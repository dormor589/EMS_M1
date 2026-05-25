/**
 * SubmissionService — student exam submission and query operations.
 *
 * Key invariants enforced here (not in the UI):
 *   1. Only Published exams may be submitted to. Draft / Closed → throws.
 *   2. One submission per (examId, studentId) — duplicate submit throws
 *      Error('Already submitted').
 *   3. gradeSubmission is a field-update stub in M1 (teacher grading UI in M2).
 *
 * Constructor receives dependencies via injection; instantiated in
 * services/index.js.
 *
 * Source: the milestone brief §8 — SubmissionService
 * Source: the milestone brief §5.1 — Must-Have: student submit, view grades
 */

import { generateId } from '../models/util.js';

class SubmissionService {
  /**
   * @param {import('./MockApiService.js').default} mockApi      - MockApiService singleton.
   * @param {import('./ExamService.js').default}    examService  - ExamService singleton.
   * @param {import('./ConfigService.js').default}  config       - ConfigService singleton.
   * @param {import('./LoggerService.js').default}  logger       - LoggerService singleton.
   */
  constructor(mockApi, examService, config, logger) {
    if (!mockApi)     throw new Error('SubmissionService: "mockApi" dependency is required');
    if (!examService) throw new Error('SubmissionService: "examService" dependency is required');
    if (!config)      throw new Error('SubmissionService: "config" dependency is required');
    if (!logger)      throw new Error('SubmissionService: "logger" dependency is required');

    this._mockApi     = mockApi;
    this._examService = examService;
    this._config      = config;
    this._logger      = logger;
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  /**
   * Submit a student's answers for an exam.
   *
   * Guards:
   *   - Exam must exist.
   *   - Exam status must be 'Published' (not Draft or Closed).
   *   - Student must not have a prior submission for this exam.
   *
   * @param {object}   data
   * @param {string}   data.examId    - Target exam ID (required).
   * @param {string}   data.studentId - Submitting student's user ID (required).
   * @param {object[]} data.answers   - Array of { questionId, value } objects.
   * @returns {Promise<object>} The persisted Submission plain-object.
   * @throws {Error} on validation / guard failure.
   *
   * Source: the milestone brief §5.1 — Student can open an exam and submit answers
   */
  async submitExam({ examId, studentId, answers }) {
    if (!examId)    throw new Error('SubmissionService.submitExam: "examId" is required');
    if (!studentId) throw new Error('SubmissionService.submitExam: "studentId" is required');

    // ── Guard 1: exam must exist and be Published ───────────────────────────
    const exam = await this._examService.getExamById(examId);
    if (!exam) {
      throw new Error(`SubmissionService.submitExam: exam not found (id="${examId}")`);
    }
    if (exam.status !== 'Published') {
      throw new Error(
        `SubmissionService.submitExam: exam is not Published (status="${exam.status}")`
      );
    }

    // ── Guard 2: no duplicate submission ────────────────────────────────────
    const existing = await this.getSubmissionByExamAndStudent(examId, studentId);
    if (existing) {
      throw new Error('Already submitted');
    }

    // ── Persist ─────────────────────────────────────────────────────────────
    const submission = {
      id:          generateId(),
      examId,
      studentId,
      answers:     Array.isArray(answers) ? answers : [],
      status:      'submitted',
      grade:       null,
      feedback:    '',
      submittedAt: new Date().toISOString(),
    };

    const persisted = await this._mockApi.post('submissions', submission);
    this._logger.info(
      'SubmissionService.submitExam: submitted id=%s examId=%s studentId=%s',
      persisted.id,
      examId,
      studentId
    );
    return persisted;
  }

  // ── Queries ───────────────────────────────────────────────────────────────────

  /**
   * Get all submissions for a given exam.
   *
   * @param {string} examId
   * @returns {Promise<object[]>}
   * @throws {Error} if examId is missing.
   */
  async getSubmissionsByExam(examId) {
    if (!examId) throw new Error('SubmissionService.getSubmissionsByExam: "examId" is required');
    const all = await this._mockApi.get('submissions');
    const filtered = all.filter((s) => s.examId === examId);
    this._logger.info(
      'SubmissionService.getSubmissionsByExam: %d submissions for exam=%s',
      filtered.length,
      examId
    );
    return filtered;
  }

  /**
   * Get all submissions by a given student.
   *
   * @param {string} studentId
   * @returns {Promise<object[]>}
   * @throws {Error} if studentId is missing.
   */
  async getSubmissionsByStudent(studentId) {
    if (!studentId) {
      throw new Error('SubmissionService.getSubmissionsByStudent: "studentId" is required');
    }
    const all = await this._mockApi.get('submissions');
    const filtered = all.filter((s) => s.studentId === studentId);
    this._logger.info(
      'SubmissionService.getSubmissionsByStudent: %d submissions for student=%s',
      filtered.length,
      studentId
    );
    return filtered;
  }

  /**
   * Find a single submission for the (examId, studentId) pair, or null.
   *
   * Used by TakeExamPage to block re-entry and by submitExam's duplicate guard.
   *
   * @param {string} examId
   * @param {string} studentId
   * @returns {Promise<object|null>}
   */
  async getSubmissionByExamAndStudent(examId, studentId) {
    if (!examId)    throw new Error('SubmissionService.getSubmissionByExamAndStudent: "examId" is required');
    if (!studentId) throw new Error('SubmissionService.getSubmissionByExamAndStudent: "studentId" is required');
    const all = await this._mockApi.get('submissions');
    return all.find((s) => s.examId === examId && s.studentId === studentId) || null;
  }

  // ── Single-record lookup ──────────────────────────────────────────────────────

  /**
   * Find a single submission by its ID, or null if not found.
   *
   * Thin wrapper around MockApiService.getById, exposed here so page components
   * depend only on SubmissionService (not MockApi directly).
   *
   * @param {string} id - Submission ID.
   * @returns {Promise<object|null>}
   * @throws {Error} if id is missing.
   *
   * Source: the milestone brief §5.1 — Teacher: review submissions
   */
  async getSubmissionById(id) {
    if (!id) throw new Error('SubmissionService.getSubmissionById: "id" is required');
    const record = await this._mockApi.getById('submissions', id);
    this._logger.info(
      'SubmissionService.getSubmissionById: id=%s found=%s',
      id,
      !!record
    );
    return record ?? null;
  }

  // ── Grading (M1 stub — full UI in M2) ────────────────────────────────────────

  /**
   * Record a grade and optional feedback on a submission.
   *
   * M1 implementation: plain field-update (no validation on grade range).
   * M2 will add grade-range validation and teacher-authorization check.
   *
   * @param {string} id              - Submission ID.
   * @param {object} data
   * @param {number} data.grade      - Numeric grade.
   * @param {string} [data.feedback] - Optional feedback text.
   * @returns {Promise<object>} The updated submission.
   * @throws {Error} if submission not found.
   */
  async gradeSubmission(id, { grade, feedback = '' }) {
    if (!id) throw new Error('SubmissionService.gradeSubmission: "id" is required');

    const existing = await this._mockApi.getById('submissions', id);
    if (!existing) {
      throw new Error(`SubmissionService.gradeSubmission: submission not found (id="${id}")`);
    }

    const updated = {
      ...existing,
      grade,
      feedback,
      status: 'graded',
    };
    const persisted = await this._mockApi.put('submissions', id, updated);
    this._logger.info(
      'SubmissionService.gradeSubmission: graded id=%s grade=%s',
      id,
      grade
    );
    return persisted;
  }
}

export default SubmissionService;
