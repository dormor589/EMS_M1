/**
 * authenticate — verify the bearer token and attach the caller to the request.
 *
 * Every protected route goes through this. It loads the user from the database
 * rather than trusting the token's claims wholesale, so a deleted account
 * cannot keep acting on a token that has not yet expired.
 */

import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import AuthService from '../services/AuthService.js';

const auth = new AuthService();

/**
 * Pull the token out of an Authorization header.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function bearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token;
}

export default asyncHandler(async (req, _res, next) => {
  const token = bearerToken(req);
  if (!token) throw ApiError.unauthorized('Please log in to continue');

  const claims = auth.verifyToken(token);
  // Confirms the account still exists, and gives handlers a real model instance
  // with isTeacher() / isStudent() rather than a bare role string.
  req.user = await auth.requireUser(claims.sub);
  next();
});
