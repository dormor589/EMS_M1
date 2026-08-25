/**
 * grading.js — the grade calculation.
 *
 * Pure functions, so these tests need no database and no model. This is the
 * single place a grade is computed, which makes it the single place worth
 * testing exhaustively.
 */

import { describe, it, expect } from 'vitest';
import { scoreMultipleChoice, computeGrade, partitionByGradingMethod } from '../grading.js';
import Question from '../../models/Question.js';

const mc = (id, correct, weight = 10) => new Question({
  id, type: 'multiple-choice', text: 'Q?', options: ['a', 'b', 'c'],
  correctAnswer: correct, weight,
});
const open = (id, weight = 10) => new Question({
  id, type: 'open-text', text: 'Explain.', weight,
});

describe('scoreMultipleChoice', () => {
  it('awards 100 for the right option', () => {
    expect(scoreMultipleChoice(mc('q1', 1), '1')).toEqual({ score: 100, isCorrect: true });
  });

  it('awards 0 for the wrong option', () => {
    expect(scoreMultipleChoice(mc('q1', 1), '2')).toEqual({ score: 0, isCorrect: false });
  });

  it('treats an unanswered question as wrong, not as an error', () => {
    expect(scoreMultipleChoice(mc('q1', 1), '')).toEqual({ score: 0, isCorrect: false });
  });

  it('compares numerically — the value arrives from the database as text', () => {
    // Answers are stored in a TEXT column, so '1' must match correctAnswer 1.
    expect(scoreMultipleChoice(mc('q1', 1), '1').isCorrect).toBe(true);
  });

  it('does not treat option 0 as blank', () => {
    // A falsy-looking index that is nonetheless a real answer.
    expect(scoreMultipleChoice(mc('q1', 0), '0')).toEqual({ score: 100, isCorrect: true });
  });
});

describe('computeGrade', () => {
  it('computes sum(score * weight) / sum(weight)', () => {
    const questions = [mc('a', 0, 20), mc('b', 0, 20), open('c', 30), open('d', 30)];
    const scores = new Map([['a', 100], ['b', 0], ['c', 85], ['d', 70]]);
    // (100*20 + 0*20 + 85*30 + 70*30) / 100 = 66.5
    expect(computeGrade(questions, scores)).toBe(66.5);
  });

  it('gives 100 when every question is perfect', () => {
    const questions = [open('a', 40), open('b', 60)];
    expect(computeGrade(questions, new Map([['a', 100], ['b', 100]]))).toBe(100);
  });

  it('counts an unscored question as zero, not as excluded', () => {
    // An unanswered question is worth nothing; treating it as "not applicable"
    // would silently inflate the grade.
    const questions = [open('a', 50), open('b', 50)];
    expect(computeGrade(questions, new Map([['a', 100]]))).toBe(50);
  });

  it('self-normalises when weights do not total 100', () => {
    // A teacher mid-edit can leave weights at any total; the grade must still
    // be 0-100 rather than depending on them summing correctly.
    const questions = [open('a', 60), open('b', 60)];
    expect(computeGrade(questions, new Map([['a', 100], ['b', 0]]))).toBe(50);
  });

  it('cannot exceed 100 even when weights total far more', () => {
    const questions = [open('a', 100), open('b', 100), open('c', 100)];
    const perfect = new Map([['a', 100], ['b', 100], ['c', 100]]);
    expect(computeGrade(questions, perfect)).toBe(100);
  });

  it('respects weight — a heavy question moves the grade more', () => {
    const heavy = [open('a', 90), open('b', 10)];
    const light = [open('a', 10), open('b', 90)];
    const scores = new Map([['a', 100], ['b', 0]]);
    expect(computeGrade(heavy, scores)).toBe(90);
    expect(computeGrade(light, scores)).toBe(10);
  });

  it('returns 0 for an exam with no questions rather than dividing by zero', () => {
    expect(computeGrade([], new Map())).toBe(0);
  });

  it('rounds to two decimal places', () => {
    const questions = [open('a', 3), open('b', 7)];
    // (100*3 + 0*7) / 10 = 30 exactly; use thirds to force rounding.
    const thirds = [open('a', 1), open('b', 1), open('c', 1)];
    const scores = new Map([['a', 100], ['b', 0], ['c', 0]]);
    expect(computeGrade(thirds, scores)).toBe(33.33);
  });
});

describe('partitionByGradingMethod', () => {
  it('separates the two types, so only open text reaches the model', () => {
    // This split is what makes a 12-question exam cost one AI call, not twelve.
    const questions = [mc('a', 0), open('b'), mc('c', 1), open('d')];
    const { multipleChoice, openText } = partitionByGradingMethod(questions);
    expect(multipleChoice.map((q) => q.id)).toEqual(['a', 'c']);
    expect(openText.map((q) => q.id)).toEqual(['b', 'd']);
  });

  it('handles an exam with only one type', () => {
    const { multipleChoice, openText } = partitionByGradingMethod([open('a'), open('b')]);
    expect(multipleChoice).toHaveLength(0);
    expect(openText).toHaveLength(2);
  });
});
