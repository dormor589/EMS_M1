/**
 * /api/exams — the exam lifecycle, plus the two nested collections that hang
 * off an exam (its attempts and its submissions).
 *
 * Every route is authenticated. Reads are role-aware inside the service;
 * writes are teacher-only and additionally ownership-checked there, because a
 * role check alone would let any teacher edit any other teacher's exam.
 */

import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import requireRole from '../middleware/requireRole.js';
import validate from '../middleware/validate.js';
import { ROLES } from '../config/index.js';
import {
  createExamSchema, updateExamSchema, idParamSchema,
} from '../validation/schemas.js';
import * as exams from '../controllers/examController.js';
import * as submissions from '../controllers/submissionController.js';

const router = Router();

router.use(authenticate);

// ── Reads ────────────────────────────────────────────────────────────────────
router.get('/',    exams.list);
router.get('/:id', validate(idParamSchema, 'params'), exams.get);

// ── Writes — teacher only ────────────────────────────────────────────────────
router.post('/',
  requireRole(ROLES.TEACHER), validate(createExamSchema), exams.create);

router.put('/:id',
  requireRole(ROLES.TEACHER),
  validate(idParamSchema, 'params'), validate(updateExamSchema),
  exams.update);

router.delete('/:id',
  requireRole(ROLES.TEACHER), validate(idParamSchema, 'params'), exams.remove);

// ── State machine ────────────────────────────────────────────────────────────
router.post('/:id/publish',
  requireRole(ROLES.TEACHER), validate(idParamSchema, 'params'), exams.publish);

router.post('/:id/close',
  requireRole(ROLES.TEACHER), validate(idParamSchema, 'params'), exams.close);

// ── Nested collections ───────────────────────────────────────────────────────
router.post('/:id/attempt',
  requireRole(ROLES.STUDENT), validate(idParamSchema, 'params'),
  submissions.startAttempt);

router.get('/:id/submissions',
  requireRole(ROLES.TEACHER), validate(idParamSchema, 'params'),
  submissions.listForExam);

export default router;
