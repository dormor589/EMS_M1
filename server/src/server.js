/**
 * server.js — process entry point.
 *
 * Starts listening, and shuts down cleanly so in-flight requests finish and the
 * database pool is drained rather than dropped.
 */

import app from './app.js';
import config from './config/index.js';
import logger from './utils/logger.js';
import pool from './db/pool.js';

const server = app.listen(config.port, () => {
  logger.info('EMS API listening', {
    port: config.port,
    env: config.env,
    cors: config.cors.origins.join(', '),
  });
});

/**
 * @param {string} signal
 */
async function shutdown(signal) {
  logger.info(`${signal} received — shutting down`);
  server.close(async () => {
    await pool.end();
    logger.info('shutdown complete');
    process.exit(0);
  });
  // Do not hang forever on a connection that will not close.
  setTimeout(() => {
    logger.error('forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
