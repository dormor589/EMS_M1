/**
 * db/pool.js — the PostgreSQL connection pool.
 *
 * The single place in the server that opens a database connection. Repositories
 * import `pool` (or `withTransaction`) from here; nothing else talks to `pg`.
 *
 * Importing this module has no side effects — it does not run a smoke-test
 * query — so it is safe to import from scripts and tests that may never
 * actually touch the database.
 */

import pg from 'pg';
import config from '../config/index.js';

const { Pool } = pg;

/**
 * Decide whether to negotiate TLS.
 *
 * Managed providers (Render, Neon, Supabase) refuse connections that do not use
 * TLS; a Postgres container or a local install usually has no certificate at
 * all and refuses connections that do. Getting it wrong fails at connect time
 * either way, so the rule is explicit rather than guessed:
 *
 *   1. DATABASE_SSL, if set, wins — the escape hatch for anything unusual.
 *   2. Otherwise TLS is used when the connection string asks for it, or the
 *      host belongs to a provider known to require it.
 *   3. Otherwise no TLS.
 *
 * An earlier version simply assumed "not localhost means remote", which broke
 * docker-compose: the host there is `db`, a plain container with no TLS.
 *
 * @param {string} connectionString
 * @returns {false | { rejectUnauthorized: boolean }}
 */
function sslFor(connectionString) {
  const override = process.env.DATABASE_SSL;
  if (override !== undefined) {
    return ['true', '1', 'require'].includes(override.toLowerCase())
      ? { rejectUnauthorized: false }
      : false;
  }

  const askedFor = /[?&](ssl=true|sslmode=require)/i.test(connectionString);
  const managedHost = /\.(render\.com|neon\.tech|supabase\.co|azure\.com|amazonaws\.com)/i
    .test(connectionString);

  // Managed providers present certificates signed by their own CA, which is why
  // verification is relaxed rather than the hostname check being skipped.
  return askedFor || managedHost ? { rejectUnauthorized: false } : false;
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: sslFor(config.databaseUrl),
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// A pooled client can fail while idle (network drop, provider restart). Without
// a listener the 'error' event would take the process down.
pool.on('error', (err) => {
  console.error('[db] idle client error:', err.message);
});

/**
 * Run a set of queries inside a single transaction.
 *
 * Commits if the callback resolves, rolls back if it throws, and always
 * returns the client to the pool.
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>} Whatever the callback resolved to.
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
