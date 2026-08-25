/**
 * validate — check a request against a zod schema before a controller sees it.
 *
 * Controllers and services can then assume well-formed input, and a client that
 * sends something malformed gets a precise, field-level 400 rather than a
 * database constraint violation surfacing as a 500.
 */

import ApiError from '../utils/ApiError.js';

/**
 * @param {import('zod').ZodType} schema
 * @param {'body'|'params'|'query'} [source]
 * @returns {import('express').RequestHandler}
 */
export default function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const fields = result.error.issues.map((i) => ({
        field: i.path.join('.') || source,
        message: i.message,
      }));
      return next(ApiError.badRequest('Some fields need fixing', { fields }));
    }

    // Use the parsed value: zod has applied defaults, coercion and trimming.
    // req.query is a getter in Express 5, so assign only where it is safe to.
    if (source === 'query') req.validatedQuery = result.data;
    else req[source] = result.data;

    next();
  };
}
