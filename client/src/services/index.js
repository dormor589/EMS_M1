/**
 * services/index.js — dependency-injection root for EMS_M1 client services.
 *
 * Imports the D002 singletons and creates MockApiService + AuthService
 * singletons wired with their dependencies. All application code imports
 * services from here — never directly from individual service files.
 *
 * Dependency order (no cycles):
 *   config, logger (no deps)
 *   → storage (logger), notify (logger)
 *   → mockApi (storage, config, logger)
 *   → auth (mockApi, storage, config, logger)
 *
 * Source: docs/spec_brief.txt §8 — Services and Responsibilities
 */

import config  from './ConfigService.js';
import logger  from './LoggerService.js';
import storage from './StorageService.js';
import notify  from './NotifyService.js';
import MockApiService from './MockApiService.js';
import AuthService    from './AuthService.js';

export { config, logger, storage, notify };

/**
 * MockApiService singleton — CRUD over localStorage-backed mock DB.
 * @type {MockApiService}
 */
export const mockApi = new MockApiService(storage, config, logger);

/**
 * AuthService singleton — login, register, logout, role checks.
 * @type {AuthService}
 */
export const auth = new AuthService(mockApi, storage, config, logger);
