/**
 * NotifyService — centralised success/error/warning notifications for EMS_M1.
 *
 * Uses an in-memory subscriber pattern. Any component can subscribe to receive
 * notification objects; M1 does not require a visible toast UI, but the wiring
 * is ready for M2.
 *
 * Notification shape:
 *   { type: 'success'|'error'|'warning', message: string, id: string, timestamp: number }
 *
 * Source: docs/spec_brief.txt §8 — NotifyService
 */

import logger from './LoggerService.js';

/** Notification type constants. */
const TYPES = Object.freeze({
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
});

/** Simple incrementing counter for unique notification IDs within a session. */
let _idCounter = 0;

/**
 * Generate a unique notification ID.
 * @returns {string}
 */
function generateId() {
  _idCounter += 1;
  return `notif_${Date.now()}_${_idCounter}`;
}

class NotifyService {
  constructor() {
    /** @type {Set<function>} */
    this._listeners = new Set();
  }

  /**
   * Subscribe to notifications.
   *
   * @param {function({ type: string, message: string, id: string, timestamp: number }): void} listener
   * @returns {function(): void} Unsubscribe function — call it to stop receiving notifications.
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Emit a success notification.
   *
   * @param {string} message
   */
  success(message) {
    this._emit(TYPES.SUCCESS, message);
  }

  /**
   * Emit an error notification.
   *
   * @param {string} message
   */
  error(message) {
    this._emit(TYPES.ERROR, message);
  }

  /**
   * Emit a warning notification.
   *
   * @param {string} message
   */
  warning(message) {
    this._emit(TYPES.WARNING, message);
  }

  /**
   * Internal: build a notification object and dispatch it to all listeners.
   *
   * @param {'success'|'error'|'warning'} type
   * @param {string} message
   * @private
   */
  _emit(type, message) {
    const notification = {
      type,
      message,
      id: generateId(),
      timestamp: Date.now(),
    };
    logger.info('NotifyService: %s — %s', type, message);
    this._listeners.forEach((listener) => {
      try {
        listener(notification);
      } catch (err) {
        logger.error('NotifyService: listener threw: %s', err.message);
      }
    });
  }

  /**
   * Returns the current number of active subscribers.
   * Useful for testing and diagnostics.
   *
   * @returns {number}
   */
  listenerCount() {
    return this._listeners.size;
  }
}

// Export singleton.
export default new NotifyService();
