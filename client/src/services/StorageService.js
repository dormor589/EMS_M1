/**
 * StorageService — localStorage wrapper for EMS_M1.
 *
 * This is the ONLY file in the codebase permitted to access localStorage
 * directly. All other code reads/writes data through this service.
 *
 * Values are serialised as JSON on write and deserialised on read.
 * clear() is scoped: it removes only keys prefixed 'ems_' so unrelated
 * browser/application state is never touched.
 *
 * Source: the milestone brief §8 — StorageService
 */

import logger from './LoggerService.js';

/** Prefix used by all EMS storage keys. Scopes clear() to EMS data only. */
const EMS_KEY_PREFIX = 'ems_';

class StorageService {
  /**
   * Retrieve a stored value by key.
   *
   * Returns null if the key is absent or if the stored string is not valid JSON.
   *
   * @param {string} key - localStorage key.
   * @returns {*} Parsed value, or null.
   */
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (err) {
      logger.error('StorageService.get: failed to parse key "%s": %s', key, err.message);
      return null;
    }
  }

  /**
   * Persist a value under key, serialised as JSON.
   *
   * @param {string} key   - localStorage key.
   * @param {*}      value - Any JSON-serialisable value.
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      logger.error('StorageService.set: failed to write key "%s": %s', key, err.message);
    }
  }

  /**
   * Remove a single key from localStorage.
   *
   * @param {string} key - localStorage key.
   */
  remove(key) {
    localStorage.removeItem(key);
  }

  /**
   * Remove all EMS keys (keys prefixed 'ems_') from localStorage.
   *
   * Does NOT touch keys belonging to other applications or browser features.
   */
  clear() {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(EMS_KEY_PREFIX)) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    logger.info('StorageService.clear: removed %d EMS key(s)', toRemove.length);
  }

  /**
   * Returns true if the key exists in localStorage (value may be null).
   *
   * @param {string} key - localStorage key.
   * @returns {boolean}
   */
  has(key) {
    return localStorage.getItem(key) !== null;
  }
}

// Export singleton.
export default new StorageService();
