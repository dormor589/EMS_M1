/**
 * User entity model.
 *
 * Represents a Teacher or Student account.
 * Models are PURE — no service imports. Validation values mirror ConfigService
 * but are defined locally to avoid circular dependencies.
 *
 * Source: the milestone brief §7 — User entity
 */

import { generateId } from './util.js';

/** Valid roles — mirrors ConfigService.getRoles(). Source: spec §7. */
const VALID_ROLES = ['teacher', 'student'];

class User {
  /**
   * Create a User instance.
   *
   * @param {object} data
   * @param {string} [data.id]       - UUID. Auto-generated if omitted.
   * @param {string} data.name       - Display name.
   * @param {string} data.email      - Unique email address (used as login).
   * @param {string} [data.password] - Only present in mock mode. In live mode the
   *   server holds a bcrypt hash and the browser never sees a password at all.
   * @param {string} data.role       - 'teacher' | 'student'.
   * @throws {Error} if any required field is missing or role is invalid.
   */
  constructor({ id, name, email, password, role } = {}) {
    if (!name)     throw new Error('User: "name" is required');
    if (!email)    throw new Error('User: "email" is required');
    if (!role)     throw new Error('User: "role" is required');
    // `password` is deliberately NOT required. Against the live API a user is
    // built from the server's response, which never contains a password — only
    // the mock backend still carries one.
    if (!VALID_ROLES.includes(role)) {
      throw new Error(`User: invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    /** @type {string} */
    this.id = id || generateId();
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.email = email;
    /** @type {string|undefined} Absent in live mode. */
    this.password = password;
    /** @type {'teacher'|'student'} */
    this.role = role;
  }

  /**
   * Serialize to a plain object suitable for JSON.stringify.
   *
   * The password key is omitted entirely when there is none, so a live-mode
   * user object never carries an empty password field into storage.
   *
   * @returns {{ id: string, name: string, email: string, role: string, password?: string }}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      ...(this.password ? { password: this.password } : {}),
      role: this.role,
    };
  }

  /**
   * Hydrate a User from a plain object (e.g. from StorageService.get()).
   *
   * @param {object} obj
   * @returns {User}
   */
  static fromJSON(obj) {
    return new User(obj);
  }
}

export default User;
