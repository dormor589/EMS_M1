/**
 * ExamRepository — all SQL touching `exams` and `questions`.
 *
 * The interesting method here is update(): it takes a whole exam and
 * RECONCILES the question rows rather than replacing them. Deleting and
 * re-inserting would hand every question a new id, and because `answers`
 * references `questions(id) ON DELETE CASCADE`, that would silently destroy
 * every student answer on the exam. Fixing a typo must not cost a cohort's
 * submissions.
 */

import pool, { withTransaction } from '../pool.js';
import { Exam, Question } from '../../models/index.js';

/** Question fields whose change invalidates grades already awarded. */
const GRADING_FIELDS = ['type', 'correct_answer', 'weight'];

class ExamRepository {
  constructor(db = pool) {
    this._db = db;
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  /**
   * Fetch one exam with its questions in display order.
   *
   * @param {string} id
   * @returns {Promise<Exam|null>}
   */
  async findById(id) {
    const { rows } = await this._db.query('SELECT * FROM exams WHERE id = $1', [id]);
    if (!rows[0]) return null;

    const { rows: qRows } = await this._db.query(
      'SELECT * FROM questions WHERE exam_id = $1 ORDER BY position, created_at',
      [id]
    );
    return Exam.fromRow(rows[0], qRows);
  }

  /**
   * List exams, with their questions attached.
   *
   * Questions for the whole page are fetched in one query rather than one per
   * exam, so listing N exams costs two queries rather than N+1.
   *
   * @param {object}  [filter]
   * @param {string}  [filter.teacherId] Only exams created by this teacher.
   * @param {string}  [filter.status]    Only exams in this status.
   * @returns {Promise<Exam[]>}
   */
  async findAll({ teacherId, status } = {}) {
    const where = [];
    const params = [];

    if (teacherId) { params.push(teacherId); where.push(`created_by = $${params.length}`); }
    if (status)    { params.push(status);    where.push(`status = $${params.length}`); }

    const { rows } = await this._db.query(
      `SELECT * FROM exams
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY created_at DESC`,
      params
    );
    if (!rows.length) return [];

    const { rows: qRows } = await this._db.query(
      `SELECT * FROM questions WHERE exam_id = ANY($1::uuid[])
        ORDER BY position, created_at`,
      [rows.map((r) => r.id)]
    );

    const byExam = new Map();
    for (const q of qRows) {
      if (!byExam.has(q.exam_id)) byExam.set(q.exam_id, []);
      byExam.get(q.exam_id).push(q);
    }
    return rows.map((r) => Exam.fromRow(r, byExam.get(r.id) || []));
  }

  /**
   * @param {string} examId
   * @returns {Promise<number>} How many submissions exist for this exam.
   */
  async countSubmissions(examId) {
    const { rows } = await this._db.query(
      'SELECT count(*)::int AS n FROM submissions WHERE exam_id = $1',
      [examId]
    );
    return rows[0].n;
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  /**
   * Create an exam and its questions in one transaction.
   *
   * @param {object}   data
   * @param {object[]} data.questions
   * @returns {Promise<Exam>}
   */
  async create({
    title, description, durationMinutes, passingGrade, createdBy,
    questions = [], generatedByAi = false, aiPrompt = null,
  }) {
    return withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO exams
           (title, description, duration_minutes, passing_grade, created_by,
            generated_by_ai, ai_prompt)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [title.trim(), description || '', durationMinutes, passingGrade,
         createdBy, generatedByAi, aiPrompt]
      );
      const exam = rows[0];

      const qRows = [];
      for (const [position, q] of questions.entries()) {
        qRows.push(await this._insertQuestion(client, exam.id, q, position));
      }
      return Exam.fromRow(exam, qRows);
    });
  }

  /**
   * Update an exam and reconcile its questions.
   *
   * Questions carrying an existing id are UPDATED in place, so their ids — and
   * therefore every answer referencing them — survive. Questions with no id are
   * inserted. Questions absent from the payload are deleted.
   *
   * @param {string}   id
   * @param {object}   fields    Editable exam fields.
   * @param {object[]} [questions] The complete desired question list, in order.
   *                               Omit to leave questions untouched.
   * @returns {Promise<{ exam: Exam, gradingAffected: boolean }>}
   *   `gradingAffected` is true when the edit invalidates grades already
   *   awarded, so the caller can flag affected submissions for re-grading.
   */
  async update(id, fields, questions) {
    return withTransaction(async (client) => {
      const sets = [];
      const params = [];
      const assign = (column, value) => {
        params.push(value);
        sets.push(`${column} = $${params.length}`);
      };

      if (fields.title !== undefined)           assign('title', fields.title.trim());
      if (fields.description !== undefined)     assign('description', fields.description);
      if (fields.durationMinutes !== undefined) assign('duration_minutes', fields.durationMinutes);
      if (fields.passingGrade !== undefined)    assign('passing_grade', fields.passingGrade);

      if (sets.length) {
        params.push(id);
        await client.query(
          `UPDATE exams SET ${sets.join(', ')} WHERE id = $${params.length}`,
          params
        );
      }

      let gradingAffected = false;
      if (Array.isArray(questions)) {
        gradingAffected = await this._reconcileQuestions(client, id, questions);
      }

      const { rows } = await client.query('SELECT * FROM exams WHERE id = $1', [id]);
      const { rows: qRows } = await client.query(
        'SELECT * FROM questions WHERE exam_id = $1 ORDER BY position, created_at',
        [id]
      );
      return { exam: Exam.fromRow(rows[0], qRows), gradingAffected };
    });
  }

  /**
   * Move an exam to a new lifecycle status.
   *
   * The transition's legality is decided by the Exam model before this is
   * called; the database's CHECK constraint is the backstop.
   *
   * @param {string} id
   * @param {string} status
   * @returns {Promise<Exam|null>}
   */
  async updateStatus(id, status) {
    await this._db.query('UPDATE exams SET status = $1 WHERE id = $2', [status, id]);
    return this.findById(id);
  }

  /**
   * @param {string} id
   * @returns {Promise<boolean>} True if a row was removed.
   */
  async delete(id) {
    const { rowCount } = await this._db.query('DELETE FROM exams WHERE id = $1', [id]);
    return rowCount > 0;
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /**
   * @param {import('pg').PoolClient} client
   * @returns {Promise<object>} The inserted row.
   * @private
   */
  async _insertQuestion(client, examId, q, position) {
    const { rows } = await client.query(
      `INSERT INTO questions
         (exam_id, type, text, options, correct_answer, weight, position)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       RETURNING *`,
      [
        examId,
        q.type,
        q.text,
        JSON.stringify(q.options ?? []),
        q.type === 'multiple-choice' ? q.correctAnswer : null,
        q.weight ?? 10,
        position,
      ]
    );
    return rows[0];
  }

  /**
   * Reconcile the stored question set against the desired one.
   *
   * @param {import('pg').PoolClient} client
   * @param {string}   examId
   * @param {object[]} desired
   * @returns {Promise<boolean>} True if any change invalidates existing grades.
   * @private
   */
  async _reconcileQuestions(client, examId, desired) {
    const { rows: existing } = await client.query(
      'SELECT * FROM questions WHERE exam_id = $1',
      [examId]
    );
    const existingById = new Map(existing.map((r) => [r.id, r]));
    const keepIds = new Set(desired.map((q) => q.id).filter(Boolean));

    let gradingAffected = false;

    // Removed — cascades to the answers that referenced them.
    const removed = existing.filter((r) => !keepIds.has(r.id));
    if (removed.length) {
      gradingAffected = true;
      await client.query(
        'DELETE FROM questions WHERE id = ANY($1::uuid[])',
        [removed.map((r) => r.id)]
      );
    }

    for (const [position, q] of desired.entries()) {
      const prior = q.id ? existingById.get(q.id) : null;

      if (!prior) {
        // New question — students who already submitted never saw it.
        gradingAffected = true;
        await this._insertQuestion(client, examId, q, position);
        continue;
      }

      const next = {
        type: q.type,
        correct_answer: q.type === 'multiple-choice' ? q.correctAnswer : null,
        weight: q.weight ?? 10,
      };
      if (GRADING_FIELDS.some((f) => String(prior[f]) !== String(next[f]))) {
        gradingAffected = true;
      }

      // UPDATE, not DELETE + INSERT: the id survives, so do the answers.
      await client.query(
        `UPDATE questions
            SET type = $1, text = $2, options = $3::jsonb,
                correct_answer = $4, weight = $5, position = $6
          WHERE id = $7`,
        [
          next.type,
          q.text,
          JSON.stringify(q.options ?? []),
          next.correct_answer,
          next.weight,
          position,
          q.id,
        ]
      );
    }

    return gradingAffected;
  }
}

export { GRADING_FIELDS };
export default ExamRepository;
