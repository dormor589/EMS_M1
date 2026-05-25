/**
 * Submission entity model.
 *
 * Represents a Student's exam submission.
 * `answers` is stored as an array of Answer plain objects; use Answer.fromJSON()
 * to re-hydrate when full Answer behaviour is needed.
 *
 * Models are PURE — no service imports.
 *
 * Source: the milestone brief §7 — Submission entity
 */

import { generateId } from './util.js';

/** Valid submission statuses. */
const VALID_STATUSES = ['submitted', 'graded'];

class Submission {
  /**
   * Create a Submission instance.
   *
   * @param {object}   data
   * @param {string}   [data.id]          - UUID. Auto-generated if omitted.
   * @param {string}   data.examId        - ID of the Exam being submitted (required).
   * @param {string}   data.studentId     - ID of the submitting Student (required).
   * @param {object[]} [data.answers]     - Array of Answer plain objects (default []).
   * @param {string}   [data.status]      - 'submitted' | 'graded' (default 'submitted').
   * @param {number|null} [data.grade]    - Numeric grade (null until graded).
   * @param {string}   [data.feedback]    - Teacher feedback text (default '').
   * @param {string}   [data.submittedAt] - ISO timestamp (default: now).
   * @throws {Error} if examId or studentId is missing.
   */
  constructor({
    id,
    examId,
    studentId,
    answers,
    status,
    grade,
    feedback,
    submittedAt,
  } = {}) {
    if (!examId)    throw new Error('Submission: "examId" is required');
    if (!studentId) throw new Error('Submission: "studentId" is required');

    const resolvedStatus = status || 'submitted';
    if (!VALID_STATUSES.includes(resolvedStatus)) {
      throw new Error(`Submission: invalid status "${resolvedStatus}". Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    /** @type {string} */
    this.id = id || generateId();
    /** @type {string} */
    this.examId = examId;
    /** @type {string} */
    this.studentId = studentId;
    /**
     * Answers stored as plain objects for clean JSON serialisation.
     * @type {object[]}
     */
    this.answers = Array.isArray(answers) ? answers : [];
    /** @type {'submitted'|'graded'} */
    this.status = resolvedStatus;
    /** @type {number|null} */
    this.grade = grade !== undefined ? grade : null;
    /** @type {string} */
    this.feedback = feedback || '';
    /** @type {string} */
    this.submittedAt = submittedAt || new Date().toISOString();
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
      studentId: this.studentId,
      answers: this.answers,
      status: this.status,
      grade: this.grade,
      feedback: this.feedback,
      submittedAt: this.submittedAt,
    };
  }

  /**
   * Hydrate a Submission from a plain object.
   *
   * @param {object} obj
   * @returns {Submission}
   */
  static fromJSON(obj) {
    return new Submission(obj);
  }
}

export default Submission;
