import { Router } from 'express';
import { UserController } from './user.controller';
import { authenticate } from '../../middlewares/authenticate';
import { validateRequest } from '../../middlewares/validate';
import { requireInternalAuth } from '../../middlewares/internal-auth';
import {
  updateProfileSchema,
  changePasswordSchema,
  getUserByIdParamSchema,
} from './user.validation';

const userRouter = Router();

// User endpoints (requires bearer token)
userRouter.get('/me', authenticate, UserController.getMe);
userRouter.patch(
  '/me',
  authenticate,
  validateRequest(updateProfileSchema),
  UserController.updateMe
);
userRouter.patch(
  '/me/password',
  authenticate,
  validateRequest(changePasswordSchema),
  UserController.changePassword
);

// Internal routes (inter-service communication)
const internalRouter = Router();
internalRouter.get(
  '/users/:id',
  requireInternalAuth,
  validateRequest(getUserByIdParamSchema),
  UserController.getInternalUserById
);

export { userRouter, internalRouter };
