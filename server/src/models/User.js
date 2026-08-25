/**
 * User entity.
 *
 * Mirrors the client's User model. The password hash is held on the instance so
 * AuthService can verify a login, but toJSON() NEVER emits it — that is the only
 * thing standing between a hash and every API response that returns a user.
 */
class User {
  /** @param {object} data Row-shaped or camelCase data. */
  constructor({ id, name, email, passwordHash, role, createdAt } = {}) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.role = role;
    this.createdAt = createdAt;
    // Non-enumerable so it cannot leak through a spread or JSON.stringify of
    // the raw instance, only through the explicit accessor below.
    Object.defineProperty(this, '_passwordHash', {
      value: passwordHash, enumerable: false, writable: false,
    });
  }

  /** @returns {string} The bcrypt digest, for AuthService only. */
  get passwordHash() { return this._passwordHash; }

  /** @returns {boolean} */
  isTeacher() { return this.role === 'teacher'; }

  /** @returns {boolean} */
  isStudent() { return this.role === 'student'; }

  /**
   * Build from a `users` table row.
   * @param {object} row
   * @returns {User|null}
   */
  static fromRow(row) {
    if (!row) return null;
    return new User({
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      createdAt: row.created_at,
    });
  }

  /**
   * Public representation. The password hash is deliberately absent.
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      createdAt: this.createdAt,
    };
  }
}

export default User;
