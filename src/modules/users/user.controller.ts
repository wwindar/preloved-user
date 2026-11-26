import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { sendSuccess } from '../../utils/response';

export class UserController {
  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UserService.getMe(req.user!.id);
      sendSuccess(res, 200, 'Berhasil mengambil profil pengguna', { user });
    } catch (error) {
      next(error);
    }
  }

  static async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updatedProfile = await UserService.updateMe(req.user!.id, req.body);
      sendSuccess(res, 200, 'Profil berhasil diperbarui', { profile: updatedProfile });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await UserService.changePassword(req.user!.id, req.sessionId, req.body);
      sendSuccess(res, 200, 'Password berhasil diubah. Sesi lain telah dicabut.');
    } catch (error) {
      next(error);
    }
  }

  static async getInternalUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const user = await UserService.getInternalUserById(targetId);
      sendSuccess(res, 200, 'Data pengguna internal berhasil diambil', { user });
    } catch (error) {
      next(error);
    }
  }
}
