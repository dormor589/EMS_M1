/**
 * /api/submissions — reading submissions, and grading them.
 */

import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import requireRole from '../middleware/requireRole.js';
import validate from '../middleware/validate.js';
import { ROLES } from '../config/index.js';
import { gradeSchema, idParamSchema } from '../validation/schemas.js';
import * as submissions from '../controllers/submissionController.js';
import * as ai from '../controllers/aiController.js';

const router = Router();

router.use(authenticate);

// Declared before '/:id' so 'mine' is not captured as an id.
router.get('/mine', requireRole(ROLES.STUDENT), submissions.listMine);

// Role-aware: full detail for the owning teacher, student-safe for its author.
router.get('/:id', validate(idParamSchema, 'params'), submissions.get);

router.patch('/:id/grade',
  requireRole(ROLES.TEACHER),
  validate(idParamSchema, 'params'), validate(gradeSchema),
  submissions.saveGrade);

router.post('/:id/ai-grade',
  requireRole(ROLES.TEACHER), validate(idParamSchema, 'params'),
  ai.gradeSubmission);

router.post('/:id/publish',
  requireRole(ROLES.TEACHER), validate(idParamSchema, 'params'),
  submissions.publishGrade);

export default router;
