import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z
    .object({
      fullName: z
        .string()
        .min(2, 'Nama lengkap minimal 2 karakter')
        .max(100, 'Nama lengkap maksimal 100 karakter')
        .optional(),
      phoneNumber: z
        .string()
        .max(20, 'Nomor telepon maksimal 20 digit')
        .regex(/^[0-9+\-\s()]*$/, 'Format nomor telepon tidak valid')
        .optional()
        .nullable(),
      profilePicture: z
        .string()
        .url('URL foto profil tidak valid')
        .max(500, 'URL foto profil terlalu panjang')
        .optional()
        .nullable(),
      bio: z
        .string()
        .max(1000, 'Bio maksimal 1000 karakter')
        .optional()
        .nullable(),
      address: z
        .string()
        .max(1000, 'Alamat maksimal 1000 karakter')
        .optional()
        .nullable(),
    })
    .strict('Field tidak diizinkan untuk diubah'),
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z
        .string()
        .min(1, 'Password saat ini wajib diisi'),
      newPassword: z
        .string()
        .min(8, 'Password baru minimal 8 karakter'),
    })
    .strict(),
});

export const getUserByIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID pengguna harus berupa format UUID yang valid'),
  }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
