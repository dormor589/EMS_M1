/**
 * /api/analytics — teacher-only statistics.
 */

import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import requireRole from '../middleware/requireRole.js';
import validate from '../middleware/validate.js';
import { ROLES } from '../config/index.js';
import { idParamSchema } from '../validation/schemas.js';
import * as analytics from '../controllers/analyticsController.js';

const router = Router();

router.use(authenticate, requireRole(ROLES.TEACHER));

router.get('/overview', analytics.overview);
router.get('/exams/:id', validate(idParamSchema, 'params'), analytics.forExam);

export default router;
