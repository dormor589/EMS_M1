/**
 * asyncHandler — wrap an async route handler so a rejected promise reaches
 * Express's error pipeline instead of becoming an unhandled rejection.
 *
 * Express 5 forwards rejected promises on its own, but wrapping explicitly
 * keeps the intent visible at every route and keeps the controllers portable.
 *
 * @param {Function} fn
 * @returns {import('express').RequestHandler}
 */
export default function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
