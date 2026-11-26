import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

export const requireInternalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const secretHeader = req.headers['x-internal-secret'];

  if (!secretHeader || secretHeader !== env.INTERNAL_SERVICE_SECRET) {
    return next(
      new AppError('Akses ditolak: Autentikasi internal service tidak valid', 401)
    );
  }

  next();
};
