/**
 * submissionController — HTTP layer for taking an exam and grading it.
 */

import asyncHandler from '../utils/asyncHandler.js';
import SubmissionService from '../services/SubmissionService.js';

const submissions = new SubmissionService();

// ── Student: taking an exam ──────────────────────────────────────────────────

/**
 * POST /api/exams/:id/attempt
 *
 * Starts the attempt, or returns the one already in progress with its original
 * deadline — so refreshing the page cannot reset the clock.
 */
export const startAttempt = asyncHandler(async (req, res) => {
  res.status(201).json({ submission: await submissions.startAttempt(req.params.id, req.user) });
});

/** PATCH /api/attempts/:id/draft — autosave. */
export const saveDraft = asyncHandler(async (req, res) => {
  const submission = await submissions.saveDraft(req.params.id, req.body.answers, req.user);
  res.json({ submission });
});

/** POST /api/attempts/:id/submit */
export const submit = asyncHandler(async (req, res) => {
  const submission = await submissions.submit(req.params.id, req.user, { auto: req.body.auto });
  res.json({ submission });
});

// ── Reading ──────────────────────────────────────────────────────────────────

/** GET /api/exams/:id/submissions — the exam owner only. */
export const listForExam = asyncHandler(async (req, res) => {
  res.json({ submissions: await submissions.listForExam(req.params.id, req.user) });
});

/** GET /api/submissions/mine — the calling student's own. */
export const listMine = asyncHandler(async (req, res) => {
  res.json({ submissions: await submissions.listForStudent(req.user) });
});

/** GET /api/submissions/:id */
export const get = asyncHandler(async (req, res) => {
  res.json({ submission: await submissions.get(req.params.id, req.user) });
});

// ── Teacher: grading ─────────────────────────────────────────────────────────

/**
 * PATCH /api/submissions/:id/grade
 *
 * Saves per-question scores and recomputes the overall grade. With
 * `publish: false` the result is a teacher-only draft; with `publish: true` it
 * is released to the student in the same call.
 */
export const saveGrade = asyncHandler(async (req, res) => {
  res.json({ submission: await submissions.saveGrade(req.params.id, req.body, req.user) });
});

/** POST /api/submissions/:id/publish — release an existing draft grade unchanged. */
export const publishGrade = asyncHandler(async (req, res) => {
  res.json({ submission: await submissions.publishGrade(req.params.id, req.user) });
});
