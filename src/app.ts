import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { authRoutes } from './modules/auth/auth.routes';
import { userRouter, internalRouter } from './modules/users/user.routes';
import { errorHandler } from './middlewares/error-handler';
import { swaggerDocument } from './docs/swagger';
import { sendSuccess } from './utils/response';

export const createApp = (): Application => {
  const app = express();

  // Security headers with Helmet
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: '*', // Diatur spesifik pada environment production
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Secret'],
    })
  );

  // Body parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Swagger Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    sendSuccess(res, 200, 'User Service is healthy and running', {
      service: 'user-service',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/internal', internalRouter);

  // 404 Route Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: 'Endpoint tidak ditemukan',
      errors: null,
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};
