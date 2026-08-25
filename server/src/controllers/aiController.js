/**
 * aiController — HTTP layer for the AI features.
 */

import asyncHandler from '../utils/asyncHandler.js';
import AiService from '../services/AiService.js';
import SubmissionService from '../services/SubmissionService.js';

const ai = new AiService();
const submissions = new SubmissionService();

/**
 * GET /api/ai/status
 *
 * Reports which provider is configured and whether a real model is behind it.
 * The UI uses this to badge generated content honestly rather than implying a
 * model was involved when the fallback answered.
 */
export const status = asyncHandler(async (_req, res) => {
  res.json(ai.status());
});

/**
 * POST /api/ai/exams/generate
 *
 * Returns a DRAFT exam for the teacher to review. Nothing is saved: the teacher
 * edits what comes back and creates it themselves, because a generated answer
 * key can be confidently wrong in a way no validation can catch.
 */
export const generateExam = asyncHandler(async (req, res) => {
  const result = await ai.generateExam(req.body);
  res.json(result);
});

/**
 * POST /api/submissions/:id/ai-grade
 *
 * Marks the submission and leaves it as a teacher-only draft.
 */
export const gradeSubmission = asyncHandler(async (req, res) => {
  res.json(await submissions.aiGrade(req.params.id, req.user));
});
