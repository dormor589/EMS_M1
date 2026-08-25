/**
 * requestLogger — one line per request, with its outcome and duration.
 *
 * Written here rather than pulled in as a dependency so the format matches the
 * rest of the server's logging and no request body is ever recorded — request
 * bodies carry passwords.
 */

import logger from '../utils/logger.js';

export default function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const meta = {
      status: res.statusCode,
      ms: Math.round(ms),
      ...(req.user ? { user: req.user.id } : {}),
    };
    const line = `${req.method} ${req.originalUrl}`;
    if (res.statusCode >= 500) logger.error(line, meta);
    else if (res.statusCode >= 400) logger.warn(line, meta);
    else logger.info(line, meta);
  });

  next();
}
