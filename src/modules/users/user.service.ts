import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { comparePassword, hashPassword } from '../../utils/password';
import { UpdateProfileInput, ChangePasswordInput } from './user.validation';

export class UserService {
  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            profilePicture: true,
            bio: true,
            address: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('Pengguna tidak ditemukan', 404);
    }

    return user;
  }

  static async updateMe(userId: string, data: UpdateProfileInput) {
    // Prevent mass assignment and only update sent fields
    const updateData: {
      fullName?: string;
      phoneNumber?: string | null;
      profilePicture?: string | null;
      bio?: string | null;
      address?: string | null;
    } = {};

    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
    if (data.profilePicture !== undefined) updateData.profilePicture = data.profilePicture;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.address !== undefined) updateData.address = data.address;

    if (Object.keys(updateData).length === 0) {
      throw new AppError('Tidak ada data profil yang dikirim untuk diperbarui', 400);
    }

    const updatedProfile = await prisma.userProfile.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        fullName: updateData.fullName || '',
        phoneNumber: updateData.phoneNumber,
        profilePicture: updateData.profilePicture,
        bio: updateData.bio,
        address: updateData.address,
      },
      select: {
        id: true,
        userId: true,
        fullName: true,
        phoneNumber: true,
        profilePicture: true,
        bio: true,
        address: true,
        updatedAt: true,
      },
    });

    return updatedProfile;
  }

  static async changePassword(
    userId: string,
    currentSessionId: string | undefined,
    data: ChangePasswordInput
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('Pengguna tidak ditemukan', 404);
    }

    const isCurrentPasswordCorrect = await comparePassword(
      data.currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordCorrect) {
      throw new AppError('Password saat ini tidak valid', 400);
    }

    if (data.currentPassword === data.newPassword) {
      throw new AppError('Password baru tidak boleh sama dengan password saat ini', 400);
    }

    const newPasswordHash = await hashPassword(data.newPassword);

    await prisma.$transaction(async (tx) => {
      // 1. Update password
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

      // 2. Revoke other sessions (or all previous sessions)
      await tx.authSession.updateMany({
        where: {
          userId,
          ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    });

    return true;
  }

  static async getInternalUserById(targetUserId: string) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
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

    if (!user) {
      throw new AppError('Pengguna tidak ditemukan', 404);
    }

    return user;
  }
}
