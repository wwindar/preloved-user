import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../utils/errors';

export const authorize = (allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Autentikasi diperlukan', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Anda tidak memiliki akses ke sumber daya ini', 403));
    }

    next();
  };
};
