/**
 * AiService tests.
 *
 * A language model's output is untrusted input. These tests use fake providers
 * — no network, no cost, deterministic — and cover the two things AiService is
 * responsible for that a provider must not be trusted with:
 *
 *   1. Validation — nothing malformed reaches the database, where it would
 *      surface as a CHECK constraint violation rather than a handled error.
 *   2. Degradation — a failing provider must never fail the request.
 */

import { describe, it, expect, vi } from 'vitest';
import AiService from '../AiService.js';
import AiProvider from '../ai/AiProvider.js';
import FallbackProvider from '../ai/FallbackProvider.js';
import Question from '../../models/Question.js';

/** A provider that returns whatever it is told to. */
class FakeProvider extends AiProvider {
  constructor(responses = {}) { super(); this._r = responses; this.calls = []; }
  get name() { return 'fake'; }
  get isModelBacked() { return true; }
  async generateExam(spec) {
    this.calls.push(['generateExam', spec]);
    if (this._r.generateExam instanceof Error) throw this._r.generateExam;
    return this._r.generateExam;
  }
  async gradeAnswers(items) {
    this.calls.push(['gradeAnswers', items]);
    if (this._r.gradeAnswers instanceof Error) throw this._r.gradeAnswers;
    return this._r.gradeAnswers;
  }
  async summariseAnalytics(stats) {
    this.calls.push(['summariseAnalytics', stats]);
    if (this._r.summariseAnalytics instanceof Error) throw this._r.summariseAnalytics;
    return this._r.summariseAnalytics;
  }
}

const validExam = {
  title: 'Generated', description: 'x', durationMinutes: 30, passingGrade: 60,
  questions: [
    { type: 'multiple-choice', text: 'Q1?', options: ['a', 'b', 'c'], correctAnswer: 1, weight: 50 },
    { type: 'open-text', text: 'Q2?', options: [], correctAnswer: null, weight: 50 },
  ],
};

describe('AiService.generateExam', () => {
  it('returns a validated exam with AI provenance recorded', async () => {
    const ai = new AiService(new FakeProvider({ generateExam: validExam }), new FakeProvider({ generateExam: validExam }), new FallbackProvider());
    const { exam, modelBacked } = await ai.generateExam({ description: 'a topic', questionCount: 2 });

    expect(exam.generatedByAi).toBe(true);
    expect(exam.aiPrompt).toBe('a topic');
    expect(modelBacked).toBe(true);
  });

  it('normalises weights to total exactly 100', async () => {
    const lopsided = { ...validExam, questions: validExam.questions.map((q) => ({ ...q, weight: 7 })) };
    const ai = new AiService(new FakeProvider({ generateExam: lopsided }), new FakeProvider({ generateExam: lopsided }), new FallbackProvider());
    const { exam } = await ai.generateExam({ description: 'a topic', questionCount: 2 });

    expect(exam.questions.reduce((s, q) => s + q.weight, 0)).toBe(100);
  });

  it('falls back when the provider throws', async () => {
    const ai = new AiService(new FakeProvider({ generateExam: new Error('provider down') }), new FakeProvider({ generateExam: new Error('provider down') }), new FallbackProvider());
    const { exam, modelBacked } = await ai.generateExam({ description: 'CSS layout', questionCount: 3 });

    // The feature still works; the caller is told no model was involved.
    expect(modelBacked).toBe(false);
    expect(exam.questions).toHaveLength(3);
  });

  it('falls back when the provider returns something unusable', async () => {
    // A multiple-choice question with one option would violate a CHECK
    // constraint, so it must never reach the repository.
    const broken = { ...validExam, questions: [{ type: 'multiple-choice', text: 'Q', options: ['only'], correctAnswer: 0, weight: 100 }] };
    const ai = new AiService(new FakeProvider({ generateExam: broken }), new FakeProvider({ generateExam: broken }), new FallbackProvider());
    const { modelBacked } = await ai.generateExam({ description: 'topic', questionCount: 1 });

    expect(modelBacked).toBe(false);
  });

  it('rejects a correct answer pointing outside the options', async () => {
    const oob = { ...validExam, questions: [{ type: 'multiple-choice', text: 'Q', options: ['a', 'b'], correctAnswer: 9, weight: 100 }] };
    const ai = new AiService(new FakeProvider({ generateExam: oob }), new FakeProvider({ generateExam: oob }), new FallbackProvider());
    expect((await ai.generateExam({ description: 't', questionCount: 1 })).modelBacked).toBe(false);
  });

  it('clamps the question count to the configured range', async () => {
    const provider = new FakeProvider({ generateExam: validExam });
    const ai = new AiService(provider, provider, new FallbackProvider());
    await ai.generateExam({ description: 'topic', questionCount: 500 });

    expect(provider.calls[0][1].questionCount).toBeLessThanOrEqual(20);
  });

  it('supplies a duration when the model omits one', async () => {
    const noDuration = { ...validExam, durationMinutes: undefined };
    const ai = new AiService(new FakeProvider({ generateExam: noDuration }), new FakeProvider({ generateExam: noDuration }), new FallbackProvider());
    const { exam } = await ai.generateExam({ description: 't', questionCount: 2 });

    expect(exam.durationMinutes).toBeGreaterThan(0);
  });
});

describe('AiService.gradeOpenAnswers', () => {
  const openQ = (id) => new Question({ id, type: 'open-text', text: `Explain ${id}`, weight: 50 });
  const mcQ = (id) => new Question({ id, type: 'multiple-choice', text: 'Pick', options: ['a', 'b'], correctAnswer: 0, weight: 50 });

  it('sends ONLY open-text questions to the model', async () => {
    // The cost control: multiple choice is decided by the answer key.
    const provider = new FakeProvider({ gradeAnswers: [{ questionId: 'o1', score: 80, feedback: 'ok' }] });
    const ai = new AiService(provider, provider, new FallbackProvider());

    await ai.gradeOpenAnswers(
      { questions: [mcQ('m1'), openQ('o1'), mcQ('m2')] },
      { answers: [{ questionId: 'm1', value: '0' }, { questionId: 'o1', value: 'prose' }] }
    );

    const sent = provider.calls[0][1];
    expect(sent).toHaveLength(1);
    expect(sent[0].questionId).toBe('o1');
  });

  it('makes no call at all when there is no open text', async () => {
    const provider = new FakeProvider({ gradeAnswers: [] });
    const ai = new AiService(provider, provider, new FallbackProvider());

    const result = await ai.gradeOpenAnswers({ questions: [mcQ('m1')] }, { answers: [] });

    expect(provider.calls).toHaveLength(0);
    expect(result.grades).toEqual([]);
  });

  it('clamps an out-of-range score rather than rejecting it', async () => {
    // A model returning 130 meant full marks; a hard error would be worse.
    const ai = new AiService(new FakeProvider({ gradeAnswers: [{ questionId: 'o1', score: 130, feedback: 'x' }] }), new FakeProvider({ gradeAnswers: [{ questionId: 'o1', score: 130, feedback: 'x' }] }), new FallbackProvider());
    const { grades } = await ai.gradeOpenAnswers(
      { questions: [openQ('o1')] }, { answers: [{ questionId: 'o1', value: 'a' }] });

    expect(grades[0].score).toBe(100);
  });

  it('discards a grade for a question that is not on the exam', async () => {
    const ai = new AiService(new FakeProvider({ gradeAnswers: [
        { questionId: 'o1', score: 80, feedback: 'real' },
        { questionId: 'invented', score: 99, feedback: 'hallucinated' },
      ] }), new FakeProvider({ gradeAnswers: [
        { questionId: 'o1', score: 80, feedback: 'real' },
        { questionId: 'invented', score: 99, feedback: 'hallucinated' },
      ] }), new FallbackProvider());
    const { grades } = await ai.gradeOpenAnswers(
      { questions: [openQ('o1')] }, { answers: [{ questionId: 'o1', value: 'a' }] });

    expect(grades.map((g) => g.questionId)).toEqual(['o1']);
  });

  it('fills gaps when the model skips an answer', async () => {
    // A skipped answer would otherwise stay silently unmarked.
    const ai = new AiService(new FakeProvider({ gradeAnswers: [{ questionId: 'o1', score: 80, feedback: 'x' }] }), new FakeProvider({ gradeAnswers: [{ questionId: 'o1', score: 80, feedback: 'x' }] }), new FallbackProvider());
    const { grades } = await ai.gradeOpenAnswers(
      { questions: [openQ('o1'), openQ('o2')] },
      { answers: [{ questionId: 'o1', value: 'a' }, { questionId: 'o2', value: 'b' }] });

    expect(grades).toHaveLength(2);
    expect(grades.map((g) => g.questionId).sort()).toEqual(['o1', 'o2']);
  });

  it('falls back when the provider throws', async () => {
    const ai = new AiService(new FakeProvider({ gradeAnswers: new Error('503') }), new FakeProvider({ gradeAnswers: new Error('503') }), new FallbackProvider());
    const { grades, modelBacked } = await ai.gradeOpenAnswers(
      { questions: [openQ('o1')] }, { answers: [{ questionId: 'o1', value: 'some prose' }] });

    expect(modelBacked).toBe(false);
    expect(grades).toHaveLength(1);
  });

  it('passes both verdict fields through to the caller', async () => {
    const ai = new AiService(new FakeProvider({ gradeAnswers: [
        { questionId: 'o1', score: 40, feedback: 'wrong', studentIsCorrect: false, methodIsSound: true, expectedAnswer: 'y = 10' },
      ] }), new FakeProvider({ gradeAnswers: [
        { questionId: 'o1', score: 40, feedback: 'wrong', studentIsCorrect: false, methodIsSound: true, expectedAnswer: 'y = 10' },
      ] }), new FallbackProvider());
    const { grades } = await ai.gradeOpenAnswers(
      { questions: [openQ('o1')] }, { answers: [{ questionId: 'o1', value: 'y = 11' }] });

    expect(grades[0].studentIsCorrect).toBe(false);
    expect(grades[0].methodIsSound).toBe(true);
    expect(grades[0].feedback).toContain('y = 10');
  });
});

describe('AiService.summariseAnalytics', () => {
  it('falls back to a computed summary when the model fails', async () => {
    const ai = new AiService(new FakeProvider({ summariseAnalytics: new Error('down') }), new FakeProvider({ summariseAnalytics: new Error('down') }), new FallbackProvider());
    const summary = await ai.summariseAnalytics({ submissionCount: 5, averageGrade: 72, passRate: 80 });

    expect(summary).toContain('5 submission');
  });
});

describe('FallbackProvider', () => {
  const provider = new FallbackProvider();

  it('declares that no model is involved', () => {
    expect(provider.isModelBacked).toBe(false);
  });

  it('generates weights that total exactly 100', async () => {
    for (const count of [1, 3, 7, 9]) {
      const exam = await provider.generateExam({ description: 'CSS layout', questionCount: count });
      expect(exam.questions.reduce((s, q) => s + q.weight, 0)).toBe(100);
      expect(exam.questions).toHaveLength(count);
    }
  });

  it('scores a blank answer 0 and says so', async () => {
    const [g] = await provider.gradeAnswers([{ questionId: 'q1', question: 'Explain closures', answer: '' }]);
    expect(g.score).toBe(0);
    expect(g.feedback).toMatch(/no answer/i);
  });

  it('ranks a relevant answer above an irrelevant one', async () => {
    const [good] = await provider.gradeAnswers([{
      questionId: 'q1', question: 'Explain what a closure is in JavaScript',
      answer: 'A closure is a function that captures variables from the scope where it was created in JavaScript, keeping them alive after that scope returns.',
    }]);
    const [bad] = await provider.gradeAnswers([{
      questionId: 'q1', question: 'Explain what a closure is in JavaScript', answer: 'idk',
    }]);
    expect(good.score).toBeGreaterThan(bad.score);
  });

  it('always admits it did not use a language model', async () => {
    const [g] = await provider.gradeAnswers([{ questionId: 'q1', question: 'Explain', answer: 'Some answer here' }]);
    expect(g.feedback).toMatch(/without a language model/i);
  });
});
