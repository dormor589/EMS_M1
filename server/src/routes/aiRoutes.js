/**
 * /api/ai — exam generation and provider status.
 *
 * Generation is rate limited separately from the rest of the API: it is the one
 * endpoint that costs a third-party call per request, so it is the one worth
 * protecting from a loop or an impatient click.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authenticate from '../middleware/authenticate.js';
import requireRole from '../middleware/requireRole.js';
import validate from '../middleware/validate.js';
import config, { ROLES } from '../config/index.js';
import { generateExamSchema } from '../validation/schemas.js';
import * as ai from '../controllers/aiController.js';

const router = Router();

router.use(authenticate);

const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many generation requests. Please wait a moment.' },
  // See authRoutes: skipped under test so the suite is not rate limited.
  skip: () => config.env === 'test',
});

router.get('/status', ai.status);

router.post('/exams/generate',
  requireRole(ROLES.TEACHER), generateLimiter, validate(generateExamSchema),
  ai.generateExam);

export default router;
