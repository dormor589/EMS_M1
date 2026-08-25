/**
 * errorHandler — the single place an error becomes an HTTP response.
 *
 * An ApiError carries a status and a message written for a client. Anything
 * else is an unexpected fault: it is logged in full server-side and reported as
 * a bare 500, so SQL text, stack traces and driver internals never reach a
 * caller.
 */

import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

/** Postgres SQLSTATEs worth translating into something a user can act on. */
const PG_ERRORS = {
  '23505': { status: 409, message: 'That already exists' },
  '23503': { status: 409, message: 'That refers to something which no longer exists' },
  '23514': { status: 422, message: 'That value is not allowed' },
  '22P02': { status: 400, message: 'Malformed identifier' },
};

// eslint-disable-next-line no-unused-vars -- Express identifies the error
// handler by its four-argument signature; `next` must stay.
export default function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    if (err.status >= 500) logger.error(err.message, { path: req.path });
    return res.status(err.status).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  const pg = PG_ERRORS[err.code];
  if (pg) {
    logger.warn('database constraint rejected a write', {
      code: err.code, constraint: err.constraint, path: req.path,
    });
    return res.status(pg.status).json({ error: pg.message });
  }

  logger.error('unhandled error', {
    message: err.message,
    path: req.path,
    method: req.method,
    stack: config.isProduction ? undefined : err.stack,
  });
  res.status(500).json({ error: 'Something went wrong on our end' });
}
