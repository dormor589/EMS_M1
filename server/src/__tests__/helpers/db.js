/**
 * Integration-test helpers.
 *
 * These tests run against a REAL PostgreSQL database rather than a mock,
 * because the schema's CHECK and UNIQUE constraints are part of the behaviour
 * under test — a duplicate submission is prevented by the database, not only
 * by the service, and a mocked driver would happily allow it.
 *
 * The target is `exam_app_test`, set in src/__tests__/setup.js, so the
 * development database is never touched.
 */

import bcrypt from 'bcryptjs';
import pool from '../../db/pool.js';

/**
 * Empty every table. Cascades from users reach everything else.
 *
 * @returns {Promise<void>}
 */
export async function resetDatabase() {
  await pool.query('TRUNCATE users CASCADE');
}

/**
 * Insert a user directly, bypassing the API.
 *
 * @param {object} data
 * @returns {Promise<object>} The row, plus the plaintext password for logging in.
 */
export async function createUser({ name = 'Test User', email, role = 'student', password = 'password1' }) {
  const hash = await bcrypt.hash(password, 4); // low cost: these are throwaway
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, email.toLowerCase(), hash, role]
  );
  return { ...rows[0], password };
}

/**
 * Insert an exam with questions directly.
 *
 * @param {object} data
 * @returns {Promise<object>} The exam row with a `questions` array attached.
 */
export async function createExam({
  title = 'Test Exam', createdBy, status = 'Draft',
  durationMinutes = 30, passingGrade = 60, questions = [],
}) {
  const { rows } = await pool.query(
    `INSERT INTO exams (title, description, duration_minutes, passing_grade, status, created_by)
     VALUES ($1, '', $2, $3, $4, $5) RETURNING *`,
    [title, durationMinutes, passingGrade, status, createdBy]
  );
  const exam = rows[0];

  const inserted = [];
  for (const [position, q] of questions.entries()) {
    const { rows: qr } = await pool.query(
      `INSERT INTO questions (exam_id, type, text, options, correct_answer, weight, position)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7) RETURNING *`,
      [exam.id, q.type, q.text, JSON.stringify(q.options ?? []),
       q.type === 'multiple-choice' ? q.correctAnswer : null, q.weight ?? 10, position]
    );
    inserted.push(qr[0]);
  }
  return { ...exam, questions: inserted };
}

/** Two questions covering both types, weighted 40/60. */
export const SAMPLE_QUESTIONS = [
  { type: 'multiple-choice', text: 'What is 2+2?', options: ['3', '4', '5'], correctAnswer: 1, weight: 40 },
  { type: 'open-text', text: 'Explain addition.', weight: 60 },
];

export { pool };
