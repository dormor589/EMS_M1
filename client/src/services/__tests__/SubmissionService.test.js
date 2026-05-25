/**
 * SubmissionService unit tests.
 *
 * Uses real StorageService (jsdom localStorage, cleared between tests),
 * real ConfigService / LoggerService singletons, and fresh MockApiService +
 * ExamService + SubmissionService instances per test suite.
 *
 * Covers:
 *   - Constructor validation
 *   - submitExam: happy path, persists correctly
 *   - submitExam: rejects exam not Published (Draft, Closed)
 *   - submitExam: rejects duplicate submission (same examId + studentId)
 *   - getSubmissionsByExam: correct filter
 *   - getSubmissionsByStudent: correct filter
 *   - getSubmissionByExamAndStudent: found / not found
 *   - gradeSubmission: updates grade, feedback, status
 *
 * Source: the milestone brief §8 — SubmissionService
 * Source: the milestone brief §5.1 — one submission per student per exam
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MockApiService    from '../MockApiService.js';
import ExamService       from '../ExamService.js';
import SubmissionService from '../SubmissionService.js';
import storage from '../StorageService.js';
import config  from '../ConfigService.js';
import logger  from '../LoggerService.js';

// Silence logger output in tests.
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Build a fresh, wired service stack backed by clean localStorage. */
function mkStack() {
  const api  = new MockApiService(storage, config, logger);
  const exam = new ExamService(api, config, logger);
  const sub  = new SubmissionService(api, exam, config, logger);
  return { api, exam, sub };
}

const TEACHER_ID = 'teacher-uuid-t1';
const STUDENT_ID = 'student-uuid-s1';

/** Create a Draft exam, publish it, return the Published record. */
async function mkPublishedExam(exam) {
  const draft = await exam.createExam({
    title: 'Published Test Exam',
    durationMinutes: 30,
    createdBy: TEACHER_ID,
    questions: [],
  });
  return exam.publishExam(draft.id);
}

// ── Constructor validation ────────────────────────────────────────────────────

describe('SubmissionService constructor', () => {
  it('throws when mockApi is missing', () => {
    const { exam } = mkStack();
    expect(() => new SubmissionService(null, exam, config, logger)).toThrow(/mockApi/);
  });

  it('throws when examService is missing', () => {
    const { api } = mkStack();
    expect(() => new SubmissionService(api, null, config, logger)).toThrow(/examService/);
  });

  it('throws when config is missing', () => {
    const { api, exam } = mkStack();
    expect(() => new SubmissionService(api, exam, null, logger)).toThrow(/config/);
  });

  it('throws when logger is missing', () => {
    const { api, exam } = mkStack();
    expect(() => new SubmissionService(api, exam, config, null)).toThrow(/logger/);
  });
});

// ── submitExam — happy path ────────────────────────────────────────────────────

describe('SubmissionService.submitExam — happy path', () => {
  it('persists a submission with status "submitted"', async () => {
    const { exam, sub } = mkStack();
    const published = await mkPublishedExam(exam);

    const result = await sub.submitExam({
      examId:    published.id,
      studentId: STUDENT_ID,
      answers:   [{ questionId: 'q1', value: 'Answer text' }],
    });

    expect(result.status).toBe('submitted');
    expect(result.examId).toBe(published.id);
    expect(result.studentId).toBe(STUDENT_ID);
  });

  it('assigns a UUID id and submittedAt timestamp', async () => {
    const { exam, sub } = mkStack();
    const published = await mkPublishedExam(exam);

    const result = await sub.submitExam({
      examId:    published.id,
      studentId: STUDENT_ID,
      answers:   [],
    });

    expect(result.id).toBeTruthy();
    expect(typeof result.id).toBe('string');
    expect(result.submittedAt).toBeTruthy();
  });

  it('sets grade = null and feedback = "" on initial submit', async () => {
    const { exam, sub } = mkStack();
    const published = await mkPublishedExam(exam);

    const result = await sub.submitExam({
      examId: published.id, studentId: STUDENT_ID, answers: [],
    });

    expect(result.grade).toBeNull();
    expect(result.feedback).toBe('');
  });

  it('persists answers array as-is', async () => {
    const { exam, sub } = mkStack();
    const published = await mkPublishedExam(exam);
    const answers = [
      { questionId: 'q1', value: 'Paris' },
      { questionId: 'q2', value: 'Blue' },
    ];

    const result = await sub.submitExam({
      examId: published.id, studentId: STUDENT_ID, answers,
    });

    expect(result.answers).toHaveLength(2);
    expect(result.answers[0].value).toBe('Paris');
  });
});

// ── submitExam — status guards ────────────────────────────────────────────────

describe('SubmissionService.submitExam — rejects non-Published exam', () => {
  it('throws when exam is Draft', async () => {
    const { exam, sub } = mkStack();
    const draft = await exam.createExam({
      title: 'Draft Exam', durationMinutes: 30, createdBy: TEACHER_ID, questions: [],
    });

    await expect(
      sub.submitExam({ examId: draft.id, studentId: STUDENT_ID, answers: [] })
    ).rejects.toThrow(/not Published/i);
  });

  it('throws when exam is Closed', async () => {
    const { exam, sub } = mkStack();
    const published = await mkPublishedExam(exam);
    await exam.closeExam(published.id);

    await expect(
      sub.submitExam({ examId: published.id, studentId: STUDENT_ID, answers: [] })
    ).rejects.toThrow(/not Published/i);
  });

  it('throws when exam does not exist', async () => {
    const { sub } = mkStack();
    await expect(
      sub.submitExam({ examId: 'no-such-id', studentId: STUDENT_ID, answers: [] })
    ).rejects.toThrow(/not found/i);
  });
});

// ── submitExam — double-submission guard ──────────────────────────────────────

describe('SubmissionService.submitExam — duplicate prevention', () => {
  it('throws "Already submitted" on second submit for same (examId, studentId)', async () => {
    const { exam, sub } = mkStack();
    const published = await mkPublishedExam(exam);

    // First submit — succeeds.
    await sub.submitExam({ examId: published.id, studentId: STUDENT_ID, answers: [] });

    // Second submit — must throw.
    await expect(
      sub.submitExam({ examId: published.id, studentId: STUDENT_ID, answers: [] })
    ).rejects.toThrow('Already submitted');
  });

  it('allows a DIFFERENT student to submit the same exam', async () => {
    const { exam, sub } = mkStack();
    const published = await mkPublishedExam(exam);

    await sub.submitExam({ examId: published.id, studentId: 'student-A', answers: [] });
    // Different student — should succeed.
    const s2 = await sub.submitExam({ examId: published.id, studentId: 'student-B', answers: [] });
    expect(s2.studentId).toBe('student-B');
  });
});

// ── getSubmissionsByExam ──────────────────────────────────────────────────────

describe('SubmissionService.getSubmissionsByExam', () => {
  it('returns only submissions for the specified exam', async () => {
    const { exam, sub } = mkStack();
    const e1 = await mkPublishedExam(exam);
    const e2 = await exam.createExam({
      title: 'Exam 2', durationMinutes: 30, createdBy: TEACHER_ID,
    });
    const pe2 = await exam.publishExam(e2.id);

    await sub.submitExam({ examId: e1.id,   studentId: 'sA', answers: [] });
    await sub.submitExam({ examId: pe2.id,  studentId: 'sA', answers: [] });

    const results = await sub.getSubmissionsByExam(e1.id);
    expect(results).toHaveLength(1);
    expect(results[0].examId).toBe(e1.id);
  });

  it('returns empty array when no submissions for that exam', async () => {
    const { exam, sub } = mkStack();
    const published = await mkPublishedExam(exam);
    const results = await sub.getSubmissionsByExam(published.id);
    expect(results).toHaveLength(0);
  });

  it('throws when examId is missing', async () => {
    const { sub } = mkStack();
    await expect(sub.getSubmissionsByExam('')).rejects.toThrow(/examId/i);
  });
});

// ── getSubmissionsByStudent ───────────────────────────────────────────────────

describe('SubmissionService.getSubmissionsByStudent', () => {
  it('returns only submissions by the specified student', async () => {
    const { exam, sub } = mkStack();
    const e1 = await mkPublishedExam(exam);

    await sub.submitExam({ examId: e1.id, studentId: 'alice', answers: [] });
    await sub.submitExam({ examId: e1.id, studentId: 'bob',   answers: [] });

    const results = await sub.getSubmissionsByStudent('alice');
    expect(results).toHaveLength(1);
    expect(results[0].studentId).toBe('alice');
  });

  it('returns empty array when student has no submissions', async () => {
    const { sub } = mkStack();
    const results = await sub.getSubmissionsByStudent('nobody');
    expect(results).toHaveLength(0);
  });

  it('throws when studentId is missing', async () => {
    const { sub } = mkStack();
    await expect(sub.getSubmissionsByStudent('')).rejects.toThrow(/studentId/i);
  });
});

// ── getSubmissionByExamAndStudent ─────────────────────────────────────────────

describe('SubmissionService.getSubmissionByExamAndStudent', () => {
  it('returns the submission when found', async () => {
    const { exam, sub } = mkStack();
    const published = await mkPublishedExam(exam);
    await sub.submitExam({ examId: published.id, studentId: STUDENT_ID, answers: [] });

    const found = await sub.getSubmissionByExamAndStudent(published.id, STUDENT_ID);
    expect(found).not.toBeNull();
    expect(found.examId).toBe(published.id);
    expect(found.studentId).toBe(STUDENT_ID);
  });

  it('returns null when no submission exists for the pair', async () => {
    const { exam, sub } = mkStack();
    const published = await mkPublishedExam(exam);
    const found = await sub.getSubmissionByExamAndStudent(published.id, STUDENT_ID);
    expect(found).toBeNull();
  });
});

// ── gradeSubmission ───────────────────────────────────────────────────────────

describe('SubmissionService.gradeSubmission', () => {
  it('updates grade and feedback, sets status to "graded"', async () => {
    const { exam, sub } = mkStack();
    const published = await mkPublishedExam(exam);
    const s = await sub.submitExam({ examId: published.id, studentId: STUDENT_ID, answers: [] });

    const graded = await sub.gradeSubmission(s.id, { grade: 85, feedback: 'Good work!' });
    expect(graded.grade).toBe(85);
    expect(graded.feedback).toBe('Good work!');
    expect(graded.status).toBe('graded');
  });

  it('throws when submission id is missing', async () => {
    const { sub } = mkStack();
    await expect(sub.gradeSubmission('', { grade: 90 })).rejects.toThrow(/id/i);
  });

  it('throws when submission not found', async () => {
    const { sub } = mkStack();
    await expect(
      sub.gradeSubmission('no-such-id', { grade: 90 })
    ).rejects.toThrow(/not found/i);
  });
});

// ── input validation ──────────────────────────────────────────────────────────

describe('SubmissionService — input validation', () => {
  it('submitExam throws when examId is missing', async () => {
    const { sub } = mkStack();
    await expect(
      sub.submitExam({ examId: '', studentId: STUDENT_ID, answers: [] })
    ).rejects.toThrow(/examId/i);
  });

  it('submitExam throws when studentId is missing', async () => {
    const { sub } = mkStack();
    await expect(
      sub.submitExam({ examId: 'some-id', studentId: '', answers: [] })
    ).rejects.toThrow(/studentId/i);
  });
});

// ── getSubmissionById (D010) ───────────────────────────────────────────────────

describe('SubmissionService.getSubmissionById', () => {
  it('returns the submission when it exists', async () => {
    const { exam, sub } = mkStack();
    const published = await mkPublishedExam(exam);
    const created = await sub.submitExam({
      examId: published.id,
      studentId: STUDENT_ID,
      answers: [],
    });

    const found = await sub.getSubmissionById(created.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(created.id);
    expect(found.examId).toBe(published.id);
    expect(found.studentId).toBe(STUDENT_ID);
  });

  it('returns null when the submission does not exist', async () => {
    const { sub } = mkStack();
    const result = await sub.getSubmissionById('non-existent-id');
    expect(result).toBeNull();
  });

  it('throws when id is missing', async () => {
    const { sub } = mkStack();
    await expect(sub.getSubmissionById('')).rejects.toThrow(/id/i);
  });

  it('gradeSubmission — grade persists and is retrievable via getSubmissionById', async () => {
    const { exam, sub } = mkStack();
    const published = await mkPublishedExam(exam);
    const s = await sub.submitExam({ examId: published.id, studentId: STUDENT_ID, answers: [] });

    await sub.gradeSubmission(s.id, { grade: 72, feedback: 'Solid effort.' });

    const reloaded = await sub.getSubmissionById(s.id);
    expect(reloaded.grade).toBe(72);
    expect(reloaded.feedback).toBe('Solid effort.');
    expect(reloaded.status).toBe('graded');
  });
});
