-- ===================================================================
-- EMS — Exam Management System
-- Milestone 2 schema — PostgreSQL
--
-- DESIGN
--   Five tables mapping 1:1 onto the five domain models shared by the
--   client and the server (User, Exam, Question, Submission, Answer), so
--   the ERD, the UML class diagram and the API payloads all describe one
--   model.
--
--   JSONB is used only for `questions.options`, whose length genuinely
--   varies by question type. Everything else is a typed column with real
--   constraints, so the database — not the application — is the last line
--   of defence for the domain invariants:
--
--     * the exam lifecycle           Draft -> Published -> Closed
--     * the submission lifecycle     in_progress -> submitted
--                                    -> ai_graded -> graded
--     * one submission per student per exam
--     * one answer per question per submission
--     * multiple-choice and open-text questions have different valid shapes
-- ===================================================================

-- gen_random_uuid() is core in PostgreSQL 13+, but some images still surface
-- it through pgcrypto. Requesting the extension is a no-op when it is built in.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop in reverse dependency order so the script is safely re-runnable.
DROP TABLE IF EXISTS answers      CASCADE;
DROP TABLE IF EXISTS submissions  CASCADE;
DROP TABLE IF EXISTS questions    CASCADE;
DROP TABLE IF EXISTS exams        CASCADE;
DROP TABLE IF EXISTS users        CASCADE;

-- ------------------------------------------------------------------
-- 1. users — both roles live in one table, discriminated by `role`.
-- ------------------------------------------------------------------
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL CHECK (length(trim(name)) > 0),
  email         VARCHAR(255) NOT NULL UNIQUE,
  -- bcrypt digest, never the plaintext.
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('teacher', 'student')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- Stored lower-cased so the UNIQUE index is effectively case-insensitive:
  -- Bob@x.com and bob@x.com cannot both exist.
  CONSTRAINT users_email_lowercase CHECK (email = lower(email))
);

CREATE INDEX idx_users_role ON users (role);

-- ------------------------------------------------------------------
-- 2. exams — owned by a teacher; lifecycle enforced by CHECK.
-- ------------------------------------------------------------------
CREATE TABLE exams (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            VARCHAR(150) NOT NULL CHECK (length(trim(title)) > 0),
  description      TEXT         NOT NULL DEFAULT '',
  duration_minutes INTEGER      NOT NULL CHECK (duration_minutes > 0),

  -- Grade at or above which a student passes this exam. Used by analytics;
  -- `passed` is always derived from it, never stored, so changing the
  -- threshold can never leave stale pass/fail values behind.
  passing_grade    INTEGER      NOT NULL DEFAULT 60
                     CHECK (passing_grade BETWEEN 0 AND 100),

  status           VARCHAR(20)  NOT NULL DEFAULT 'Draft'
                     CHECK (status IN ('Draft', 'Published', 'Closed')),
  created_by       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- AI provenance: set when the exam came out of the generation agent, so the
  -- UI can badge it and the teacher can see the prompt it was built from.
  generated_by_ai  BOOLEAN      NOT NULL DEFAULT FALSE,
  ai_prompt        TEXT,

  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_exams_created_by ON exams (created_by);
CREATE INDEX idx_exams_status     ON exams (status);

-- ------------------------------------------------------------------
-- 3. questions — normalised out of the exam so per-question analytics
--    are plain SQL joins rather than JSON traversal.
-- ------------------------------------------------------------------
CREATE TABLE questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id        UUID        NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  type           VARCHAR(20) NOT NULL CHECK (type IN ('multiple-choice', 'open-text')),
  text           TEXT        NOT NULL CHECK (length(trim(text)) > 0),

  -- JSONB: a multiple-choice question carries an array of option strings,
  -- an open-text question carries none. Variable shape -> JSONB is honest here.
  options        JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- Zero-based index into `options`. NULL for open-text (no single right answer).
  correct_answer INTEGER,

  -- How much this question contributes to the final grade. Weights are
  -- relative: the grade is sum(score * weight) / sum(weight), so they need
  -- not total exactly 100 and a mid-edit exam can never produce a grade > 100.
  weight         INTEGER     NOT NULL DEFAULT 10 CHECK (weight > 0),

  position       INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The two question types have genuinely different shapes; the database
  -- refuses to store a malformed one of either kind.
  CONSTRAINT questions_type_shape CHECK (
    (
      type = 'multiple-choice'
      AND jsonb_typeof(options) = 'array'
      AND jsonb_array_length(options) >= 2
      AND correct_answer IS NOT NULL
      AND correct_answer >= 0
      AND correct_answer < jsonb_array_length(options)
    )
    OR (
      type = 'open-text'
      AND correct_answer IS NULL
    )
  )
);

CREATE INDEX idx_questions_exam_id ON questions (exam_id, position);

-- ------------------------------------------------------------------
-- 4. submissions — one row per (exam, student), created the moment the
--    student OPENS the exam. It therefore carries the countdown and the
--    autosaved answers long before it carries a grade.
-- ------------------------------------------------------------------
CREATE TABLE submissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id      UUID        NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  status       VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                 CHECK (status IN ('in_progress', 'submitted', 'ai_graded', 'graded')),

  -- Timer. expires_at is stamped at insert as started_at + the exam's
  -- duration, so the deadline survives a change to the exam afterwards.
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,

  -- Final grade 0-100, derived from the answers but stored so that listing
  -- submissions does not require recomputing every one of them.
  grade        NUMERIC(5,2) CHECK (grade BETWEEN 0 AND 100),
  feedback     TEXT        NOT NULL DEFAULT '',

  -- Who produced the grade. 'ai+teacher' means the AI proposed it and the
  -- teacher then changed something.
  graded_by    VARCHAR(20) CHECK (graded_by IN ('teacher', 'ai', 'ai+teacher')),

  -- Set only when the grade is PUBLISHED to the student, i.e. status='graded'.
  graded_at    TIMESTAMPTZ,

  -- Raised when the exam is edited in a grading-affecting way after this
  -- submission already existed, so the teacher can see it needs re-running.
  needs_regrade BOOLEAN    NOT NULL DEFAULT FALSE,

  -- A student may sit each exam exactly once.
  CONSTRAINT submissions_one_per_student UNIQUE (exam_id, student_id),

  -- The four lifecycle states each imply a specific shape. Encoding it here
  -- means no code path can leave a submission half-graded.
  CONSTRAINT submissions_status_consistency CHECK (
    (status = 'in_progress'
       AND submitted_at IS NULL AND grade IS NULL     AND graded_at IS NULL)
    OR (status = 'submitted'
       AND submitted_at IS NOT NULL AND grade IS NULL AND graded_at IS NULL)
    OR (status = 'ai_graded'
       AND submitted_at IS NOT NULL AND grade IS NOT NULL AND graded_at IS NULL)
    OR (status = 'graded'
       AND submitted_at IS NOT NULL AND grade IS NOT NULL AND graded_at IS NOT NULL)
  ),

  CONSTRAINT submissions_timer_sane CHECK (expires_at > started_at)
);

CREATE INDEX idx_submissions_exam_id    ON submissions (exam_id);
CREATE INDEX idx_submissions_student_id ON submissions (student_id);
CREATE INDEX idx_submissions_status     ON submissions (status);

-- ------------------------------------------------------------------
-- 5. answers — one row per answered question, so grading and analytics
--    operate per question instead of on an opaque blob.
--
--    The ai_* columns hold what the model proposed; `score` and `feedback`
--    hold what the teacher settled on. Keeping them apart is what lets the
--    UI show "AI proposed 85 — you changed it to 92" instead of silently
--    overwriting the model's judgement.
-- ------------------------------------------------------------------
CREATE TABLE answers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  question_id   UUID NOT NULL REFERENCES questions(id)   ON DELETE CASCADE,

  -- The student's response: the chosen option index rendered as text for
  -- multiple-choice, the free prose for open-text. The question type on the
  -- other side of question_id already says how to read it.
  value         TEXT NOT NULL DEFAULT '',

  -- Multiple-choice only: whether `value` matched the question's correct_answer.
  is_correct    BOOLEAN,

  -- What the AI proposed. NULL when the answer was never AI-graded.
  ai_score      NUMERIC(5,2) CHECK (ai_score BETWEEN 0 AND 100),
  ai_feedback   TEXT,

  -- The final per-question result, 0-100. Defaults to ai_score, editable by
  -- the teacher. NULL until the submission is graded.
  score         NUMERIC(5,2) CHECK (score BETWEEN 0 AND 100),
  feedback      TEXT NOT NULL DEFAULT '',

  -- Touched on every autosave while the exam is in progress.
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A student answers each question at most once per submission.
  CONSTRAINT answers_one_per_question UNIQUE (submission_id, question_id)
);

CREATE INDEX idx_answers_submission_id ON answers (submission_id);
CREATE INDEX idx_answers_question_id   ON answers (question_id);

-- ------------------------------------------------------------------
-- updated_at maintenance.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER exams_set_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER answers_set_updated_at
  BEFORE UPDATE ON answers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
