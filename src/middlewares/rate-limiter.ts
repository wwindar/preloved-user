import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/response';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    return sendError(
      res,
      429,
      'Terlalu banyak permintaan dari alamat IP ini, silakan coba lagi beberapa saat kemudian'
    );
  },
});
