/**
 * AnalyticsService — statistics over exams and submissions.
 *
 * The numbers come from SQL, computed in the database rather than by pulling
 * rows into JavaScript and looping. The AI's only role is to write a short
 * narrative on top of figures that are already correct — so a provider being
 * unavailable costs the commentary, never the data.
 *
 * Per-question difficulty is a plain join, which is the payoff for normalising
 * questions and answers into their own tables instead of storing them as JSON.
 *
 * Source: the milestone brief §5.2 — statistics and analytics
 */

import pool from '../db/pool.js';
import ApiError from '../utils/ApiError.js';
import ExamRepository from '../db/repositories/ExamRepository.js';
import AiService from './AiService.js';

class AnalyticsService {
  constructor(exams = new ExamRepository(), ai = new AiService(), db = pool) {
    this._exams = exams;
    this._ai = ai;
    this._db = db;
  }

  /**
   * Statistics for one exam, for its owning teacher.
   *
   * @param {string} examId
   * @param {import('../models/User.js').default} user
   * @param {object}  [options]
   * @param {boolean} [options.withSummary] Ask the AI for a narrative too.
   * @returns {Promise<object>}
   */
  async forExam(examId, user, { withSummary = false } = {}) {
    const exam = await this._exams.findById(examId);
    if (!exam) throw ApiError.notFound('Exam not found');
    if (!exam.isOwnedBy(user.id)) {
      throw ApiError.forbidden('This exam belongs to another teacher');
    }

    const [overview, distribution, questions] = await Promise.all([
      this._examOverview(examId),
      this._gradeDistribution(examId),
      this._questionBreakdown(examId),
    ]);

    const hardest = questions
      .filter((q) => q.answeredCount > 0)
      .sort((a, b) => a.averageScore - b.averageScore)[0] ?? null;

    const stats = {
      exam: { id: exam.id, title: exam.title, status: exam.status, passingGrade: exam.passingGrade },
      ...overview,
      distribution,
      questions,
      hardestQuestion: hardest && {
        position: hardest.position,
        text: hardest.text,
        averageScore: hardest.averageScore,
      },
    };

    if (withSummary) {
      stats.summary = await this._ai.summariseAnalytics({
        examTitle: exam.title,
        passingGrade: exam.passingGrade,
        submissionCount: overview.gradedCount,
        averageGrade: overview.averageGrade,
        passRate: overview.passRate,
        hardestQuestion: stats.hardestQuestion,
        questions: questions.map((q) => ({
          position: q.position, type: q.type, averageScore: q.averageScore,
        })),
      });
      // The FAST provider writes the summary, not the grading one — report the
      // model that actually answered so the UI cannot claim otherwise.
      stats.summaryProvider = this._ai.status().fastProvider;
    }

    return stats;
  }

  /**
   * Cohort view across every exam a teacher owns.
   *
   * @param {import('../models/User.js').default} user
   * @returns {Promise<object>}
   */
  async overview(user) {
    const { rows } = await this._db.query(
      `SELECT e.id, e.title, e.status, e.passing_grade,
              count(s.id)                                      AS submission_count,
              count(s.grade)                                   AS graded_count,
              count(*) FILTER (WHERE s.status = 'submitted')   AS awaiting_grading,
              round(avg(s.grade), 1)                           AS average_grade,
              count(*) FILTER (WHERE s.grade >= e.passing_grade) AS passed_count
         FROM exams e
         LEFT JOIN submissions s ON s.exam_id = e.id
        WHERE e.created_by = $1
        GROUP BY e.id
        ORDER BY e.created_at DESC`,
      [user.id]
    );

    const exams = rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      passingGrade: r.passing_grade,
      submissionCount: Number(r.submission_count),
      gradedCount: Number(r.graded_count),
      awaitingGrading: Number(r.awaiting_grading),
      averageGrade: r.average_grade === null ? null : Number(r.average_grade),
      passRate: Number(r.graded_count)
        ? Math.round((Number(r.passed_count) / Number(r.graded_count)) * 100)
        : null,
    }));

    const graded = exams.reduce((sum, e) => sum + e.gradedCount, 0);

    return {
      exams,
      totals: {
        examCount: exams.length,
        published: exams.filter((e) => e.status === 'Published').length,
        submissionCount: exams.reduce((sum, e) => sum + e.submissionCount, 0),
        gradedCount: graded,
        awaitingGrading: exams.reduce((sum, e) => sum + e.awaitingGrading, 0),
        // Weighted by how many submissions each exam contributed, so an exam
        // with one submission does not swing the average as hard as one with 30.
        averageGrade: graded
          ? Math.round(
              (exams.reduce((sum, e) => sum + (e.averageGrade ?? 0) * e.gradedCount, 0) / graded) * 10
            ) / 10
          : null,
      },
    };
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  /**
   * @param {string} examId
   * @returns {Promise<object>}
   * @private
   */
  async _examOverview(examId) {
    const { rows } = await this._db.query(
      `SELECT count(*)                                          AS total,
              count(*) FILTER (WHERE s.status = 'in_progress')  AS in_progress,
              count(*) FILTER (WHERE s.status = 'submitted')    AS awaiting,
              count(*) FILTER (WHERE s.status = 'ai_graded')    AS draft_graded,
              count(*) FILTER (WHERE s.status = 'graded')       AS published,
              count(s.grade)                                    AS graded,
              round(avg(s.grade), 1)                            AS avg_grade,
              min(s.grade)                                      AS min_grade,
              max(s.grade)                                      AS max_grade,
              count(*) FILTER (WHERE s.grade >= e.passing_grade) AS passed
         FROM submissions s
         JOIN exams e ON e.id = s.exam_id
        WHERE s.exam_id = $1`,
      [examId]
    );
    const r = rows[0];
    const graded = Number(r.graded);

    return {
      submissionCount: Number(r.total),
      inProgress: Number(r.in_progress),
      awaitingGrading: Number(r.awaiting),
      draftGraded: Number(r.draft_graded),
      publishedGrades: Number(r.published),
      gradedCount: graded,
      averageGrade: r.avg_grade === null ? null : Number(r.avg_grade),
      lowestGrade: r.min_grade === null ? null : Number(r.min_grade),
      highestGrade: r.max_grade === null ? null : Number(r.max_grade),
      passedCount: Number(r.passed),
      passRate: graded ? Math.round((Number(r.passed) / graded) * 100) : null,
    };
  }

  /**
   * Grades bucketed into tens, with empty buckets included so a chart has a
   * complete x-axis rather than gaps.
   *
   * @param {string} examId
   * @returns {Promise<Array<{bucket: string, count: number}>>}
   * @private
   */
  async _gradeDistribution(examId) {
    const { rows } = await this._db.query(
      `SELECT width_bucket(grade, 0, 100, 10) AS bucket, count(*)::int AS n
         FROM submissions
        WHERE exam_id = $1 AND grade IS NOT NULL
        GROUP BY bucket`,
      [examId]
    );

    const counts = new Map(rows.map((r) => [Number(r.bucket), r.n]));
    return Array.from({ length: 10 }, (_, i) => {
      const low = i * 10;
      // width_bucket puts a grade of exactly 100 in bucket 11, so the top
      // bucket absorbs it rather than losing it.
      const n = (counts.get(i + 1) ?? 0) + (i === 9 ? (counts.get(11) ?? 0) : 0);
      return { bucket: `${low}-${low + 9}`, count: n };
    });
  }

  /**
   * Per-question difficulty — a plain join, which is why questions and answers
   * are their own tables rather than JSON blobs.
   *
   * @param {string} examId
   * @returns {Promise<object[]>}
   * @private
   */
  async _questionBreakdown(examId) {
    const { rows } = await this._db.query(
      `SELECT q.id, q.position, q.type, q.text, q.weight,
              count(a.id)                                  AS answered,
              count(a.score)                               AS scored,
              round(avg(a.score), 1)                       AS avg_score,
              count(*) FILTER (WHERE a.is_correct IS TRUE) AS correct
         FROM questions q
         LEFT JOIN answers a ON a.question_id = q.id
        WHERE q.exam_id = $1
        GROUP BY q.id
        ORDER BY q.position`,
      [examId]
    );

    return rows.map((r) => ({
      id: r.id,
      position: r.position + 1,
      type: r.type,
      text: r.text,
      weight: r.weight,
      answeredCount: Number(r.answered),
      scoredCount: Number(r.scored),
      averageScore: r.avg_score === null ? 0 : Number(r.avg_score),
      correctCount: Number(r.correct),
      // Only meaningful for multiple choice: `is_correct` is never set on an
      // open-text answer, so reporting 0% there would read as "everyone got it
      // wrong" rather than "this question is not marked that way".
      correctRate: r.type === 'multiple-choice' && Number(r.answered)
        ? Math.round((Number(r.correct) / Number(r.answered)) * 100)
        : null,
    }));
  }
}

export default AnalyticsService;
