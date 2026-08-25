/**
 * /api/attempts — a student acting on their own in-progress attempt.
 *
 * Separate from /api/exams because these operate on the attempt itself, not on
 * the exam. Ownership is checked in the service: a student can only reach an
 * attempt they authored.
 */

import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import requireRole from '../middleware/requireRole.js';
import validate from '../middleware/validate.js';
import { ROLES } from '../config/index.js';
import { draftSchema, submitSchema, idParamSchema } from '../validation/schemas.js';
import * as submissions from '../controllers/submissionController.js';

const router = Router();

router.use(authenticate, requireRole(ROLES.STUDENT));

router.patch('/:id/draft',
  validate(idParamSchema, 'params'), validate(draftSchema), submissions.saveDraft);

router.post('/:id/submit',
  validate(idParamSchema, 'params'), validate(submitSchema), submissions.submit);

export default router;
