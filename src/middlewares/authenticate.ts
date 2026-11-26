import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token autentikasi tidak ditemukan atau format salah', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('Token autentikasi tidak ditemukan', 401);
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Access token telah kedaluwarsa', 401);
      }
      throw new AppError('Access token tidak valid', 401);
    }

    // Check if user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, username: true, email: true, role: true, isActive: true },
    });

    if (!user) {
      throw new AppError('Pengguna tidak ditemukan', 401);
    }

    if (!user.isActive) {
      throw new AppError('Akun pengguna telah dinonaktifkan', 403);
    }

    // If token contains sessionId, check if that session was revoked
    if (payload.sessionId) {
      const session = await prisma.authSession.findUnique({
        where: { id: payload.sessionId },
      });

      if (!session || session.revokedAt !== null || session.expiresAt < new Date()) {
        throw new AppError('Sesi autentikasi telah dicabut atau kedaluwarsa', 401);
      }

      req.sessionId = payload.sessionId;
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};
