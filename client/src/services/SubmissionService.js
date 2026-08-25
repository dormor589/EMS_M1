/**
 * SubmissionService — taking an exam and reading grades, against the API.
 *
 * The shape of taking an exam changed in Milestone 2. Milestone 1 collected
 * answers in React state and posted them once. Now an attempt is a real
 * server-side record with a deadline:
 *
 *   startAttempt  -> the server creates the attempt and fixes expires_at
 *   saveDraft     -> autosave, so a closed tab loses nothing
 *   submitExam    -> finalise; refused after the deadline
 *
 * Grading rules (one submission per student, teacher-only marking, a grade
 * hidden until published) are all enforced server-side now.
 *
 * Source: the milestone brief §8 — SubmissionService
 */

class SubmissionService {
  /**
   * @param {import('./HttpApiService.js').default} api
   * @param {import('./ExamService.js').default}    examService
   * @param {import('./ConfigService.js').default}  config
   * @param {import('./LoggerService.js').default}  logger
   */
  constructor(api, examService, config, logger) {
    if (!api)         throw new Error('SubmissionService: "api" dependency is required');
    if (!examService) throw new Error('SubmissionService: "examService" dependency is required');
    if (!config)      throw new Error('SubmissionService: "config" dependency is required');
    if (!logger)      throw new Error('SubmissionService: "logger" dependency is required');

    this._api = api;
    this._examService = examService;
    this._config = config;
    this._logger = logger;
  }

  // ── Taking an exam ───────────────────────────────────────────────────────

  /**
   * Open an exam: start a new attempt, or resume one already running.
   *
   * Safe to call twice — the server returns the existing attempt with its
   * original deadline, so a page refresh cannot buy more time.
   *
   * @param {string} examId
   * @returns {Promise<object>} The attempt, including `secondsRemaining`.
   */
  async startAttempt(examId) {
    if (!examId) throw new Error('SubmissionService.startAttempt: "examId" is required');
    const { submission } = await this._api.post(`/exams/${examId}/attempt`);
    this._logger.info(
      'SubmissionService.startAttempt: id=%s %ds remaining',
      submission.id, submission.secondsRemaining
    );
    return submission;
  }

  /**
   * Autosave answers for an attempt in progress.
   *
   * @param {string} attemptId
   * @param {Array<{questionId: string, value: string}>} answers
   * @returns {Promise<object>}
   */
  async saveDraft(attemptId, answers) {
    if (!attemptId) throw new Error('SubmissionService.saveDraft: "attemptId" is required');
    const { submission } = await this._api.patch(`/attempts/${attemptId}/draft`, { answers });
    return submission;
  }

  /**
   * Submit an attempt.
   *
   * @param {string}  attemptId
   * @param {object}  [options]
   * @param {boolean} [options.auto] True when the countdown fired rather than
   *   the student clicking. The server accepts these past the deadline, because
   *   the answers were captured before it.
   * @returns {Promise<object>}
   */
  async submitExam(attemptId, { auto = false } = {}) {
    if (!attemptId) throw new Error('SubmissionService.submitExam: "attemptId" is required');
    const { submission } = await this._api.post(`/attempts/${attemptId}/submit`, { auto });
    this._logger.info('SubmissionService.submitExam: submitted id=%s auto=%s', attemptId, auto);
    return submission;
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  /**
   * Every submission for one exam. Teacher-only; the server checks ownership.
   *
   * @param {string} examId
   * @returns {Promise<object[]>} Each carries the `student` who wrote it.
   */
  async getSubmissionsByExam(examId) {
    if (!examId) throw new Error('SubmissionService.getSubmissionsByExam: "examId" is required');
    const { submissions } = await this._api.get(`/exams/${examId}/submissions`);
    return submissions;
  }

  /**
   * The signed-in student's own submissions.
   *
   * The studentId argument is ignored — the server derives identity from the
   * token, so one student cannot request another's work. It is kept in the
   * signature for compatibility with the existing pages.
   *
   * @param {string} [studentId]
   * @returns {Promise<object[]>}
   */
  async getSubmissionsByStudent(studentId) {
    const { submissions } = await this._api.get('/submissions/mine');
    this._logger.info(
      'SubmissionService.getSubmissionsByStudent: %d for student=%s',
      submissions.length, studentId ?? 'self'
    );
    return submissions;
  }

  /**
   * The current student's submission for one exam, or null.
   *
   * @param {string} examId
   * @param {string} [studentId]
   * @returns {Promise<object|null>}
   */
  async getSubmissionByExamAndStudent(examId, studentId) {
    if (!examId) {
      throw new Error('SubmissionService.getSubmissionByExamAndStudent: "examId" is required');
    }
    const mine = await this.getSubmissionsByStudent(studentId);
    return mine.find((s) => s.examId === examId) || null;
  }

  /**
   * One submission by id.
   *
   * A teacher gets the full record with the exam and answer key attached; a
   * student gets their own, without any unpublished grade.
   *
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async getSubmissionById(id) {
    if (!id) throw new Error('SubmissionService.getSubmissionById: "id" is required');
    try {
      const { submission } = await this._api.get(`/submissions/${id}`);
      return submission;
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  // ── Grading ──────────────────────────────────────────────────────────────

  /**
   * Save per-question scores. The server recomputes the overall grade with
   * sum(score * weight) / sum(weight).
   *
   * Multiple-choice scores are ignored if supplied: the server marks those from
   * the answer key, so a teacher cannot accidentally mark a correct answer wrong.
   *
   * @param {string}  id
   * @param {object}  data
   * @param {Array<{questionId: string, score?: number, feedback?: string}>} [data.answers]
   * @param {string}  [data.feedback] Overall feedback.
   * @param {boolean} [data.publish]  True releases the grade to the student.
   * @returns {Promise<object>}
   */
  async gradeSubmission(id, { answers = [], feedback = '', publish = false } = {}) {
    if (!id) throw new Error('SubmissionService.gradeSubmission: "id" is required');

    const { submission } = await this._api.patch(`/submissions/${id}/grade`, {
      answers: answers.map((a) => ({
        questionId: a.questionId,
        ...(a.score === undefined || a.score === null ? {} : { score: Number(a.score) }),
        feedback: a.feedback ?? '',
      })),
      feedback,
      publish,
    });
    this._logger.info(
      'SubmissionService.gradeSubmission: id=%s grade=%s published=%s',
      id, submission.grade, publish
    );
    return submission;
  }

  /**
   * Release a draft grade to the student, unchanged.
   *
   * @param {string} id
   * @returns {Promise<object>}
   */
  async publishGrade(id) {
    if (!id) throw new Error('SubmissionService.publishGrade: "id" is required');
    const { submission } = await this._api.post(`/submissions/${id}/publish`);
    this._logger.info('SubmissionService.publishGrade: id=%s released', id);
    return submission;
  }
}

export default SubmissionService;
