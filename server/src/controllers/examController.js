/**
 * examController — HTTP layer for the exam lifecycle.
 */

import asyncHandler from '../utils/asyncHandler.js';
import ExamService from '../services/ExamService.js';

const exams = new ExamService();

/** GET /api/exams — role-aware: own exams for a teacher, published for a student. */
export const list = asyncHandler(async (req, res) => {
  res.json({ exams: await exams.list(req.user) });
});

/** GET /api/exams/:id */
export const get = asyncHandler(async (req, res) => {
  res.json({ exam: await exams.get(req.params.id, req.user) });
});

/** POST /api/exams */
export const create = asyncHandler(async (req, res) => {
  res.status(201).json({ exam: await exams.create(req.body, req.user) });
});

/**
 * PUT /api/exams/:id
 *
 * Takes the whole exam. The repository reconciles the question rows rather than
 * replacing them, so ids survive and existing answers stay attached.
 * `regradeRequired` reports how many submissions the edit invalidated.
 */
export const update = asyncHandler(async (req, res) => {
  const { exam, regradeRequired } = await exams.update(req.params.id, req.body, req.user);
  res.json({ exam, regradeRequired });
});

/** POST /api/exams/:id/publish */
export const publish = asyncHandler(async (req, res) => {
  res.json({ exam: await exams.changeStatus(req.params.id, 'Published', req.user) });
});

/** POST /api/exams/:id/close */
export const close = asyncHandler(async (req, res) => {
  res.json({ exam: await exams.changeStatus(req.params.id, 'Closed', req.user) });
});

/** DELETE /api/exams/:id */
export const remove = asyncHandler(async (req, res) => {
  res.json(await exams.remove(req.params.id, req.user));
});
