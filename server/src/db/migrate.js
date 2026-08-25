/**
 * migrate.js — build the database schema from scratch.
 *
 * Runs schema.sql, which drops and recreates all five tables. Destructive by
 * design: this is a course project, so a clean rebuild is preferable to an
 * incremental migration history.
 *
 * Usage: npm run db:migrate
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './pool.js';
import config from '../config/index.js';

// __dirname does not exist in ES modules; derive it from import.meta.url.
const here = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const target = config.databaseUrl.replace(/:[^:@/]*@/, ':****@');
  console.log(`[migrate] target: ${target}`);

  const sql = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');

  await pool.query(sql);

  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`
  );
  console.log(`[migrate] created ${rows.length} tables: ${rows.map((r) => r.table_name).join(', ')}`);
}

migrate()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('[migrate] FAILED:', err.message);
    await pool.end();
    process.exit(1);
  });
