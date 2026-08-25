/**
 * /api/auth — registration, login, identity.
 *
 * The two unauthenticated endpoints are the system's only public write surface,
 * so both sit behind a rate limiter: without one, login is an open door for
 * credential stuffing.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import validate from '../middleware/validate.js';
import authenticate from '../middleware/authenticate.js';
import config from '../config/index.js';
import { registerSchema, loginSchema } from '../validation/schemas.js';
import * as controller from '../controllers/authController.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
  // The integration suite logs in dozens of times in a few seconds, which is
  // exactly the pattern this limiter exists to stop. Skipping it under test
  // keeps the protection intact everywhere else rather than weakening the
  // limit to a value that would not actually protect anything.
  skip: () => config.env === 'test',
});

router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login',    authLimiter, validate(loginSchema),    controller.login);
router.get('/me',        authenticate,                          controller.me);

export default router;
