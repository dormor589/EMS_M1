/**
 * MockApiService — simulates a backend REST API backed by localStorage.
 *
 * All methods return Promises so the interface is forward-compatible with a
 * real HTTP backend swap in M2. Business logic (AuthService, ExamService,
 * SubmissionService) calls this instead of touching storage directly.
 *
 * Constructor receives dependencies via injection; instantiated in services/index.js.
 *
 * Source: docs/spec_brief.txt §8 — MockApiService
 */

import { getSeedData } from '../data/seedData.js';
import { generateId } from '../models/util.js';

/** Valid collection names — must match ConfigService.getStorageKeys() keys. */
const VALID_COLLECTIONS = ['users', 'exams', 'submissions'];

class MockApiService {
  /**
   * @param {import('./StorageService.js').default} storage - StorageService singleton.
   * @param {import('./ConfigService.js').default}  config  - ConfigService singleton.
   * @param {import('./LoggerService.js').default}  logger  - LoggerService singleton.
   */
  constructor(storage, config, logger) {
    if (!storage) throw new Error('MockApiService: "storage" dependency is required');
    if (!config)  throw new Error('MockApiService: "config" dependency is required');
    if (!logger)  throw new Error('MockApiService: "logger" dependency is required');

    this._storage = storage;
    this._config  = config;
    this._logger  = logger;
    this._keys    = config.getStorageKeys();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Resolve collection name → storage key.
   *
   * @param {string} collection
   * @returns {string} Storage key (e.g. 'ems_users')
   * @throws {Error} if collection is not recognised
   * @private
   */
  _key(collection) {
    if (!VALID_COLLECTIONS.includes(collection)) {
      throw new Error(
        `MockApiService: unknown collection "${collection}". ` +
        `Must be one of: ${VALID_COLLECTIONS.join(', ')}`
      );
    }
    return this._keys[collection];
  }

  /**
   * Read a collection from storage, returning an empty array if absent.
   *
   * @param {string} collection
   * @returns {object[]}
   * @private
   */
  _read(collection) {
    return this._storage.get(this._key(collection)) || [];
  }

  /**
   * Write a collection array back to storage.
   *
   * @param {string}   collection
   * @param {object[]} records
   * @private
   */
  _write(collection, records) {
    this._storage.set(this._key(collection), records);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Seed all collections if they are currently empty.
   *
   * Idempotent: calling twice has no effect on the second call (storage
   * already has data, so the emptiness check fails and we skip).
   *
   * @returns {Promise<void>}
   */
  async seedIfEmpty() {
    const users = this._read('users');
    if (users.length > 0) {
      this._logger.info('MockApiService.seedIfEmpty: data already present, skipping seed');
      return;
    }

    const seed = getSeedData();
    this._write('users',       seed.users);
    this._write('exams',       seed.exams);
    this._write('submissions', seed.submissions);
    this._logger.info(
      'MockApiService.seedIfEmpty: seeded %d users, %d exams, %d submissions',
      seed.users.length,
      seed.exams.length,
      seed.submissions.length
    );
  }

  /**
   * Retrieve all records from a collection.
   *
   * @param {string} collection - 'users' | 'exams' | 'submissions'
   * @returns {Promise<object[]>}
   */
  async get(collection) {
    return this._read(collection);
  }

  /**
   * Retrieve a single record by ID.
   *
   * @param {string} collection
   * @param {string} id
   * @returns {Promise<object|null>} The record, or null if not found.
   */
  async getById(collection, id) {
    const records = this._read(collection);
    return records.find((r) => r.id === id) || null;
  }

  /**
   * Append a new record to a collection.
   *
   * If the record lacks an `id`, one is generated with crypto.randomUUID().
   *
   * @param {string} collection
   * @param {object} record
   * @returns {Promise<object>} The persisted record (with id populated).
   */
  async post(collection, record) {
    const records = this._read(collection);
    const persisted = { ...record, id: record.id || generateId() };
    records.push(persisted);
    this._write(collection, records);
    this._logger.info('MockApiService.post: added to %s (id=%s)', collection, persisted.id);
    return persisted;
  }

  /**
   * Replace an existing record by ID.
   *
   * @param {string} collection
   * @param {string} id
   * @param {object} record - Replacement data (id field will be preserved).
   * @returns {Promise<object>} The updated record.
   * @throws {Error} if no record with the given id exists.
   */
  async put(collection, id, record) {
    if (!id) throw new Error('MockApiService.put: "id" is required');

    const records = this._read(collection);
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) {
      throw new Error(`MockApiService.put: record with id="${id}" not found in "${collection}"`);
    }
    const updated = { ...record, id };
    records[idx] = updated;
    this._write(collection, records);
    this._logger.info('MockApiService.put: updated %s (id=%s)', collection, id);
    return updated;
  }

  /**
   * Remove a record by ID.
   *
   * @param {string} collection
   * @param {string} id
   * @returns {Promise<void>}
   * @throws {Error} if no record with the given id exists.
   */
  async delete(collection, id) {
    const records = this._read(collection);
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) {
      throw new Error(`MockApiService.delete: record with id="${id}" not found in "${collection}"`);
    }
    records.splice(idx, 1);
    this._write(collection, records);
    this._logger.info('MockApiService.delete: removed from %s (id=%s)', collection, id);
  }

  /**
   * Wipe all records from a single collection.
   *
   * Does NOT touch other collections.
   *
   * @param {string} collection
   * @returns {Promise<void>}
   */
  async clear(collection) {
    this._write(collection, []);
    this._logger.info('MockApiService.clear: cleared collection "%s"', collection);
  }
}

export default MockApiService;
