/**
 * UserRepository — all SQL touching the `users` table.
 *
 * Repositories are the only layer that writes SQL. Services above them work
 * with model instances and never see a row or a query string.
 */

import pool from '../pool.js';
import { User } from '../../models/index.js';

class UserRepository {
  /**
   * @param {import('pg').Pool|import('pg').PoolClient} [db] Injectable so a
   *   caller inside a transaction can pass its client.
   */
  constructor(db = pool) {
    this._db = db;
  }

  /**
   * Look up a user by email.
   *
   * Emails are stored lower-cased (enforced by a CHECK constraint), so the
   * lookup lower-cases its input to make the match case-insensitive.
   *
   * @param {string} email
   * @returns {Promise<User|null>}
   */
  async findByEmail(email) {
    const { rows } = await this._db.query(
      'SELECT * FROM users WHERE email = $1',
      [String(email).toLowerCase().trim()]
    );
    return User.fromRow(rows[0]);
  }

  /**
   * @param {string} id
   * @returns {Promise<User|null>}
   */
  async findById(id) {
    const { rows } = await this._db.query('SELECT * FROM users WHERE id = $1', [id]);
    return User.fromRow(rows[0]);
  }

  /**
   * Look up many users at once, for annotating a list of submissions with
   * student names without a query per row.
   *
   * @param {string[]} ids
   * @returns {Promise<Map<string, User>>} Keyed by id.
   */
  async findManyByIds(ids) {
    if (!ids.length) return new Map();
    const { rows } = await this._db.query(
      'SELECT * FROM users WHERE id = ANY($1::uuid[])',
      [ids]
    );
    return new Map(rows.map((r) => [r.id, User.fromRow(r)]));
  }

  /**
   * Insert a new user.
   *
   * @param {object} data
   * @param {string} data.name
   * @param {string} data.email
   * @param {string} data.passwordHash Already hashed — this layer never hashes.
   * @param {string} data.role
   * @returns {Promise<User>}
   */
  async create({ name, email, passwordHash, role }) {
    const { rows } = await this._db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), String(email).toLowerCase().trim(), passwordHash, role]
    );
    return User.fromRow(rows[0]);
  }
}

export default UserRepository;
