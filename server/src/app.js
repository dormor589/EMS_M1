/**
 * app.js — assembles the Express application.
 *
 * Exports the app WITHOUT listening, so tests can drive it in-process with
 * supertest and no port. server.js owns the listening.
 *
 * Middleware order matters and is deliberate:
 *   helmet          security headers before anything can respond
 *   cors            reject disallowed origins before doing work
 *   express.json    parse bodies so routes see objects
 *   requestLogger   attaches the finish listener before routing
 *   /api routes     the application
 *   notFound        anything unmatched becomes a JSON 404
 *   errorHandler    last: the single place an error becomes a response
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config/index.js';
import routes from './routes/index.js';
import requestLogger from './middleware/requestLogger.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';
import pool from './db/pool.js';

const app = express();

// Behind a proxy the rate limiter must see the real client IP, not the proxy's.
app.set('trust proxy', 1);

app.use(helmet());

app.use(cors({
  origin(origin, callback) {
    // No Origin header: same-origin, curl, or a server-to-server call. Allowed —
    // CORS protects browsers from cross-site reads, and these are not that.
    if (!origin) return callback(null, true);
    if (config.cors.origins.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} is not allowed`));
  },
  credentials: true,
}));

// 1 MB is generous for an exam payload and small enough to blunt a body-size
// denial of service.
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

/**
 * GET /health — liveness plus a real database round trip.
 *
 * Unauthenticated on purpose: a health check that needs credentials cannot be
 * used by the thing that needs to check health.
 */
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', database: 'unavailable', error: err.message });
  }
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
