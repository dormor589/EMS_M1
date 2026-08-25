/**
 * SubmissionRepository — all SQL touching `submissions` and `answers`.
 */

import pool, { withTransaction } from '../pool.js';
import { Submission } from '../../models/index.js';

class SubmissionRepository {
  constructor(db = pool) {
    this._db = db;
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  /**
   * @param {string} id
   * @returns {Promise<Submission|null>}
   */
  async findById(id) {
    const { rows } = await this._db.query('SELECT * FROM submissions WHERE id = $1', [id]);
    if (!rows[0]) return null;
    const { rows: aRows } = await this._db.query(
      'SELECT * FROM answers WHERE submission_id = $1',
      [id]
    );
    return Submission.fromRow(rows[0], aRows);
  }

  /**
   * @param {string} examId
   * @param {string} studentId
   * @returns {Promise<Submission|null>}
   */
  async findByExamAndStudent(examId, studentId) {
    const { rows } = await this._db.query(
      'SELECT * FROM submissions WHERE exam_id = $1 AND student_id = $2',
      [examId, studentId]
    );
    if (!rows[0]) return null;
    const { rows: aRows } = await this._db.query(
      'SELECT * FROM answers WHERE submission_id = $1',
      [rows[0].id]
    );
    return Submission.fromRow(rows[0], aRows);
  }

  /**
   * List submissions with their answers attached.
   *
   * Answers for the whole page are fetched in one query, so listing N
   * submissions costs two queries rather than N+1.
   *
   * @param {object} filter
   * @param {string} [filter.examId]
   * @param {string} [filter.studentId]
   * @returns {Promise<Submission[]>}
   */
  async findAll({ examId, studentId } = {}) {
    const where = [];
    const params = [];
    if (examId)    { params.push(examId);    where.push(`exam_id = $${params.length}`); }
    if (studentId) { params.push(studentId); where.push(`student_id = $${params.length}`); }

    const { rows } = await this._db.query(
      `SELECT * FROM submissions
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY submitted_at DESC NULLS FIRST, started_at DESC`,
      params
    );
    if (!rows.length) return [];

    const { rows: aRows } = await this._db.query(
      'SELECT * FROM answers WHERE submission_id = ANY($1::uuid[])',
      [rows.map((r) => r.id)]
    );
    const bySubmission = new Map();
    for (const a of aRows) {
      if (!bySubmission.has(a.submission_id)) bySubmission.set(a.submission_id, []);
      bySubmission.get(a.submission_id).push(a);
    }
    return rows.map((r) => Submission.fromRow(r, bySubmission.get(r.id) || []));
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  /**
   * Start an attempt. The row is created when the student opens the exam, so it
   * exists — carrying the deadline — before any answer is given.
   *
   * @param {object} data
   * @param {Date}   data.expiresAt Stamped now, so a later change to the exam's
   *                                duration cannot move a running deadline.
   * @returns {Promise<Submission>}
   */
  async createAttempt({ examId, studentId, expiresAt }) {
    // Idempotent by design. Two requests can arrive at once — React's dev-mode
    // double effect, an impatient double-click, a retried request — and a
    // check-then-insert would let both pass the check and the second would die
    // on the UNIQUE(exam_id, student_id) constraint. ON CONFLICT DO NOTHING
    // makes the race harmless: one request inserts, the other gets no row back
    // and reads the winner instead. Either way the caller gets the same
    // attempt, with the deadline set by whichever arrived first.
    const { rows } = await this._db.query(
      `INSERT INTO submissions (exam_id, student_id, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (exam_id, student_id) DO NOTHING
       RETURNING *`,
      [examId, studentId, expiresAt]
    );

    if (rows[0]) return Submission.fromRow(rows[0], []);

    // Lost the race — return the attempt that won it.
    return this.findByExamAndStudent(examId, studentId);
  }

  /**
   * Autosave answers for an in-progress attempt.
   *
   * Upserts on (submission_id, question_id) so repeated saves of the same
   * question overwrite rather than accumulate.
   *
   * @param {string} submissionId
   * @param {Array<{questionId: string, value: string}>} answers
   * @returns {Promise<Submission>}
   */
  async saveDraft(submissionId, answers) {
    return withTransaction(async (client) => {
      for (const a of answers) {
        await client.query(
          `INSERT INTO answers (submission_id, question_id, value)
           VALUES ($1, $2, $3)
           ON CONFLICT (submission_id, question_id)
           DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [submissionId, a.questionId, String(a.value ?? '')]
        );
      }
      return this._reload(client, submissionId);
    });
  }

  /**
   * Mark an attempt as submitted, recording `is_correct` for every
   * multiple-choice answer at the same time.
   *
   * @param {string} submissionId
   * @param {Array<{questionId: string, isCorrect: boolean|null}>} scored
   * @returns {Promise<Submission>}
   */
  async submit(submissionId, scored) {
    return withTransaction(async (client) => {
      for (const s of scored) {
        await client.query(
          'UPDATE answers SET is_correct = $1 WHERE submission_id = $2 AND question_id = $3',
          [s.isCorrect, submissionId, s.questionId]
        );
      }
      await client.query(
        `UPDATE submissions SET status = 'submitted', submitted_at = now()
          WHERE id = $1`,
        [submissionId]
      );
      return this._reload(client, submissionId);
    });
  }

  /**
   * Write per-question grades and the resulting overall grade.
   *
   * Used for a manual grade, for the AI pass, and for a teacher editing what
   * the AI proposed — the only difference is `status` and `gradedBy`.
   *
   * @param {string} submissionId
   * @param {object} data
   * @param {Array<{questionId, score, feedback, aiScore, aiFeedback}>} data.answers
   * @param {number} data.grade
   * @param {string} data.status   'ai_graded' (draft) or 'graded' (published).
   * @param {string} data.gradedBy
   * @param {string} [data.feedback] Overall feedback on the submission.
   * @returns {Promise<Submission>}
   */
  async saveGrades(submissionId, { answers, grade, status, gradedBy, feedback = '' }) {
    return withTransaction(async (client) => {
      for (const a of answers) {
        const sets = ['score = $1', 'feedback = $2'];
        const params = [a.score, a.feedback ?? ''];

        // Only overwrite the AI columns when this pass actually produced them,
        // so a teacher's later edit cannot erase the original proposal.
        if (a.aiScore !== undefined) {
          params.push(a.aiScore);    sets.push(`ai_score = $${params.length}`);
          params.push(a.aiFeedback ?? null); sets.push(`ai_feedback = $${params.length}`);
        }
        params.push(submissionId, a.questionId);
        await client.query(
          `UPDATE answers SET ${sets.join(', ')}
            WHERE submission_id = $${params.length - 1} AND question_id = $${params.length}`,
          params
        );
      }

      // graded_at marks publication, so it is set only for the published state.
      // Decided here rather than with a CASE in SQL: reusing $1 both as the
      // assigned status and inside a CASE gave Postgres two different types to
      // deduce for one parameter, which it rejects. A plain value is also
      // easier to read than the CASE was.
      const gradedAt = status === 'graded' ? new Date() : null;

      await client.query(
        `UPDATE submissions
            SET status = $1, grade = $2, graded_by = $3, feedback = $4,
                graded_at = $5, needs_regrade = FALSE
          WHERE id = $6`,
        [status, grade, gradedBy, feedback, gradedAt, submissionId]
      );
      return this._reload(client, submissionId);
    });
  }

  /**
   * Flag every already-submitted attempt on an exam as needing a re-grade,
   * after a grading-affecting edit to that exam.
   *
   * @param {string} examId
   * @returns {Promise<number>} How many submissions were flagged.
   */
  async flagForRegrade(examId) {
    const { rowCount } = await this._db.query(
      `UPDATE submissions SET needs_regrade = TRUE
        WHERE exam_id = $1 AND status <> 'in_progress'`,
      [examId]
    );
    return rowCount;
  }

  /**
   * @param {import('pg').PoolClient} client
   * @returns {Promise<Submission>}
   * @private
   */
  async _reload(client, id) {
    const { rows } = await client.query('SELECT * FROM submissions WHERE id = $1', [id]);
    const { rows: aRows } = await client.query(
      'SELECT * FROM answers WHERE submission_id = $1',
      [id]
    );
    return Submission.fromRow(rows[0], aRows);
  }
}

export default SubmissionRepository;
