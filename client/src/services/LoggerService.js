/**
 * LoggerService — central logging for EMS_M1.
 *
 * This is the ONLY file in the codebase permitted to call console.* directly.
 * All other production files route log output through this service.
 *
 * Includes a level filter: messages below the current level are silently
 * dropped. Levels in ascending severity: debug < info < warn < error.
 *
 * Source: the milestone brief §8 — LoggerService
 */

// ── Level constants ───────────────────────────────────────────────────────────

/** Numeric severity for each level. Higher = more severe. */
const LEVELS = Object.freeze({
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
});

/** Default minimum level; messages below this are dropped. */
const DEFAULT_LEVEL = 'info';

// ── Class ─────────────────────────────────────────────────────────────────────

class LoggerService {
  constructor() {
    this._level = LEVELS[DEFAULT_LEVEL];
  }

  /**
   * Set the minimum log level.
   *
   * Messages with severity below this level are silently dropped.
   *
   * @param {'debug'|'info'|'warn'|'error'} level
   * @throws {Error} if the supplied level is not recognised
   */
  setLevel(level) {
    if (!(level in LEVELS)) {
      throw new Error(`LoggerService.setLevel: unknown level '${level}'. Use one of: ${Object.keys(LEVELS).join(', ')}`);
    }
    this._level = LEVELS[level];
  }

  /**
   * Returns the current minimum log level name.
   *
   * @returns {'debug'|'info'|'warn'|'error'}
   */
  getLevel() {
    return Object.keys(LEVELS).find((k) => LEVELS[k] === this._level);
  }

  /**
   * Log an informational message.
   *
   * Dropped when current level is above 'info'.
   *
   * @param {string} msg  - Message string (may include printf-style placeholders).
   * @param {...*}   args - Additional values passed through to console.info.
   */
  info(msg, ...args) {
    if (this._level <= LEVELS.info) {
      console.info(`[EMS][INFO] ${msg}`, ...args);
    }
  }

  /**
   * Log a warning message.
   *
   * Dropped when current level is above 'warn'.
   *
   * @param {string} msg
   * @param {...*}   args
   */
  warn(msg, ...args) {
    if (this._level <= LEVELS.warn) {
      console.warn(`[EMS][WARN] ${msg}`, ...args);
    }
  }

  /**
   * Log an error message.
   *
   * Always emitted unless level is set above 'error' (not currently possible).
   *
   * @param {string} msg
   * @param {...*}   args
   */
  error(msg, ...args) {
    if (this._level <= LEVELS.error) {
      console.error(`[EMS][ERROR] ${msg}`, ...args);
    }
  }

  /**
   * Log a debug message.
   *
   * Only emitted when level is set to 'debug'.
   *
   * @param {string} msg
   * @param {...*}   args
   */
  debug(msg, ...args) {
    if (this._level <= LEVELS.debug) {
      console.debug(`[EMS][DEBUG] ${msg}`, ...args);
    }
  }
}

// Export singleton.
export default new LoggerService();
