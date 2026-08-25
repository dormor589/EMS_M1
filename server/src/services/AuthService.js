/**
 * AuthService — registration, login, and token verification.
 *
 * Milestone 1 compared plaintext passwords in the browser. This replaces that
 * entirely: passwords are bcrypt-hashed, never returned by any endpoint, and
 * identity travels as a signed JWT.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config, { ROLES } from '../config/index.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import UserRepository from '../db/repositories/UserRepository.js';

class AuthService {
  /** @param {UserRepository} [users] */
  constructor(users = new UserRepository()) {
    this._users = users;
  }

  /**
   * Register a new account and return it with a token.
   *
   * @param {object} data
   * @param {string} data.name
   * @param {string} data.email
   * @param {string} data.password Plaintext; hashed here and never stored raw.
   * @param {string} data.role
   * @returns {Promise<{ user: object, token: string }>}
   * @throws {ApiError} 409 if the email is already registered.
   */
  async register({ name, email, password, role }) {
    const existing = await this._users.findByEmail(email);
    if (existing) {
      throw ApiError.conflict('That email is already registered');
    }

    const passwordHash = await bcrypt.hash(password, config.bcrypt.saltRounds);
    const user = await this._users.create({ name, email, passwordHash, role });

    logger.info('user registered', { id: user.id, role: user.role });
    return { user: user.toJSON(), token: this.issueToken(user) };
  }

  /**
   * Authenticate an email and password.
   *
   * A missing user and a wrong password produce the same error, so the response
   * cannot be used to discover which addresses are registered.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ user: object, token: string }>}
   * @throws {ApiError} 401 on any failure.
   */
  async login(email, password) {
    const user = await this._users.findByEmail(email);

    // Hash a dummy value when the user does not exist, so both paths take
    // roughly the same time and timing cannot reveal which emails are known.
    const hash = user?.passwordHash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const ok = await bcrypt.compare(password, hash);

    if (!user || !ok) {
      logger.warn('failed login', { email: String(email).toLowerCase() });
      throw ApiError.unauthorized('Invalid email or password');
    }

    logger.info('user logged in', { id: user.id, role: user.role });
    return { user: user.toJSON(), token: this.issueToken(user) };
  }

  /**
   * Sign a JWT for a user.
   *
   * The role is embedded so authorization does not need a database round trip
   * on every request. It is therefore a snapshot: a role change takes effect
   * when the token is next issued, which is acceptable because roles are fixed
   * at registration in this system.
   *
   * @param {import('../models/User.js').default} user
   * @returns {string}
   */
  issueToken(user) {
    return jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn, issuer: config.jwt.issuer }
    );
  }

  /**
   * Verify a token and return its claims.
   *
   * @param {string} token
   * @returns {{ sub: string, role: string, email: string }}
   * @throws {ApiError} 401 if the token is missing, malformed, or expired.
   */
  verifyToken(token) {
    if (!token) throw ApiError.unauthorized();
    try {
      return jwt.verify(token, config.jwt.secret, { issuer: config.jwt.issuer });
    } catch (err) {
      const message = err.name === 'TokenExpiredError'
        ? 'Your session has expired — please log in again'
        : 'Invalid authentication token';
      throw ApiError.unauthorized(message);
    }
  }

  /**
   * @param {string} id
   * @returns {Promise<import('../models/User.js').default>}
   * @throws {ApiError} 401 if the user behind a valid token no longer exists.
   */
  async requireUser(id) {
    const user = await this._users.findById(id);
    if (!user) throw ApiError.unauthorized('Your account no longer exists');
    return user;
  }
}

export { ROLES };
export default AuthService;
