/**
 * grading.js — the grade calculation, as pure functions.
 *
 * Kept free of database and HTTP concerns so the identical code serves the
 * manual path, the AI path, and the unit tests. There is exactly one place in
 * the system where a grade is computed.
 */

/**
 * Score one multiple-choice answer.
 *
 * Deterministic by design: no model is involved in marking multiple choice, so
 * it can never be inconsistent between two runs, and an exam of ten MC plus two
 * open questions costs two AI calls rather than twelve.
 *
 * @param {import('../models/Question.js').default} question
 * @param {string} value The submitted option index, as stored.
 * @returns {{ score: number, isCorrect: boolean }}
 */
export function scoreMultipleChoice(question, value) {
  const isCorrect = value !== '' && value !== null && Number(value) === question.correctAnswer;
  return { score: isCorrect ? 100 : 0, isCorrect };
}

/**
 * Compute an overall grade from per-question scores.
 *
 *     grade = sum(score * weight) / sum(weight)
 *
 * Dividing by the total weight rather than by 100 makes the weights
 * self-normalising. A teacher can add a question to an exam whose weights
 * already total 100, or leave them mid-edit at any total at all, and the result
 * is still 0-100 — so no validation has to block a save to keep grades sane.
 *
 * Every question on the exam counts. A question with no score contributes zero
 * rather than being excluded, because an unanswered question is worth nothing,
 * not "not applicable".
 *
 * @param {import('../models/Question.js').default[]} questions Every question on the exam.
 * @param {Map<string, number|null>} scoreByQuestionId
 * @returns {number} Grade 0-100, rounded to two decimal places.
 */
export function computeGrade(questions, scoreByQuestionId) {
  const totalWeight = questions.reduce((sum, q) => sum + q.weight, 0);
  if (totalWeight === 0) return 0;

  const earned = questions.reduce((sum, q) => {
    const score = scoreByQuestionId.get(q.id);
    return sum + (typeof score === 'number' ? score : 0) * q.weight;
  }, 0);

  return Math.round((earned / totalWeight) * 100) / 100;
}

/**
 * Split an exam's questions by how they get marked.
 *
 * @param {import('../models/Question.js').default[]} questions
 * @returns {{ multipleChoice: object[], openText: object[] }}
 */
export function partitionByGradingMethod(questions) {
  return {
    multipleChoice: questions.filter((q) => q.isMultipleChoice()),
    openText:       questions.filter((q) => q.isOpenText()),
  };
}
