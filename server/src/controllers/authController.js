/**
 * authController — HTTP layer for registration, login, and identity.
 *
 * Controllers translate between HTTP and the services; every business rule
 * lives a layer down, so these stay thin enough to read at a glance.
 */

import asyncHandler from '../utils/asyncHandler.js';
import AuthService from '../services/AuthService.js';

const auth = new AuthService();

/** POST /api/auth/register */
export const register = asyncHandler(async (req, res) => {
  const result = await auth.register(req.body);
  res.status(201).json(result);
});

/** POST /api/auth/login */
export const login = asyncHandler(async (req, res) => {
  const result = await auth.login(req.body.email, req.body.password);
  res.json(result);
});

/** GET /api/auth/me — who the current token belongs to. */
export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toJSON() });
});
