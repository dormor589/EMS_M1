/**
 * LoggerService — the server's only logging surface.
 *
 * Mirrors the client's LoggerService so both halves of the system log the same
 * way. Nothing else in the server calls `console` directly; routing every
 * message through here means the format can change in one place, and log level
 * is honoured consistently.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

class LoggerService {
  /**
   * @param {object}  [options]
   * @param {string}  [options.level] One of debug | info | warn | error | silent.
   */
  constructor({ level } = {}) {
    const requested = level || process.env.LOG_LEVEL || 'info';
    this._threshold = LEVELS[requested] ?? LEVELS.info;
  }

  /**
   * @param {string} level
   * @param {string} message
   * @param {object} [meta] Extra structured fields.
   * @private
   */
  _write(level, message, meta) {
    if (LEVELS[level] < this._threshold) return;

    const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}`;
    const extra = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';

    // The only place in the server permitted to touch console.
    // eslint-disable-next-line no-console
    (level === 'error' ? console.error : console.log)(line + extra);
  }

  debug(message, meta) { this._write('debug', message, meta); }
  info(message, meta)  { this._write('info',  message, meta); }
  warn(message, meta)  { this._write('warn',  message, meta); }
  error(message, meta) { this._write('error', message, meta); }
}

export { LoggerService };
export default new LoggerService();
