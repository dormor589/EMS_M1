/**
 * ExamService tests — Milestone 2.
 *
 * The exam state machine now lives on the server, so these tests assert the
 * HTTP contract this class is responsible for: correct endpoints, and correct
 * translation of the form's shapes into what the API validates.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import ExamService from '../ExamService.js';
import config from '../ConfigService.js';
import { makeFakeApi, apiError } from './helpers/fakeApi.js';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const EXAMS = [
  { id: 'e1', title: 'Published One', status: 'Published', createdBy: 't1' },
  { id: 'e2', title: 'Draft One',     status: 'Draft',     createdBy: 't1' },
  { id: 'e3', title: 'Someone Else',  status: 'Published', createdBy: 't2' },
];

describe('ExamService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('reads', () => {
    it('gets the list from /exams', async () => {
      const api = makeFakeApi({ 'GET /exams': { exams: EXAMS } });
      const exams = await new ExamService(api, config, logger).getAllExams();

      expect(api.calls[0].path).toBe('/exams');
      expect(exams).toHaveLength(3);
    });

    it('filters published exams', async () => {
      const api = makeFakeApi({ 'GET /exams': { exams: EXAMS } });
      const published = await new ExamService(api, config, logger).getPublishedExams();

      expect(published.map((e) => e.id)).toEqual(['e1', 'e3']);
    });

    it('filters by teacher', async () => {
      const api = makeFakeApi({ 'GET /exams': { exams: EXAMS } });
      const mine = await new ExamService(api, config, logger).getExamsByTeacher('t1');

      expect(mine.map((e) => e.id)).toEqual(['e1', 'e2']);
    });

    it('requires a teacher id', async () => {
      const api = makeFakeApi({});
      await expect(new ExamService(api, config, logger).getExamsByTeacher())
        .rejects.toThrow(/teacherId/);
    });

    it('returns null for a missing exam rather than throwing', async () => {
      // The pages rely on this: they branch on `if (!exam)`.
      const api = makeFakeApi({ 'GET /exams/gone': apiError(404, 'Exam not found') });
      expect(await new ExamService(api, config, logger).getExamById('gone')).toBeNull();
    });

    it('still propagates errors that are not 404', async () => {
      const api = makeFakeApi({ 'GET /exams/e1': apiError(403, 'Forbidden') });
      await expect(new ExamService(api, config, logger).getExamById('e1'))
        .rejects.toThrow('Forbidden');
    });
  });

  describe('create', () => {
    it('coerces the form’s strings into the shapes the API validates', async () => {
      const api = makeFakeApi({ 'POST /exams': { exam: { id: 'new' } } });

      await new ExamService(api, config, logger).createExam({
        title: 'Maths',
        durationMinutes: '45',          // a form gives strings
        questions: [{
          type: 'multiple-choice',
          text: '2+2?',
          options: ['3', '4', ''],      // trailing blank left by the editor
          correctAnswer: '1',
          points: 20,                   // M1 called weight "points"
        }],
      });

      const body = api.calls[0].body;
      expect(body.durationMinutes).toBe(45);
      expect(body.questions[0].correctAnswer).toBe(1);
      expect(body.questions[0].weight).toBe(20);
      // Blank options are dropped, or the API would reject them.
      expect(body.questions[0].options).toEqual(['3', '4']);
    });

    it('sends no correctAnswer for an open-text question', async () => {
      const api = makeFakeApi({ 'POST /exams': { exam: { id: 'new' } } });

      await new ExamService(api, config, logger).createExam({
        title: 'Essay', durationMinutes: 30,
        questions: [{ type: 'open-text', text: 'Discuss.', weight: 100 }],
      });

      expect(api.calls[0].body.questions[0].correctAnswer).toBeNull();
      expect(api.calls[0].body.questions[0].options).toEqual([]);
    });
  });

  describe('update', () => {
    it('strips fields the API will not accept', async () => {
      const api = makeFakeApi({ 'PUT /exams/e1': { exam: { id: 'e1' }, regradeRequired: 0 } });

      await new ExamService(api, config, logger).updateExam('e1', {
        title: 'New title',
        status: 'Published',   // publish/close own the lifecycle, not update
        id: 'e1',
        createdAt: 'whenever',
      });

      const body = api.calls[0].body;
      expect(body.title).toBe('New title');
      expect(body).not.toHaveProperty('status');
      expect(body).not.toHaveProperty('id');
      expect(body).not.toHaveProperty('createdAt');
    });

    it('keeps a question id, so the server updates rather than re-creates', async () => {
      const api = makeFakeApi({ 'PUT /exams/e1': { exam: { id: 'e1' }, regradeRequired: 0 } });

      await new ExamService(api, config, logger).updateExam('e1', {
        questions: [
          { id: 'q1', type: 'open-text', text: 'Existing', weight: 50 },
          { type: 'open-text', text: 'Brand new', weight: 50 },
        ],
      });

      const [existing, added] = api.calls[0].body.questions;
      // Keeping the id is what stops the answers being cascade-deleted.
      expect(existing.id).toBe('q1');
      expect(added).not.toHaveProperty('id');
    });

    it('surfaces how many submissions the edit invalidated', async () => {
      const api = makeFakeApi({ 'PUT /exams/e1': { exam: { id: 'e1' }, regradeRequired: 3 } });
      const result = await new ExamService(api, config, logger).updateExam('e1', { title: 'x' });

      expect(result.regradeRequired).toBe(3);
    });
  });

  describe('lifecycle', () => {
    it('publishes and closes through their own endpoints', async () => {
      const api = makeFakeApi({
        'POST /exams/e1/publish': { exam: { id: 'e1', status: 'Published' } },
        'POST /exams/e1/close':   { exam: { id: 'e1', status: 'Closed' } },
      });
      const service = new ExamService(api, config, logger);

      expect((await service.publishExam('e1')).status).toBe('Published');
      expect((await service.closeExam('e1')).status).toBe('Closed');
    });

    it('propagates an illegal transition rejected by the server', async () => {
      const api = makeFakeApi({
        'POST /exams/e1/close': apiError(409, 'Cannot move an exam from Draft to Closed'),
      });
      await expect(new ExamService(api, config, logger).closeExam('e1'))
        .rejects.toThrow(/Cannot move an exam/);
    });

    it('reports what a delete cascaded to', async () => {
      const api = makeFakeApi({ 'DELETE /exams/e1': { deletedSubmissions: 4 } });
      const result = await new ExamService(api, config, logger).deleteExam('e1');

      expect(result.deletedSubmissions).toBe(4);
    });
  });
});
