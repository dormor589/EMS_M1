/**
 * AnalyticsService — client for the statistics endpoints.
 *
 * Source: the milestone brief §5.2 — statistics and analytics
 */

class AnalyticsService {
  /**
   * @param {import('./HttpApiService.js').default} api
   * @param {import('./LoggerService.js').default}  logger
   */
  constructor(api, logger) {
    if (!api)    throw new Error('AnalyticsService: "api" dependency is required');
    if (!logger) throw new Error('AnalyticsService: "logger" dependency is required');
    this._api = api;
    this._logger = logger;
  }

  /**
   * Every exam the teacher owns, with counts and averages.
   *
   * @returns {Promise<object>}
   */
  async getOverview() {
    return this._api.get('/analytics/overview');
  }

  /**
   * Statistics for one exam.
   *
   * @param {string}  examId
   * @param {object}  [options]
   * @param {boolean} [options.withSummary] Ask for the AI narrative too. Off by
   *   default because it costs a model call and the numbers stand alone.
   * @returns {Promise<object>}
   */
  async getForExam(examId, { withSummary = false } = {}) {
    if (!examId) throw new Error('AnalyticsService.getForExam: "examId" is required');
    return this._api.get(`/analytics/exams/${examId}${withSummary ? '?summary=true' : ''}`);
  }
}

export default AnalyticsService;
