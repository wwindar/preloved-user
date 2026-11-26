import { prisma } from '../../config/database';
import { hashPassword, comparePassword, hashToken } from '../../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiresDate,
} from '../../utils/jwt';
import { AppError } from '../../utils/errors';
import { RegisterInput, LoginInput } from './auth.validation';

export class AuthService {
  static async register(data: RegisterInput) {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email.toLowerCase() },
          { username: data.username.toLowerCase() },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email.toLowerCase() === data.email.toLowerCase()) {
        throw new AppError('Email sudah terdaftar', 409);
      }
      if (existingUser.username.toLowerCase() === data.username.toLowerCase()) {
        throw new AppError('Username sudah digunakan', 409);
      }
    }

    const hashedPassword = await hashPassword(data.password);

    // Database transaction to ensure atomic creation of User and UserProfile
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username: data.username.toLowerCase(),
          email: data.email.toLowerCase(),
          passwordHash: hashedPassword,
          role: 'USER',
          isActive: true,
          profile: {
            create: {
              fullName: data.fullName,
            },
          },
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          profile: {
            select: {
              id: true,
              fullName: true,
              phoneNumber: true,
              profilePicture: true,
              bio: true,
              address: true,
            },
          },
        },
      });

      return newUser;
    });

    return result;
  }

  static async login(data: LoginInput) {
    const identifier = data.identifier.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      include: {
        profile: true,
      },
    });

    // Timing-safe or generic error without leaking which field failed
    if (!user) {
      throw new AppError('Email/username atau password salah', 401);
    }

    if (!user.isActive) {
      throw new AppError('Akun dinonaktifkan. Silakan hubungi customer support', 403);
    }

    const isPasswordValid = await comparePassword(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Email/username atau password salah', 401);
    }

    // Create session record first to get session ID
    const expiresAt = getRefreshTokenExpiresDate();
    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: '', // temporarily empty, updated right below
        expiresAt,
      },
    });

    const accessToken = generateAccessToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });

    const refreshToken = generateRefreshToken({
      id: user.id,
      sessionId: session.id,
    });

    // Update session with hashed refresh token
    await prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: hashToken(refreshToken),
      },
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  static async logout(userId: string, sessionId?: string) {
    if (sessionId) {
      await prisma.authSession.updateMany({
        where: {
          id: sessionId,
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    } else {
      await prisma.authSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    return true;
  }

  static async refreshToken(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Refresh token telah kedaluwarsa', 401);
      }
      throw new AppError('Refresh token tidak valid', 401);
    }

    const tokenHash = hashToken(refreshToken);

    const session = await prisma.authSession.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.id,
      },
      include: {
        user: true,
      },
    });

    if (!session) {
      throw new AppError('Sesi autentikasi tidak ditemukan', 401);
    }

    // Check if session has been revoked
    if (session.revokedAt !== null) {
      throw new AppError('Refresh token telah dicabut', 401);
    }

    // Check token hash matches
    if (session.refreshTokenHash !== tokenHash) {
      // Possible token reuse attack! Revoke all sessions for this user for security
      await prisma.authSession.updateMany({
        where: { userId: session.userId },
        data: { revokedAt: new Date() },
      });
      throw new AppError('Anomali refresh token terdeteksi. Sesi dicabut demi keamanan', 401);
    }

    // Check session expiry
    if (session.expiresAt < new Date()) {
      throw new AppError('Sesi autentikasi telah kedaluwarsa', 401);
    }

    // Check user is active
    if (!session.user.isActive) {
      throw new AppError('Akun pengguna telah dinonaktifkan', 403);
    }

    // Implement Refresh Token Rotation
    // Revoke old session and create new session in transaction
    const newExpiresAt = getRefreshTokenExpiresDate();

    const newTokens = await prisma.$transaction(async (tx) => {
      // 1. Revoke old session
      await tx.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      // 2. Create new session
      const newSession = await tx.authSession.create({
        data: {
          userId: session.userId,
          refreshTokenHash: '',
          expiresAt: newExpiresAt,
        },
      });

      const newAccessToken = generateAccessToken({
        id: session.user.id,
        username: session.user.username,
        email: session.user.email,
        role: session.user.role,
        sessionId: newSession.id,
      });

      const newRefreshToken = generateRefreshToken({
        id: session.user.id,
        sessionId: newSession.id,
      });

      await tx.authSession.update({
        where: { id: newSession.id },
        data: {
          refreshTokenHash: hashToken(newRefreshToken),
        },
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    });

    return newTokens;
  }
}
