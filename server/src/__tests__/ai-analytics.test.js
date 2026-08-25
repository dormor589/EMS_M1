/**
 * AI grading and analytics endpoints — integration.
 *
 * The AI provider is stubbed via a module mock, so these run offline, cost
 * nothing and are deterministic. What is being tested is the plumbing around
 * the model — authorization, persistence of the AI's proposal alongside the
 * teacher's final value, and the publish gate — not the model's judgement.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

// Stub the provider before anything imports it.
vi.mock('../services/ai/index.js', async () => {
  const { default: FallbackProvider } = await import('../services/ai/FallbackProvider.js');
  class StubProvider {
    get name() { return 'stub:test-model'; }
    get isModelBacked() { return true; }
    async generateExam({ questionCount }) {
      return {
        title: 'Stub Exam', description: 'generated', durationMinutes: 30, passingGrade: 60,
        questions: Array.from({ length: questionCount }, (_, i) => ({
          type: i % 2 === 0 ? 'multiple-choice' : 'open-text',
          text: `Stub question ${i + 1}`,
          options: i % 2 === 0 ? ['a', 'b', 'c'] : [],
          correctAnswer: i % 2 === 0 ? 1 : null,
          weight: Math.round(100 / questionCount),
        })),
      };
    }
    async gradeAnswers(items) {
      return items.map((it) => ({
        questionId: it.questionId,
        expectedAnswer: 'the expected answer',
        studentIsCorrect: it.answer.length > 5,
        methodIsSound: it.answer.length > 5,
        score: it.answer.length > 5 ? 75 : 0,
        feedback: 'stub feedback',
      }));
    }
    async summariseAnalytics() { return 'A stub narrative summary.'; }
  }
  const provider = new StubProvider();
  // Both providers are the same stub here: these tests exercise the plumbing
  // around the model, not which model answers.
  return { provider, fastProvider: provider, fallback: new FallbackProvider(), default: provider };
});

const { login, as } = await import('./helpers/api.js');
const { resetDatabase, createUser, createExam, SAMPLE_QUESTIONS, pool } = await import('./helpers/db.js');

let teacher, otherTeacher, student, exam, tToken, oToken, sToken;

beforeEach(async () => {
  await resetDatabase();
  teacher      = await createUser({ email: 'teacher@ems.dev', role: 'teacher' });
  otherTeacher = await createUser({ email: 'other@ems.dev',   role: 'teacher' });
  student      = await createUser({ email: 'student@ems.dev', role: 'student' });
  tToken = await login('teacher@ems.dev');
  oToken = await login('other@ems.dev');
  sToken = await login('student@ems.dev');
  exam = await createExam({
    createdBy: teacher.id, status: 'Published', passingGrade: 60, questions: SAMPLE_QUESTIONS,
  });
});
afterAll(() => pool.end());

const mcQ = () => exam.questions.find((q) => q.type === 'multiple-choice');
const openQ = () => exam.questions.find((q) => q.type === 'open-text');

/** Submit a full attempt and return its id. */
async function submitAttempt(openAnswer = 'A reasonably long open answer.') {
  const { body } = await as(sToken).post(`/api/exams/${exam.id}/attempt`);
  const id = body.submission.id;
  await as(sToken).patch(`/api/attempts/${id}/draft`, {
    answers: [{ questionId: mcQ().id, value: '1' }, { questionId: openQ().id, value: openAnswer }],
  });
  await as(sToken).post(`/api/attempts/${id}/submit`, {});
  return id;
}

describe('GET /api/ai/status', () => {
  it('reports the provider and whether a model backs it', async () => {
    const res = await as(tToken).get('/api/ai/status');
    // Two providers are reported: the grading model and the faster one used
    // for generation and summaries.
    expect(res.body).toEqual({
      provider: 'stub:test-model',
      fastProvider: 'stub:test-model',
      modelBacked: true,
    });
  });
});

describe('POST /api/ai/exams/generate', () => {
  it('returns a draft exam WITHOUT saving it', async () => {
    const before = await pool.query('SELECT count(*)::int AS n FROM exams');
    const res = await as(tToken).post('/api/ai/exams/generate', {
      description: 'A topic worth examining', questionCount: 4,
    });
    const after = await pool.query('SELECT count(*)::int AS n FROM exams');

    expect(res.status).toBe(200);
    expect(res.body.exam.questions).toHaveLength(4);
    // Nothing persisted: a generated answer key can be wrong, so a person
    // reviews before it becomes a real exam.
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('records the prompt as provenance', async () => {
    const res = await as(tToken).post('/api/ai/exams/generate', {
      description: 'Photosynthesis for year 9', questionCount: 2,
    });
    expect(res.body.exam.generatedByAi).toBe(true);
    expect(res.body.exam.aiPrompt).toBe('Photosynthesis for year 9');
  });

  it('normalises weights to 100', async () => {
    const res = await as(tToken).post('/api/ai/exams/generate', {
      description: 'Any topic at all', questionCount: 3,
    });
    expect(res.body.exam.questions.reduce((s, q) => s + q.weight, 0)).toBe(100);
  });

  it('rejects a description that is too short to act on', async () => {
    expect((await as(tToken).post('/api/ai/exams/generate', { description: 'x' })).status).toBe(400);
  });

  it('is teacher-only', async () => {
    const res = await as(sToken).post('/api/ai/exams/generate', {
      description: 'A topic worth examining',
    });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/submissions/:id/ai-grade', () => {
  it('grades and leaves the result as a teacher-only draft', async () => {
    const id = await submitAttempt();
    const res = await as(tToken).post(`/api/submissions/${id}/ai-grade`);

    expect(res.status).toBe(200);
    expect(res.body.submission.status).toBe('ai_graded');
    expect(res.body.submission.gradedBy).toBe('ai');
    // Not published: gradedAt is only set when a student can see it.
    expect(res.body.submission.gradedAt).toBeNull();
  });

  it('computes the grade from the answer key AND the model', async () => {
    const id = await submitAttempt();
    const res = await as(tToken).post(`/api/submissions/${id}/ai-grade`);

    // MC correct = 100 at weight 40; stub scores the open answer 75 at weight 60.
    // (100*40 + 75*60) / 100 = 85
    expect(Number(res.body.submission.grade)).toBe(85);
  });

  it('does NOT send multiple choice to the model', async () => {
    const id = await submitAttempt();
    await as(tToken).post(`/api/submissions/${id}/ai-grade`);

    const { rows } = await pool.query(
      'SELECT ai_score FROM answers WHERE submission_id=$1 AND question_id=$2',
      [id, mcQ().id]);
    // No ai_score means no model was consulted for it.
    expect(rows[0].ai_score).toBeNull();
  });

  it('stores the AI proposal alongside the final score', async () => {
    const id = await submitAttempt();
    await as(tToken).post(`/api/submissions/${id}/ai-grade`);

    const { rows } = await pool.query(
      'SELECT ai_score, score, ai_feedback FROM answers WHERE submission_id=$1 AND question_id=$2',
      [id, openQ().id]);
    expect(Number(rows[0].ai_score)).toBe(75);
    expect(Number(rows[0].score)).toBe(75);
    expect(rows[0].ai_feedback).toBe('stub feedback');
  });

  it('keeps the AI proposal when the teacher overrides it', async () => {
    // This is what powers "AI proposed 75 — you changed it to 95".
    const id = await submitAttempt();
    await as(tToken).post(`/api/submissions/${id}/ai-grade`);
    await as(tToken).patch(`/api/submissions/${id}/grade`, {
      answers: [{ questionId: openQ().id, score: 95, feedback: 'Better than the AI thought' }],
      publish: true,
    });

    const { rows } = await pool.query(
      'SELECT ai_score, score FROM answers WHERE submission_id=$1 AND question_id=$2',
      [id, openQ().id]);
    expect(Number(rows[0].ai_score)).toBe(75);   // untouched
    expect(Number(rows[0].score)).toBe(95);      // the teacher's decision
  });

  it('records that both the AI and the teacher were involved', async () => {
    const id = await submitAttempt();
    await as(tToken).post(`/api/submissions/${id}/ai-grade`);
    const res = await as(tToken).patch(`/api/submissions/${id}/grade`, {
      answers: [{ questionId: openQ().id, score: 95 }], publish: true,
    });

    expect(res.body.submission.gradedBy).toBe('ai+teacher');
  });

  it('keeps the draft invisible to the student', async () => {
    const id = await submitAttempt();
    await as(tToken).post(`/api/submissions/${id}/ai-grade`);

    const mine = await as(sToken).get('/api/submissions/mine');
    expect(mine.body.submissions[0].grade).toBeNull();
    expect(mine.body.submissions[0].status).toBe('submitted');
  });

  it('is teacher-only', async () => {
    const id = await submitAttempt();
    expect((await as(sToken).post(`/api/submissions/${id}/ai-grade`)).status).toBe(403);
  });

  it('stops another teacher running it', async () => {
    const id = await submitAttempt();
    expect((await as(oToken).post(`/api/submissions/${id}/ai-grade`)).status).toBe(403);
  });
});

describe('GET /api/analytics/exams/:id', () => {
  it('reports counts, averages and a pass rate', async () => {
    const id = await submitAttempt();
    await as(tToken).patch(`/api/submissions/${id}/grade`, {
      answers: [{ questionId: openQ().id, score: 80 }], publish: true,
    });

    const res = await as(tToken).get(`/api/analytics/exams/${exam.id}`);
    expect(res.body.submissionCount).toBe(1);
    expect(res.body.gradedCount).toBe(1);
    expect(Number(res.body.averageGrade)).toBe(88);
    expect(res.body.passRate).toBe(100);
  });

  it('returns a full ten-bucket distribution, including empty buckets', async () => {
    const res = await as(tToken).get(`/api/analytics/exams/${exam.id}`);
    expect(res.body.distribution).toHaveLength(10);
    expect(res.body.distribution[0].bucket).toBe('0-9');
  });

  it('breaks results down per question', async () => {
    const id = await submitAttempt();
    await as(tToken).patch(`/api/submissions/${id}/grade`, {
      answers: [{ questionId: openQ().id, score: 80 }], publish: true,
    });

    const res = await as(tToken).get(`/api/analytics/exams/${exam.id}`);
    const mc = res.body.questions.find((q) => q.type === 'multiple-choice');
    expect(mc.correctRate).toBe(100);
    // correctRate is meaningless for open text and must not read as 0%.
    expect(res.body.questions.find((q) => q.type === 'open-text').correctRate).toBeNull();
  });

  it('omits the AI narrative unless asked', async () => {
    const res = await as(tToken).get(`/api/analytics/exams/${exam.id}`);
    expect(res.body.summary).toBeUndefined();
  });

  it('includes it with ?summary=true', async () => {
    const res = await as(tToken).get(`/api/analytics/exams/${exam.id}?summary=true`);
    expect(res.body.summary).toBe('A stub narrative summary.');
  });

  it('stops another teacher reading it', async () => {
    expect((await as(oToken).get(`/api/analytics/exams/${exam.id}`)).status).toBe(403);
  });

  it('is teacher-only', async () => {
    expect((await as(sToken).get(`/api/analytics/exams/${exam.id}`)).status).toBe(403);
  });
});

describe('GET /api/analytics/overview', () => {
  it('covers only the calling teacher’s exams', async () => {
    await createExam({ createdBy: otherTeacher.id, status: 'Published', title: 'Not mine' });
    const res = await as(tToken).get('/api/analytics/overview');

    expect(res.body.exams.map((e) => e.title)).not.toContain('Not mine');
    expect(res.body.totals.examCount).toBe(1);
  });

  it('counts work awaiting grading', async () => {
    await submitAttempt();
    const res = await as(tToken).get('/api/analytics/overview');
    expect(res.body.totals.awaitingGrading).toBe(1);
  });
});
