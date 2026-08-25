/**
 * requireRole — restrict a route to one role.
 *
 * Authorization, as distinct from the authentication that must run before it.
 * Mount as `router.post('/', authenticate, requireRole('teacher'), handler)`.
 */

import ApiError from '../utils/ApiError.js';

/**
 * @param {'teacher'|'student'} role
 * @returns {import('express').RequestHandler}
 */
export default function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user) {
      // A programming error, not a client one: requireRole was mounted without
      // authenticate in front of it.
      return next(ApiError.internal('requireRole used without authenticate'));
    }
    if (req.user.role !== role) {
      return next(ApiError.forbidden(`Only a ${role} can do that`));
    }
    next();
  };
}
