/**
 * Vitest configuration for the server.
 *
 * Unit tests run against pure functions and injected fakes — no database.
 * Integration tests talk to a REAL PostgreSQL database (`exam_app_test`),
 * because the schema's CHECK and UNIQUE constraints are part of the behaviour
 * being tested, and a mocked driver would not enforce them.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // Integration tests share one database, so parallel files would clash on
    // the same rows. Sequential keeps them independent without per-test schemas.
    fileParallelism: false,
    setupFiles: ['./src/__tests__/setup.js'],
    include: ['src/**/__tests__/**/*.test.js'],
    testTimeout: 15000,
  },
});
