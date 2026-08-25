/**
 * analyticsController — HTTP layer for statistics.
 */

import asyncHandler from '../utils/asyncHandler.js';
import AnalyticsService from '../services/AnalyticsService.js';

const analytics = new AnalyticsService();

/**
 * GET /api/analytics/overview
 *
 * Every exam the calling teacher owns, with counts and averages.
 */
export const overview = asyncHandler(async (req, res) => {
  res.json(await analytics.overview(req.user));
});

/**
 * GET /api/analytics/exams/:id?summary=true
 *
 * Statistics for one exam. The AI narrative is opt-in via ?summary=true,
 * because it costs a model call and the numbers are useful without it.
 */
export const forExam = asyncHandler(async (req, res) => {
  const withSummary = String(req.query.summary) === 'true';
  res.json(await analytics.forExam(req.params.id, req.user, { withSummary }));
});
