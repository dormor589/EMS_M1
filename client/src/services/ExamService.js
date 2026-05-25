/**
 * ExamService — exam CRUD operations and status state machine.
 *
 * Enforces the Draft → Published → Closed one-way state machine in the
 * service layer so the UI cannot bypass it.  Status changes are ONLY
 * possible via the dedicated publishExam() / closeExam() methods; the
 * general updateExam() strips any incoming status field.
 *
 * Constructor receives dependencies via injection; instantiated in
 * services/index.js.
 *
 * Source: the milestone brief §8 — ExamService
 * Source: the milestone brief §5.1 — Must-Have: exam status machine
 */

import { generateId } from '../models/util.js';

class ExamService {
  /**
   * @param {import('./MockApiService.js').default} mockApi - MockApiService singleton.
   * @param {import('./ConfigService.js').default}  config  - ConfigService singleton.
   * @param {import('./LoggerService.js').default}  logger  - LoggerService singleton.
   */
  constructor(mockApi, config, logger) {
    if (!mockApi) throw new Error('ExamService: "mockApi" dependency is required');
    if (!config)  throw new Error('ExamService: "config" dependency is required');
    if (!logger)  throw new Error('ExamService: "logger" dependency is required');

    this._mockApi = mockApi;
    this._config  = config;
    this._logger  = logger;
  }

  // ── Read operations ──────────────────────────────────────────────────────────

  /**
   * Retrieve all exams (teacher-side view — all statuses).
   *
   * @returns {Promise<object[]>}
   */
  async getAllExams() {
    const exams = await this._mockApi.get('exams');
    this._logger.info('ExamService.getAllExams: %d exams', exams.length);
    return exams;
  }

  /**
   * Retrieve only exams with status === 'Published'.
   *
   * Used by the student-facing view (D007).
   *
   * @returns {Promise<object[]>}
   */
  async getPublishedExams() {
    const exams = await this._mockApi.get('exams');
    const published = exams.filter((e) => e.status === 'Published');
    this._logger.info('ExamService.getPublishedExams: %d published', published.length);
    return published;
  }

  /**
   * Retrieve all exams created by a specific teacher.
   *
   * Filters by `createdBy` field so teachers only see their own exams.
   *
   * @param {string} teacherId - The teacher's user ID.
   * @returns {Promise<object[]>}
   * @throws {Error} if teacherId is missing.
   */
  async getExamsByTeacher(teacherId) {
    if (!teacherId) {
      throw new Error('ExamService.getExamsByTeacher: "teacherId" is required');
    }
    const exams = await this._mockApi.get('exams');
    const mine = exams.filter((e) => e.createdBy === teacherId);
    this._logger.info(
      'ExamService.getExamsByTeacher: %d exams for teacher=%s',
      mine.length,
      teacherId
    );
    return mine;
  }

  /**
   * Retrieve a single exam by ID.
   *
   * @param {string} id
   * @returns {Promise<object|null>} The exam record, or null if not found.
   * @throws {Error} if id is missing.
   */
  async getExamById(id) {
    if (!id) throw new Error('ExamService.getExamById: "id" is required');
    const exam = await this._mockApi.getById('exams', id);
    return exam;
  }

  // ── Write operations ─────────────────────────────────────────────────────────

  /**
   * Create a new exam with status 'Draft'.
   *
   * Generates a UUID for the exam and for each supplied question.
   * The questions array can be empty at creation; teachers add questions
   * via the edit flow.
   *
   * @param {object}   data
   * @param {string}   data.title            - Exam title (required, non-empty).
   * @param {string}   [data.description]    - Optional description.
   * @param {number}   data.durationMinutes  - Duration in minutes (required, > 0).
   * @param {object[]} [data.questions]      - Array of question plain objects.
   * @param {string}   data.createdBy        - Teacher user ID (required).
   * @returns {Promise<object>} The persisted exam record.
   * @throws {Error} on validation failures.
   *
   * Source: the milestone brief §7 — Exam entity fields
   */
  async createExam({ title, description, durationMinutes, questions, createdBy }) {
    if (!title || !title.trim()) {
      throw new Error('ExamService.createExam: "title" is required and must be non-empty');
    }
    if (!createdBy) {
      throw new Error('ExamService.createExam: "createdBy" is required');
    }
    const mins = Number(durationMinutes);
    if (!Number.isFinite(mins) || mins <= 0) {
      throw new Error('ExamService.createExam: "durationMinutes" must be a positive number');
    }

    const examId      = generateId();
    const defaultStatus = this._config.getDefaultExamStatus(); // 'Draft'

    // Assign id + examId to every question.
    const resolvedQuestions = (questions || []).map((q) => ({
      ...q,
      id:     q.id     || generateId(),
      examId: examId,
    }));

    const exam = {
      id:              examId,
      title:           title.trim(),
      description:     description || '',
      durationMinutes: mins,
      status:          defaultStatus,
      createdBy,
      questions:       resolvedQuestions,
      createdAt:       new Date().toISOString(),
    };

    const persisted = await this._mockApi.post('exams', exam);
    this._logger.info(
      'ExamService.createExam: created id=%s title="%s" status=%s',
      persisted.id,
      persisted.title,
      persisted.status
    );
    return persisted;
  }

  /**
   * Partially update an exam's editable fields.
   *
   * `status` is intentionally STRIPPED from the partial to prevent status
   * changes via this method — use publishExam() / closeExam() instead.
   * `id` and `createdAt` are also preserved from the existing record.
   *
   * If the caller includes `questions`, each question receives an id (if
   * missing) and the exam's id as examId.
   *
   * @param {string} id      - Exam ID.
   * @param {object} partial - Fields to update (status ignored).
   * @returns {Promise<object>} The updated exam record.
   * @throws {Error} if exam not found.
   */
  async updateExam(id, partial) {
    if (!id) throw new Error('ExamService.updateExam: "id" is required');

    const existing = await this._mockApi.getById('exams', id);
    if (!existing) {
      throw new Error(`ExamService.updateExam: exam not found (id="${id}")`);
    }

    // Strip immutable / dedicated-method fields from the incoming partial.
    // eslint-disable-next-line no-unused-vars
    const { status: _s, id: _i, createdAt: _c, ...safePartial } = partial || {};

    // Re-stamp question ids if questions are included in the update.
    if (Array.isArray(safePartial.questions)) {
      safePartial.questions = safePartial.questions.map((q) => ({
        ...q,
        id:     q.id     || generateId(),
        examId: id,
      }));
    }

    const updated   = { ...existing, ...safePartial };
    const persisted = await this._mockApi.put('exams', id, updated);
    this._logger.info('ExamService.updateExam: updated id=%s', id);
    return persisted;
  }

  // ── State machine ────────────────────────────────────────────────────────────

  /**
   * Transition an exam from Draft → Published.
   *
   * Throws if the current status is not 'Draft'.
   *
   * Source: the milestone brief §5.1 — exam status state machine
   *
   * @param {string} id - Exam ID.
   * @returns {Promise<object>} The updated exam record.
   * @throws {Error} on invalid transition or exam not found.
   */
  async publishExam(id) {
    if (!id) throw new Error('ExamService.publishExam: "id" is required');

    const existing = await this._mockApi.getById('exams', id);
    if (!existing) {
      throw new Error(`ExamService.publishExam: exam not found (id="${id}")`);
    }
    if (existing.status !== 'Draft') {
      throw new Error(`Invalid status transition: ${existing.status} → Published`);
    }

    const updated   = { ...existing, status: 'Published' };
    const persisted = await this._mockApi.put('exams', id, updated);
    this._logger.info('ExamService.publishExam: exam id=%s is now Published', id);
    return persisted;
  }

  /**
   * Transition an exam from Published → Closed.
   *
   * Throws if the current status is not 'Published'.
   *
   * Source: the milestone brief §5.1 — exam status state machine
   *
   * @param {string} id - Exam ID.
   * @returns {Promise<object>} The updated exam record.
   * @throws {Error} on invalid transition or exam not found.
   */
  async closeExam(id) {
    if (!id) throw new Error('ExamService.closeExam: "id" is required');

    const existing = await this._mockApi.getById('exams', id);
    if (!existing) {
      throw new Error(`ExamService.closeExam: exam not found (id="${id}")`);
    }
    if (existing.status !== 'Published') {
      throw new Error(`Invalid status transition: ${existing.status} → Closed`);
    }

    const updated   = { ...existing, status: 'Closed' };
    const persisted = await this._mockApi.put('exams', id, updated);
    this._logger.info('ExamService.closeExam: exam id=%s is now Closed', id);
    return persisted;
  }

  /**
   * Delete an exam by ID (optional M1 operation).
   *
   * @param {string} id - Exam ID.
   * @returns {Promise<void>}
   * @throws {Error} if exam not found.
   */
  async deleteExam(id) {
    if (!id) throw new Error('ExamService.deleteExam: "id" is required');
    await this._mockApi.delete('exams', id);
    this._logger.info('ExamService.deleteExam: deleted id=%s', id);
  }
}

export default ExamService;
