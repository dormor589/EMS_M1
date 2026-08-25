/**
 * ConfigService — central configuration values for EMS_M1.
 *
 * This is the project's single source of constants (equivalent to constants.py
 * in quant deployments). All magic strings and configuration values live here.
 * Other modules import from this service; nothing is duplicated elsewhere.
 *
 * Source: the milestone brief §8 — ConfigService
 */

// ── Module-level constants ────────────────────────────────────────────────────

/**
 * API mode.
 *
 * 'live' talks to the Express API; 'mock' uses the in-browser localStorage
 * implementation kept from Milestone 1. Set VITE_API_MODE=mock to fall back —
 * useful for demoing the UI with no server running, and it keeps the service
 * tests able to run without a database.
 */
const API_MODE = import.meta.env?.VITE_API_MODE || 'live';

/** Base URL of the Express API. Overridable per environment. */
const API_BASE_URL =
  import.meta.env?.VITE_API_URL || 'http://localhost:5050/api';

/** localStorage key names. Prefixed with 'ems_' for scoped clear(). */
const STORAGE_KEYS = Object.freeze({
  users: 'ems_users',
  exams: 'ems_exams',
  submissions: 'ems_submissions',
  currentUser: 'ems_current_user',
  /** Signed JWT from the API. Replaces M1's plaintext password in storage. */
  authToken: 'ems_auth_token',
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
   * Returns the current API mode: 'live' or 'mock'.
   *
   * @returns {string}
   */
  getApiMode() {
    return API_MODE;
  }

  /**
   * True when the app should talk to the real Express API.
   *
   * @returns {boolean}
   */
  isLive() {
    return API_MODE === 'live';
  }

  /**
   * Base URL of the API, without a trailing slash.
   *
   * @returns {string}
   */
  getApiBaseUrl() {
    return API_BASE_URL.replace(/\/$/, '');
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
