/**
 * SubmissionService tests — Milestone 2.
 *
 * The shape of taking an exam changed: an attempt is now a server-side record
 * with a deadline, rather than answers collected in React state and posted once.
 * These tests cover the attempt lifecycle and the grading contract.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import SubmissionService from '../SubmissionService.js';
import config from '../ConfigService.js';
import { makeFakeApi, apiError } from './helpers/fakeApi.js';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const examService = {};

const ATTEMPT = {
  id: 's1', examId: 'e1', status: 'in_progress',
  secondsRemaining: 1800, answers: [],
};

describe('SubmissionService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('taking an exam', () => {
    it('starts an attempt and reports the time left', async () => {
      const api = makeFakeApi({ 'POST /exams/e1/attempt': { submission: ATTEMPT } });
      const attempt = await new SubmissionService(api, examService, config, logger).startAttempt('e1');

      expect(api.calls[0]).toMatchObject({ method: 'POST', path: '/exams/e1/attempt' });
      expect(attempt.secondsRemaining).toBe(1800);
    });

    it('propagates the server refusing a second attempt', async () => {
      const api = makeFakeApi({
        'POST /exams/e1/attempt': apiError(409, 'You have already submitted this exam'),
      });
      await expect(new SubmissionService(api, examService, config, logger).startAttempt('e1'))
        .rejects.toThrow(/already submitted/);
    });

    it('autosaves answers to the attempt', async () => {
      const api = makeFakeApi({ 'PATCH /attempts/s1/draft': { submission: ATTEMPT } });
      const answers = [{ questionId: 'q1', value: '1' }];

      await new SubmissionService(api, examService, config, logger).saveDraft('s1', answers);

      expect(api.calls[0]).toEqual({
        method: 'PATCH', path: '/attempts/s1/draft', body: { answers },
      });
    });

    it('marks an automatic submission so the server waives the deadline', async () => {
      const api = makeFakeApi({
        'POST /attempts/s1/submit': { submission: { ...ATTEMPT, status: 'submitted' } },
      });
      const service = new SubmissionService(api, examService, config, logger);

      await service.submitExam('s1');
      expect(api.calls[0].body).toEqual({ auto: false });

      await service.submitExam('s1', { auto: true });
      // The countdown fired: answers were captured before expiry even though the
      // request lands after it.
      expect(api.calls[1].body).toEqual({ auto: true });
    });

    it('requires an attempt id', async () => {
      const api = makeFakeApi({});
      const service = new SubmissionService(api, examService, config, logger);

      await expect(service.saveDraft(undefined, [])).rejects.toThrow(/attemptId/);
      await expect(service.submitExam(undefined)).rejects.toThrow(/attemptId/);
    });
  });

  describe('reads', () => {
    it('lists an exam’s submissions for its teacher', async () => {
      const api = makeFakeApi({ 'GET /exams/e1/submissions': { submissions: [ATTEMPT] } });
      const list = await new SubmissionService(api, examService, config, logger)
        .getSubmissionsByExam('e1');

      expect(list).toHaveLength(1);
    });

    it('asks for "mine" rather than trusting a client-supplied student id', async () => {
      const api = makeFakeApi({ 'GET /submissions/mine': { submissions: [ATTEMPT] } });

      await new SubmissionService(api, examService, config, logger)
        .getSubmissionsByStudent('someone-elses-id');

      // Identity comes from the token, so one student cannot read another's work.
      expect(api.calls[0].path).toBe('/submissions/mine');
    });

    it('finds the caller’s submission for one exam, or null', async () => {
      const api = makeFakeApi({ 'GET /submissions/mine': { submissions: [ATTEMPT] } });
      const service = new SubmissionService(api, examService, config, logger);

      expect((await service.getSubmissionByExamAndStudent('e1'))?.id).toBe('s1');
      expect(await service.getSubmissionByExamAndStudent('other')).toBeNull();
    });

    it('returns null for a missing submission rather than throwing', async () => {
      const api = makeFakeApi({ 'GET /submissions/gone': apiError(404, 'Submission not found') });
      expect(await new SubmissionService(api, examService, config, logger)
        .getSubmissionById('gone')).toBeNull();
    });
  });

  describe('grading', () => {
    it('sends per-question scores and keeps the grade a draft by default', async () => {
      const api = makeFakeApi({
        'PATCH /submissions/s1/grade': { submission: { id: 's1', grade: 88, status: 'ai_graded' } },
      });

      await new SubmissionService(api, examService, config, logger).gradeSubmission('s1', {
        answers: [{ questionId: 'q2', score: '80', feedback: 'Clear.' }],
        feedback: 'Good work.',
      });

      const body = api.calls[0].body;
      expect(body.answers[0]).toEqual({ questionId: 'q2', score: 80, feedback: 'Clear.' });
      expect(body.publish).toBe(false);
    });

    it('omits score entirely when none was given, so it is not read as zero', async () => {
      const api = makeFakeApi({
        'PATCH /submissions/s1/grade': { submission: { id: 's1', grade: 0 } },
      });

      await new SubmissionService(api, examService, config, logger).gradeSubmission('s1', {
        answers: [{ questionId: 'q1', feedback: 'Marked from the answer key.' }],
      });

      expect(api.calls[0].body.answers[0]).not.toHaveProperty('score');
    });

    it('publishes when asked', async () => {
      const api = makeFakeApi({
        'PATCH /submissions/s1/grade': { submission: { id: 's1', status: 'graded' } },
      });

      await new SubmissionService(api, examService, config, logger)
        .gradeSubmission('s1', { answers: [], publish: true });

      expect(api.calls[0].body.publish).toBe(true);
    });

    it('releases an existing draft grade unchanged', async () => {
      const api = makeFakeApi({
        'POST /submissions/s1/publish': { submission: { id: 's1', status: 'graded' } },
      });

      const result = await new SubmissionService(api, examService, config, logger)
        .publishGrade('s1');

      expect(api.calls[0].path).toBe('/submissions/s1/publish');
      expect(result.status).toBe('graded');
    });
  });
});
