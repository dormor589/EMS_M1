/**
 * Question entity model.
 *
 * Represents a single question within an Exam.
 * Models are PURE — no service imports.
 *
 * Source: docs/spec_brief.txt §7 — Question entity
 */

import { generateId } from './util.js';

/** Valid question types — mirrors ConfigService.getQuestionTypes(). Source: spec §7. */
const VALID_TYPES = ['multiple-choice', 'open-text'];

class Question {
  /**
   * Create a Question instance.
   *
   * @param {object}   data
   * @param {string}   [data.id]            - UUID. Auto-generated if omitted.
   * @param {string}   data.examId          - ID of the parent Exam.
   * @param {string}   data.type            - 'multiple-choice' | 'open-text'.
   * @param {string}   data.text            - Question prompt text.
   * @param {string[]} [data.options]       - Choices for multiple-choice; must be
   *                                          non-empty. Empty array for open-text.
   * @param {*}        [data.correctAnswer] - Index or string for MC; optional for open-text.
   * @param {number}   [data.points]        - Point value (default 1).
   * @throws {Error} if required fields are missing, type is invalid, or
   *                 multiple-choice question has no options.
   */
  constructor({ id, examId, type, text, options, correctAnswer, points } = {}) {
    if (!examId) throw new Error('Question: "examId" is required');
    if (!type)   throw new Error('Question: "type" is required');
    if (!text)   throw new Error('Question: "text" is required');
    if (!VALID_TYPES.includes(type)) {
      throw new Error(`Question: invalid type "${type}". Must be one of: ${VALID_TYPES.join(', ')}`);
    }

    const resolvedOptions = options || [];
    if (type === 'multiple-choice' && resolvedOptions.length === 0) {
      throw new Error('Question: "multiple-choice" questions must have at least one option');
    }

    /** @type {string} */
    this.id = id || generateId();
    /** @type {string} */
    this.examId = examId;
    /** @type {'multiple-choice'|'open-text'} */
    this.type = type;
    /** @type {string} */
    this.text = text;
    /** @type {string[]} */
    this.options = resolvedOptions;
    /** @type {*} */
    this.correctAnswer = correctAnswer !== undefined ? correctAnswer : null;
    /** @type {number} */
    this.points = typeof points === 'number' ? points : 1;
  }

  /**
   * Serialize to a plain object.
   *
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      examId: this.examId,
      type: this.type,
      text: this.text,
      options: this.options,
      correctAnswer: this.correctAnswer,
      points: this.points,
    };
  }

  /**
   * Hydrate a Question from a plain object.
   *
   * @param {object} obj
   * @returns {Question}
   */
  static fromJSON(obj) {
    return new Question(obj);
  }
}

export default Question;
