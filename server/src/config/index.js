/**
 * config/index.js — the single source of configuration and domain constants
 * for the EMS server.
 *
 * Mirrors the client's ConfigService: every magic string, limit and enum lives
 * here so nothing is duplicated across the codebase. Reads the environment once
 * (see .env.example) and fails fast at boot on a missing secret rather than at
 * the first request that happens to need it.
 */

import dotenv from 'dotenv';

dotenv.config();

// ── Domain constants ─────────────────────────────────────────────────────────

/** User roles. */
export const ROLES = Object.freeze({ TEACHER: 'teacher', STUDENT: 'student' });

/** Exam lifecycle, in state-machine order. */
export const EXAM_STATUSES = Object.freeze(['Draft', 'Published', 'Closed']);

/** The only legal one-way transitions of the exam state machine. */
export const EXAM_TRANSITIONS = Object.freeze({
  Draft:     ['Published'],
  Published: ['Closed'],
  Closed:    [],
});

/** Supported question types. */
export const QUESTION_TYPES = Object.freeze(['multiple-choice', 'open-text']);

/** Submission lifecycle, in order. */
export const SUBMISSION_STATUSES = Object.freeze([
  'in_progress',
  'submitted',
  'ai_graded',
  'graded',
]);

/** Who produced a grade. */
export const GRADED_BY = Object.freeze(['teacher', 'ai', 'ai+teacher']);

// ── Environment ──────────────────────────────────────────────────────────────

const NODE_ENV     = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

/**
 * Read a required environment variable, or throw at boot.
 *
 * A development fallback is allowed so `npm run dev` works with no setup;
 * in production the variable must be supplied explicitly.
 *
 * @param {string}  name
 * @param {string} [devFallback] Used only outside production.
 * @returns {string}
 */
function required(name, devFallback) {
  const value = process.env[name] || (isProduction ? undefined : devFallback);
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". ` +
      'Copy server/.env.example to server/.env and fill it in.'
    );
  }
  return value;
}

const config = Object.freeze({
  env: NODE_ENV,
  isProduction,
  // 5000 is taken by macOS AirPlay Receiver (ControlCenter), which silently
  // wins the connection even though Node binds successfully. 5050 avoids it.
  port: Number(process.env.PORT) || 5050,

  /** Postgres connection string. The local default keeps first run zero-config. */
  databaseUrl: required('DATABASE_URL', 'postgres://localhost:5432/exam_app'),

  jwt: {
    // A weak development default is fine locally but can never reach production.
    secret:    required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    issuer:    'ems-api',
  },

  bcrypt: {
    // 10 rounds: the standard cost/latency trade-off for an interactive login.
    saltRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
  },

  cors: {
    // Comma-separated list of browser origins allowed to call the API.
    origins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  ai: {
    /**
     * NVIDIA NIM if a key is present, otherwise the deterministic fallback.
     * The fallback keeps every AI feature working with no key at all, so the
     * project runs for someone who has not signed up for anything. Adding
     * another vendor is one subclass of ModelBackedProvider.
     */
    nim: {
      apiKey:  process.env.NVIDIA_API_KEY || '',
      baseUrl: process.env.NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
      // kimi-k3 over llama-3.3-70b on measured grading quality: it tells a
      // rigorous proof from a nearly-rigorous one (98 vs 90, where llama gave
      // 100 vs 95), names the specific invalid step rather than a generic
      // remark, and does not invent criticism of a complete answer. Comparable
      // latency. Change this one value to switch back or try another.
      model:   process.env.NIM_MODEL || 'moonshotai/kimi-k3',

      /**
       * A second, faster model for the tasks that do not need deep judgement.
       *
       * kimi-k3 reasons before answering, which is what makes it good at
       * grading prose — and wasted on drafting exam questions or writing a
       * two-line summary. Those run on this model instead, so a teacher
       * waiting on a spinner waits seconds rather than most of a minute.
       * Grading keeps the slower, better model: it is clicked once per
       * submission and correctness matters more than latency there.
       *
       * Measured on NIM, generating a 5-question exam (2 runs each):
       *   llama-3.1-8b   11.1s     llama-3.1-70b  14.1s
       *   kimi-k3        32.7s     llama-3.3-70b  53.7s
       * Note that llama-3.3-70b is SLOWER than kimi-k3 — the newer model is
       * not the quicker one, which is why this was measured rather than assumed.
       */
      fastModel: process.env.NIM_FAST_MODEL || 'meta/llama-3.1-70b-instruct',
    },
    /** Milliseconds before an AI call is abandoned and the fallback is used. */
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 90_000,
  },

  limits: {
    maxQuestionsPerExam:   50,
    minGeneratedQuestions: 1,
    maxGeneratedQuestions: 20,
    minGrade:              0,
    maxGrade:              100,
    /** Grace period allowed past expires_at, to absorb clock skew and latency. */
    submitGraceSeconds:    30,
  },
});

export default config;
