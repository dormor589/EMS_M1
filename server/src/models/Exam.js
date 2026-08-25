import Question from './Question.js';

/** Legal one-way transitions of the exam state machine. */
const TRANSITIONS = Object.freeze({
  Draft:     ['Published'],
  Published: ['Closed'],
  Closed:    [],
});

/**
 * Exam entity.
 *
 * Owns the exam lifecycle rule. Keeping `canTransitionTo` on the model rather
 * than in a service means every caller asks the same question of the same code.
 */
class Exam {
  constructor({
    id, title, description, durationMinutes, passingGrade, status,
    createdBy, generatedByAi, aiPrompt, questions, createdAt, updatedAt,
  } = {}) {
    this.id = id;
    this.title = title;
    this.description = description || '';
    this.durationMinutes = durationMinutes;
    this.passingGrade = passingGrade ?? 60;
    this.status = status || 'Draft';
    this.createdBy = createdBy;
    this.generatedByAi = Boolean(generatedByAi);
    this.aiPrompt = aiPrompt ?? null;
    this.questions = questions || [];
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /** @returns {boolean} */
  isPublished() { return this.status === 'Published'; }

  /** @returns {boolean} */
  isDraft() { return this.status === 'Draft'; }

  /**
   * @param {string} userId
   * @returns {boolean} True if this user created the exam.
   */
  isOwnedBy(userId) { return this.createdBy === userId; }

  /**
   * @param {string} nextStatus
   * @returns {boolean} True if the transition is legal from the current status.
   */
  canTransitionTo(nextStatus) {
    return (TRANSITIONS[this.status] || []).includes(nextStatus);
  }

  /** @returns {number} Sum of all question weights; 0 for an empty exam. */
  totalWeight() {
    return this.questions.reduce((sum, q) => sum + q.weight, 0);
  }

  /**
   * @param {object}   row       An `exams` table row.
   * @param {object[]} [qRows]   Rows from `questions` for this exam.
   * @returns {Exam|null}
   */
  static fromRow(row, qRows = []) {
    if (!row) return null;
    return new Exam({
      id: row.id,
      title: row.title,
      description: row.description,
      durationMinutes: row.duration_minutes,
      passingGrade: row.passing_grade,
      status: row.status,
      createdBy: row.created_by,
      generatedByAi: row.generated_by_ai,
      aiPrompt: row.ai_prompt,
      questions: qRows.map(Question.fromRow),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  /**
   * @param {object}  [opts]
   * @param {boolean} [opts.includeAnswerKey] Pass through to each question.
   * @returns {object}
   */
  toJSON({ includeAnswerKey = false } = {}) {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      durationMinutes: this.durationMinutes,
      passingGrade: this.passingGrade,
      status: this.status,
      createdBy: this.createdBy,
      generatedByAi: this.generatedByAi,
      aiPrompt: this.aiPrompt,
      questions: this.questions.map((q) => q.toJSON({ includeAnswerKey })),
      questionCount: this.questions.length,
      totalWeight: this.totalWeight(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export { TRANSITIONS };
export default Exam;
