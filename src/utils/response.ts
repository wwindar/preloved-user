import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any;
}

export const sendSuccess = <T>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T
): Response => {
  const responseBody: ApiResponse<T> = {
    success: true,
    message,
    ...(data !== undefined && { data }),
  };
  return res.status(statusCode).json(responseBody);
};

export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  errors: any = null
): Response => {
  const responseBody: ApiResponse = {
    success: false,
    message,
    errors,
  };
  return res.status(statusCode).json(responseBody);
};
