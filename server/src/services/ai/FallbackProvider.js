/**
 * FallbackProvider — the AI features with no API key and no network.
 *
 * This exists so the project runs for someone who is not the author. Whoever
 * marks this work will not have an API key, and an application whose headline
 * features are dead on their machine has not really shipped them.
 *
 * It is deliberately a real implementation rather than a stub: exams are built
 * from templates around the teacher's own words, and open-text answers are
 * scored by comparing them against the question's vocabulary. It is visibly
 * less capable than a language model — it cannot judge whether an argument is
 * correct, only whether an answer engages with the right material — and every
 * response says so, so nothing here is passed off as AI.
 */

import AiProvider from './AiProvider.js';

/** Words too common to carry meaning when comparing an answer to a question. */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'as', 'that', 'this',
  'these', 'those', 'it', 'its', 'you', 'your', 'what', 'which', 'when', 'how',
  'why', 'who', 'do', 'does', 'did', 'can', 'could', 'would', 'should', 'explain',
  'describe', 'briefly', 'discuss', 'give', 'between', 'difference', 'about',
]);

/**
 * Reduce text to a set of meaningful lower-case words.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
function keywords(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

class FallbackProvider extends AiProvider {
  /** @returns {string} */
  get name() { return 'fallback:deterministic'; }

  /** @returns {boolean} No model is involved, and callers are told so. */
  get isModelBacked() { return false; }

  /**
   * Build an exam skeleton from the teacher's description.
   *
   * The questions are scaffolding for the teacher to edit, not finished
   * questions — which is why they name the subject rather than inventing
   * content about it.
   *
   * @param {object} spec
   * @returns {Promise<object>}
   */
  async generateExam({ description, questionCount }) {
    const subject = this._subjectFrom(description);

    // Weights that always total exactly 100, with the remainder spread over the
    // first few questions rather than dumped on the last one.
    const base = Math.floor(100 / questionCount);
    const remainder = 100 - base * questionCount;

    const questions = Array.from({ length: questionCount }, (_, i) => {
      const weight = base + (i < remainder ? 1 : 0);

      // Alternate the two types so the teacher sees both shapes to edit.
      if (i % 2 === 0) {
        return {
          type: 'multiple-choice',
          text: `Which statement about ${subject} is correct?`,
          options: [
            `A correct statement about ${subject} — replace this with the real one`,
            'A plausible but incorrect statement — replace this',
            'Another plausible but incorrect statement — replace this',
          ],
          correctAnswer: 0,
          weight,
        };
      }
      return {
        type: 'open-text',
        text: `Explain a key concept in ${subject}, with an example.`,
        options: [],
        correctAnswer: null,
        weight,
      };
    });

    return {
      title: this._titleFrom(subject),
      description: `Draft exam on ${subject}. Generated without a language model — `
        + 'edit the questions before publishing.',
      durationMinutes: Math.max(15, questionCount * 5),
      passingGrade: 60,
      questions,
    };
  }

  /**
   * Score answers by how much of the question's vocabulary they engage with,
   * with a length signal for substance.
   *
   * This measures relevance, not correctness. A confidently wrong answer using
   * the right words will score well, which is exactly the limitation the
   * feedback text admits to.
   *
   * @param {Array<{questionId: string, question: string, answer: string}>} items
   * @returns {Promise<Array<{questionId: string, score: number, feedback: string}>>}
   */
  async gradeAnswers(items) {
    return items.map(({ questionId, question, answer }) => {
      const text = String(answer || '').trim();

      if (!text) {
        return {
          questionId,
          score: 0,
          feedback: 'No answer was given.',
        };
      }

      const asked = keywords(question);
      const given = keywords(text);
      const overlap = [...asked].filter((w) => given.has(w)).length;
      const coverage = asked.size ? overlap / asked.size : 0;

      // Substance: an answer of roughly 40 words or more gets full marks on
      // this half. Crude, but it separates a sentence fragment from an attempt.
      const words = text.split(/\s+/).length;
      const substance = Math.min(1, words / 40);

      // Relevance weighted above length: engaging with the topic matters more
      // than writing at length about nothing.
      const score = Math.round((coverage * 0.65 + substance * 0.35) * 100);

      return {
        questionId,
        score: Math.max(0, Math.min(100, score)),
        feedback:
          'Scored automatically without a language model, by comparing this answer '
          + 'against the question\'s key terms and its length. It measures relevance, '
          + 'not whether the reasoning is correct — please review before publishing. '
          + 'It is weakest on questions with little distinctive vocabulary, such as '
          + 'calculations, where a correct answer may score low.',
      };
    });
  }

  /**
   * Describe the statistics in prose, computed rather than written.
   *
   * @param {object} stats
   * @returns {Promise<string>}
   */
  async summariseAnalytics(stats) {
    const parts = [];
    const { submissionCount = 0, averageGrade, passRate, hardestQuestion } = stats;

    if (!submissionCount) return 'No submissions have been graded yet.';

    parts.push(
      `${submissionCount} submission${submissionCount === 1 ? '' : 's'} graded, `
      + `averaging ${averageGrade}.`
    );
    if (typeof passRate === 'number') {
      parts.push(`${passRate}% reached the pass mark.`);
    }
    if (hardestQuestion) {
      parts.push(
        `Question ${hardestQuestion.position} scored lowest at ${hardestQuestion.averageScore}, `
        + 'which is worth reviewing — either the topic needs revisiting or the wording does.'
      );
    }
    parts.push('(Summary generated without a language model.)');

    return parts.join(' ');
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /**
   * Extract a subject from the teacher's description.
   *
   * @param {string} description
   * @returns {string}
   * @private
   */
  _subjectFrom(description) {
    const cleaned = String(description || '')
      .replace(/\b\d+\s*(questions?|minutes?|marks?)\b/gi, '')
      .replace(/\b(exam|quiz|test|about|on|for|with|create|make|generate|an?|the)\b/gi, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || 'the course material';
  }

  /**
   * @param {string} subject
   * @returns {string}
   * @private
   */
  _titleFrom(subject) {
    const titled = subject.replace(/\b\w/g, (c) => c.toUpperCase());
    return titled.length > 60 ? `${titled.slice(0, 57)}…` : titled;
  }
}

export default FallbackProvider;
