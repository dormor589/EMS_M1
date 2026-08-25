/**
 * Question entity.
 *
 * SECURITY: `correctAnswer` is the exam's answer key. toJSON() omits it unless
 * the caller explicitly asks for it, so a student fetching an exam to sit it
 * cannot simply read the answers out of the API response. Only teachers who own
 * the exam — and the grading code — ever pass includeAnswerKey.
 */
class Question {
  constructor({ id, examId, type, text, options, correctAnswer, weight, position } = {}) {
    this.id = id;
    this.examId = examId;
    this.type = type;
    this.text = text;
    this.options = Array.isArray(options) ? options : [];
    this.correctAnswer = correctAnswer ?? null;
    this.weight = typeof weight === 'number' ? weight : 10;
    this.position = position ?? 0;
  }

  /** @returns {boolean} */
  isMultipleChoice() { return this.type === 'multiple-choice'; }

  /** @returns {boolean} */
  isOpenText() { return this.type === 'open-text'; }

  /**
   * Score a student's raw answer 0-100.
   *
   * Multiple-choice is deterministic and never involves a model: the submitted
   * option index either matches the key or it does not. Open-text returns null,
   * meaning "a grader must decide".
   *
   * @param {string} value The stored answer value.
   * @returns {number|null} 100, 0, or null for open-text.
   */
  scoreFor(value) {
    if (!this.isMultipleChoice()) return null;
    return Number(value) === this.correctAnswer ? 100 : 0;
  }

  /**
   * @param {object} row A `questions` table row.
   * @returns {Question}
   */
  static fromRow(row) {
    return new Question({
      id: row.id,
      examId: row.exam_id,
      type: row.type,
      text: row.text,
      options: row.options,
      correctAnswer: row.correct_answer,
      weight: row.weight,
      position: row.position,
    });
  }

  /**
   * @param {object}  [opts]
   * @param {boolean} [opts.includeAnswerKey] Emit correctAnswer. Teachers only.
   * @returns {object}
   */
  toJSON({ includeAnswerKey = false } = {}) {
    const json = {
      id: this.id,
      examId: this.examId,
      type: this.type,
      text: this.text,
      options: this.options,
      weight: this.weight,
      position: this.position,
    };
    if (includeAnswerKey) json.correctAnswer = this.correctAnswer;
    return json;
  }
}

export default Question;
