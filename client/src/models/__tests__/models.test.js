/**
 * Entity model unit tests: User, Exam, Question, Submission, Answer.
 *
 * Source: the milestone brief §7 — Data Model
 */
import { describe, it, expect } from 'vitest';
import User       from '../User.js';
import Exam       from '../Exam.js';
import Question   from '../Question.js';
import Submission from '../Submission.js';
import Answer     from '../Answer.js';

// ── User ───────────────────────────────────────────────────────────────────────
describe('User', () => {
  const valid = { name: 'Alice', email: 'alice@ems.dev', password: 'pw', role: 'teacher' };

  it('constructs with valid data', () => {
    const u = new User(valid);
    expect(u.name).toBe('Alice');
    expect(u.role).toBe('teacher');
  });

  it('auto-generates id when omitted', () => {
    const u = new User(valid);
    expect(typeof u.id).toBe('string');
    expect(u.id.length).toBeGreaterThan(0);
  });

  it('preserves a provided id', () => {
    const u = new User({ ...valid, id: 'fixed-id' });
    expect(u.id).toBe('fixed-id');
  });

  it('throws when name is missing', () => {
    expect(() => new User({ ...valid, name: undefined })).toThrow(/name/);
  });

  it('throws when email is missing', () => {
    expect(() => new User({ ...valid, email: '' })).toThrow(/email/);
  });

  it('throws when password is missing', () => {
    expect(() => new User({ ...valid, password: undefined })).toThrow(/password/);
  });

  it('throws when role is missing', () => {
    expect(() => new User({ ...valid, role: undefined })).toThrow(/role/);
  });

  it('throws on invalid role', () => {
    expect(() => new User({ ...valid, role: 'admin' })).toThrow(/invalid role/i);
  });

  it('accepts "student" role', () => {
    const u = new User({ ...valid, role: 'student' });
    expect(u.role).toBe('student');
  });

  it('round-trips through toJSON / fromJSON', () => {
    const u = new User({ ...valid, id: 'u1' });
    const roundTripped = User.fromJSON(u.toJSON());
    expect(roundTripped.id).toBe('u1');
    expect(roundTripped.email).toBe('alice@ems.dev');
    expect(roundTripped.role).toBe('teacher');
  });
});

// ── Exam ───────────────────────────────────────────────────────────────────────
describe('Exam', () => {
  const valid = { title: 'Test Exam', createdBy: 'u1' };

  it('constructs with valid data and defaults', () => {
    const e = new Exam(valid);
    expect(e.title).toBe('Test Exam');
    expect(e.status).toBe('Draft');
    expect(e.durationMinutes).toBe(60);
    expect(e.questions).toEqual([]);
  });

  it('auto-generates id and createdAt when omitted', () => {
    const e = new Exam(valid);
    expect(typeof e.id).toBe('string');
    expect(typeof e.createdAt).toBe('string');
  });

  it('throws when title is missing', () => {
    expect(() => new Exam({ createdBy: 'u1' })).toThrow(/title/);
  });

  it('throws when createdBy is missing', () => {
    expect(() => new Exam({ title: 'X' })).toThrow(/createdBy/);
  });

  it('throws on invalid status', () => {
    expect(() => new Exam({ ...valid, status: 'Archived' })).toThrow(/invalid status/i);
  });

  it('accepts Published and Closed statuses', () => {
    expect(new Exam({ ...valid, status: 'Published' }).status).toBe('Published');
    expect(new Exam({ ...valid, status: 'Closed' }).status).toBe('Closed');
  });

  it('preserves questions array on round-trip', () => {
    const q = { id: 'q1', examId: 'e1', type: 'open-text', text: 'Q?', options: [], correctAnswer: null, points: 1 };
    const e = new Exam({ ...valid, id: 'e1', questions: [q] });
    const rt = Exam.fromJSON(e.toJSON());
    expect(rt.questions).toHaveLength(1);
    expect(rt.questions[0].id).toBe('q1');
  });

  it('round-trips through toJSON / fromJSON', () => {
    const e = new Exam({ ...valid, id: 'e99', status: 'Published' });
    const rt = Exam.fromJSON(e.toJSON());
    expect(rt.id).toBe('e99');
    expect(rt.status).toBe('Published');
  });
});

// ── Question ───────────────────────────────────────────────────────────────────
describe('Question', () => {
  const mc   = { examId: 'e1', type: 'multiple-choice', text: 'Pick one', options: ['A', 'B'] };
  const open = { examId: 'e1', type: 'open-text', text: 'Explain X' };

  it('constructs a multiple-choice question', () => {
    const q = new Question(mc);
    expect(q.type).toBe('multiple-choice');
    expect(q.options).toEqual(['A', 'B']);
    expect(q.points).toBe(1);
  });

  it('constructs an open-text question with empty options', () => {
    const q = new Question(open);
    expect(q.type).toBe('open-text');
    expect(q.options).toEqual([]);
  });

  it('throws when examId is missing', () => {
    expect(() => new Question({ ...mc, examId: undefined })).toThrow(/examId/);
  });

  it('throws when text is missing', () => {
    expect(() => new Question({ ...mc, text: '' })).toThrow(/text/);
  });

  it('throws on invalid type', () => {
    expect(() => new Question({ ...mc, type: 'essay' })).toThrow(/invalid type/i);
  });

  it('throws when multiple-choice has no options', () => {
    expect(() => new Question({ ...mc, options: [] })).toThrow(/options/i);
  });

  it('open-text accepts empty options without throwing', () => {
    expect(() => new Question({ ...open, options: [] })).not.toThrow();
  });

  it('round-trips through toJSON / fromJSON', () => {
    const q = new Question({ ...mc, id: 'q42', correctAnswer: 1 });
    const rt = Question.fromJSON(q.toJSON());
    expect(rt.id).toBe('q42');
    expect(rt.correctAnswer).toBe(1);
    expect(rt.options).toEqual(['A', 'B']);
  });
});

// ── Submission ─────────────────────────────────────────────────────────────────
describe('Submission', () => {
  const valid = { examId: 'e1', studentId: 'u2' };

  it('constructs with defaults', () => {
    const s = new Submission(valid);
    expect(s.status).toBe('submitted');
    expect(s.grade).toBeNull();
    expect(s.answers).toEqual([]);
  });

  it('throws when examId is missing', () => {
    expect(() => new Submission({ studentId: 'u2' })).toThrow(/examId/);
  });

  it('throws when studentId is missing', () => {
    expect(() => new Submission({ examId: 'e1' })).toThrow(/studentId/);
  });

  it('preserves answers array on round-trip', () => {
    const a = { questionId: 'q1', value: 'CSS' };
    const s = new Submission({ ...valid, id: 's1', answers: [a] });
    const rt = Submission.fromJSON(s.toJSON());
    expect(rt.answers).toHaveLength(1);
    expect(rt.answers[0].questionId).toBe('q1');
  });

  it('round-trips through toJSON / fromJSON', () => {
    const s = new Submission({ ...valid, id: 's99', grade: 85, status: 'graded' });
    const rt = Submission.fromJSON(s.toJSON());
    expect(rt.id).toBe('s99');
    expect(rt.grade).toBe(85);
    expect(rt.status).toBe('graded');
  });
});

// ── Answer ─────────────────────────────────────────────────────────────────────
describe('Answer', () => {
  it('constructs with questionId and value', () => {
    const a = new Answer({ questionId: 'q1', value: 'CSS' });
    expect(a.questionId).toBe('q1');
    expect(a.value).toBe('CSS');
  });

  it('defaults value to null when omitted', () => {
    const a = new Answer({ questionId: 'q1' });
    expect(a.value).toBeNull();
  });

  it('throws when questionId is missing', () => {
    expect(() => new Answer({ value: 'x' })).toThrow(/questionId/);
  });

  it('round-trips through toJSON / fromJSON', () => {
    const a = new Answer({ questionId: 'q1', value: 2 });
    const rt = Answer.fromJSON(a.toJSON());
    expect(rt.questionId).toBe('q1');
    expect(rt.value).toBe(2);
  });
});
