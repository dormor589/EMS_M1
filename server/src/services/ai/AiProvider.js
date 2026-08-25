/**
 * AiProvider — the contract every AI backend implements.
 *
 * Deliberately task-level (generateExam / gradeAnswers / summariseAnalytics)
 * rather than prompt-level. A prompt-level interface would force the fallback
 * to pretend to be a language model; a task-level one lets it satisfy the same
 * contract with plain deterministic code.
 *
 * ModelBackedProvider below implements all three tasks by prompting, leaving a
 * real backend to supply only complete(). So adding another vendor is one
 * subclass with one method.
 */
class AiProvider {
  /** @returns {string} Name reported by GET /api/ai/status. */
  get name() { throw new Error('AiProvider: name must be implemented'); }

  /** @returns {boolean} True when a real language model answers. */
  get isModelBacked() { return true; }

  /**
   * Draft an exam from a description.
   *
   * @param {object} spec
   * @param {string} spec.description   What the teacher asked for.
   * @param {number} spec.questionCount
   * @returns {Promise<object>} { title, description, durationMinutes, passingGrade, questions[] }
   */
  // eslint-disable-next-line no-unused-vars
  async generateExam(spec) { throw new Error('AiProvider: generateExam must be implemented'); }

  /**
   * Mark open-text answers.
   *
   * @param {Array<{questionId: string, question: string, answer: string}>} items
   * @returns {Promise<Array<{questionId: string, score: number, feedback: string}>>}
   */
  // eslint-disable-next-line no-unused-vars
  async gradeAnswers(items) { throw new Error('AiProvider: gradeAnswers must be implemented'); }

  /**
   * Write a short narrative over already-computed statistics.
   *
   * @param {object} stats
   * @returns {Promise<string>}
   */
  // eslint-disable-next-line no-unused-vars
  async summariseAnalytics(stats) { throw new Error('AiProvider: summariseAnalytics must be implemented'); }
}

/**
 * Pull a JSON object out of a model's reply.
 *
 * Models wrap JSON in prose or fence it in markdown even when told not to, so
 * this strips fences and, failing that, takes the outermost balanced braces.
 * Cheaper and more reliable than a second round trip asking it to try again.
 *
 * @param {string} text
 * @returns {object}
 * @throws {Error} If nothing parseable is present.
 */
export function parseJsonReply(text) {
  if (!text || !text.trim()) throw new Error('The model returned an empty response');

  const cleaned = text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall through to brace extraction.
  }

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      // Fall through to the error below.
    }
  }

  throw new Error('The model did not return valid JSON');
}

export default AiProvider;
