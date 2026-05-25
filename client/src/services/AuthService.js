/**
 * AuthService — mock authentication and current-user state for EMS_M1.
 *
 * M1 LIMITATION: passwords are compared plain-text against the mock DB.
 * Real bcrypt hashing + JWT are deferred to Milestone 2.
 * NEVER ship this approach to a real backend.
 *
 * Constructor receives all dependencies via injection (wired in services/index.js).
 * Current user is persisted via StorageService — no direct localStorage access.
 *
 * Source: the milestone brief §8 — AuthService
 */

import User from '../models/User.js';

/** Basic email format check — stricter validation deferred to M2. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors ConfigService.getRoles() — kept local to avoid circular import. */
const VALID_ROLES = ['teacher', 'student'];

/** Minimum password length for M1 (no hashing — keep short for demo ease). */
const MIN_PASSWORD_LENGTH = 4;

class AuthService {
  /**
   * @param {import('./MockApiService.js').default} mockApi - MockApiService singleton.
   * @param {import('./StorageService.js').default}  storage - StorageService singleton.
   * @param {import('./ConfigService.js').default}   config  - ConfigService singleton.
   * @param {import('./LoggerService.js').default}   logger  - LoggerService singleton.
   */
  constructor(mockApi, storage, config, logger) {
    if (!mockApi)  throw new Error('AuthService: "mockApi" dependency is required');
    if (!storage)  throw new Error('AuthService: "storage" dependency is required');
    if (!config)   throw new Error('AuthService: "config" dependency is required');
    if (!logger)   throw new Error('AuthService: "logger" dependency is required');

    this._mockApi = mockApi;
    this._storage = storage;
    this._config  = config;
    this._logger  = logger;
    /** @type {string} */
    this._currentUserKey = config.getStorageKeys().currentUser;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Authenticate a user by email and password.
   *
   * Looks up the user in the mock DB, compares plain-text password (M1 only),
   * persists the current user to storage on success.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<User>} Authenticated user.
   * @throws {Error} 'Invalid credentials' if email not found or password mismatch.
   */
  async login(email, password) {
    if (!email || !password) {
      throw new Error('Invalid credentials');
    }

    const users = await this._mockApi.get('users');
    const record = users.find((u) => u.email === email);

    // M1 plain-text comparison — replace with bcrypt.compare() in M2.
    if (!record || record.password !== password) {
      throw new Error('Invalid credentials');
    }

    this._storage.set(this._currentUserKey, record);
    this._logger.info('AuthService.login: %s (%s)', record.email, record.role);
    return User.fromJSON(record);
  }

  /**
   * Register a new user and auto-log them in.
   *
   * Validates all required fields, rejects duplicate emails, inserts via MockApi,
   * and persists the new user as the current session user.
   *
   * @param {object} data
   * @param {string} data.name
   * @param {string} data.email
   * @param {string} data.password
   * @param {string} data.role - 'teacher' | 'student'
   * @returns {Promise<User>} The newly created user.
   * @throws {Error} on validation failure or duplicate email.
   */
  async register({ name, email, password, role } = {}) {
    // Field presence
    if (!name)     throw new Error('Name is required');
    if (!email)    throw new Error('Email is required');
    if (!password) throw new Error('Password is required');
    if (!role)     throw new Error('Role is required');

    // Format validation
    if (!EMAIL_REGEX.test(email)) {
      throw new Error('Invalid email address');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    if (!VALID_ROLES.includes(role)) {
      throw new Error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    // Duplicate email check
    const users = await this._mockApi.get('users');
    if (users.find((u) => u.email === email)) {
      throw new Error('Email already registered');
    }

    // Create + persist
    const user = new User({ name, email, password, role });
    await this._mockApi.post('users', user.toJSON());
    this._storage.set(this._currentUserKey, user.toJSON());
    this._logger.info('AuthService.register: %s (%s)', user.email, user.role);
    return user;
  }

  /**
   * Log out the current user by removing their session from storage.
   */
  logout() {
    this._storage.remove(this._currentUserKey);
    this._logger.info('AuthService.logout');
  }

  /**
   * Return the currently logged-in user, or null if not authenticated.
   *
   * Reads from StorageService and rehydrates a User model.
   * If the stored data is corrupt/invalid, clears it and returns null.
   *
   * @returns {User|null}
   */
  getCurrentUser() {
    const data = this._storage.get(this._currentUserKey);
    if (!data) return null;
    try {
      return User.fromJSON(data);
    } catch (err) {
      this._logger.warn('AuthService.getCurrentUser: invalid stored user, clearing — %s', err.message);
      this._storage.remove(this._currentUserKey);
      return null;
    }
  }

  /**
   * Returns true if a user is currently logged in.
   *
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.getCurrentUser() !== null;
  }

  /**
   * Returns true if the current user's role is 'teacher'.
   *
   * @returns {boolean}
   */
  isTeacher() {
    const user = this.getCurrentUser();
    return user !== null && user.role === 'teacher';
  }

  /**
   * Returns true if the current user's role is 'student'.
   *
   * @returns {boolean}
   */
  isStudent() {
    const user = this.getCurrentUser();
    return user !== null && user.role === 'student';
  }

  /**
   * Fetch a user record by their ID, or null if not found.
   *
   * Thin wrapper around MockApiService.getById so page components
   * don't need to import MockApi directly for user lookups.
   *
   * Used by SubmissionDetailPage to display the submitting student's name.
   *
   * @param {string} id - User ID.
   * @returns {Promise<object|null>}
   * @throws {Error} if id is missing.
   *
   * Source: the milestone brief §5.1 — Teacher: review submissions (view student name)
   */
  async getUserById(id) {
    if (!id) throw new Error('AuthService.getUserById: "id" is required');
    const user = await this._mockApi.getById('users', id);
    this._logger.info('AuthService.getUserById: id=%s found=%s', id, !!user);
    return user;
  }
}

export default AuthService;
