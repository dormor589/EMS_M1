/**
 * Exam entity model.
 *
 * Represents an exam created by a Teacher.
 * `questions` is stored as an array of plain objects (toJSON() of each Question)
 * so exams round-trip cleanly through JSON serialisation without circular refs.
 * Use Question.fromJSON() to re-hydrate when needed.
 *
 * Models are PURE — no service imports.
 *
 * Source: the milestone brief §7 — Exam entity
 */

import { generateId } from './util.js';

/** Valid statuses — mirrors ConfigService.getExamStatusOptions(). Source: spec §7. */
const VALID_STATUSES = ['Draft', 'Published', 'Closed'];

class Exam {
  /**
   * Create an Exam instance.
   *
   * @param {object}    data
   * @param {string}    [data.id]              - UUID. Auto-generated if omitted.
   * @param {string}    data.title             - Exam title (required).
   * @param {string}    [data.description]     - Optional description.
   * @param {number}    [data.durationMinutes] - Duration in minutes (default 60).
   * @param {string}    [data.status]          - 'Draft' | 'Published' | 'Closed' (default 'Draft').
   * @param {string}    data.createdBy         - User ID of the creating Teacher (required).
   * @param {object[]}  [data.questions]       - Array of Question plain objects (default []).
   * @param {string}    [data.createdAt]       - ISO timestamp string (default: now).
   * @throws {Error} if title or createdBy is missing, or status is invalid.
   */
  constructor({
    id,
    title,
    description,
    durationMinutes,
    status,
    createdBy,
    questions,
    createdAt,
  } = {}) {
    if (!title)     throw new Error('Exam: "title" is required');
    if (!createdBy) throw new Error('Exam: "createdBy" is required');

    const resolvedStatus = status || 'Draft';
    if (!VALID_STATUSES.includes(resolvedStatus)) {
      throw new Error(`Exam: invalid status "${resolvedStatus}". Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    /** @type {string} */
    this.id = id || generateId();
    /** @type {string} */
    this.title = title;
    /** @type {string} */
    this.description = description || '';
    /** @type {number} */
    this.durationMinutes = typeof durationMinutes === 'number' ? durationMinutes : 60;
    /** @type {'Draft'|'Published'|'Closed'} */
    this.status = resolvedStatus;
    /** @type {string} */
    this.createdBy = createdBy;
    /**
     * Questions stored as plain objects so JSON round-trips cleanly.
     * Re-hydrate with Question.fromJSON() when full Question behaviour is needed.
     * @type {object[]}
     */
    this.questions = Array.isArray(questions) ? questions : [];
    /** @type {string} */
    this.createdAt = createdAt || new Date().toISOString();
  }

  /**
   * Serialize to a plain object.
   *
   * Questions are already plain objects so no extra mapping is needed.
   *
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      durationMinutes: this.durationMinutes,
      status: this.status,
      createdBy: this.createdBy,
      questions: this.questions,
      createdAt: this.createdAt,
    };
  }

  /**
   * Hydrate an Exam from a plain object.
   *
   * @param {object} obj
   * @returns {Exam}
   */
  static fromJSON(obj) {
    return new Exam(obj);
  }
}

export default Exam;
