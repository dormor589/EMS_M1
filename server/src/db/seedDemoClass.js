/**
 * seedDemoClass.js — a class of ten students sitting the teacher's six exams.
 *
 * Written for the milestone presentation: the analytics screens are only worth
 * showing if there is a real cohort behind them. It is deliberately NOT part of
 * seed.js, because that script truncates every table — this one is additive and
 * touches nothing outside the teacher's own exams and this class's students.
 *
 * HOW THE GRADES ARE PRODUCED
 *
 *   Grades are not drawn directly and they are not hand-picked. Each student
 *   gets an ability, each question a difficulty, and every answer is simulated
 *   from the two. The grade is then computed from those answers with the
 *   application's own computeGrade(), so a seeded grade and a grade the app
 *   would calculate agree by construction rather than by my arithmetic.
 *
 *   The ten abilities are the ten deciles of the standard normal rather than
 *   ten random draws, so the cohort is normally spread by construction instead
 *   of on average — with n=10 a random draw is lumpy often enough to matter.
 *
 *   Difficulty varies per question, which is what makes the "hardest question"
 *   panel in the analytics a real finding rather than an artefact of noise.
 *
 * Everything is deterministic: same seed, same database, every run.
 *
 * Usage:
 *   node src/db/seedDemoClass.js --dry-run   # print the distribution only
 *   node src/db/seedDemoClass.js             # write it
 */

import bcrypt from 'bcryptjs';
import pool, { withTransaction } from './pool.js';
import config from '../config/index.js';
import { computeGrade, scoreMultipleChoice } from '../services/grading.js';
import { students, exams, existingExam, CLASS_PASSWORD, CLASS_DOMAIN } from './demoClassData.js';

/** The teacher these exams belong to. */
const TEACHER_EMAIL = 'dormordechai589@gmail.com';

const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const ago = (days) => new Date(Date.now() - days * DAY);

// ── Calibration ────────────────────────────────────────────────────────────
// Tuned by running --dry-run and reading the resulting distribution, not by
// assumption. See PROGRESS.md for the measured output.

/** Spread of the cohort's abilities, in logits. */
const THETA_SCALE = 0.8;
/** Slope of the item-response curve: how sharply ability separates students. */
const DISCRIMINATION = 1.2;
/**
 * Difficulty is authored on a readable scale (-1.4 easy .. +0.5 hard) and
 * stretched here. Without the stretch the hardest questions still sat below
 * the strongest student's ability, so the top of the class answered everything
 * correctly and a fifth of all grades piled into the 90-99 bucket — a ceiling,
 * not a distribution.
 */
const DIFFICULTY_STRETCH = 1.8;
const DIFFICULTY_SHIFT = -0.15;
/** Centre of the open-text score scale, for a student of average ability. */
const OPEN_BASE = 72;
/** How many points of open-text score one logit of (ability - difficulty) buys. */
const OPEN_SPREAD = 12;
/** Marking noise on an open-text answer, in points. */
const OPEN_NOISE = 6;
/** Per-exam variation in a student's own form. */
const FORM_NOISE = 0.28;

// ── Deterministic randomness ───────────────────────────────────────────────

/**
 * mulberry32 — a small seeded PRNG.
 *
 * A fixed seed matters here: the presentation should show the same numbers
 * every time it is rehearsed, and PROGRESS.md can quote figures that a re-run
 * still reproduces.
 *
 * @param {number} seed
 * @returns {() => number} uniform in [0, 1)
 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Inverse standard-normal CDF (Acklam's rational approximation).
 *
 * Used to place the ten students at the deciles of the normal rather than
 * sampling them, so the cohort is exactly normally spread.
 *
 * @param {number} p in (0, 1)
 * @returns {number} z
 */
function probit(p) {
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
             1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
             6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
             -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
             3.754408661907416e+00];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  if (p > pHigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  q = p - 0.5; r = q * q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
         (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

/** Standard normal deviate from a uniform generator (Box-Muller). */
function gauss(rand) {
  const u = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

// ── The cohort ─────────────────────────────────────────────────────────────

/**
 * Ability for each student: the deciles of the standard normal, so the class
 * spans roughly -1.65 to +1.65 with the density of a real bell.
 */
const abilities = students.map((s, i) => ({
  ...s,
  theta: probit((i + 0.5) / students.length) * THETA_SCALE,
}));

/**
 * Which statuses each exam's submissions take.
 *
 * Not everything is finished, deliberately: an exam awaiting grading is what
 * makes the "Run AI grading" demo possible live, and a draft AI grade shows the
 * publish gate. The teacher's dashboard counters are only interesting if they
 * are not all zero.
 */
const PLAN = {
  python: { graded: 10, aiGraded: 0, submitted: 0, inProgress: 0, gradedBy: 'ai+teacher' },
  js:     { graded: 10, aiGraded: 0, submitted: 0, inProgress: 0, gradedBy: 'teacher' },
  react:  { graded: 10, aiGraded: 0, submitted: 0, inProgress: 0, gradedBy: 'ai+teacher' },
  node:   { graded: 10, aiGraded: 0, submitted: 0, inProgress: 0, gradedBy: 'teacher' },
  sql:    { graded: 8,  aiGraded: 0, submitted: 2, inProgress: 0, gradedBy: 'ai+teacher' },
  http:   { graded: 7,  aiGraded: 2, submitted: 0, inProgress: 1, gradedBy: 'ai' },
};

/** Teacher feedback bands, so a marked script reads like someone marked it. */
function feedbackFor(score) {
  if (score >= 90) return 'Complete and precise — you covered the reasoning, not just the result.';
  if (score >= 78) return 'Solid answer. The main idea is right; a concrete example would have made it airtight.';
  if (score >= 65) return 'Correct in outline, but thin on the "why". Say what goes wrong without it.';
  if (score >= 50) return 'Partly there. You state the rule but do not show that you understand what it prevents.';
  return 'This misses the core of the question — please review the topic and come to office hours.';
}

function aiFeedbackFor(score) {
  if (score >= 90) return 'The answer is correct and the explanation is complete, including the failure case.';
  if (score >= 78) return 'The final claim is correct and the reasoning is sound, though not fully developed.';
  if (score >= 65) return 'Correct as far as it goes; the explanation stops before the consequence.';
  if (score >= 50) return 'The definition is broadly right but the justification is missing or imprecise.';
  return 'The answer does not establish the required point; key reasoning is absent.';
}

/**
 * Simulate one student's answers to one exam.
 *
 * @param {object[]} questions  With id, type, weight, difficulty, correctAnswer.
 * @param {number}   theta      Student ability.
 * @param {() => number} rand
 * @returns {Array<object>} One entry per question.
 */
function sitExam(questions, theta, rand) {
  const form = theta + gauss(rand) * FORM_NOISE;

  return questions.map((q) => {
    const difficulty = q.difficulty * DIFFICULTY_STRETCH + DIFFICULTY_SHIFT;

    if (q.type === 'multiple-choice') {
      const correct = rand() < sigmoid(DISCRIMINATION * (form - difficulty));
      let choice = q.correctAnswer;
      if (!correct) {
        // Pick a wrong option; a plausible distractor, not always the same one.
        const wrong = q.options.map((_, i) => i).filter((i) => i !== q.correctAnswer);
        choice = wrong[Math.floor(rand() * wrong.length)];
      }
      const value = String(choice);
      const { score, isCorrect } = scoreMultipleChoice(q, value);
      return { question: q, value, score, isCorrect };
    }

    const raw = OPEN_BASE + OPEN_SPREAD * (form - difficulty) + gauss(rand) * OPEN_NOISE;
    const score = Math.round(clamp(raw, 0, 100));
    const tier = score >= 85 ? 'strong' : score >= 65 ? 'mid' : 'weak';
    return { question: q, value: q.answers[tier], score, isCorrect: null };
  });
}

// ── Reporting ──────────────────────────────────────────────────────────────

function describe(grades) {
  const n = grades.length;
  const mean = grades.reduce((s, g) => s + g, 0) / n;
  const sd = Math.sqrt(grades.reduce((s, g) => s + (g - mean) ** 2, 0) / n);
  const sorted = [...grades].sort((a, b) => a - b);
  return { n, mean, sd, min: sorted[0], max: sorted[n - 1], median: sorted[Math.floor(n / 2)] };
}

function histogram(grades) {
  const buckets = Array.from({ length: 10 }, () => 0);
  for (const g of grades) buckets[Math.min(9, Math.floor(g / 10))] += 1;
  return buckets
    .map((c, i) => `  ${String(i * 10).padStart(3)}-${String(i * 10 + 9).padEnd(3)} ${'█'.repeat(c)}${c ? ' ' + c : ''}`)
    .join('\n');
}

// ── Main ───────────────────────────────────────────────────────────────────

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`[demo-class] target: ${config.databaseUrl.replace(/:[^:@/]*@/, ':****@')}`);
  if (dryRun) console.log('[demo-class] DRY RUN — nothing will be written\n');

  const { rows: teacherRows } = await pool.query(
    'SELECT id, name FROM users WHERE email = $1', [TEACHER_EMAIL]
  );
  if (!teacherRows.length) {
    console.error(`[demo-class] no teacher account ${TEACHER_EMAIL} — register it first`);
    await pool.end();
    process.exit(1);
  }
  const teacher = teacherRows[0];
  console.log(`[demo-class] teacher: ${teacher.name} <${TEACHER_EMAIL}>`);

  // The hand-made exam is kept exactly as it is; only submissions are added.
  const { rows: legacyRows } = await pool.query(
    `SELECT id FROM exams WHERE created_by = $1 AND title = $2`,
    [teacher.id, existingExam.title]
  );
  const legacyExamId = legacyRows[0]?.id ?? null;
  if (!legacyExamId) {
    console.warn(`[demo-class] "${existingExam.title}" not found — seeding the other 5 only`);
  }

  const allGrades = [];
  const perExam = [];

  await withTransaction(async (client) => {
    // ── students ───────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(CLASS_PASSWORD, config.bcrypt.saltRounds);
    const studentId = {};
    for (const s of abilities) {
      const { rows } = await client.query(
        `INSERT INTO users (name, email, password_hash, role)
              VALUES ($1, $2, $3, 'student')
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [s.name, s.email.toLowerCase(), passwordHash]
      );
      studentId[s.key] = rows[0].id;
    }

    // Idempotency: clear only THIS class's submissions, then rebuild them.
    // Answers go with them by cascade.
    await client.query(
      `DELETE FROM submissions s
        USING users u
        WHERE s.student_id = u.id AND u.email LIKE $1`,
      [`%@${CLASS_DOMAIN}`]
    );

    // Idempotency: the five generated exams are dropped and rebuilt, so a
    // re-run cannot leave a half-updated question set behind.
    await client.query(
      `DELETE FROM exams WHERE created_by = $1 AND title = ANY($2::text[])`,
      [teacher.id, exams.map((e) => e.title)]
    );

    // ── exams + questions ──────────────────────────────────────────────────
    const built = [];

    if (legacyExamId) {
      const { rows: qs } = await client.query(
        `SELECT id, type, text, options, correct_answer, weight, position
           FROM questions WHERE exam_id = $1 ORDER BY position`, [legacyExamId]
      );
      built.push({
        key: 'python',
        id: legacyExamId,
        title: existingExam.title,
        daysAgo: 54,
        durationMinutes: 60,
        questions: qs.map((q, i) => ({
          id: q.id,
          type: q.type,
          options: q.options,
          correctAnswer: q.correct_answer,
          weight: q.weight,
          difficulty: existingExam.difficulty[i] ?? -0.5,
          answers: existingExam.openAnswers[i],
        })),
      });
    }

    for (const e of exams) {
      const createdAt = ago(e.daysAgo + 3);
      const { rows } = await client.query(
        `INSERT INTO exams (title, description, duration_minutes, passing_grade,
                            status, created_by, created_at, updated_at)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
         RETURNING id`,
        [e.title, e.description, e.durationMinutes, e.passingGrade, e.status,
         teacher.id, createdAt]
      );
      const examId = rows[0].id;

      const questions = [];
      for (const [position, q] of e.questions.entries()) {
        const { rows: qr } = await client.query(
          `INSERT INTO questions (exam_id, type, text, options, correct_answer,
                                  weight, position, created_at)
                VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)
           RETURNING id`,
          [examId, q.type, q.text, JSON.stringify(q.options ?? []),
           q.type === 'multiple-choice' ? q.correctAnswer : null,
           q.weight, position, createdAt]
        );
        questions.push({ ...q, id: qr[0].id });
      }

      built.push({ key: e.key, id: examId, title: e.title, daysAgo: e.daysAgo,
                   durationMinutes: e.durationMinutes, questions });
    }

    // ── submissions + answers ──────────────────────────────────────────────
    for (const exam of built) {
      const plan = PLAN[exam.key];
      // One generator per exam, seeded from the exam key, so adding an exam
      // never shifts the numbers of the exams before it.
      const rand = rng([...exam.key].reduce((h, c) => h * 31 + c.charCodeAt(0), 7));

      // Abilities are ordered weakest-to-strongest, so handing out statuses in
      // index order would always leave the TOP students ungraded — which drags
      // that exam's average down for a reason that has nothing to do with the
      // exam. Shuffled with its own generator so the choice of who is still
      // awaiting marking does not perturb anybody's answers.
      const shuffle = rng([...exam.key].reduce((h, c) => h * 17 + c.charCodeAt(0), 99));
      const statuses = [
        ...Array(plan.graded).fill('graded'),
        ...Array(plan.aiGraded).fill('ai_graded'),
        ...Array(plan.submitted).fill('submitted'),
        ...Array(plan.inProgress).fill('in_progress'),
      ];
      for (let k = statuses.length - 1; k > 0; k -= 1) {
        const j = Math.floor(shuffle() * (k + 1));
        [statuses[k], statuses[j]] = [statuses[j], statuses[k]];
      }

      const grades = [];
      for (const [i, student] of abilities.entries()) {
        const status = statuses[i] ?? 'graded';
        const marked = sitExam(exam.questions, student.theta, rand);

        // Timing: started around the exam date, took most but not all of the
        // allotted time, marked a few days later.
        const startedAt = new Date(ago(exam.daysAgo).getTime() + i * 7 * MINUTE);
        const expiresAt = new Date(startedAt.getTime() + exam.durationMinutes * MINUTE);
        const usedMinutes = Math.round(exam.durationMinutes * (0.55 + rand() * 0.4));
        const submittedAt = new Date(startedAt.getTime() + usedMinutes * MINUTE);
        const gradedAt = new Date(submittedAt.getTime() + (2 + rand() * 3) * DAY);

        const inProgress = status === 'in_progress';
        const hasGrade = status === 'graded' || status === 'ai_graded';

        // An in-progress attempt must still have time on the clock.
        const liveStart = new Date(Date.now() - 11 * MINUTE);
        const liveExpiry = new Date(liveStart.getTime() + exam.durationMinutes * MINUTE);

        const scoreMap = new Map(marked.map((m) => [m.question.id, m.score]));
        const grade = hasGrade ? computeGrade(exam.questions, scoreMap) : null;
        if (hasGrade) { grades.push(grade); allGrades.push(grade); }

        // An in-progress attempt has only answered part of the paper so far.
        const visible = inProgress ? marked.slice(0, Math.ceil(marked.length / 2)) : marked;

        // Every remaining draw happens HERE, before the dry-run check, so a dry
        // run and a real run consume the generator identically. Skipping these
        // draws when not writing would desynchronise the stream and make
        // --dry-run report a distribution the real run never produces.
        const rows = visible.map((m) => {
          const isOpen = m.question.type === 'open-text';
          // The AI only ever marks open text — multiple choice is deterministic,
          // so the model is never asked. Mirrors AiService.
          const aiInvolved = hasGrade && isOpen &&
                             (plan.gradedBy === 'ai' || plan.gradedBy === 'ai+teacher');
          // Where the teacher reviewed an AI mark, the two differ a little —
          // which is what the "AI proposed N" badge exists to show.
          const aiScore = aiInvolved
            ? clamp(m.score + (plan.gradedBy === 'ai+teacher' ? Math.round((rand() - 0.35) * 12) : 0), 0, 100)
            : null;
          return { m, isOpen, aiScore };
        });

        if (dryRun) continue;

        const { rows: sr } = await client.query(
          `INSERT INTO submissions
             (exam_id, student_id, status, started_at, expires_at, submitted_at,
              grade, graded_by, graded_at, feedback)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING id`,
          [
            exam.id, studentId[student.key], status,
            inProgress ? liveStart : startedAt,
            inProgress ? liveExpiry : expiresAt,
            inProgress ? null : submittedAt,
            grade,
            hasGrade ? plan.gradedBy : null,
            status === 'graded' ? gradedAt : null,
            status === 'graded' ? feedbackFor(grade) : '',
          ]
        );
        const submissionId = sr[0].id;

        for (const { m, isOpen, aiScore } of rows) {
          await client.query(
            `INSERT INTO answers
               (submission_id, question_id, value, is_correct,
                ai_score, ai_feedback, score, feedback, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              submissionId, m.question.id, m.value,
              // is_correct is stamped at submit time for multiple choice only.
              inProgress ? null : m.isCorrect,
              aiScore,
              aiScore === null ? null : aiFeedbackFor(aiScore),
              hasGrade ? m.score : null,
              hasGrade && isOpen ? feedbackFor(m.score) : '',
              inProgress ? liveStart : submittedAt,
            ]
          );
        }
      }

      perExam.push({ exam: exam.title, submissions: statuses.length, ...describe(grades.length ? grades : [0]) });
    }

    if (dryRun) throw new Error('__DRY_RUN__');
  }).catch((err) => {
    if (err.message !== '__DRY_RUN__') throw err;
  });

  // ── Report ─────────────────────────────────────────────────────────────
  console.log('\nPer exam');
  console.table(perExam.map((e) => ({
    exam: e.exam, subs: e.submissions, graded: e.n,
    mean: e.mean.toFixed(1), sd: e.sd.toFixed(1),
    min: e.min.toFixed(1), max: e.max.toFixed(1),
  })));

  const all = describe(allGrades);
  console.log(`Cohort: n=${all.n}  mean=${all.mean.toFixed(1)}  sd=${all.sd.toFixed(1)}  ` +
              `min=${all.min.toFixed(1)}  median=${all.median.toFixed(1)}  max=${all.max.toFixed(1)}`);
  console.log('\nAll grades, bucketed as the analytics page buckets them:');
  console.log(histogram(allGrades));

  if (!dryRun) console.log('\n[demo-class] written.');
  await pool.end();
}

run().catch(async (err) => {
  console.error('[demo-class] failed:', err.message);
  await pool.end();
  process.exit(1);
});
