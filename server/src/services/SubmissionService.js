/**
 * SubmissionService — taking an exam, and grading what comes back.
 *
 * Enforces server-side what Milestone 1 only enforced in the browser:
 *
 *   - a student may sit each exam exactly once
 *   - only published exams may be attempted
 *   - the timer is real: a submission arriving after the deadline is refused
 *   - a student sees a grade only once the teacher has published it
 *   - only the exam's owner may read or grade its submissions
 */

import config from '../config/index.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import ExamRepository from '../db/repositories/ExamRepository.js';
import SubmissionRepository from '../db/repositories/SubmissionRepository.js';
import UserRepository from '../db/repositories/UserRepository.js';
import { scoreMultipleChoice, computeGrade } from './grading.js';
import AiService from './AiService.js';

class SubmissionService {
  constructor(
    submissions = new SubmissionRepository(),
    exams = new ExamRepository(),
    users = new UserRepository(),
    ai = new AiService()
  ) {
    this._submissions = submissions;
    this._exams = exams;
    this._users = users;
    this._ai = ai;
  }

  // ── Taking an exam ─────────────────────────────────────────────────────────

  /**
   * Start — or resume — an attempt at an exam.
   *
   * Calling this twice is safe: an existing in-progress attempt is returned
   * with its original deadline, so refreshing the page cannot reset the clock.
   * An attempt that is already submitted is refused.
   *
   * @param {string} examId
   * @param {import('../models/User.js').default} user
   * @returns {Promise<object>}
   */
  async startAttempt(examId, user) {
    const exam = await this._exams.findById(examId);
    // 404 for both "no such exam" and "not published", so a student cannot
    // distinguish the two by probing ids. GET /api/exams/:id already hides
    // unpublished exams this way; returning 409 here would have leaked their
    // existence through the back door.
    if (!exam || !exam.isPublished()) {
      throw ApiError.notFound('Exam not found');
    }

    const existing = await this._submissions.findByExamAndStudent(examId, user.id);
    if (existing) {
      if (!existing.isInProgress()) {
        throw ApiError.conflict('You have already submitted this exam');
      }
      // Resume: the deadline was fixed when the attempt began.
      return this._present(existing, exam, user);
    }

    const expiresAt = new Date(Date.now() + exam.durationMinutes * 60_000);
    const created = await this._submissions.createAttempt({
      examId, studentId: user.id, expiresAt,
    });

    logger.info('attempt started', { examId, studentId: user.id, expiresAt });
    return this._present(created, exam, user);
  }

  /**
   * Autosave answers for an in-progress attempt.
   *
   * @param {string} submissionId
   * @param {Array<{questionId: string, value: string}>} answers
   * @param {import('../models/User.js').default} user
   * @returns {Promise<object>}
   */
  async saveDraft(submissionId, answers, user) {
    const { submission, exam } = await this._loadOwnAttempt(submissionId, user);

    if (!submission.isInProgress()) {
      throw ApiError.conflict('This exam has already been submitted');
    }
    if (submission.hasExpired(config.limits.submitGraceSeconds)) {
      throw ApiError.conflict('Time is up for this exam');
    }
    this._assertAnswersBelongToExam(answers, exam);

    const saved = await this._submissions.saveDraft(submissionId, answers);
    return this._present(saved, exam, user);
  }

  /**
   * Submit an attempt.
   *
   * Multiple-choice answers are marked here, at submit time, because that is
   * deterministic and needs no grader. The overall grade is NOT computed: a
   * submission stays ungraded until a teacher acts on it.
   *
   * @param {string} submissionId
   * @param {import('../models/User.js').default} user
   * @param {object}  [options]
   * @param {boolean} [options.auto] True when the client's timer fired, which
   *   waives the deadline check — the answers were captured before expiry.
   * @returns {Promise<object>}
   */
  async submit(submissionId, user, { auto = false } = {}) {
    const { submission, exam } = await this._loadOwnAttempt(submissionId, user);

    if (!submission.isInProgress()) {
      throw ApiError.conflict('You have already submitted this exam');
    }
    if (!auto && submission.hasExpired(config.limits.submitGraceSeconds)) {
      throw ApiError.conflict('Time is up — this exam can no longer be submitted');
    }

    // Record correctness for multiple choice; open text is left for a grader.
    const byQuestion = new Map(submission.answers.map((a) => [a.questionId, a]));
    const scored = exam.questions
      .filter((q) => q.isMultipleChoice())
      .map((q) => ({
        questionId: q.id,
        isCorrect: scoreMultipleChoice(q, byQuestion.get(q.id)?.value ?? '').isCorrect,
      }));

    const submitted = await this._submissions.submit(submissionId, scored);
    logger.info('exam submitted', { submissionId, examId: exam.id, auto });
    return this._present(submitted, exam, user);
  }

  // ── Reading ────────────────────────────────────────────────────────────────

  /**
   * Every submission for one exam. The exam's owner only.
   *
   * @param {string} examId
   * @param {import('../models/User.js').default} user
   * @returns {Promise<object[]>}
   */
  async listForExam(examId, user) {
    const exam = await this._exams.findById(examId);
    if (!exam) throw ApiError.notFound('Exam not found');
    if (!exam.isOwnedBy(user.id)) {
      throw ApiError.forbidden('This exam belongs to another teacher');
    }

    const submissions = await this._submissions.findAll({ examId });
    const students = await this._users.findManyByIds(submissions.map((s) => s.studentId));

    return submissions.map((s) => ({
      ...s.toJSON({ passingGrade: exam.passingGrade }),
      student: students.get(s.studentId)?.toJSON() ?? null,
      examTitle: exam.title,
    }));
  }

  /**
   * The calling student's own submissions.
   *
   * @param {import('../models/User.js').default} user
   * @returns {Promise<object[]>}
   */
  async listForStudent(user) {
    const submissions = await this._submissions.findAll({ studentId: user.id });
    if (!submissions.length) return [];

    const exams = await this._exams.findAll();
    const byId = new Map(exams.map((e) => [e.id, e]));

    return submissions.map((s) => {
      const exam = byId.get(s.examId);
      return {
        ...s.toJSON({ forStudent: true, passingGrade: exam?.passingGrade }),
        // Recomputed here so it reflects publication, which toJSON hides.
        passed: s.isPublished() && exam ? s.passed(exam.passingGrade) : null,
        grade: s.isPublished() ? s.grade : null,
        feedback: s.isPublished() ? s.feedback : '',
        examTitle: exam?.title ?? null,
        passingGrade: exam?.passingGrade ?? null,
      };
    });
  }

  /**
   * One submission, in full detail for the owning teacher or in the
   * student-safe shape for its author.
   *
   * @param {string} id
   * @param {import('../models/User.js').default} user
   * @returns {Promise<object>}
   */
  async get(id, user) {
    const submission = await this._submissions.findById(id);
    if (!submission) throw ApiError.notFound('Submission not found');

    const exam = await this._exams.findById(submission.examId);

    if (user.isTeacher()) {
      if (!exam.isOwnedBy(user.id)) {
        throw ApiError.forbidden('This exam belongs to another teacher');
      }
      const student = await this._users.findById(submission.studentId);
      return {
        ...submission.toJSON({ passingGrade: exam.passingGrade }),
        student: student?.toJSON() ?? null,
        // The teacher grading this needs the answer key.
        exam: exam.toJSON({ includeAnswerKey: true }),
      };
    }

    if (submission.studentId !== user.id) {
      throw ApiError.notFound('Submission not found');
    }
    return this._present(submission, exam, user);
  }

  // ── Grading ────────────────────────────────────────────────────────────────

  /**
   * Save per-question scores and recompute the overall grade.
   *
   * Serves both the plain manual grade and a teacher editing what the AI
   * proposed. The AI columns are never written here, so an edit records the
   * teacher's decision without erasing the model's original proposal.
   *
   * @param {string} id
   * @param {object} data
   * @param {Array<{questionId: string, score: number, feedback?: string}>} data.answers
   * @param {string} [data.feedback] Overall feedback.
   * @param {boolean} [data.publish] Release the grade to the student now.
   * @param {import('../models/User.js').default} user
   * @returns {Promise<object>}
   */
  async saveGrade(id, { answers, feedback = '', publish = false }, user) {
    const { submission, exam } = await this._loadForGrading(id, user);

    this._assertAnswersBelongToExam(answers, exam);

    // Multiple choice is authoritative from the answer key — a teacher does not
    // get to mark a correct MC answer wrong, and does not have to mark it right.
    const stored = new Map(submission.answers.map((a) => [a.questionId, a]));
    const supplied = new Map(answers.map((a) => [a.questionId, a]));

    const rows = [];
    const scores = new Map();
    for (const q of exam.questions) {
      let score;
      let fb = supplied.get(q.id)?.feedback ?? stored.get(q.id)?.feedback ?? '';

      if (q.isMultipleChoice()) {
        score = scoreMultipleChoice(q, stored.get(q.id)?.value ?? '').score;
      } else {
        const given = supplied.get(q.id)?.score;
        score = typeof given === 'number' ? given : (stored.get(q.id)?.score ?? 0);
      }

      scores.set(q.id, score);
      if (stored.has(q.id)) rows.push({ questionId: q.id, score, feedback: fb });
    }

    const grade = computeGrade(exam.questions, scores);
    const wasAiGraded = submission.answers.some((a) => a.aiScore !== null);
    const status = publish ? 'graded' : 'ai_graded';

    const saved = await this._submissions.saveGrades(id, {
      answers: rows,
      grade,
      status,
      gradedBy: wasAiGraded ? 'ai+teacher' : 'teacher',
      feedback,
    });

    logger.info('submission graded', { id, grade, status, published: publish });
    return {
      ...saved.toJSON({ passingGrade: exam.passingGrade }),
      exam: exam.toJSON({ includeAnswerKey: true }),
    };
  }

  /**
   * Run the AI marking pass over a submission.
   *
   * Marks everything in one go and leaves the result as a DRAFT — status
   * `ai_graded`, invisible to the student — so the teacher reviews before
   * anything is released. That is the whole point of the design: the model
   * proposes, the teacher decides.
   *
   * Multiple-choice questions are scored from the answer key here rather than
   * sent to the model, so a twelve-question exam with two open questions costs
   * one AI call, not twelve.
   *
   * @param {string} id
   * @param {import('../models/User.js').default} user
   * @returns {Promise<object>} The draft-graded submission, with which provider
   *   answered and whether a real model was involved.
   */
  async aiGrade(id, user) {
    const { submission, exam } = await this._loadForGrading(id, user);

    const { grades, gradedBy, modelBacked } = await this._ai.gradeOpenAnswers(exam, submission);
    const aiByQuestion = new Map(grades.map((g) => [g.questionId, g]));
    const stored = new Map(submission.answers.map((a) => [a.questionId, a]));

    const rows = [];
    const scores = new Map();

    for (const q of exam.questions) {
      let score;
      let feedback = '';
      let aiScore;
      let aiFeedback;

      if (q.isMultipleChoice()) {
        // Decided by the answer key. No model, no ambiguity, no cost.
        score = scoreMultipleChoice(q, stored.get(q.id)?.value ?? '').score;
      } else {
        const proposed = aiByQuestion.get(q.id);
        score = proposed?.score ?? 0;
        feedback = proposed?.feedback ?? '';
        // Recorded separately so a later teacher edit does not erase what the
        // model said — that is what powers "AI proposed 85, you changed it to 92".
        aiScore = score;
        aiFeedback = feedback;
      }

      scores.set(q.id, score);
      if (stored.has(q.id)) {
        rows.push({ questionId: q.id, score, feedback, aiScore, aiFeedback });
      }
    }

    const grade = computeGrade(exam.questions, scores);

    const saved = await this._submissions.saveGrades(id, {
      answers: rows,
      grade,
      // Draft, not published. The student still sees nothing.
      status: 'ai_graded',
      gradedBy: 'ai',
      feedback: submission.feedback,
    });

    logger.info('AI grading complete', { id, grade, provider: gradedBy, modelBacked });

    return {
      submission: {
        ...saved.toJSON({ passingGrade: exam.passingGrade }),
        exam: exam.toJSON({ includeAnswerKey: true }),
      },
      gradedBy,
      modelBacked,
    };
  }

  /**
   * Publish an existing draft grade to the student, unchanged.
   *
   * @param {string} id
   * @param {import('../models/User.js').default} user
   * @returns {Promise<object>}
   */
  async publishGrade(id, user) {
    const { submission, exam } = await this._loadForGrading(id, user);

    if (submission.grade === null) {
      throw ApiError.conflict('This submission has not been graded yet');
    }
    if (submission.isPublished()) {
      throw ApiError.conflict('This grade has already been published');
    }

    const rows = submission.answers.map((a) => ({
      questionId: a.questionId, score: a.score, feedback: a.feedback,
    }));
    const saved = await this._submissions.saveGrades(id, {
      answers: rows,
      grade: submission.grade,
      status: 'graded',
      gradedBy: submission.gradedBy ?? 'teacher',
      feedback: submission.feedback,
    });

    logger.info('grade published', { id, grade: saved.grade });
    return {
      ...saved.toJSON({ passingGrade: exam.passingGrade }),
      exam: exam.toJSON({ includeAnswerKey: true }),
    };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /**
   * Load a submission the caller authored, with its exam.
   * @private
   */
  async _loadOwnAttempt(submissionId, user) {
    const submission = await this._submissions.findById(submissionId);
    if (!submission || submission.studentId !== user.id) {
      throw ApiError.notFound('Submission not found');
    }
    const exam = await this._exams.findById(submission.examId);
    return { submission, exam };
  }

  /**
   * Load a submission the caller is entitled to grade, with its exam.
   * @private
   */
  async _loadForGrading(id, user) {
    const submission = await this._submissions.findById(id);
    if (!submission) throw ApiError.notFound('Submission not found');

    const exam = await this._exams.findById(submission.examId);
    if (!exam.isOwnedBy(user.id)) {
      throw ApiError.forbidden('This exam belongs to another teacher');
    }
    if (submission.isInProgress()) {
      throw ApiError.conflict('This student has not submitted yet');
    }
    return { submission, exam };
  }

  /**
   * Reject answers referring to questions that are not on this exam.
   * @private
   */
  _assertAnswersBelongToExam(answers, exam) {
    const valid = new Set(exam.questions.map((q) => q.id));
    const stray = (answers ?? []).find((a) => !valid.has(a.questionId));
    if (stray) {
      throw ApiError.badRequest('An answer refers to a question that is not on this exam', {
        questionId: stray.questionId,
      });
    }
  }

  /**
   * Shape a submission for its own student, with the exam attached.
   * @private
   */
  _present(submission, exam, user) {
    return {
      ...submission.toJSON({ forStudent: user.isStudent(), passingGrade: exam?.passingGrade }),
      examTitle: exam?.title ?? null,
      exam: exam ? exam.toJSON({ includeAnswerKey: false }) : null,
    };
  }
}

export default SubmissionService;
