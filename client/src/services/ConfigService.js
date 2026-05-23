/**
 * ConfigService — central configuration values for EMS_M1.
 *
 * This is the project's single source of constants (equivalent to constants.py
 * in quant deployments). All magic strings and configuration values live here.
 * Other modules import from this service; nothing is duplicated elsewhere.
 *
 * Source: docs/spec_brief.txt §8 — ConfigService
 */

// ── Module-level constants ────────────────────────────────────────────────────

/** API mode for Milestone 1 — all calls are mocked locally. */
const API_MODE = 'mock';

/** localStorage key names. Prefixed with 'ems_' for scoped clear(). */
const STORAGE_KEYS = Object.freeze({
  users: 'ems_users',
  exams: 'ems_exams',
  submissions: 'ems_submissions',
  currentUser: 'ems_current_user',
});

/** Default status for a newly-created exam. Source: spec §5.1 state machine. */
const DEFAULT_EXAM_STATUS = 'Draft';

/** Valid exam statuses in state-machine order. Source: spec §5.1. */
const EXAM_STATUS_OPTIONS = Object.freeze(['Draft', 'Published', 'Closed']);

/** Valid user roles. Source: spec §2 (User Types). */
const ROLES = Object.freeze(['teacher', 'student']);

/** Question types supported in M1. Source: spec §7. */
const QUESTION_TYPES = Object.freeze(['multiple-choice', 'open-text']);

// ── Class ─────────────────────────────────────────────────────────────────────

class ConfigService {
  /**
   * Returns the current API mode.
   *
   * In M1 this is always 'mock'. M2+ will introduce 'live'.
   *
   * @returns {string} 'mock'
   */
  getApiMode() {
    return API_MODE;
  }

  /**
   * Returns the canonical localStorage key names used across the app.
   *
   * Keys are prefixed 'ems_' so StorageService.clear() can scope removal.
   *
   * @returns {{ users: string, exams: string, submissions: string, currentUser: string }}
   */
  getStorageKeys() {
    return STORAGE_KEYS;
  }

  /**
   * Returns the default status assigned to a newly created exam.
   *
   * @returns {string} 'Draft'
   */
  getDefaultExamStatus() {
    return DEFAULT_EXAM_STATUS;
  }

  /**
   * Returns the ordered list of valid exam statuses.
   *
   * State machine: Draft → Published → Closed (one-way, teacher-only).
   *
   * @returns {readonly string[]} ['Draft', 'Published', 'Closed']
   */
  getExamStatusOptions() {
    return EXAM_STATUS_OPTIONS;
  }

  /**
   * Returns the valid user roles.
   *
   * @returns {readonly string[]} ['teacher', 'student']
   */
  getRoles() {
    return ROLES;
  }

  /**
   * Returns the question types supported in M1.
   *
   * @returns {readonly string[]} ['multiple-choice', 'open-text']
   */
  getQuestionTypes() {
    return QUESTION_TYPES;
  }
}

// Export singleton — one instance shared across the whole app.
export default new ConfigService();
