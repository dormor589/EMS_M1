/**
 * Test setup — applied to every test file before it runs.
 *
 * Points the suite at a SEPARATE database so running tests can never truncate
 * the development data, and quietens the logger so expected-failure paths do
 * not fill the output with warnings that are not failures.
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgres://localhost:5432/exam_app_test';
process.env.JWT_SECRET = 'test-only-secret';
process.env.LOG_LEVEL = 'silent';
