/**
 * schemas.js — request shapes, as zod schemas.
 *
 * Validation runs before any controller, so services can assume well-formed
 * input and a malformed request produces a precise field-level 400 rather than
 * a database constraint violation surfacing as a 500.
 */

import { z } from 'zod';
import config, { ROLES, QUESTION_TYPES } from '../config/index.js';

const { minGrade, maxGrade, maxQuestionsPerExam } = config.limits;

// ── Primitives ───────────────────────────────────────────────────────────────

const uuid = z.uuid('Not a valid identifier');
const email = z.email('Enter a valid email address').max(255).toLowerCase().trim();
const name = z.string().trim().min(1, 'Name is required').max(100);

/**
 * Deliberately modest: 8 characters, no composition rules. Complexity
 * requirements push people toward predictable substitutions; length is what
 * actually helps, and bcrypt handles the rest.
 */
const password = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(200, 'Password is too long');

// ── Auth ─────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  name,
  email,
  password,
  role: z.enum([ROLES.TEACHER, ROLES.STUDENT], 'Choose either teacher or student'),
});

export const loginSchema = z.object({
  email,
  // Not `password`: an existing account must not be locked out by a rule that
  // tightened after it was created. The stored hash decides.
  password: z.string().min(1, 'Password is required'),
});

// ── Questions ────────────────────────────────────────────────────────────────

/**
 * The two question types have genuinely different valid shapes, so the schema
 * checks each one rather than accepting a union of every field.
 */
export const questionSchema = z.object({
  // Present when editing an existing question. Its absence is what tells the
  // repository to INSERT rather than UPDATE.
  id: uuid.optional(),
  type: z.enum(QUESTION_TYPES),
  text: z.string().trim().min(1, 'Question text is required').max(2000),
  options: z.array(z.string().trim().min(1, 'An option cannot be empty')).max(10).default([]),
  correctAnswer: z.number().int().min(0).nullable().optional(),
  weight: z.number().int().min(1, 'Weight must be at least 1').max(100).default(10),
}).superRefine((q, ctx) => {
  if (q.type === 'multiple-choice') {
    if (q.options.length < 2) {
      ctx.addIssue({
        code: 'custom', path: ['options'],
        message: 'A multiple-choice question needs at least two options',
      });
    }
    if (q.correctAnswer === null || q.correctAnswer === undefined) {
      ctx.addIssue({
        code: 'custom', path: ['correctAnswer'],
        message: 'Choose which option is correct',
      });
    } else if (q.correctAnswer >= q.options.length) {
      ctx.addIssue({
        code: 'custom', path: ['correctAnswer'],
        message: 'The correct answer must be one of the options',
      });
    }
  } else if (q.correctAnswer !== null && q.correctAnswer !== undefined) {
    ctx.addIssue({
      code: 'custom', path: ['correctAnswer'],
      message: 'An open-text question has no single correct answer',
    });
  }
});

// ── Exams ────────────────────────────────────────────────────────────────────

const examFields = {
  title: z.string().trim().min(1, 'Title is required').max(150),
  description: z.string().trim().max(2000).default(''),
  durationMinutes: z.number().int()
    .min(1, 'Duration must be at least one minute')
    .max(600, 'Duration cannot exceed 10 hours'),
  passingGrade: z.number().int().min(minGrade).max(maxGrade).default(60),
  questions: z.array(questionSchema)
    .max(maxQuestionsPerExam, `An exam may have at most ${maxQuestionsPerExam} questions`)
    .default([]),
};

export const createExamSchema = z.object(examFields);

/**
 * `status` is absent by design. The lifecycle moves only through the dedicated
 * publish and close endpoints, so a general update cannot smuggle a transition
 * past the state machine.
 */
export const updateExamSchema = z.object({
  title: examFields.title.optional(),
  description: examFields.description.optional(),
  durationMinutes: examFields.durationMinutes.optional(),
  passingGrade: examFields.passingGrade.optional(),
  questions: z.array(questionSchema).max(maxQuestionsPerExam).optional(),
}).refine((v) => Object.keys(v).length > 0, 'Nothing to update');

// ── Attempts ─────────────────────────────────────────────────────────────────

export const draftSchema = z.object({
  answers: z.array(z.object({
    questionId: uuid,
    value: z.string().max(10_000, 'That answer is too long').default(''),
  })).max(maxQuestionsPerExam),
});

export const submitSchema = z.object({
  // Set by the client's countdown when it reaches zero. It waives the deadline
  // check, because the answers were captured before expiry even though the
  // request arrives just after it.
  auto: z.boolean().default(false),
});

// ── Grading ──────────────────────────────────────────────────────────────────

export const gradeSchema = z.object({
  answers: z.array(z.object({
    questionId: uuid,
    score: z.number().min(minGrade).max(maxGrade).optional(),
    feedback: z.string().max(5000).default(''),
  })).default([]),
  feedback: z.string().max(5000).default(''),
  /** True releases the grade to the student; false keeps it a teacher-only draft. */
  publish: z.boolean().default(false),
});

// ── AI ───────────────────────────────────────────────────────────────────────

export const generateExamSchema = z.object({
  description: z.string().trim()
    .min(10, 'Describe the exam in a little more detail')
    .max(1000, 'That description is too long'),
  questionCount: z.number().int()
    .min(config.limits.minGeneratedQuestions)
    .max(config.limits.maxGeneratedQuestions)
    .default(5),
});

// ── Params ───────────────────────────────────────────────────────────────────

export const idParamSchema = z.object({ id: uuid });
