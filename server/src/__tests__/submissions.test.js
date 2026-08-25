/**
 * Taking an exam and grading it — integration.
 *
 * Covers the invariants that Milestone 1 enforced only in the browser and were
 * therefore bypassable with curl: one attempt per student, the timer, and the
 * rule that a student sees no grade until the teacher publishes it.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { login, as } from './helpers/api.js';
import { resetDatabase, createUser, createExam, SAMPLE_QUESTIONS, pool } from './helpers/db.js';

let teacher, otherTeacher, student, otherStudent, exam;
let tToken, oTeacherToken, sToken, oStudentToken;

beforeEach(async () => {
  await resetDatabase();
  teacher      = await createUser({ email: 'teacher@ems.dev', role: 'teacher' });
  otherTeacher = await createUser({ email: 'other@ems.dev',   role: 'teacher' });
  student      = await createUser({ email: 'student@ems.dev', role: 'student', name: 'Sam Student' });
  otherStudent = await createUser({ email: 'other-s@ems.dev', role: 'student' });

  tToken        = await login('teacher@ems.dev');
  oTeacherToken = await login('other@ems.dev');
  sToken        = await login('student@ems.dev');
  oStudentToken = await login('other-s@ems.dev');

  exam = await createExam({
    createdBy: teacher.id, status: 'Published', durationMinutes: 30,
    passingGrade: 60, questions: SAMPLE_QUESTIONS,
  });
});
afterAll(() => pool.end());

const mcQ = () => exam.questions.find((q) => q.type === 'multiple-choice');
const openQ = () => exam.questions.find((q) => q.type === 'open-text');

describe('starting an attempt', () => {
  it('creates the attempt with a deadline', async () => {
    const res = await as(sToken).post(`/api/exams/${exam.id}/attempt`);

    expect(res.status).toBe(201);
    expect(res.body.submission.status).toBe('in_progress');
    expect(res.body.submission.secondsRemaining).toBeGreaterThan(1700);
  });

  it('RESUMES rather than restarting — a refresh cannot buy more time', async () => {
    const first = await as(sToken).post(`/api/exams/${exam.id}/attempt`);
    const second = await as(sToken).post(`/api/exams/${exam.id}/attempt`);

    expect(second.body.submission.id).toBe(first.body.submission.id);
    expect(second.body.submission.expiresAt).toBe(first.body.submission.expiresAt);
  });

  it('survives concurrent starts without a unique-constraint error', async () => {
    // React's dev-mode double effect, or an impatient double click.
    const results = await Promise.all(
      Array.from({ length: 5 }, () => as(sToken).post(`/api/exams/${exam.id}/attempt`))
    );

    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.body.submission.id)).size).toBe(1);
  });

  it('refuses an unpublished exam', async () => {
    const draft = await createExam({ createdBy: teacher.id, status: 'Draft' });
    expect((await as(sToken).post(`/api/exams/${draft.id}/attempt`)).status).toBe(404);
  });

  it('refuses a closed exam', async () => {
    const closed = await createExam({ createdBy: teacher.id, status: 'Closed' });
    expect((await as(sToken).post(`/api/exams/${closed.id}/attempt`)).status).toBe(404);
  });
});

describe('autosave', () => {
  it('stores answers and upserts on repeat', async () => {
    const { body } = await as(sToken).post(`/api/exams/${exam.id}/attempt`);
    const id = body.submission.id;

    await as(sToken).patch(`/api/attempts/${id}/draft`, {
      answers: [{ questionId: mcQ().id, value: '1' }, { questionId: openQ().id, value: 'first' }],
    });
    const res = await as(sToken).patch(`/api/attempts/${id}/draft`, {
      answers: [{ questionId: openQ().id, value: 'revised' }],
    });

    expect(res.body.submission.answers).toHaveLength(2);
    const open = res.body.submission.answers.find((a) => a.questionId === openQ().id);
    expect(open.value).toBe('revised');
  });

  it('rejects an answer to a question on a different exam', async () => {
    const other = await createExam({ createdBy: teacher.id, status: 'Published', questions: SAMPLE_QUESTIONS });
    const { body } = await as(sToken).post(`/api/exams/${exam.id}/attempt`);

    const res = await as(sToken).patch(`/api/attempts/${body.submission.id}/draft`, {
      answers: [{ questionId: other.questions[0].id, value: 'x' }],
    });
    expect(res.status).toBe(400);
  });

  it('stops one student writing to another student’s attempt', async () => {
    const { body } = await as(sToken).post(`/api/exams/${exam.id}/attempt`);
    const res = await as(oStudentToken).patch(`/api/attempts/${body.submission.id}/draft`, {
      answers: [{ questionId: openQ().id, value: 'sabotage' }],
    });

    expect(res.status).toBe(404);
  });
});

describe('the timer', () => {
  /** Move both timestamps into the past; the CHECK requires expires > started. */
  async function expire(id) {
    await pool.query(
      `UPDATE submissions
          SET started_at = now() - interval '60 minutes',
              expires_at = now() - interval '5 minutes'
        WHERE id = $1`, [id]);
  }

  it('refuses autosave once time is up', async () => {
    const { body } = await as(sToken).post(`/api/exams/${exam.id}/attempt`);
    await expire(body.submission.id);

    const res = await as(sToken).patch(`/api/attempts/${body.submission.id}/draft`, { answers: [] });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/time is up/i);
  });

  it('refuses a manual submit once time is up', async () => {
    const { body } = await as(sToken).post(`/api/exams/${exam.id}/attempt`);
    await expire(body.submission.id);

    const res = await as(sToken).post(`/api/attempts/${body.submission.id}/submit`, {});
    expect(res.status).toBe(409);
  });

  it('ACCEPTS an automatic submit past the deadline', async () => {
    // The client's countdown fired: the answers were captured before expiry
    // even though the request lands after it.
    const { body } = await as(sToken).post(`/api/exams/${exam.id}/attempt`);
    await expire(body.submission.id);

    const res = await as(sToken).post(`/api/attempts/${body.submission.id}/submit`, { auto: true });
    expect(res.status).toBe(200);
    expect(res.body.submission.status).toBe('submitted');
  });
});

describe('submitting', () => {
  async function attemptAndAnswer(mcValue = '1') {
    const { body } = await as(sToken).post(`/api/exams/${exam.id}/attempt`);
    await as(sToken).patch(`/api/attempts/${body.submission.id}/draft`, {
      answers: [
        { questionId: mcQ().id, value: mcValue },
        { questionId: openQ().id, value: 'Addition combines quantities.' },
      ],
    });
    return body.submission.id;
  }

  it('marks multiple choice from the answer key at submit time', async () => {
    const id = await attemptAndAnswer('1');
    const res = await as(sToken).post(`/api/attempts/${id}/submit`, {});

    const mc = res.body.submission.answers.find((a) => a.questionId === mcQ().id);
    expect(mc.isCorrect).toBe(true);
  });

  it('marks a wrong choice as incorrect', async () => {
    const id = await attemptAndAnswer('0');
    const res = await as(sToken).post(`/api/attempts/${id}/submit`, {});

    expect(res.body.submission.answers.find((a) => a.questionId === mcQ().id).isCorrect).toBe(false);
  });

  it('does NOT grade the submission — that is the teacher’s to trigger', async () => {
    const id = await attemptAndAnswer();
    const res = await as(sToken).post(`/api/attempts/${id}/submit`, {});

    expect(res.body.submission.status).toBe('submitted');
    expect(res.body.submission.grade).toBeNull();
  });

  it('blocks a second submit', async () => {
    const id = await attemptAndAnswer();
    await as(sToken).post(`/api/attempts/${id}/submit`, {});

    expect((await as(sToken).post(`/api/attempts/${id}/submit`, {})).status).toBe(409);
  });

  it('blocks restarting the exam afterwards', async () => {
    const id = await attemptAndAnswer();
    await as(sToken).post(`/api/attempts/${id}/submit`, {});

    const res = await as(sToken).post(`/api/exams/${exam.id}/attempt`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already submitted/i);
  });
});

describe('grading and the publish gate', () => {
  async function submitted() {
    const { body } = await as(sToken).post(`/api/exams/${exam.id}/attempt`);
    const id = body.submission.id;
    await as(sToken).patch(`/api/attempts/${id}/draft`, {
      answers: [{ questionId: mcQ().id, value: '1' }, { questionId: openQ().id, value: 'An answer.' }],
    });
    await as(sToken).post(`/api/attempts/${id}/submit`, {});
    return id;
  }

  it('computes the grade with sum(score * weight) / sum(weight)', async () => {
    const id = await submitted();
    // MC correct = 100 at weight 40; open scored 80 at weight 60.
    // (100*40 + 80*60) / 100 = 88
    const res = await as(tToken).patch(`/api/submissions/${id}/grade`, {
      answers: [{ questionId: openQ().id, score: 80, feedback: 'Good' }],
      publish: false,
    });

    expect(Number(res.body.submission.grade)).toBe(88);
  });

  it('keeps an unpublished grade as a teacher-only draft', async () => {
    const id = await submitted();
    const res = await as(tToken).patch(`/api/submissions/${id}/grade`, {
      answers: [{ questionId: openQ().id, score: 80 }], publish: false,
    });

    expect(res.body.submission.status).toBe('ai_graded');
    expect(res.body.submission.gradedAt).toBeNull();
  });

  it('HIDES an unpublished grade from the student', async () => {
    const id = await submitted();
    await as(tToken).patch(`/api/submissions/${id}/grade`, {
      answers: [{ questionId: openQ().id, score: 80 }], publish: false,
    });

    const mine = await as(sToken).get('/api/submissions/mine');
    expect(mine.body.submissions[0].grade).toBeNull();
    // Even the status is collapsed, so a draft cannot be inferred.
    expect(mine.body.submissions[0].status).toBe('submitted');
  });

  it('reveals it once published', async () => {
    const id = await submitted();
    await as(tToken).patch(`/api/submissions/${id}/grade`, {
      answers: [{ questionId: openQ().id, score: 80, feedback: 'Nice' }], publish: true,
    });

    const mine = await as(sToken).get('/api/submissions/mine');
    expect(Number(mine.body.submissions[0].grade)).toBe(88);
    expect(mine.body.submissions[0].passed).toBe(true);
  });

  it('publishes an existing draft unchanged', async () => {
    const id = await submitted();
    await as(tToken).patch(`/api/submissions/${id}/grade`, {
      answers: [{ questionId: openQ().id, score: 80 }], publish: false,
    });
    const res = await as(tToken).post(`/api/submissions/${id}/publish`);

    expect(res.body.submission.status).toBe('graded');
    expect(Number(res.body.submission.grade)).toBe(88);
  });

  it('IGNORES a teacher score for multiple choice — the key decides', async () => {
    const id = await submitted();
    const res = await as(tToken).patch(`/api/submissions/${id}/grade`, {
      answers: [
        { questionId: mcQ().id, score: 0 },      // attempt to mark a correct answer wrong
        { questionId: openQ().id, score: 100 },
      ],
      publish: true,
    });

    // MC stays at 100: (100*40 + 100*60)/100 = 100
    expect(Number(res.body.submission.grade)).toBe(100);
  });

  it('refuses to grade a submission that is still in progress', async () => {
    const { body } = await as(sToken).post(`/api/exams/${exam.id}/attempt`);
    const res = await as(tToken).patch(`/api/submissions/${body.submission.id}/grade`, {
      answers: [], publish: true,
    });

    expect(res.status).toBe(409);
  });

  it('stops another teacher grading it', async () => {
    const id = await submitted();
    const res = await as(oTeacherToken).patch(`/api/submissions/${id}/grade`, {
      answers: [], publish: true,
    });

    expect(res.status).toBe(403);
  });

  it('stops a student grading their own work', async () => {
    const id = await submitted();
    expect((await as(sToken).patch(`/api/submissions/${id}/grade`, { answers: [] })).status).toBe(403);
  });
});

describe('reading submissions', () => {
  it('gives the teacher the list with student names attached', async () => {
    const { body } = await as(sToken).post(`/api/exams/${exam.id}/attempt`);
    await as(sToken).post(`/api/attempts/${body.submission.id}/submit`, {});

    const res = await as(tToken).get(`/api/exams/${exam.id}/submissions`);
    expect(res.body.submissions[0].student.name).toBe('Sam Student');
  });

  it('stops another teacher reading them', async () => {
    expect((await as(oTeacherToken).get(`/api/exams/${exam.id}/submissions`)).status).toBe(403);
  });

  it('returns only the caller’s own submissions to a student', async () => {
    await as(sToken).post(`/api/exams/${exam.id}/attempt`);
    await as(oStudentToken).post(`/api/exams/${exam.id}/attempt`);

    const res = await as(sToken).get('/api/submissions/mine');
    expect(res.body.submissions).toHaveLength(1);
    expect(res.body.submissions[0].studentId).toBe(student.id);
  });

  it('404s a student reading someone else’s submission by id', async () => {
    const { body } = await as(oStudentToken).post(`/api/exams/${exam.id}/attempt`);
    expect((await as(sToken).get(`/api/submissions/${body.submission.id}`)).status).toBe(404);
  });
});
