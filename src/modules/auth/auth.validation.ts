import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    username: z
      .string()
      .min(3, 'Username minimal 3 karakter')
      .max(30, 'Username maksimal 30 karakter')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username hanya boleh berisi huruf, angka, dan underscore'),
    email: z
      .string()
      .email('Format email tidak valid')
      .max(255, 'Email terlalu panjang'),
    password: z
      .string()
      .min(8, 'Password minimal 8 karakter'),
    fullName: z
      .string()
      .min(2, 'Nama lengkap minimal 2 karakter')
      .max(100, 'Nama lengkap maksimal 100 karakter'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    identifier: z
      .string()
      .min(1, 'Identifier (username atau email) wajib diisi'),
    password: z
      .string()
      .min(1, 'Password wajib diisi'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z
      .string()
      .min(1, 'Refresh token wajib dikirim'),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];
