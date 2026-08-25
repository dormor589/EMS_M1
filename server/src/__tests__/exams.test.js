/**
 * Exam lifecycle, visibility and editing — integration.
 *
 * The reconciling-save tests near the bottom are the important ones: a naive
 * "replace the exam" implementation would give every question a new id, and
 * because answers reference questions with ON DELETE CASCADE, fixing a typo
 * would silently destroy every submission on the exam.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { login, as } from './helpers/api.js';
import { resetDatabase, createUser, createExam, SAMPLE_QUESTIONS, pool } from './helpers/db.js';

let teacher, otherTeacher, student, tToken, oToken, sToken;

beforeEach(async () => {
  await resetDatabase();
  teacher      = await createUser({ email: 'teacher@ems.dev', role: 'teacher' });
  otherTeacher = await createUser({ email: 'other@ems.dev',   role: 'teacher' });
  student      = await createUser({ email: 'student@ems.dev', role: 'student' });
  tToken = await login('teacher@ems.dev');
  oToken = await login('other@ems.dev');
  sToken = await login('student@ems.dev');
});
afterAll(() => pool.end());

describe('visibility', () => {
  it('shows a teacher only their own exams, in every status', async () => {
    await createExam({ createdBy: teacher.id, title: 'Mine A', status: 'Draft' });
    await createExam({ createdBy: teacher.id, title: 'Mine B', status: 'Published' });
    await createExam({ createdBy: otherTeacher.id, title: 'Theirs', status: 'Published' });

    const res = await as(tToken).get('/api/exams');
    expect(res.body.exams.map((e) => e.title).sort()).toEqual(['Mine A', 'Mine B']);
  });

  it('shows a student ONLY published exams', async () => {
    await createExam({ createdBy: teacher.id, title: 'Draft',     status: 'Draft' });
    await createExam({ createdBy: teacher.id, title: 'Published', status: 'Published' });
    await createExam({ createdBy: teacher.id, title: 'Closed',    status: 'Closed' });

    const res = await as(sToken).get('/api/exams');
    expect(res.body.exams.map((e) => e.title)).toEqual(['Published']);
  });

  it('404s a student opening a draft exam directly by id', async () => {
    const exam = await createExam({ createdBy: teacher.id, status: 'Draft' });
    expect((await as(sToken).get(`/api/exams/${exam.id}`)).status).toBe(404);
  });

  it('404s rather than 403s another teacher — existence is not disclosed', async () => {
    const exam = await createExam({ createdBy: otherTeacher.id, status: 'Published' });
    expect((await as(tToken).get(`/api/exams/${exam.id}`)).status).toBe(404);
  });
});

describe('answer key', () => {
  it('is HIDDEN from a student sitting the exam', async () => {
    const exam = await createExam({
      createdBy: teacher.id, status: 'Published', questions: SAMPLE_QUESTIONS,
    });
    const res = await as(sToken).get(`/api/exams/${exam.id}`);

    for (const q of res.body.exam.questions) {
      expect(q).not.toHaveProperty('correctAnswer');
    }
    expect(JSON.stringify(res.body)).not.toContain('correctAnswer');
  });

  it('is hidden in the student list view too', async () => {
    await createExam({ createdBy: teacher.id, status: 'Published', questions: SAMPLE_QUESTIONS });
    const res = await as(sToken).get('/api/exams');
    expect(JSON.stringify(res.body)).not.toContain('correctAnswer');
  });

  it('is visible to the owning teacher', async () => {
    const exam = await createExam({
      createdBy: teacher.id, status: 'Published', questions: SAMPLE_QUESTIONS,
    });
    const res = await as(tToken).get(`/api/exams/${exam.id}`);
    expect(res.body.exam.questions[0].correctAnswer).toBe(1);
  });
});

describe('lifecycle', () => {
  it('creates as Draft regardless of what the client sends', async () => {
    const res = await as(tToken).post('/api/exams', {
      title: 'New', durationMinutes: 30, status: 'Published',
      questions: [{ type: 'open-text', text: 'Q', weight: 100 }],
    });
    expect(res.body.exam.status).toBe('Draft');
  });

  it('allows Draft -> Published -> Closed', async () => {
    const exam = await createExam({ createdBy: teacher.id, questions: SAMPLE_QUESTIONS });

    expect((await as(tToken).post(`/api/exams/${exam.id}/publish`)).body.exam.status).toBe('Published');
    expect((await as(tToken).post(`/api/exams/${exam.id}/close`)).body.exam.status).toBe('Closed');
  });

  it('blocks Draft -> Closed', async () => {
    const exam = await createExam({ createdBy: teacher.id, status: 'Draft' });
    const res = await as(tToken).post(`/api/exams/${exam.id}/close`);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Draft to Closed/);
  });

  it('blocks reopening a closed exam', async () => {
    const exam = await createExam({ createdBy: teacher.id, status: 'Closed' });
    expect((await as(tToken).post(`/api/exams/${exam.id}/publish`)).status).toBe(409);
  });

  it('refuses to publish an exam with no questions', async () => {
    const exam = await createExam({ createdBy: teacher.id, questions: [] });
    expect((await as(tToken).post(`/api/exams/${exam.id}/publish`)).status).toBe(422);
  });

  it('will not let a general update smuggle a status change', async () => {
    const exam = await createExam({ createdBy: teacher.id, status: 'Draft' });
    await as(tToken).put(`/api/exams/${exam.id}`, { title: 'Renamed', status: 'Published' });

    const { rows } = await pool.query('SELECT status FROM exams WHERE id=$1', [exam.id]);
    expect(rows[0].status).toBe('Draft');
  });
});

describe('ownership', () => {
  it('stops another teacher editing the exam', async () => {
    const exam = await createExam({ createdBy: teacher.id });
    expect((await as(oToken).put(`/api/exams/${exam.id}`, { title: 'Stolen' })).status).toBe(403);
  });

  it('stops another teacher publishing it', async () => {
    const exam = await createExam({ createdBy: teacher.id, questions: SAMPLE_QUESTIONS });
    expect((await as(oToken).post(`/api/exams/${exam.id}/publish`)).status).toBe(403);
  });

  it('stops another teacher deleting it', async () => {
    const exam = await createExam({ createdBy: teacher.id });
    expect((await as(oToken).delete(`/api/exams/${exam.id}`)).status).toBe(403);
  });
});

describe('validation', () => {
  it('rejects a multiple-choice question with one option', async () => {
    const res = await as(tToken).post('/api/exams', {
      title: 'Bad', durationMinutes: 30,
      questions: [{ type: 'multiple-choice', text: 'Q', options: ['only'], correctAnswer: 0 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.details.fields[0].message).toMatch(/two options/i);
  });

  it('rejects a correct answer outside the options', async () => {
    const res = await as(tToken).post('/api/exams', {
      title: 'Bad', durationMinutes: 30,
      questions: [{ type: 'multiple-choice', text: 'Q', options: ['a', 'b'], correctAnswer: 5 }],
    });
    expect(res.status).toBe(400);
  });

  it('rejects an open-text question carrying an answer key', async () => {
    const res = await as(tToken).post('/api/exams', {
      title: 'Bad', durationMinutes: 30,
      questions: [{ type: 'open-text', text: 'Q', correctAnswer: 1 }],
    });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed exam id without reaching the database', async () => {
    expect((await as(tToken).get('/api/exams/not-a-uuid')).status).toBe(400);
  });
});

describe('reconciling save', () => {
  it('KEEPS question ids when editing, so answers survive', async () => {
    const exam = await createExam({
      createdBy: teacher.id, status: 'Published', questions: SAMPLE_QUESTIONS,
    });
    const originalIds = exam.questions.map((q) => q.id);

    await as(tToken).put(`/api/exams/${exam.id}`, {
      title: 'Typo fixed',
      questions: exam.questions.map((q) => ({
        id: q.id, type: q.type, text: `${q.text} (edited)`,
        options: q.options, correctAnswer: q.correct_answer, weight: q.weight,
      })),
    });

    const { rows } = await pool.query('SELECT id FROM questions WHERE exam_id=$1 ORDER BY position', [exam.id]);
    expect(rows.map((r) => r.id)).toEqual(originalIds);
  });

  it('does not flag a re-grade for a harmless text edit', async () => {
    const exam = await createExam({
      createdBy: teacher.id, status: 'Published', questions: SAMPLE_QUESTIONS,
    });
    const res = await as(tToken).put(`/api/exams/${exam.id}`, {
      questions: exam.questions.map((q) => ({
        id: q.id, type: q.type, text: 'Reworded', options: q.options,
        correctAnswer: q.correct_answer, weight: q.weight,
      })),
    });

    expect(res.body.regradeRequired).toBe(0);
  });

  it('FLAGS submissions when the correct answer changes', async () => {
    const exam = await createExam({
      createdBy: teacher.id, status: 'Published', questions: SAMPLE_QUESTIONS,
    });
    await pool.query(
      `INSERT INTO submissions (exam_id, student_id, status, expires_at, submitted_at)
       VALUES ($1, $2, 'submitted', now() + interval '1 hour', now())`,
      [exam.id, student.id]
    );

    const res = await as(tToken).put(`/api/exams/${exam.id}`, {
      questions: exam.questions.map((q) => ({
        id: q.id, type: q.type, text: q.text, options: q.options,
        // Move the key from option 1 to option 2.
        correctAnswer: q.type === 'multiple-choice' ? 2 : null, weight: q.weight,
      })),
    });

    expect(res.body.regradeRequired).toBe(1);
  });

  it('flags submissions when a question is removed', async () => {
    const exam = await createExam({
      createdBy: teacher.id, status: 'Published', questions: SAMPLE_QUESTIONS,
    });
    await pool.query(
      `INSERT INTO submissions (exam_id, student_id, status, expires_at, submitted_at)
       VALUES ($1, $2, 'submitted', now() + interval '1 hour', now())`,
      [exam.id, student.id]
    );

    const [keep] = exam.questions;
    const res = await as(tToken).put(`/api/exams/${exam.id}`, {
      questions: [{ id: keep.id, type: keep.type, text: keep.text, options: keep.options,
                    correctAnswer: keep.correct_answer, weight: keep.weight }],
    });

    expect(res.body.regradeRequired).toBe(1);
  });

  it('inserts a question that arrives without an id', async () => {
    const exam = await createExam({ createdBy: teacher.id, questions: SAMPLE_QUESTIONS });

    await as(tToken).put(`/api/exams/${exam.id}`, {
      questions: [
        ...exam.questions.map((q) => ({ id: q.id, type: q.type, text: q.text,
          options: q.options, correctAnswer: q.correct_answer, weight: q.weight })),
        { type: 'open-text', text: 'Brand new', weight: 20 },
      ],
    });

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM questions WHERE exam_id=$1', [exam.id]);
    expect(rows[0].n).toBe(3);
  });
});

describe('deletion', () => {
  it('reports how many submissions went with the exam', async () => {
    const exam = await createExam({ createdBy: teacher.id, status: 'Published' });
    await pool.query(
      `INSERT INTO submissions (exam_id, student_id, status, expires_at, submitted_at)
       VALUES ($1, $2, 'submitted', now() + interval '1 hour', now())`,
      [exam.id, student.id]
    );

    const res = await as(tToken).delete(`/api/exams/${exam.id}`);
    expect(res.body.deletedSubmissions).toBe(1);

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM exams WHERE id=$1', [exam.id]);
    expect(rows[0].n).toBe(0);
  });
});
