/**
 * Answer entity model.
 *
 * Embedded inside a Submission — not stored as a top-level collection.
 * Represents a student's response to a single question.
 *
 * Source: the milestone brief §7 — Answer entity
 */

class Answer {
  /**
   * Create an Answer instance.
   *
   * @param {object} data
   * @param {string} data.questionId - ID of the Question being answered.
   * @param {*}      data.value      - Student's response.
   *                                   For multiple-choice: the selected option (string/index).
   *                                   For open-text: a plain string.
   * @throws {Error} if questionId is missing.
   */
  constructor({ questionId, value } = {}) {
    if (!questionId) throw new Error('Answer: "questionId" is required');

    /** @type {string} */
    this.questionId = questionId;
    /** @type {*} */
    this.value = value !== undefined ? value : null;
  }

  /**
   * Serialize to a plain object.
   *
   * @returns {{ questionId: string, value: * }}
   */
  toJSON() {
    return {
      questionId: this.questionId,
      value: this.value,
    };
  }

  /**
   * Hydrate an Answer from a plain object.
   *
   * @param {object} obj
   * @returns {Answer}
   */
  static fromJSON(obj) {
    return new Answer(obj);
  }
}

export default Answer;
