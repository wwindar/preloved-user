import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateRequest } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { authLimiter } from '../../middlewares/rate-limiter';
import { registerSchema, loginSchema, refreshTokenSchema } from './auth.validation';

const router = Router();

router.post(
  '/register',
  authLimiter,
  validateRequest(registerSchema),
  AuthController.register
);

router.post(
  '/login',
  authLimiter,
  validateRequest(loginSchema),
  AuthController.login
);

router.post(
  '/logout',
  authenticate,
  AuthController.logout
);

router.post(
  '/refresh',
  validateRequest(refreshTokenSchema),
  AuthController.refresh
);

export const authRoutes = router;
