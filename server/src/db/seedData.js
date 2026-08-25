/**
 * seedData.js — the demo dataset, as plain data.
 *
 * Kept separate from seed.js so the dataset can be read, reviewed and reused
 * (by tests, for example) without running any database code.
 *
 * Every account uses the password 'password'. Two ids are pinned to the values
 * Milestone 1 used, so the demo credentials from the M1 README keep working.
 */

/** Password for every seeded account. Hashed with bcrypt at seed time. */
export const DEMO_PASSWORD = 'password';

/** Ids pinned for continuity with the Milestone 1 demo credentials. */
export const PINNED_IDS = Object.freeze({
  teacher: 'a1b2c3d4-0001-4000-8000-000000000001',
  student: 'a1b2c3d4-0002-4000-8000-000000000002',
});

export const users = [
  { key: 'alice', id: PINNED_IDS.teacher, name: 'Alice Teacher', email: 'teacher@ems.dev',  role: 'teacher' },
  { key: 'david',                          name: 'David Cohen',   email: 'lecturer@ems.dev', role: 'teacher' },

  { key: 'bob',   id: PINNED_IDS.student, name: 'Bob Student',   email: 'student@ems.dev', role: 'student' },
  { key: 'maya',                           name: 'Maya Levi',     email: 'maya@ems.dev',    role: 'student' },
  { key: 'omar',                           name: 'Omar Haddad',   email: 'omar@ems.dev',    role: 'student' },
  { key: 'noa',                            name: 'Noa Friedman',  email: 'noa@ems.dev',     role: 'student' },
  { key: 'yuval',                          name: 'Yuval Barak',   email: 'yuval@ems.dev',   role: 'student' },
  { key: 'tamar',                          name: 'Tamar Azoulay', email: 'tamar@ems.dev',   role: 'student' },
];

/**
 * Exams, each with its questions in display order.
 * `weight` values total 100 per exam here, though the grading formula does not
 * require it — see the grade calculation in seed.js.
 */
export const exams = [
  {
    key: 'webdev',
    title: 'Introduction to Web Development',
    description: 'A sample exam covering HTML, CSS, and JavaScript basics.',
    durationMinutes: 30,
    passingGrade: 60,
    status: 'Published',
    createdBy: 'alice',
    questions: [
      {
        key: 'w1', type: 'multiple-choice', weight: 30,
        text: 'Which language is used for styling web pages?',
        options: ['HTML', 'CSS', 'JavaScript', 'Python'],
        correctAnswer: 1,
      },
      {
        key: 'w2', type: 'multiple-choice', weight: 30,
        text: 'Which HTML element contains metadata about the document?',
        options: ['<body>', '<head>', '<main>', '<section>'],
        correctAnswer: 1,
      },
      {
        key: 'w3', type: 'open-text', weight: 40,
        text: 'Briefly describe the difference between a class selector and an ID selector in CSS.',
      },
    ],
  },
  {
    key: 'react',
    title: 'React Fundamentals',
    description: 'Components, state, props, and the rendering lifecycle.',
    durationMinutes: 45,
    passingGrade: 65,
    status: 'Published',
    createdBy: 'alice',
    questions: [
      {
        key: 'r1', type: 'multiple-choice', weight: 25,
        text: 'Which hook manages local state inside a function component?',
        options: ['useEffect', 'useState', 'useMemo', 'useRef'],
        correctAnswer: 1,
      },
      {
        key: 'r2', type: 'multiple-choice', weight: 25,
        text: 'How is data passed from a parent component to a child component?',
        options: ['context', 'props', 'redux', 'global variables'],
        correctAnswer: 1,
      },
      {
        key: 'r3', type: 'open-text', weight: 25,
        text: 'Explain what happens when a component’s state changes.',
      },
      {
        key: 'r4', type: 'open-text', weight: 25,
        text: 'When would you reach for useEffect, and what is a common mistake people make with it?',
      },
    ],
  },
  {
    key: 'dbdesign',
    title: 'Database Design Basics',
    description: 'Keys, relationships, normalization, and when to break the rules.',
    durationMinutes: 40,
    passingGrade: 60,
    status: 'Closed',
    createdBy: 'david',
    questions: [
      {
        key: 'd1', type: 'multiple-choice', weight: 40,
        text: 'What does a FOREIGN KEY constraint enforce?',
        options: ['Uniqueness of a column', 'Referential integrity between tables', 'Row ordering', 'Encryption at rest'],
        correctAnswer: 1,
      },
      {
        key: 'd2', type: 'open-text', weight: 60,
        text: 'Explain normalization, and give one reason you might deliberately denormalize.',
      },
    ],
  },
  {
    key: 'advjs',
    title: 'Advanced JavaScript Concepts',
    description: 'Work in progress — closures, promises, and async/await.',
    durationMinutes: 45,
    passingGrade: 70,
    status: 'Draft',
    createdBy: 'alice',
    questions: [
      {
        key: 'j1', type: 'open-text', weight: 50,
        text: 'Explain what a closure is in JavaScript, with an example of where it is useful.',
      },
      {
        key: 'j2', type: 'multiple-choice', weight: 50,
        text: 'What is the result of `typeof null`?',
        options: ['"object"', '"null"', '"undefined"', '"number"'],
        correctAnswer: 0,
      },
    ],
  },
];

/**
 * Submissions.
 *
 * `answers` maps a question key to the student's response:
 *   - multiple-choice: `choice` is the zero-based option index they picked.
 *   - open-text:       `text` is their prose, `score` the 0-100 mark it earned,
 *                      `aiScore` what the model proposed (omit if never AI-graded).
 *
 * The final grade is NOT written here — seed.js computes it with the real
 * formula, sum(score * weight) / sum(weight), so the seeded data and the
 * running application agree by construction.
 */
export const submissions = [
  // ── Introduction to Web Development (Published) ──────────────────────────
  {
    exam: 'webdev', student: 'bob', status: 'graded', gradedBy: 'ai+teacher',
    answers: {
      w1: { choice: 1 },
      w2: { choice: 1 },
      w3: {
        text: 'A class selector starts with a dot and can be used on many elements. An ID starts with a hash and should only be used once per page. IDs are also more specific.',
        aiScore: 82, score: 88,
        aiFeedback: 'Correct on both syntax and reuse. Could mention specificity weighting explicitly.',
        feedback: 'Good answer — you did mention specificity, so full marks for the concept.',
      },
    },
  },
  {
    exam: 'webdev', student: 'maya', status: 'graded', gradedBy: 'ai',
    answers: {
      w1: { choice: 1 },
      w2: { choice: 1 },
      w3: {
        text: 'Class selectors (.name) are reusable across multiple elements and are the normal way to style groups of things. ID selectors (#name) must be unique in a document and carry much higher specificity, which makes them harder to override later.',
        aiScore: 96, score: 96,
        aiFeedback: 'Excellent — covers reuse, uniqueness, specificity and the practical consequence.',
        feedback: 'Excellent — covers reuse, uniqueness, specificity and the practical consequence.',
      },
    },
  },
  {
    exam: 'webdev', student: 'omar', status: 'graded', gradedBy: 'ai',
    answers: {
      w1: { choice: 1 },
      w2: { choice: 0 },
      w3: {
        text: 'A class is for styling and an id is for javascript.',
        aiScore: 30, score: 30,
        aiFeedback: 'This is a common misconception. Both can be used for styling and for scripting; the real differences are reuse and specificity.',
        feedback: 'This is a common misconception. Both can be used for styling and for scripting; the real differences are reuse and specificity.',
      },
    },
  },
  {
    exam: 'webdev', student: 'noa', status: 'graded', gradedBy: 'teacher',
    answers: {
      w1: { choice: 1 },
      w2: { choice: 1 },
      w3: {
        text: 'Classes can repeat, IDs cannot. You write classes with a dot and IDs with a hash.',
        score: 65,
        feedback: 'Correct as far as it goes, but you did not mention specificity.',
      },
    },
  },
  {
    exam: 'webdev', student: 'yuval', status: 'submitted',
    answers: {
      w1: { choice: 1 },
      w2: { choice: 3 },
      w3: { text: 'Classes are reusable and IDs are unique to one element on the page.' },
    },
  },
  {
    exam: 'webdev', student: 'tamar', status: 'ai_graded', gradedBy: 'ai',
    answers: {
      w1: { choice: 1 },
      w2: { choice: 1 },
      w3: {
        text: 'A class can be applied to several elements, an ID only one. IDs override classes in the cascade.',
        aiScore: 78, score: 78,
        aiFeedback: 'Accurate and mentions the cascade. Would be stronger with the specificity numbers.',
        feedback: 'Accurate and mentions the cascade. Would be stronger with the specificity numbers.',
      },
    },
  },

  // ── React Fundamentals (Published) ───────────────────────────────────────
  {
    exam: 'react', student: 'bob', status: 'graded', gradedBy: 'ai',
    answers: {
      r1: { choice: 1 },
      r2: { choice: 1 },
      r3: {
        text: 'React re-renders the component and updates the DOM where it changed.',
        aiScore: 70, score: 70,
        aiFeedback: 'Right idea. Missing that the re-render is scheduled rather than immediate, and that children re-render too.',
        feedback: 'Right idea. Missing that the re-render is scheduled rather than immediate, and that children re-render too.',
      },
      r4: {
        text: 'For fetching data. A common mistake is forgetting the dependency array so it runs on every render.',
        aiScore: 75, score: 75,
        aiFeedback: 'Good concrete example of the classic bug. Could also mention cleanup functions.',
        feedback: 'Good concrete example of the classic bug. Could also mention cleanup functions.',
      },
    },
  },
  {
    exam: 'react', student: 'maya', status: 'graded', gradedBy: 'ai+teacher',
    answers: {
      r1: { choice: 1 },
      r2: { choice: 1 },
      r3: {
        text: 'Calling the setter marks the component as needing an update. React schedules a re-render, produces a new element tree, diffs it against the previous one and applies only the differences to the DOM. Children re-render unless they are memoized.',
        aiScore: 92, score: 98,
        aiFeedback: 'Very strong — scheduling, diffing and memoization all covered.',
        feedback: 'Best answer in the cohort. Raised to full marks.',
      },
      r4: {
        text: 'For synchronising with something outside React — network requests, subscriptions, timers. The classic mistake is an incorrect dependency array causing either infinite loops or stale closures. Forgetting the cleanup function also leaks subscriptions.',
        aiScore: 90, score: 90,
        aiFeedback: 'Covers purpose, both failure modes and cleanup. Excellent.',
        feedback: 'Covers purpose, both failure modes and cleanup. Excellent.',
      },
    },
  },
  {
    exam: 'react', student: 'omar', status: 'submitted',
    answers: {
      r1: { choice: 1 },
      r2: { choice: 0 },
      r3: { text: 'The page updates.' },
      r4: { text: 'To do something after render.' },
    },
  },
  {
    // Timer still running — exercises the in_progress state and autosave.
    exam: 'react', student: 'noa', status: 'in_progress',
    answers: {
      r1: { choice: 1 },
      r3: { text: 'React re-renders and updates the DOM. I need to expand this' },
    },
  },

  // ── Database Design Basics (Closed) ──────────────────────────────────────
  {
    exam: 'dbdesign', student: 'bob', status: 'graded', gradedBy: 'ai',
    answers: {
      d1: { choice: 1 },
      d2: {
        text: 'Normalization means splitting data into tables so nothing is stored twice. You might denormalize to make reads faster.',
        aiScore: 62, score: 62,
        aiFeedback: 'Correct but thin. No mention of normal forms or the write-cost trade-off.',
        feedback: 'Correct but thin. No mention of normal forms or the write-cost trade-off.',
      },
    },
  },
  {
    exam: 'dbdesign', student: 'maya', status: 'graded', gradedBy: 'ai',
    answers: {
      d1: { choice: 1 },
      d2: {
        text: 'Normalization organises columns and tables so each fact is stored exactly once, removing update anomalies — typically to third normal form. You denormalize when the joins needed to reassemble that data make a hot read path too slow, accepting duplicated data and the cost of keeping copies in sync.',
        aiScore: 95, score: 95,
        aiFeedback: 'Outstanding — names the normal form, the anomaly it prevents, and states the trade-off precisely.',
        feedback: 'Outstanding — names the normal form, the anomaly it prevents, and states the trade-off precisely.',
      },
    },
  },
  {
    exam: 'dbdesign', student: 'omar', status: 'graded', gradedBy: 'ai',
    answers: {
      d1: { choice: 0 },
      d2: {
        text: 'It is when you make the database normal so it works better.',
        aiScore: 15, score: 15,
        aiFeedback: 'This does not describe normalization. Review functional dependencies and the first three normal forms.',
        feedback: 'This does not describe normalization. Review functional dependencies and the first three normal forms.',
      },
    },
  },
  {
    exam: 'dbdesign', student: 'yuval', status: 'graded', gradedBy: 'teacher',
    answers: {
      d1: { choice: 1 },
      d2: {
        text: 'Normalization removes duplicate data by splitting it across related tables joined by keys, which prevents update anomalies. Denormalizing is worth it when a report query joins six tables and runs too slowly.',
        score: 82,
        feedback: 'Solid, with a realistic example of when to denormalize.',
      },
    },
  },
  {
    exam: 'dbdesign', student: 'tamar', status: 'graded', gradedBy: 'ai',
    answers: {
      d1: { choice: 1 },
      d2: {
        text: 'Splitting tables up so data is not repeated. Denormalize for speed.',
        aiScore: 48, score: 48,
        aiFeedback: 'The core idea is there but the answer is too brief to show understanding.',
        feedback: 'The core idea is there but the answer is too brief to show understanding.',
      },
    },
  },
];
