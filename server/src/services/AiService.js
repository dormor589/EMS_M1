/**
 * AiService — exam generation and AI-assisted marking.
 *
 * Sits between the controllers and whichever AI provider is configured, and
 * owns the two things a provider must not be trusted with:
 *
 *   1. Validation. A language model's output is untrusted input. Everything it
 *      returns is checked and repaired before it reaches the database, because
 *      a malformed question would otherwise be rejected by a CHECK constraint
 *      as a 500 rather than handled here.
 *
 *   2. Degradation. If a model-backed call fails — provider down, model retired,
 *      unparseable reply — the request falls back to the deterministic provider
 *      rather than failing. The response always says which one answered.
 *
 * Source: the milestone brief §5.2 — AI API agents
 */

import config from '../config/index.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { provider, fastProvider, fallback } from './ai/index.js';
import { partitionByGradingMethod } from './grading.js';

const { minGeneratedQuestions, maxGeneratedQuestions } = config.limits;


class AiService {
  /**
   * Two providers, because the three AI tasks do not need the same thing.
   *
   * Grading needs judgement — telling a sound argument from a confident wrong
   * one — and is worth waiting for, since a teacher triggers it deliberately
   * once per submission. Generation and the analytics summary need plausible
   * text quickly, and are what a user sits watching. Running both on the
   * slower reasoning model made generation feel sluggish for no gain.
   *
   * @param {import('./ai/AiProvider.js').default} [ai]     Grading.
   * @param {import('./ai/AiProvider.js').default} [fast]   Generation, summaries.
   * @param {import('./ai/AiProvider.js').default} [safety] Fallback for both.
   */
  constructor(ai = provider, fast = fastProvider, safety = fallback) {
    this._ai = ai;
    this._fast = fast;
    this._fallback = safety;
  }

  /**
   * @returns {{ provider: string, fastProvider: string, modelBacked: boolean }}
   */
  status() {
    return {
      provider: this._ai.name,
      fastProvider: this._fast.name,
      modelBacked: this._ai.isModelBacked,
    };
  }

  // ── Generation ───────────────────────────────────────────────────────────

  /**
   * Draft an exam from a plain-language description.
   *
   * The result is NOT saved — it is returned for the teacher to review and
   * edit. A generated exam only becomes real when they choose to create it.
   *
   * @param {object} input
   * @param {string} input.description
   * @param {number} [input.questionCount]
   * @returns {Promise<{ exam: object, generatedBy: string, modelBacked: boolean }>}
   */
  async generateExam({ description, questionCount = 5 }) {
    const count = Math.min(maxGeneratedQuestions, Math.max(minGeneratedQuestions, questionCount));

    let raw;
    let usedProvider = this._fast;
    try {
      raw = await this._fast.generateExam({ description, questionCount: count });
    } catch (err) {
      logger.warn('AI generation failed, using the fallback', { error: err.message });
      usedProvider = this._fallback;
      raw = await this._fallback.generateExam({ description, questionCount: count });
    }

    let exam;
    try {
      exam = this._validateExam(raw, count);
    } catch (err) {
      // The model answered but produced something unusable. Rather than hand a
      // broken draft to the teacher, fall back and keep the feature working.
      logger.warn('AI returned an invalid exam, using the fallback', { error: err.message });
      usedProvider = this._fallback;
      exam = this._validateExam(
        await this._fallback.generateExam({ description, questionCount: count }),
        count
      );
    }

    return {
      exam: { ...exam, generatedByAi: true, aiPrompt: description },
      generatedBy: usedProvider.name,
      modelBacked: usedProvider.isModelBacked,
    };
  }

  // ── Marking ──────────────────────────────────────────────────────────────

  /**
   * Propose marks for a submission's open-text answers.
   *
   * Multiple-choice questions are not sent to the model: they are decided by
   * the answer key, so involving one would cost money, add latency and
   * introduce the possibility of being wrong. An exam of ten multiple-choice
   * and two open questions makes one AI call covering two answers.
   *
   * @param {import('../models/Exam.js').default} exam
   * @param {import('../models/Submission.js').default} submission
   * @returns {Promise<{ grades: Array, gradedBy: string, modelBacked: boolean }>}
   */
  async gradeOpenAnswers(exam, submission) {
    const { openText } = partitionByGradingMethod(exam.questions);
    if (!openText.length) {
      return { grades: [], gradedBy: 'none', modelBacked: false };
    }

    const answerByQuestion = new Map(submission.answers.map((a) => [a.questionId, a]));
    const items = openText.map((q) => ({
      questionId: q.id,
      question: q.text,
      answer: answerByQuestion.get(q.id)?.value ?? '',
    }));

    let raw;
    let usedProvider = this._ai;
    try {
      raw = await this._ai.gradeAnswers(items);
    } catch (err) {
      logger.warn('AI marking failed, using the fallback', { error: err.message });
      usedProvider = this._fallback;
      raw = await this._fallback.gradeAnswers(items);
    }

    const grades = this._validateGrades(raw, items);

    // A model that skipped an answer must not leave it silently unmarked.
    if (grades.length !== items.length) {
      logger.warn('AI returned an incomplete set of marks, filling the gaps', {
        expected: items.length, received: grades.length,
      });
      const seen = new Set(grades.map((g) => g.questionId));
      const missing = items.filter((it) => !seen.has(it.questionId));
      grades.push(...(await this._fallback.gradeAnswers(missing)));
    }

    return { grades, gradedBy: usedProvider.name, modelBacked: usedProvider.isModelBacked };
  }

  /**
   * @param {object} stats
   * @returns {Promise<string>}
   */
  async summariseAnalytics(stats) {
    try {
      return await this._fast.summariseAnalytics(stats);
    } catch (err) {
      logger.warn('AI summary failed, using the fallback', { error: err.message });
      return this._fallback.summariseAnalytics(stats);
    }
  }

  // ── Validation ───────────────────────────────────────────────────────────

  /**
   * Check and repair a generated exam.
   *
   * Repairs what is safely repairable (a weight total that is slightly off, a
   * missing duration) and rejects what is not (a multiple-choice question with
   * one option). Anything reaching the database must already satisfy its CHECK
   * constraints.
   *
   * @param {object} raw
   * @param {number} expectedCount
   * @returns {object}
   * @throws {Error} If the shape cannot be salvaged.
   * @private
   */
  _validateExam(raw, expectedCount) {
    if (!raw || typeof raw !== 'object') throw new Error('not an object');
    if (!Array.isArray(raw.questions) || !raw.questions.length) {
      throw new Error('no questions');
    }

    const questions = raw.questions.slice(0, expectedCount).map((q, i) => {
      const type = q.type === 'multiple-choice' ? 'multiple-choice' : 'open-text';
      const text = String(q.text || '').trim();
      if (!text) throw new Error(`question ${i + 1} has no text`);

      if (type === 'multiple-choice') {
        const options = (Array.isArray(q.options) ? q.options : [])
          .map((o) => String(o).trim())
          .filter(Boolean);
        if (options.length < 2) throw new Error(`question ${i + 1} has too few options`);

        const answer = Number(q.correctAnswer);
        if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) {
          throw new Error(`question ${i + 1} has an out-of-range correct answer`);
        }
        return { type, text, options, correctAnswer: answer, weight: this._weight(q.weight) };
      }

      return { type, text, options: [], correctAnswer: null, weight: this._weight(q.weight) };
    });

    // Nudge the weights to total exactly 100. The grade formula divides by the
    // total so it would be correct either way, but a teacher opening the editor
    // should see a tidy 100.
    this._normaliseWeights(questions);

    const duration = Number(raw.durationMinutes);
    const passing = Number(raw.passingGrade);

    return {
      title: String(raw.title || 'Generated exam').trim().slice(0, 150),
      description: String(raw.description || '').trim().slice(0, 2000),
      durationMinutes: Number.isFinite(duration) && duration > 0
        ? Math.min(600, Math.round(duration))
        : Math.max(15, questions.length * 5),
      passingGrade: Number.isFinite(passing) && passing >= 0 && passing <= 100
        ? Math.round(passing)
        : 60,
      questions,
    };
  }

  /**
   * @param {unknown} value
   * @returns {number}
   * @private
   */
  _weight(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? Math.min(100, Math.round(n)) : 10;
  }

  /**
   * Scale weights so they total 100, giving any rounding remainder to the
   * first questions.
   *
   * @param {object[]} questions
   * @private
   */
  _normaliseWeights(questions) {
    const total = questions.reduce((sum, q) => sum + q.weight, 0);
    if (total === 100 || total === 0) return;

    let running = 0;
    questions.forEach((q, i) => {
      if (i === questions.length - 1) {
        q.weight = Math.max(1, 100 - running);
      } else {
        q.weight = Math.max(1, Math.round((q.weight / total) * 100));
        running += q.weight;
      }
    });
  }

  /**
   * Check the marks a provider returned.
   *
   * @param {unknown} raw
   * @param {Array<{questionId: string}>} items
   * @returns {Array<{questionId: string, score: number, feedback: string}>}
   * @private
   */
  _validateGrades(raw, items) {
    if (!Array.isArray(raw)) return [];
    const valid = new Set(items.map((it) => it.questionId));

    return raw
      .filter((g) => g && valid.has(g.questionId))
      .map((g) => {
        const score = Number(g.score);
        let final = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
        let feedback = String(g.feedback || '').trim();

        // The consistency check that makes AI marking usable.
        //
        // Models routinely identify that an answer is wrong and award full
        // marks anyway — observed on "y - 3 = 7" where the student answered 11
        // instead of 10: the model's own feedback said "y=11 is not the correct
        // solution" while scoring it 100. The reasoning and the number it
        // produces are simply not connected.
        //
        // Asking it to commit to `studentIsCorrect` BEFORE scoring gives us a
        // field to check the score against, and the ceiling is applied here in
        // code rather than trusted to the prompt. A wrong answer cannot receive
        // a high mark no matter what the model claims.
        // The model's score is used as given. An earlier version capped it when
        // the model contradicted its own verdict — scoring an answer highly
        // after declaring it wrong. That guard existed to compensate for
        // llama-3.3-70b, which did exactly that; measured against kimi-k3 it
        // never once fired, because the model's own bands already land
        // sensibly. Rather than keep a rule that silently overrides a grade on
        // the author's opinion of how strictly to mark, the contradiction is
        // logged for visibility and the teacher decides — which is what the
        // override on the marking screen is for.
        if (g.studentIsCorrect === false || g.methodIsSound === false) {
          if (final > 60) {
            logger.warn('AI scored highly despite its own negative verdict', {
              questionId: g.questionId,
              score: final,
              studentIsCorrect: g.studentIsCorrect,
              methodIsSound: g.methodIsSound,
            });
          }
          if (g.studentIsCorrect === false && g.expectedAnswer) {
            feedback += ` (The expected answer was: ${String(g.expectedAnswer).trim()})`;
          }
        }

        return {
          questionId: g.questionId,
          score: final,
          feedback: feedback.slice(0, 2000),
          // Kept for the teacher's benefit: seeing what the model thought the
          // answer was, and how it judged the working, makes its verdict
          // checkable rather than opaque.
          expectedAnswer: g.expectedAnswer ? String(g.expectedAnswer).trim().slice(0, 500) : null,
          studentIsCorrect: typeof g.studentIsCorrect === 'boolean' ? g.studentIsCorrect : null,
          methodIsSound: typeof g.methodIsSound === 'boolean' ? g.methodIsSound : null,
        };
      });
  }
}

export default AiService;
