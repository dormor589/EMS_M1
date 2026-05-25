/**
 * ExamService unit tests.
 *
 * Uses real StorageService (jsdom localStorage, cleared between tests) and
 * real ConfigService / LoggerService singletons, with a fresh MockApiService
 * and ExamService per describe-group to avoid state bleed.
 *
 * Covers:
 *   - Constructor validation
 *   - createExam: happy path + validation rejections
 *   - getAllExams / getPublishedExams / getExamsByTeacher
 *   - getExamById: found + not found
 *   - publishExam: Draft → Published; invalid transitions reject
 *   - closeExam:  Published → Closed; invalid transitions reject
 *   - updateExam: partial update; status field is stripped
 *   - deleteExam: removes the record
 *
 * Source: the milestone brief §8 — ExamService
 * Source: the milestone brief §5.1 — exam status state machine
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MockApiService from '../MockApiService.js';
import ExamService    from '../ExamService.js';
import storage from '../StorageService.js';
import config  from '../ConfigService.js';
import logger  from '../LoggerService.js';

// Silence logger console output during tests.
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Create a fresh, wired ExamService backed by a fresh MockApiService. */
function mkService() {
  const api = new MockApiService(storage, config, logger);
  return new ExamService(api, config, logger);
}

/** Minimal valid createExam payload. */
const BASE_EXAM = {
  title:           'Test Exam',
  description:     'A description',
  durationMinutes: 30,
  createdBy:       'teacher-uuid-001',
  questions:       [],
};

// ── Constructor validation ────────────────────────────────────────────────────

describe('ExamService constructor', () => {
  it('throws when mockApi is missing', () => {
    expect(() => new ExamService(null, config, logger)).toThrow(/mockApi/);
  });

  it('throws when config is missing', () => {
    const api = new MockApiService(storage, config, logger);
    expect(() => new ExamService(api, null, logger)).toThrow(/config/);
  });

  it('throws when logger is missing', () => {
    const api = new MockApiService(storage, config, logger);
    expect(() => new ExamService(api, config, null)).toThrow(/logger/);
  });
});

// ── createExam ────────────────────────────────────────────────────────────────

describe('ExamService.createExam', () => {
  it('persists an exam with status Draft', async () => {
    const svc   = mkService();
    const exam  = await svc.createExam(BASE_EXAM);

    expect(exam.status).toBe('Draft');
    expect(exam.title).toBe('Test Exam');
    expect(exam.createdBy).toBe('teacher-uuid-001');
  });

  it('assigns a UUID id and createdAt', async () => {
    const svc  = mkService();
    const exam = await svc.createExam(BASE_EXAM);

    expect(exam.id).toBeTruthy();
    expect(typeof exam.id).toBe('string');
    expect(exam.createdAt).toBeTruthy();
  });

  it('assigns id and examId to each question', async () => {
    const svc = mkService();
    const exam = await svc.createExam({
      ...BASE_EXAM,
      questions: [
        { type: 'open-text', text: 'Explain X', options: [], correctAnswer: '', points: 2 },
      ],
    });

    expect(exam.questions).toHaveLength(1);
    expect(exam.questions[0].id).toBeTruthy();
    expect(exam.questions[0].examId).toBe(exam.id);
  });

  it('rejects when title is empty string', async () => {
    const svc = mkService();
    await expect(svc.createExam({ ...BASE_EXAM, title: '' })).rejects.toThrow(/title/i);
  });

  it('rejects when title is whitespace only', async () => {
    const svc = mkService();
    await expect(svc.createExam({ ...BASE_EXAM, title: '   ' })).rejects.toThrow(/title/i);
  });

  it('rejects when createdBy is missing', async () => {
    const svc = mkService();
    await expect(svc.createExam({ ...BASE_EXAM, createdBy: '' })).rejects.toThrow(/createdBy/i);
  });

  it('rejects when durationMinutes is 0', async () => {
    const svc = mkService();
    await expect(
      svc.createExam({ ...BASE_EXAM, durationMinutes: 0 })
    ).rejects.toThrow(/durationMinutes/i);
  });

  it('rejects when durationMinutes is negative', async () => {
    const svc = mkService();
    await expect(
      svc.createExam({ ...BASE_EXAM, durationMinutes: -5 })
    ).rejects.toThrow(/durationMinutes/i);
  });

  it('creates with an empty questions array (teacher adds questions later)', async () => {
    const svc  = mkService();
    const exam = await svc.createExam({ ...BASE_EXAM, questions: undefined });
    expect(exam.questions).toEqual([]);
  });
});

// ── getAllExams ───────────────────────────────────────────────────────────────

describe('ExamService.getAllExams', () => {
  it('returns an empty array when no exams exist', async () => {
    const svc   = mkService();
    const exams = await svc.getAllExams();
    expect(exams).toEqual([]);
  });

  it('returns all exams regardless of status', async () => {
    const svc = mkService();
    await svc.createExam({ ...BASE_EXAM, title: 'E1' });
    const e2 = await svc.createExam({ ...BASE_EXAM, title: 'E2' });
    await svc.publishExam(e2.id);

    const exams = await svc.getAllExams();
    expect(exams).toHaveLength(2);
  });
});

// ── getPublishedExams ─────────────────────────────────────────────────────────

describe('ExamService.getPublishedExams', () => {
  it('returns only Published exams', async () => {
    const svc   = mkService();
    const draft = await svc.createExam({ ...BASE_EXAM, title: 'Draft Exam' });
    const pub   = await svc.createExam({ ...BASE_EXAM, title: 'Published Exam' });
    await svc.publishExam(pub.id);

    const results = await svc.getPublishedExams();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(pub.id);
    expect(results.some((e) => e.id === draft.id)).toBe(false);
  });

  it('returns empty when no exams are published', async () => {
    const svc = mkService();
    await svc.createExam(BASE_EXAM);
    const results = await svc.getPublishedExams();
    expect(results).toHaveLength(0);
  });
});

// ── getExamsByTeacher ─────────────────────────────────────────────────────────

describe('ExamService.getExamsByTeacher', () => {
  it('returns only exams created by the specified teacher', async () => {
    const svc = mkService();
    await svc.createExam({ ...BASE_EXAM, createdBy: 'teacher-A' });
    await svc.createExam({ ...BASE_EXAM, createdBy: 'teacher-B' });

    const results = await svc.getExamsByTeacher('teacher-A');
    expect(results).toHaveLength(1);
    expect(results[0].createdBy).toBe('teacher-A');
  });

  it('returns empty when teacher has no exams', async () => {
    const svc = mkService();
    await svc.createExam({ ...BASE_EXAM, createdBy: 'teacher-B' });
    const results = await svc.getExamsByTeacher('teacher-A');
    expect(results).toHaveLength(0);
  });

  it('throws when teacherId is missing', async () => {
    const svc = mkService();
    await expect(svc.getExamsByTeacher('')).rejects.toThrow(/teacherId/i);
  });
});

// ── getExamById ───────────────────────────────────────────────────────────────

describe('ExamService.getExamById', () => {
  it('returns the exam when found', async () => {
    const svc  = mkService();
    const exam = await svc.createExam(BASE_EXAM);
    const found = await svc.getExamById(exam.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(exam.id);
  });

  it('returns null when exam does not exist', async () => {
    const svc  = mkService();
    const found = await svc.getExamById('non-existent-id');
    expect(found).toBeNull();
  });

  it('throws when id is missing', async () => {
    const svc = mkService();
    await expect(svc.getExamById('')).rejects.toThrow(/id/i);
  });
});

// ── publishExam ───────────────────────────────────────────────────────────────

describe('ExamService.publishExam', () => {
  it('transitions a Draft exam to Published', async () => {
    const svc  = mkService();
    const exam = await svc.createExam(BASE_EXAM);
    expect(exam.status).toBe('Draft');

    const published = await svc.publishExam(exam.id);
    expect(published.status).toBe('Published');
  });

  it('persists Published status (getExamById returns Published)', async () => {
    const svc  = mkService();
    const exam = await svc.createExam(BASE_EXAM);
    await svc.publishExam(exam.id);

    const reloaded = await svc.getExamById(exam.id);
    expect(reloaded.status).toBe('Published');
  });

  it('throws Invalid status transition when exam is already Published', async () => {
    const svc  = mkService();
    const exam = await svc.createExam(BASE_EXAM);
    await svc.publishExam(exam.id);

    await expect(svc.publishExam(exam.id)).rejects.toThrow(
      /Invalid status transition: Published → Published/
    );
  });

  it('throws Invalid status transition when exam is Closed', async () => {
    const svc  = mkService();
    const exam = await svc.createExam(BASE_EXAM);
    await svc.publishExam(exam.id);
    await svc.closeExam(exam.id);

    await expect(svc.publishExam(exam.id)).rejects.toThrow(
      /Invalid status transition: Closed → Published/
    );
  });

  it('throws when id is missing', async () => {
    const svc = mkService();
    await expect(svc.publishExam('')).rejects.toThrow(/id/i);
  });
});

// ── closeExam ─────────────────────────────────────────────────────────────────

describe('ExamService.closeExam', () => {
  it('transitions a Published exam to Closed', async () => {
    const svc  = mkService();
    const exam = await svc.createExam(BASE_EXAM);
    await svc.publishExam(exam.id);

    const closed = await svc.closeExam(exam.id);
    expect(closed.status).toBe('Closed');
  });

  it('persists Closed status', async () => {
    const svc  = mkService();
    const exam = await svc.createExam(BASE_EXAM);
    await svc.publishExam(exam.id);
    await svc.closeExam(exam.id);

    const reloaded = await svc.getExamById(exam.id);
    expect(reloaded.status).toBe('Closed');
  });

  it('throws Invalid status transition Draft → Closed', async () => {
    const svc  = mkService();
    const exam = await svc.createExam(BASE_EXAM);

    await expect(svc.closeExam(exam.id)).rejects.toThrow(
      /Invalid status transition: Draft → Closed/
    );
  });

  it('throws Invalid status transition Closed → Closed', async () => {
    const svc  = mkService();
    const exam = await svc.createExam(BASE_EXAM);
    await svc.publishExam(exam.id);
    await svc.closeExam(exam.id);

    await expect(svc.closeExam(exam.id)).rejects.toThrow(
      /Invalid status transition: Closed → Closed/
    );
  });

  it('throws when id is missing', async () => {
    const svc = mkService();
    await expect(svc.closeExam('')).rejects.toThrow(/id/i);
  });
});

// ── updateExam ────────────────────────────────────────────────────────────────

describe('ExamService.updateExam', () => {
  it('updates title and description', async () => {
    const svc  = mkService();
    const exam = await svc.createExam(BASE_EXAM);
    const updated = await svc.updateExam(exam.id, {
      title:       'New Title',
      description: 'New Description',
    });
    expect(updated.title).toBe('New Title');
    expect(updated.description).toBe('New Description');
  });

  it('strips the status field from partial (status unchanged)', async () => {
    const svc  = mkService();
    const exam = await svc.createExam(BASE_EXAM);

    // Attempt to change status via updateExam — must be ignored.
    const updated = await svc.updateExam(exam.id, { status: 'Published' });
    expect(updated.status).toBe('Draft');
  });

  it('preserves createdAt from the original exam', async () => {
    const svc  = mkService();
    const exam = await svc.createExam(BASE_EXAM);
    const updated = await svc.updateExam(exam.id, { title: 'Changed' });
    expect(updated.createdAt).toBe(exam.createdAt);
  });

  it('throws when exam not found', async () => {
    const svc = mkService();
    await expect(svc.updateExam('no-such-id', { title: 'X' })).rejects.toThrow(/not found/i);
  });
});

// ── deleteExam ────────────────────────────────────────────────────────────────

describe('ExamService.deleteExam', () => {
  it('removes the exam so it is no longer returned by getAllExams', async () => {
    const svc  = mkService();
    const exam = await svc.createExam(BASE_EXAM);
    await svc.deleteExam(exam.id);

    const all = await svc.getAllExams();
    expect(all.find((e) => e.id === exam.id)).toBeUndefined();
  });

  it('throws when id is missing', async () => {
    const svc = mkService();
    await expect(svc.deleteExam('')).rejects.toThrow(/id/i);
  });
});
