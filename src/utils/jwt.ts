import jwt, { SignOptions } from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env';

export interface AccessTokenPayload {
  id: string;
  username: string;
  email: string;
  role: Role;
  sessionId?: string;
}

export interface RefreshTokenPayload {
  id: string;
  sessionId: string;
}

export const generateAccessToken = (payload: AccessTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
};

export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
};

export const getRefreshTokenExpiresDate = (): Date => {
  // Parse env.JWT_REFRESH_EXPIRES_IN (e.g. "7d", "24h", "60m")
  const durationStr = env.JWT_REFRESH_EXPIRES_IN.trim();
  const match = durationStr.match(/^(\d+)([dhms])$/);
  let durationMs = 7 * 24 * 60 * 60 * 1000; // default 7 days

  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 'd':
        durationMs = value * 24 * 60 * 60 * 1000;
        break;
      case 'h':
        durationMs = value * 60 * 60 * 1000;
        break;
      case 'm':
        durationMs = value * 60 * 1000;
        break;
      case 's':
        durationMs = value * 1000;
        break;
    }
  }

  return new Date(Date.now() + durationMs);
};
