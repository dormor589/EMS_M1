/**
 * Answer entity — one student response to one question.
 *
 * Holds two parallel sets of grading fields: what the AI proposed (`aiScore`,
 * `aiFeedback`) and what the teacher settled on (`score`, `feedback`). They are
 * kept apart so an override never destroys the model's judgement, which is what
 * lets the UI show "AI proposed 85 — you changed it to 92".
 */
class Answer {
  constructor({
    id, submissionId, questionId, value, isCorrect,
    aiScore, aiFeedback, score, feedback, updatedAt,
  } = {}) {
    this.id = id;
    this.submissionId = submissionId;
    this.questionId = questionId;
    this.value = value ?? '';
    this.isCorrect = isCorrect ?? null;
    this.aiScore = aiScore === null || aiScore === undefined ? null : Number(aiScore);
    this.aiFeedback = aiFeedback ?? null;
    this.score = score === null || score === undefined ? null : Number(score);
    this.feedback = feedback ?? '';
    this.updatedAt = updatedAt;
  }

  /** @returns {boolean} True once a grader has settled a score. */
  isGraded() { return this.score !== null; }

  /**
   * @returns {boolean} True if a teacher changed what the AI proposed.
   *                    False when there was no AI proposal to change.
   */
  wasOverridden() {
    return this.aiScore !== null && this.score !== null && this.aiScore !== this.score;
  }

  /**
   * @param {object} row An `answers` table row.
   * @returns {Answer}
   */
  static fromRow(row) {
    return new Answer({
      id: row.id,
      submissionId: row.submission_id,
      questionId: row.question_id,
      value: row.value,
      isCorrect: row.is_correct,
      aiScore: row.ai_score,
      aiFeedback: row.ai_feedback,
      score: row.score,
      feedback: row.feedback,
      updatedAt: row.updated_at,
    });
  }

  /** @returns {object} */
  toJSON() {
    return {
      id: this.id,
      submissionId: this.submissionId,
      questionId: this.questionId,
      value: this.value,
      isCorrect: this.isCorrect,
      aiScore: this.aiScore,
      aiFeedback: this.aiFeedback,
      score: this.score,
      feedback: this.feedback,
      wasOverridden: this.wasOverridden(),
      updatedAt: this.updatedAt,
    };
  }
}

export default Answer;
