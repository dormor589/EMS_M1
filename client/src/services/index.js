/**
 * services/index.js — dependency-injection root for the client services.
 *
 * Creates the singletons and wires their dependencies. Application code imports
 * services from here, never from the individual service files.
 *
 * `api` is the persistence seam. Milestone 1 wired MockApiService in here,
 * backed by localStorage; Milestone 2 wires HttpApiService, backed by the
 * Express API and PostgreSQL. Because both expose the same promise-returning
 * interface, that one substitution is the whole of the client-side migration —
 * the pages call the same service methods either way.
 *
 * Dependency order (no cycles):
 *   config, logger        (no deps)
 *   -> storage, notify    (logger)
 *   -> api                (config, logger, storage)
 *   -> auth               (api, storage, config, logger)
 *   -> examService        (api, config, logger)
 *   -> submissionService  (api, examService, config, logger)
 *
 * Source: the milestone brief §8 — Services and Responsibilities
 */

import config  from './ConfigService.js';
import logger  from './LoggerService.js';
import storage from './StorageService.js';
import notify  from './NotifyService.js';

import HttpApiService    from './HttpApiService.js';
import AuthService       from './AuthService.js';
import ExamService       from './ExamService.js';
import SubmissionService from './SubmissionService.js';
import AiService from './AiService.js';
import AnalyticsService from './AnalyticsService.js';

export { config, logger, storage, notify };

/**
 * HTTP client for the Express API. The single point at which the app leaves the
 * browser, and the only thing holding the JWT.
 * @type {HttpApiService}
 */
export const api = new HttpApiService(config, logger, storage);

/**
 * AuthService singleton — login, register, logout, role checks.
 * @type {AuthService}
 */
export const auth = new AuthService(api, storage, config, logger);

/**
 * ExamService singleton — exam CRUD and the publish/close transitions.
 * @type {ExamService}
 */
export const examService = new ExamService(api, config, logger);

/**
 * SubmissionService singleton — attempts, autosave, submission, grading.
 * @type {SubmissionService}
 */
export const submissionService = new SubmissionService(api, examService, config, logger);

/**
 * AiService singleton — exam generation and AI-assisted marking.
 * @type {AiService}
 */
export const aiService = new AiService(api, logger);

/**
 * AnalyticsService singleton — exam and cohort statistics.
 * @type {AnalyticsService}
 */
export const analyticsService = new AnalyticsService(api, logger);

logger.info('services wired: API at %s', config.getApiBaseUrl());
