/**
 * services/index.js — dependency-injection root for EMS_M1 client services.
 *
 * Imports the D002 singletons (which manage their own internal deps) and
 * creates the MockApiService singleton wired with storage + config + logger.
 * All other modules should import services from here rather than from
 * individual service files directly.
 *
 * Source: docs/spec_brief.txt §8 — Services and Responsibilities
 */

import config  from './ConfigService.js';
import logger  from './LoggerService.js';
import storage from './StorageService.js';
import notify  from './NotifyService.js';
import MockApiService from './MockApiService.js';

export { config, logger, storage, notify };

/**
 * MockApiService singleton — wired with the StorageService, ConfigService,
 * and LoggerService singletons.
 *
 * @type {MockApiService}
 */
export const mockApi = new MockApiService(storage, config, logger);
