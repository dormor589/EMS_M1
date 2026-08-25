import Answer from './Answer.js';

/** Legal one-way transitions of the submission lifecycle. */
const TRANSITIONS = Object.freeze({
  in_progress: ['submitted'],
  submitted:   ['ai_graded', 'graded'],
  ai_graded:   ['graded'],
  graded:      [],
});

/**
 * Submission entity — one student's attempt at one exam.
 *
 * The row exists from the moment the student OPENS the exam, so this object
 * carries the countdown and the autosaved answers long before it carries a
 * grade.
 */
class Submission {
  constructor({
    id, examId, studentId, status, startedAt, expiresAt, submittedAt,
    grade, feedback, gradedBy, gradedAt, needsRegrade, answers,
  } = {}) {
    this.id = id;
    this.examId = examId;
    this.studentId = studentId;
    this.status = status || 'in_progress';
    this.startedAt = startedAt;
    this.expiresAt = expiresAt;
    this.submittedAt = submittedAt ?? null;
    this.grade = grade === null || grade === undefined ? null : Number(grade);
    this.feedback = feedback ?? '';
    this.gradedBy = gradedBy ?? null;
    this.gradedAt = gradedAt ?? null;
    this.needsRegrade = Boolean(needsRegrade);
    this.answers = answers || [];
  }

  /** @returns {boolean} */
  isInProgress() { return this.status === 'in_progress'; }

  /** @returns {boolean} True once the grade has been released to the student. */
  isPublished() { return this.status === 'graded'; }

  /**
   * @param {string} nextStatus
   * @returns {boolean}
   */
  canTransitionTo(nextStatus) {
    return (TRANSITIONS[this.status] || []).includes(nextStatus);
  }

  /**
   * @param {number} [graceSeconds] Allowance for clock skew and latency.
   * @returns {boolean} True if the timer has run out.
   */
  hasExpired(graceSeconds = 0) {
    return Date.now() > new Date(this.expiresAt).getTime() + graceSeconds * 1000;
  }

  /** @returns {number} Whole seconds left on the clock, floored at zero. */
  secondsRemaining() {
    return Math.max(0, Math.floor((new Date(this.expiresAt).getTime() - Date.now()) / 1000));
  }

  /**
   * @param {number} passingGrade The owning exam's threshold.
   * @returns {boolean|null} Null while ungraded — never stored, always derived.
   */
  passed(passingGrade) {
    return this.grade === null ? null : this.grade >= passingGrade;
  }

  /**
   * @param {object}   row
   * @param {object[]} [aRows] Rows from `answers` for this submission.
   * @returns {Submission|null}
   */
  static fromRow(row, aRows = []) {
    if (!row) return null;
    return new Submission({
      id: row.id,
      examId: row.exam_id,
      studentId: row.student_id,
      status: row.status,
      startedAt: row.started_at,
      expiresAt: row.expires_at,
      submittedAt: row.submitted_at,
      grade: row.grade,
      feedback: row.feedback,
      gradedBy: row.graded_by,
      gradedAt: row.graded_at,
      needsRegrade: row.needs_regrade,
      answers: aRows.map(Answer.fromRow),
    });
  }

  /**
   * @param {object}  [opts]
   * @param {boolean} [opts.forStudent] Hide grading detail that has not been
   *                                    published yet. A student must not see an
   *                                    ai_graded draft the teacher is still editing.
   * @param {number}  [opts.passingGrade]
   * @returns {object}
   */
  toJSON({ forStudent = false, passingGrade } = {}) {
    const base = {
      id: this.id,
      examId: this.examId,
      studentId: this.studentId,
      status: this.status,
      startedAt: this.startedAt,
      expiresAt: this.expiresAt,
      submittedAt: this.submittedAt,
      secondsRemaining: this.isInProgress() ? this.secondsRemaining() : 0,
      answers: this.answers.map((a) => a.toJSON()),
    };

    // A student sees a grade only once it has actually been published.
    if (forStudent && !this.isPublished()) {
      return {
        ...base,
        // Collapse the internal draft state so 'ai_graded' never reaches a student.
        status: this.isInProgress() ? 'in_progress' : 'submitted',
        answers: base.answers.map(({ aiScore, aiFeedback, score, feedback, ...rest }) => rest),
        grade: null,
        feedback: '',
        passed: null,
      };
    }

    return {
      ...base,
      grade: this.grade,
      feedback: this.feedback,
      gradedBy: this.gradedBy,
      gradedAt: this.gradedAt,
      needsRegrade: this.needsRegrade,
      passed: passingGrade === undefined ? undefined : this.passed(passingGrade),
    };
  }
}

export { TRANSITIONS };
export default Submission;
