/**
 * Domain model tests.
 *
 * These five classes carry the rules that both halves of the system rely on:
 * the exam lifecycle, the submission lifecycle, and — most importantly — what
 * each role is allowed to see. The answer-key tests below are the ones that
 * matter most: a regression there leaks exam answers to students.
 */

import { describe, it, expect } from 'vitest';
import { User, Exam, Question, Submission, Answer } from '../index.js';

describe('User', () => {
  const row = {
    id: 'u1', name: 'Alice', email: 'alice@ems.dev',
    password_hash: '$2b$10$abcdefghijklmnopqrstuv',
    role: 'teacher', created_at: '2026-01-01T00:00:00Z',
  };

  it('maps a database row', () => {
    const u = User.fromRow(row);
    expect(u.email).toBe('alice@ems.dev');
    expect(u.isTeacher()).toBe(true);
    expect(u.isStudent()).toBe(false);
  });

  it('NEVER emits the password hash from toJSON', () => {
    // The single thing standing between a bcrypt digest and every API response
    // that returns a user.
    const json = User.fromRow(row).toJSON();
    expect(json).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(json)).not.toContain('$2b$');
  });

  it('keeps the hash reachable for AuthService only', () => {
    expect(User.fromRow(row).passwordHash).toBe(row.password_hash);
  });

  it('does not expose the hash through a spread either', () => {
    // Non-enumerable, so { ...user } cannot leak it by accident.
    expect(JSON.stringify({ ...User.fromRow(row) })).not.toContain('$2b$');
  });

  it('returns null for a missing row', () => {
    expect(User.fromRow(undefined)).toBeNull();
  });
});

describe('Question', () => {
  const mcRow = {
    id: 'q1', exam_id: 'e1', type: 'multiple-choice', text: 'Which?',
    options: ['a', 'b'], correct_answer: 1, weight: 30, position: 0,
  };

  it('HIDES the answer key by default', () => {
    // A student fetching an exam to sit it must not receive correctAnswer.
    const json = Question.fromRow(mcRow).toJSON();
    expect(json).not.toHaveProperty('correctAnswer');
  });

  it('includes the answer key only when explicitly asked', () => {
    const json = Question.fromRow(mcRow).toJSON({ includeAnswerKey: true });
    expect(json.correctAnswer).toBe(1);
  });

  it('scores multiple choice from the key', () => {
    const q = Question.fromRow(mcRow);
    expect(q.scoreFor('1')).toBe(100);
    expect(q.scoreFor('0')).toBe(0);
  });

  it('returns null for open text — a grader must decide', () => {
    const q = Question.fromRow({ ...mcRow, type: 'open-text', correct_answer: null });
    expect(q.scoreFor('anything')).toBeNull();
  });
});

describe('Exam', () => {
  const examRow = {
    id: 'e1', title: 'Test', description: '', duration_minutes: 30,
    passing_grade: 60, status: 'Draft', created_by: 't1',
    generated_by_ai: false, ai_prompt: null,
  };

  it('enforces the one-way lifecycle', () => {
    const draft = Exam.fromRow(examRow);
    expect(draft.canTransitionTo('Published')).toBe(true);
    expect(draft.canTransitionTo('Closed')).toBe(false);

    const published = Exam.fromRow({ ...examRow, status: 'Published' });
    expect(published.canTransitionTo('Closed')).toBe(true);
    expect(published.canTransitionTo('Draft')).toBe(false);

    const closed = Exam.fromRow({ ...examRow, status: 'Closed' });
    expect(closed.canTransitionTo('Published')).toBe(false);
    expect(closed.canTransitionTo('Draft')).toBe(false);
  });

  it('knows its owner', () => {
    const exam = Exam.fromRow(examRow);
    expect(exam.isOwnedBy('t1')).toBe(true);
    expect(exam.isOwnedBy('t2')).toBe(false);
  });

  it('sums question weights', () => {
    const exam = Exam.fromRow(examRow, [
      { id: 'q1', exam_id: 'e1', type: 'open-text', text: 'A', options: [], correct_answer: null, weight: 40, position: 0 },
      { id: 'q2', exam_id: 'e1', type: 'open-text', text: 'B', options: [], correct_answer: null, weight: 60, position: 1 },
    ]);
    expect(exam.totalWeight()).toBe(100);
  });

  it('propagates the answer-key flag to its questions', () => {
    const exam = Exam.fromRow(examRow, [
      { id: 'q1', exam_id: 'e1', type: 'multiple-choice', text: 'Q', options: ['a', 'b'], correct_answer: 0, weight: 10, position: 0 },
    ]);
    expect(exam.toJSON().questions[0]).not.toHaveProperty('correctAnswer');
    expect(exam.toJSON({ includeAnswerKey: true }).questions[0].correctAnswer).toBe(0);
  });
});

describe('Submission', () => {
  const base = {
    id: 's1', exam_id: 'e1', student_id: 'st1', status: 'in_progress',
    started_at: new Date(Date.now() - 60_000).toISOString(),
    expires_at: new Date(Date.now() + 600_000).toISOString(),
    submitted_at: null, grade: null, feedback: '', graded_by: null,
    graded_at: null, needs_regrade: false,
  };

  it('enforces the submission lifecycle', () => {
    expect(Submission.fromRow(base).canTransitionTo('submitted')).toBe(true);
    expect(Submission.fromRow(base).canTransitionTo('graded')).toBe(false);

    const submitted = Submission.fromRow({ ...base, status: 'submitted' });
    expect(submitted.canTransitionTo('ai_graded')).toBe(true);
    expect(submitted.canTransitionTo('graded')).toBe(true);

    const graded = Submission.fromRow({ ...base, status: 'graded' });
    expect(graded.canTransitionTo('submitted')).toBe(false);
  });

  it('reports time remaining, floored at zero', () => {
    expect(Submission.fromRow(base).secondsRemaining()).toBeGreaterThan(590);
    const expired = Submission.fromRow({ ...base, expires_at: new Date(Date.now() - 1000).toISOString() });
    expect(expired.secondsRemaining()).toBe(0);
  });

  it('detects expiry, with a grace period for latency', () => {
    const justExpired = Submission.fromRow({
      ...base, expires_at: new Date(Date.now() - 5_000).toISOString(),
    });
    expect(justExpired.hasExpired(0)).toBe(true);
    // A request in flight when the clock ran out is not late.
    expect(justExpired.hasExpired(30)).toBe(false);
  });

  it('derives pass/fail rather than storing it', () => {
    const graded = Submission.fromRow({ ...base, status: 'graded', grade: '72.50' });
    expect(graded.passed(60)).toBe(true);
    expect(graded.passed(80)).toBe(false);
    // Ungraded work has no verdict — not "failed".
    expect(Submission.fromRow(base).passed(60)).toBeNull();
  });

  it('HIDES an unpublished grade from the student', () => {
    // An ai_graded draft is the teacher's working copy.
    const draft = Submission.fromRow({
      ...base, status: 'ai_graded', submitted_at: new Date().toISOString(),
      grade: '88.00', feedback: 'Draft note',
    });
    const json = draft.toJSON({ forStudent: true });
    expect(json.grade).toBeNull();
    expect(json.feedback).toBe('');
  });

  it('COLLAPSES the draft status so a student cannot infer one exists', () => {
    const draft = Submission.fromRow({
      ...base, status: 'ai_graded', submitted_at: new Date().toISOString(), grade: '88.00',
    });
    expect(draft.toJSON({ forStudent: true }).status).toBe('submitted');
  });

  it('strips per-answer grading detail from the student view', () => {
    const draft = Submission.fromRow(
      { ...base, status: 'ai_graded', submitted_at: new Date().toISOString(), grade: '88.00' },
      [{ id: 'a1', submission_id: 's1', question_id: 'q1', value: 'x', is_correct: true,
         ai_score: '90.00', ai_feedback: 'good', score: '90.00', feedback: 'good' }]
    );
    const answer = draft.toJSON({ forStudent: true }).answers[0];
    expect(answer).not.toHaveProperty('score');
    expect(answer).not.toHaveProperty('aiScore');
  });

  it('shows everything once published', () => {
    const published = Submission.fromRow({
      ...base, status: 'graded', submitted_at: new Date().toISOString(),
      grade: '88.00', feedback: 'Well done', graded_at: new Date().toISOString(),
    });
    const json = published.toJSON({ forStudent: true, passingGrade: 60 });
    expect(json.grade).toBe(88);
    expect(json.feedback).toBe('Well done');
  });
});

describe('Answer', () => {
  const row = {
    id: 'a1', submission_id: 's1', question_id: 'q1', value: 'text',
    is_correct: null, ai_score: '85.00', ai_feedback: 'AI said',
    score: '92.00', feedback: 'Teacher said',
  };

  it('detects a teacher override', () => {
    // Powers "AI proposed 85 — you changed it to 92".
    expect(Answer.fromRow(row).wasOverridden()).toBe(true);
  });

  it('is not an override when the teacher agreed', () => {
    expect(Answer.fromRow({ ...row, score: '85.00' }).wasOverridden()).toBe(false);
  });

  it('is not an override when the AI never ran', () => {
    expect(Answer.fromRow({ ...row, ai_score: null }).wasOverridden()).toBe(false);
  });

  it('reports ungraded answers as ungraded', () => {
    expect(Answer.fromRow({ ...row, score: null }).isGraded()).toBe(false);
  });
});
