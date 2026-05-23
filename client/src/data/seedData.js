/**
 * seedData.js — deterministic demo data for EMS_M1 mock database.
 *
 * IDs are hard-coded UUIDs so the seed is stable across reloads and predictable
 * in tests. Password is 'password' for all demo accounts (M1 mock auth only).
 *
 * Demo credentials (documented in docs/ai-work-log.txt):
 *   Teacher  — email: teacher@ems.dev   password: password
 *   Student  — email: student@ems.dev   password: password
 *
 * Source: docs/spec_brief.txt §7 — Mock DB / seed data
 */

// ── Fixed IDs ─────────────────────────────────────────────────────────────────
export const SEED_IDS = Object.freeze({
  teacherUser:   'a1b2c3d4-0001-4000-8000-000000000001',
  studentUser:   'a1b2c3d4-0002-4000-8000-000000000002',
  publishedExam: 'a1b2c3d4-0010-4000-8000-000000000010',
  draftExam:     'a1b2c3d4-0011-4000-8000-000000000011',
  question1:     'a1b2c3d4-0020-4000-8000-000000000020',
  question2:     'a1b2c3d4-0021-4000-8000-000000000021',
  question3:     'a1b2c3d4-0022-4000-8000-000000000022',
});

/**
 * Return the canonical seed dataset.
 *
 * Calling this function always produces the same output (pure, no side effects).
 * MockApiService.seedIfEmpty() calls this when storage is empty.
 *
 * @returns {{ users: object[], exams: object[], submissions: object[] }}
 */
export function getSeedData() {
  return {
    users: [
      {
        id: SEED_IDS.teacherUser,
        name: 'Alice Teacher',
        email: 'teacher@ems.dev',
        password: 'password',
        role: 'teacher',
      },
      {
        id: SEED_IDS.studentUser,
        name: 'Bob Student',
        email: 'student@ems.dev',
        password: 'password',
        role: 'student',
      },
    ],

    exams: [
      {
        id: SEED_IDS.publishedExam,
        title: 'Introduction to Web Development',
        description: 'A sample exam covering HTML, CSS, and JavaScript basics.',
        durationMinutes: 30,
        status: 'Published',
        createdBy: SEED_IDS.teacherUser,
        createdAt: '2026-05-20T10:00:00.000Z',
        questions: [
          {
            id: SEED_IDS.question1,
            examId: SEED_IDS.publishedExam,
            type: 'multiple-choice',
            text: 'Which language is used for styling web pages?',
            options: ['HTML', 'CSS', 'JavaScript', 'Python'],
            correctAnswer: 1,   // index of 'CSS'
            points: 2,
          },
          {
            id: SEED_IDS.question2,
            examId: SEED_IDS.publishedExam,
            type: 'open-text',
            text: 'Briefly describe the difference between a class and an ID selector in CSS.',
            options: [],
            correctAnswer: null,
            points: 3,
          },
        ],
      },
      {
        id: SEED_IDS.draftExam,
        title: 'Advanced JavaScript Concepts (Draft)',
        description: 'Work in progress — closures, promises, and async/await.',
        durationMinutes: 45,
        status: 'Draft',
        createdBy: SEED_IDS.teacherUser,
        createdAt: '2026-05-21T09:00:00.000Z',
        questions: [
          {
            id: SEED_IDS.question3,
            examId: SEED_IDS.draftExam,
            type: 'open-text',
            text: 'Explain what a closure is in JavaScript.',
            options: [],
            correctAnswer: null,
            points: 5,
          },
        ],
      },
    ],

    // No demo submissions in M1 seed — student takes the exam live.
    submissions: [],
  };
}
