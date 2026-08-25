/**
 * seed.js — populate the database with the demo dataset.
 *
 * Assumes the schema already exists (run `npm run db:migrate` first, or use
 * `npm run db:reset` to do both).
 *
 * Two things are deliberately computed here rather than hard-coded in
 * seedData.js:
 *
 *   1. Password hashes — bcrypt at seed time, so no digest is ever committed.
 *   2. Grades — via the real formula, sum(score * weight) / sum(weight), over
 *      EVERY question in the exam. An unanswered question scores zero rather
 *      than being excluded, which is what actually happens in the application.
 *      Seeded grades and computed grades therefore agree by construction.
 *
 * Usage: npm run db:seed
 */

import bcrypt from 'bcryptjs';
import pool, { withTransaction } from './pool.js';
import config from '../config/index.js';
import { users, exams, submissions, DEMO_PASSWORD } from './seedData.js';

/** Emails belonging to the demo dataset; anything else is a real account. */
const SEED_EMAILS = new Set(users.map((u) => u.email.toLowerCase()));

const MINUTE = 60 * 1000;

/** Timestamp `minutes` in the past. */
const ago = (minutes) => new Date(Date.now() - minutes * MINUTE);

/**
 * Score a single answer 0-100.
 *
 * Multiple-choice is deterministic — the chosen index either matches the
 * question's correct_answer or it does not, no model involved. Open-text
 * carries whatever mark the dataset recorded.
 *
 * @param {object} question
 * @param {object} [answer]
 * @returns {{ score: number, isCorrect: boolean|null }}
 */
function scoreAnswer(question, answer) {
  if (!answer) return { score: 0, isCorrect: question.type === 'multiple-choice' ? false : null };

  if (question.type === 'multiple-choice') {
    const isCorrect = answer.choice === question.correctAnswer;
    return { score: isCorrect ? 100 : 0, isCorrect };
  }
  return { score: Number(answer.score ?? 0), isCorrect: null };
}

/**
 * The grade formula: sum(score * weight) / sum(weight).
 *
 * Dividing by the total weight rather than by 100 means the weights
 * self-normalise — the result is always 0-100 even if an exam's weights do not
 * happen to total 100.
 *
 * @param {object[]} questions Every question on the exam.
 * @param {object}   answers   Keyed by question key; missing entries score zero.
 * @returns {number} Grade rounded to two decimal places.
 */
function computeGrade(questions, answers) {
  const totalWeight = questions.reduce((sum, q) => sum + q.weight, 0);
  const earned = questions.reduce((sum, q) => {
    const { score } = scoreAnswer(q, answers[q.key]);
    return sum + score * q.weight;
  }, 0);
  return Math.round((earned / totalWeight) * 100) / 100;
}

/**
 * Refuse to wipe accounts that are not part of the demo dataset.
 *
 * Seeding truncates every table, so anyone who registered through the app
 * loses their account and their work. That is fine for the seeded demo users
 * and emphatically not fine for anyone else — so real accounts stop the script
 * unless the caller explicitly says otherwise with --force.
 *
 * @returns {Promise<string[]>} Emails that would be destroyed.
 */
async function findRealAccounts() {
  const { rows } = await pool.query('SELECT email FROM users');
  return rows.map((r) => r.email).filter((e) => !SEED_EMAILS.has(e.toLowerCase()));
}

async function seed() {
  const target = config.databaseUrl.replace(/:[^:@/]*@/, ':****@');
  console.log(`[seed] target: ${target}`);

  const force = process.argv.includes('--force');
  let atRisk = [];
  try {
    atRisk = await findRealAccounts();
  } catch {
    // No users table yet — a fresh migrate. Nothing to protect.
  }

  if (atRisk.length && !force) {
    console.error(
      `\n[seed] REFUSING TO RUN — this would delete ${atRisk.length} account(s) ` +
      'that were registered through the app:\n' +
      atRisk.map((e) => `         ${e}`).join('\n') +
      '\n\n       Seeding truncates every table, so their exams, submissions and\n' +
      '       grades would go too.\n\n' +
      '       To wipe anyway:  npm run db:seed -- --force\n' +
      '       Or to reset all: npm run db:reset:force\n'
    );
    await pool.end();
    process.exit(1);
  }

  if (atRisk.length) {
    console.warn(`[seed] --force given: deleting ${atRisk.length} registered account(s)`);
  }

  // One hash for every demo account — they all share the same password.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, config.bcrypt.saltRounds);

  await withTransaction(async (client) => {
    // Clearing users cascades to exams, questions, submissions and answers.
    await client.query('TRUNCATE users CASCADE');

    // ── users ──────────────────────────────────────────────────────────────
    const userId = {};
    for (const u of users) {
      const { rows } = await client.query(
        `INSERT INTO users (id, name, email, password_hash, role)
         VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5)
         RETURNING id`,
        [u.id ?? null, u.name, u.email.toLowerCase(), passwordHash, u.role]
      );
      userId[u.key] = rows[0].id;
    }

    // ── exams + questions ──────────────────────────────────────────────────
    const examId = {};
    const questionId = {};
    for (const e of exams) {
      const { rows } = await client.query(
        `INSERT INTO exams
           (title, description, duration_minutes, passing_grade, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [e.title, e.description, e.durationMinutes, e.passingGrade, e.status, userId[e.createdBy]]
      );
      examId[e.key] = rows[0].id;

      for (const [position, q] of e.questions.entries()) {
        const { rows: qr } = await client.query(
          `INSERT INTO questions
             (exam_id, type, text, options, correct_answer, weight, position)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
           RETURNING id`,
          [
            examId[e.key],
            q.type,
            q.text,
            JSON.stringify(q.options ?? []),
            q.correctAnswer ?? null,
            q.weight,
            position,
          ]
        );
        questionId[q.key] = qr[0].id;
      }
    }

    // ── submissions + answers ──────────────────────────────────────────────
    let offset = 0;
    for (const s of submissions) {
      const exam = exams.find((e) => e.key === s.exam);
      const isGraded = s.status === 'graded' || s.status === 'ai_graded';

      // Stagger start times so the analytics timeline is not a single instant.
      offset += 37;
      const startedAt = s.status === 'in_progress' ? ago(10) : ago(exam.durationMinutes + offset);
      const expiresAt = new Date(startedAt.getTime() + exam.durationMinutes * MINUTE);
      // Submitted a few minutes before the deadline, as a real student would.
      const submittedAt =
        s.status === 'in_progress' ? null : new Date(expiresAt.getTime() - 4 * MINUTE);
      const gradedAt = s.status === 'graded' ? new Date(submittedAt.getTime() + 30 * MINUTE) : null;

      const grade = isGraded ? computeGrade(exam.questions, s.answers) : null;

      const { rows } = await client.query(
        `INSERT INTO submissions
           (exam_id, student_id, status, started_at, expires_at, submitted_at,
            grade, graded_by, graded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          examId[s.exam],
          userId[s.student],
          s.status,
          startedAt,
          expiresAt,
          submittedAt,
          grade,
          isGraded ? s.gradedBy : null,
          gradedAt,
        ]
      );
      const submissionId = rows[0].id;

      for (const q of exam.questions) {
        const answer = s.answers[q.key];
        if (!answer) continue; // genuinely unanswered — no row at all

        const { score, isCorrect } = scoreAnswer(q, answer);
        const value =
          q.type === 'multiple-choice' ? String(answer.choice) : (answer.text ?? '');

        await client.query(
          `INSERT INTO answers
             (submission_id, question_id, value, is_correct,
              ai_score, ai_feedback, score, feedback)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            submissionId,
            questionId[q.key],
            value,
            isCorrect,
            answer.aiScore ?? null,
            answer.aiFeedback ?? null,
            isGraded ? score : null,
            answer.feedback ?? '',
          ]
        );
      }
    }
  });

  // ── summary ──────────────────────────────────────────────────────────────
  const { rows: counts } = await pool.query(`
    SELECT 'users' AS name, count(*) FROM users
    UNION ALL SELECT 'exams',       count(*) FROM exams
    UNION ALL SELECT 'questions',   count(*) FROM questions
    UNION ALL SELECT 'submissions', count(*) FROM submissions
    UNION ALL SELECT 'answers',     count(*) FROM answers
  `);
  console.log('[seed] rows inserted:');
  for (const c of counts) console.log(`         ${String(c.count).padStart(3)}  ${c.name}`);
  console.log(`[seed] demo login: teacher@ems.dev / student@ems.dev  password: ${DEMO_PASSWORD}`);
}

seed()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('[seed] FAILED:', err.message);
    await pool.end();
    process.exit(1);
  });
