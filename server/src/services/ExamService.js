/**
 * ExamService — exam business rules and authorization.
 *
 * The rules that Milestone 1 kept in the browser now live here, where a client
 * cannot bypass them:
 *
 *   - the Draft -> Published -> Closed state machine
 *   - only the owning teacher may modify an exam
 *   - students see published exams only, and never the answer key
 *   - a grading-affecting edit flags existing submissions for re-grading
 */

import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import ExamRepository from '../db/repositories/ExamRepository.js';
import SubmissionRepository from '../db/repositories/SubmissionRepository.js';
import config from '../config/index.js';

class ExamService {
  constructor(exams = new ExamRepository(), submissions = new SubmissionRepository()) {
    this._exams = exams;
    this._submissions = submissions;
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  /**
   * List exams appropriate to the caller.
   *
   * A teacher sees the exams they created, in every status. A student sees
   * published exams only — draft and closed exams are invisible, not merely
   * hidden in the UI.
   *
   * @param {import('../models/User.js').default} user
   * @returns {Promise<object[]>}
   */
  async list(user) {
    const exams = user.isTeacher()
      ? await this._exams.findAll({ teacherId: user.id })
      : await this._exams.findAll({ status: 'Published' });

    return exams.map((e) => e.toJSON({ includeAnswerKey: user.isTeacher() }));
  }

  /**
   * Fetch one exam, enforcing visibility.
   *
   * @param {string} id
   * @param {import('../models/User.js').default} user
   * @returns {Promise<object>}
   * @throws {ApiError} 404 if absent or not visible to this user.
   */
  async get(id, user) {
    const exam = await this._exams.findById(id);
    if (!exam) throw ApiError.notFound('Exam not found');

    if (user.isTeacher()) {
      // A teacher may only open their own exams.
      if (!exam.isOwnedBy(user.id)) {
        // 404 rather than 403: a teacher has no business learning that another
        // teacher's exam exists.
        throw ApiError.notFound('Exam not found');
      }
      return exam.toJSON({ includeAnswerKey: true });
    }

    if (!exam.isPublished()) {
      throw ApiError.notFound('Exam not found');
    }
    // Students never receive correctAnswer — that is the answer key.
    return exam.toJSON({ includeAnswerKey: false });
  }

  /**
   * Load an exam and assert the caller owns it.
   *
   * @param {string} id
   * @param {import('../models/User.js').default} user
   * @returns {Promise<import('../models/Exam.js').default>}
   * @private
   */
  async _requireOwned(id, user) {
    const exam = await this._exams.findById(id);
    if (!exam) throw ApiError.notFound('Exam not found');
    if (!exam.isOwnedBy(user.id)) {
      throw ApiError.forbidden('This exam belongs to another teacher');
    }
    return exam;
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  /**
   * Create an exam. It always starts as a Draft.
   *
   * @param {object} data
   * @param {import('../models/User.js').default} user
   * @returns {Promise<object>}
   */
  async create(data, user) {
    this._assertQuestionCount(data.questions);

    const exam = await this._exams.create({
      title: data.title,
      description: data.description,
      durationMinutes: data.durationMinutes,
      passingGrade: data.passingGrade ?? 60,
      questions: data.questions ?? [],
      createdBy: user.id,
      generatedByAi: data.generatedByAi ?? false,
      aiPrompt: data.aiPrompt ?? null,
    });

    logger.info('exam created', { id: exam.id, questions: exam.questions.length });
    return exam.toJSON({ includeAnswerKey: true });
  }

  /**
   * Update an exam, including its full question list.
   *
   * Editing a published exam is deliberately allowed — a teacher who spots a
   * mistake in a live exam must be able to fix it. The cost is handled rather
   * than prevented: if the edit changes anything that affects grading, every
   * existing submission is flagged for re-grading and the caller is told how
   * many were affected.
   *
   * @param {string} id
   * @param {object} data
   * @param {import('../models/User.js').default} user
   * @returns {Promise<{ exam: object, regradeRequired: number }>}
   */
  async update(id, data, user) {
    await this._requireOwned(id, user);
    if (data.questions !== undefined) this._assertQuestionCount(data.questions);

    const { exam, gradingAffected } = await this._exams.update(id, data, data.questions);

    let regradeRequired = 0;
    if (gradingAffected) {
      regradeRequired = await this._submissions.flagForRegrade(id);
      if (regradeRequired) {
        logger.warn('exam edit invalidated grades', { examId: id, regradeRequired });
      }
    }

    return { exam: exam.toJSON({ includeAnswerKey: true }), regradeRequired };
  }

  /**
   * Move an exam to the next lifecycle state.
   *
   * @param {string} id
   * @param {string} nextStatus 'Published' or 'Closed'.
   * @param {import('../models/User.js').default} user
   * @returns {Promise<object>}
   * @throws {ApiError} 409 on an illegal transition.
   */
  async changeStatus(id, nextStatus, user) {
    const exam = await this._requireOwned(id, user);

    if (!exam.canTransitionTo(nextStatus)) {
      throw ApiError.conflict(
        `Cannot move an exam from ${exam.status} to ${nextStatus}`,
        { from: exam.status, to: nextStatus }
      );
    }
    // Publishing an exam nobody can answer is almost certainly a mistake.
    if (nextStatus === 'Published' && exam.questions.length === 0) {
      throw ApiError.unprocessable('An exam needs at least one question before it can be published');
    }

    const updated = await this._exams.updateStatus(id, nextStatus);
    logger.info('exam status changed', { id, from: exam.status, to: nextStatus });
    return updated.toJSON({ includeAnswerKey: true });
  }

  /**
   * Delete an exam and everything referencing it.
   *
   * @param {string} id
   * @param {import('../models/User.js').default} user
   * @returns {Promise<{ deletedSubmissions: number }>}
   */
  async remove(id, user) {
    await this._requireOwned(id, user);

    // Deleting cascades to questions, submissions and answers, so the caller is
    // told what else went with it rather than discovering it afterwards.
    const deletedSubmissions = await this._exams.countSubmissions(id);
    await this._exams.delete(id);

    logger.warn('exam deleted', { id, deletedSubmissions });
    return { deletedSubmissions };
  }

  /**
   * @param {object[]} [questions]
   * @throws {ApiError} 422 if the exam carries too many questions.
   * @private
   */
  _assertQuestionCount(questions) {
    const max = config.limits.maxQuestionsPerExam;
    if (Array.isArray(questions) && questions.length > max) {
      throw ApiError.unprocessable(`An exam may have at most ${max} questions`);
    }
  }
}

export default ExamService;
