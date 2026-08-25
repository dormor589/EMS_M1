/**
 * ExamService — exam operations against the Express API.
 *
 * Milestone 1 enforced the Draft → Published → Closed state machine here, in
 * the browser. That rule now lives on the server, where a client cannot get
 * around it; this class is the HTTP client for it. The method names and return
 * shapes are unchanged, so the pages did not have to be rewritten.
 *
 * Source: the milestone brief §8 — ExamService
 */

class ExamService {
  /**
   * @param {import('./HttpApiService.js').default} api
   * @param {import('./ConfigService.js').default}  config
   * @param {import('./LoggerService.js').default}  logger
   */
  constructor(api, config, logger) {
    if (!api)    throw new Error('ExamService: "api" dependency is required');
    if (!config) throw new Error('ExamService: "config" dependency is required');
    if (!logger) throw new Error('ExamService: "logger" dependency is required');

    this._api = api;
    this._config = config;
    this._logger = logger;
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  /**
   * Every exam the caller is allowed to see.
   *
   * The server decides what that means: a teacher gets their own exams in all
   * statuses, a student gets published ones only.
   *
   * @returns {Promise<object[]>}
   */
  async getAllExams() {
    const { exams } = await this._api.get('/exams');
    this._logger.info('ExamService.getAllExams: %d exams', exams.length);
    return exams;
  }

  /**
   * Published exams only.
   *
   * For a student this is already all the server returns; the filter matters
   * only when a teacher calls it.
   *
   * @returns {Promise<object[]>}
   */
  async getPublishedExams() {
    const exams = await this.getAllExams();
    return exams.filter((e) => e.status === 'Published');
  }

  /**
   * Exams created by a given teacher.
   *
   * The server already scopes /exams to the calling teacher, so the argument is
   * kept for signature compatibility with the pages and used only as a guard.
   *
   * @param {string} teacherId
   * @returns {Promise<object[]>}
   */
  async getExamsByTeacher(teacherId) {
    if (!teacherId) {
      throw new Error('ExamService.getExamsByTeacher: "teacherId" is required');
    }
    const exams = await this.getAllExams();
    return exams.filter((e) => e.createdBy === teacherId);
  }

  /**
   * One exam by id, or null if it does not exist or is not visible.
   *
   * Returns null rather than throwing on 404 so the pages can keep their
   * existing "if (!exam)" handling.
   *
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async getExamById(id) {
    if (!id) throw new Error('ExamService.getExamById: "id" is required');
    try {
      const { exam } = await this._api.get(`/exams/${id}`);
      return exam;
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  /**
   * Create an exam. The server always starts it as a Draft.
   *
   * @param {object} data
   * @returns {Promise<object>}
   */
  async createExam({ title, description, durationMinutes, passingGrade, questions }) {
    const { exam } = await this._api.post('/exams', {
      title,
      description: description || '',
      durationMinutes: Number(durationMinutes),
      ...(passingGrade === undefined ? {} : { passingGrade: Number(passingGrade) }),
      questions: (questions || []).map(normaliseQuestion),
    });
    this._logger.info('ExamService.createExam: created id=%s', exam.id);
    return exam;
  }

  /**
   * Update an exam, sending the whole thing.
   *
   * The server reconciles the question list rather than replacing it, so a
   * question keeps its id and the answers already attached to it survive.
   *
   * @param {string} id
   * @param {object} partial
   * @returns {Promise<object>} The updated exam, carrying `regradeRequired`:
   *   how many existing submissions this edit invalidated.
   */
  async updateExam(id, partial) {
    if (!id) throw new Error('ExamService.updateExam: "id" is required');

    const body = { ...partial };
    // `status` is not editable here by design — publish/close own that.
    delete body.status;
    delete body.id;
    delete body.createdAt;
    if (Array.isArray(body.questions)) {
      body.questions = body.questions.map(normaliseQuestion);
    }
    if (body.durationMinutes !== undefined) body.durationMinutes = Number(body.durationMinutes);
    if (body.passingGrade !== undefined)    body.passingGrade = Number(body.passingGrade);

    const { exam, regradeRequired } = await this._api.put(`/exams/${id}`, body);
    this._logger.info('ExamService.updateExam: updated id=%s regrade=%d', id, regradeRequired);
    return { ...exam, regradeRequired };
  }

  /**
   * Draft → Published.
   *
   * @param {string} id
   * @returns {Promise<object>}
   */
  async publishExam(id) {
    if (!id) throw new Error('ExamService.publishExam: "id" is required');
    const { exam } = await this._api.post(`/exams/${id}/publish`);
    this._logger.info('ExamService.publishExam: id=%s is now Published', id);
    return exam;
  }

  /**
   * Published → Closed.
   *
   * @param {string} id
   * @returns {Promise<object>}
   */
  async closeExam(id) {
    if (!id) throw new Error('ExamService.closeExam: "id" is required');
    const { exam } = await this._api.post(`/exams/${id}/close`);
    this._logger.info('ExamService.closeExam: id=%s is now Closed', id);
    return exam;
  }

  /**
   * Delete an exam and everything referencing it.
   *
   * @param {string} id
   * @returns {Promise<{ deletedSubmissions: number }>}
   */
  async deleteExam(id) {
    if (!id) throw new Error('ExamService.deleteExam: "id" is required');
    const result = await this._api.delete(`/exams/${id}`);
    this._logger.info('ExamService.deleteExam: deleted id=%s', id);
    return result;
  }
}

/**
 * Coerce a question from the form into the shape the API validates.
 *
 * The form yields strings for numeric fields, and Milestone 1 called the
 * weighting `points`; the API calls it `weight`. Both are handled here so the
 * pages did not need changing.
 *
 * @param {object} q
 * @returns {object}
 */
function normaliseQuestion(q) {
  const isMultipleChoice = q.type === 'multiple-choice';
  return {
    // Present only for a question that already exists. Its absence is what
    // tells the server to insert rather than update.
    ...(q.id ? { id: q.id } : {}),
    type: q.type,
    text: q.text,
    options: isMultipleChoice ? (q.options || []).filter((o) => o.trim() !== '') : [],
    correctAnswer: isMultipleChoice ? Number(q.correctAnswer ?? 0) : null,
    weight: Number(q.weight ?? q.points ?? 10),
  };
}

export default ExamService;
