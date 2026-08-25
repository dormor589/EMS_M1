/**
 * AuthService — authentication against the Express API.
 *
 * Milestone 1 compared plaintext passwords held in localStorage. That is gone:
 * credentials go to the server, which verifies a bcrypt hash and returns a
 * signed JWT. The browser stores the token and the public user record — never
 * a password.
 *
 * getCurrentUser() and the role checks are intentionally SYNCHRONOUS, because
 * route guards and the navigation menu read them during render. The user record
 * is cached in storage at login precisely so those calls need no round trip.
 *
 * Source: the milestone brief §8 — AuthService
 */

import User from '../models/User.js';

/** Basic email format check; the server validates properly. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors ConfigService.getRoles() — kept local to avoid a circular import. */
const VALID_ROLES = ['teacher', 'student'];

/** Matches the server's rule, so the form can fail fast without a round trip. */
const MIN_PASSWORD_LENGTH = 8;

class AuthService {
  /**
   * @param {import('./HttpApiService.js').default} api
   * @param {import('./StorageService.js').default} storage
   * @param {import('./ConfigService.js').default}  config
   * @param {import('./LoggerService.js').default}  logger
   */
  constructor(api, storage, config, logger) {
    if (!api)     throw new Error('AuthService: "api" dependency is required');
    if (!storage) throw new Error('AuthService: "storage" dependency is required');
    if (!config)  throw new Error('AuthService: "config" dependency is required');
    if (!logger)  throw new Error('AuthService: "logger" dependency is required');

    this._api     = api;
    this._storage = storage;
    this._config  = config;
    this._logger  = logger;
    this._currentUserKey = config.getStorageKeys().currentUser;

    // When the API rejects our token, drop the cached user too, so the app does
    // not keep rendering as though someone is logged in.
    this._api.onUnauthorized = () => {
      this._storage.remove(this._currentUserKey);
      this._logger.warn('AuthService: session rejected by the server, cleared');
    };
  }

  // ── Session ──────────────────────────────────────────────────────────────

  /**
   * Log in.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<User>}
   * @throws {Error} 'Invalid email or password' — the server does not reveal
   *   whether the address exists.
   */
  async login(email, password) {
    if (!email || !password) throw new Error('Enter your email and password');

    const { user, token } = await this._api.post('/auth/login', { email, password });

    this._api.setToken(token);
    this._storage.set(this._currentUserKey, user);
    this._logger.info('AuthService.login: %s (%s)', user.email, user.role);
    return User.fromJSON(user);
  }

  /**
   * Register and sign in as the new account.
   *
   * Validated here as well as on the server so the form can respond instantly;
   * the server's rules remain authoritative.
   *
   * @param {object} data
   * @param {string} data.name
   * @param {string} data.email
   * @param {string} data.password
   * @param {string} data.role
   * @returns {Promise<User>}
   */
  async register({ name, email, password, role } = {}) {
    if (!name)     throw new Error('Name is required');
    if (!email)    throw new Error('Email is required');
    if (!password) throw new Error('Password is required');
    if (!role)     throw new Error('Role is required');

    if (!EMAIL_REGEX.test(email)) throw new Error('Enter a valid email address');
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    if (!VALID_ROLES.includes(role)) {
      throw new Error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    const { user, token } = await this._api.post('/auth/register', {
      name, email, password, role,
    });

    this._api.setToken(token);
    this._storage.set(this._currentUserKey, user);
    this._logger.info('AuthService.register: %s (%s)', user.email, user.role);
    return User.fromJSON(user);
  }

  /** Log out: drop the token and the cached user. */
  logout() {
    this._api.clearToken();
    this._storage.remove(this._currentUserKey);
    this._logger.info('AuthService.logout');
  }

  /**
   * The signed-in user, read synchronously from storage.
   *
   * @returns {User|null}
   */
  getCurrentUser() {
    const data = this._storage.get(this._currentUserKey);
    if (!data) return null;
    try {
      return User.fromJSON(data);
    } catch (err) {
      this._logger.warn('AuthService.getCurrentUser: stored user invalid, clearing — %s', err.message);
      this._storage.remove(this._currentUserKey);
      return null;
    }
  }

  /**
   * Re-check the session against the server and refresh the cached user.
   *
   * Called once at boot: a token can expire or be revoked while the tab is
   * closed, and only the server can say so.
   *
   * @returns {Promise<User|null>}
   */
  async refreshSession() {
    if (!this._api.getToken()) {
      // A cached user with no token is a leftover from Milestone 1, when the
      // whole user record (password included) lived in localStorage. It would
      // otherwise render as a signed-in session whose every request 401s.
      if (this._storage.get(this._currentUserKey)) {
        this._storage.remove(this._currentUserKey);
        this._logger.warn('AuthService: cleared a stale session with no token');
      }
      return null;
    }
    try {
      const { user } = await this._api.get('/auth/me');
      this._storage.set(this._currentUserKey, user);
      return User.fromJSON(user);
    } catch (err) {
      // A 401 has already cleared the session via onUnauthorized. Anything else
      // (the API being down, say) should not log a valid user out.
      this._logger.warn('AuthService.refreshSession: %s', err.message);
      return this.getCurrentUser();
    }
  }

  // ── Role checks ──────────────────────────────────────────────────────────

  /** @returns {boolean} */
  isAuthenticated() { return this.getCurrentUser() !== null; }

  /** @returns {boolean} */
  isTeacher() { return this.getCurrentUser()?.role === 'teacher'; }

  /** @returns {boolean} */
  isStudent() { return this.getCurrentUser()?.role === 'student'; }
}

export default AuthService;
