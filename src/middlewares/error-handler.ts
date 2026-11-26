import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.message, err.errors);
  }

  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return sendError(res, 400, 'Validasi gagal', formattedErrors);
  }

  // Handle Prisma Known Request Errors if necessary
  if (err.name === 'PrismaClientKnownRequestError') {
    return sendError(res, 400, 'Operasi database gagal');
  }

  // Prevent leaking stack trace in production
  const message = env.NODE_ENV === 'production' ? 'Terjadi kesalahan pada server' : err.message;
  return sendError(res, 500, message, env.NODE_ENV === 'production' ? null : err.stack);
};
