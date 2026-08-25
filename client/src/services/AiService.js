/**
 * AiService — client for the AI endpoints.
 *
 * Source: the milestone brief §5.2 — AI API agents
 */

class AiService {
  /**
   * @param {import('./HttpApiService.js').default} api
   * @param {import('./LoggerService.js').default}  logger
   */
  constructor(api, logger) {
    if (!api)    throw new Error('AiService: "api" dependency is required');
    if (!logger) throw new Error('AiService: "logger" dependency is required');
    this._api = api;
    this._logger = logger;
    /** Cached because it cannot change without restarting the server. */
    this._status = null;
  }

  /**
   * Which provider the server is using, and whether a real model is behind it.
   *
   * The UI uses this to label generated content honestly rather than implying a
   * model was involved when the deterministic fallback answered.
   *
   * @returns {Promise<{ provider: string, modelBacked: boolean }>}
   */
  async getStatus() {
    if (!this._status) this._status = await this._api.get('/ai/status');
    return this._status;
  }

  /**
   * Draft an exam from a description.
   *
   * Nothing is saved: the draft comes back for the teacher to review and edit,
   * because a generated answer key can be confidently wrong.
   *
   * @param {string} description
   * @param {number} questionCount
   * @returns {Promise<{ exam: object, generatedBy: string, modelBacked: boolean }>}
   */
  async generateExam(description, questionCount = 5) {
    const result = await this._api.post('/ai/exams/generate', {
      description,
      questionCount: Number(questionCount),
    });
    this._logger.info('AiService.generateExam: %d questions', result.exam.questions.length);
    return result;
  }

  /**
   * Run the AI marking pass. The result is a teacher-only draft.
   *
   * @param {string} submissionId
   * @returns {Promise<{ submission: object, gradedBy: string, modelBacked: boolean }>}
   */
  async gradeSubmission(submissionId) {
    const result = await this._api.post(`/submissions/${submissionId}/ai-grade`);
    this._logger.info('AiService.gradeSubmission: grade=%s', result.submission.grade);
    return result;
  }
}

export default AiService;
