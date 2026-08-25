/**
 * ModelBackedProvider — implements the three AI tasks by prompting a model.
 *
 * All prompt engineering lives here, once, so every vendor gets the same
 * instructions and only has to supply complete(). The prompts are strict about
 * output shape because the results are parsed, not read: a stray sentence of
 * preamble is a failure, not a nuisance.
 */

import AiProvider from './AiProvider.js';

/** Shared preamble: these models like to explain themselves. */
const JSON_ONLY = 'Reply with a single valid JSON object and nothing else. '
  + 'No markdown fences, no commentary before or after.';

class ModelBackedProvider extends AiProvider {
  /**
   * Send a prompt and return the parsed JSON.
   *
   * The one method a concrete vendor must implement.
   *
   * @param {object} request
   * @param {string} request.system
   * @param {string} request.user
   * @param {number} [request.maxTokens]
   * @param {number} [request.temperature]
   * @returns {Promise<object>}
   */
  // eslint-disable-next-line no-unused-vars
  async complete(request) { throw new Error('ModelBackedProvider: complete must be implemented'); }

  /**
   * @param {object} spec
   * @returns {Promise<object>}
   */
  async generateExam({ description, questionCount }) {
    const system = [
      'You are an experienced lecturer writing an exam.',
      JSON_ONLY,
      'Schema:',
      '{"title":string,"description":string,"durationMinutes":integer,',
      '"passingGrade":integer,"questions":[{"type":"multiple-choice"|"open-text",',
      '"text":string,"options":string[],"correctAnswer":integer|null,"weight":integer}]}',
      'Rules:',
      '- A multiple-choice question needs 3 or 4 plausible options and correctAnswer',
      '  as the zero-based index of the right one. Wrong options must be genuinely',
      '  tempting, not obviously absurd.',
      '- An open-text question must have "options":[] and "correctAnswer":null.',
      '- Mix both types unless the request says otherwise.',
      '- weight is each question\'s share of the grade; all weights must total 100.',
      '- Vary difficulty across the questions.',
    ].join('\n');

    const user = [
      `Write an exam for this request: "${description}"`,
      `Produce exactly ${questionCount} questions.`,
      'Pick a sensible title, duration and pass mark if the request does not say.',
    ].join('\n');

    // 1800 rather than 3000: even a 20-question exam fits comfortably, and a
    // reasoning model will spend whatever budget it is handed on thinking.
    return this.complete({ system, user, maxTokens: 1800, temperature: 0.6 });
  }

  /**
   * @param {Array<{questionId: string, question: string, answer: string}>} items
   * @returns {Promise<Array<{questionId: string, score: number, feedback: string}>>}
   */
  async gradeAnswers(items) {
    const system = [
      "You are marking a student's exam answers.",
      JSON_ONLY,
      'Schema: {"grades":[{"questionId":string,"expectedAnswer":string,',
      '"studentIsCorrect":boolean,"methodIsSound":boolean,"score":integer,',
      '"feedback":string}]}',
      '',
      'For EACH answer, in this order:',
      '  1. expectedAnswer — work out the correct answer yourself, from the',
      '     question alone, BEFORE reading what the student wrote. For a',
      '     calculation, compute it.',
      '  2. studentIsCorrect — does the student\'s FINAL answer match yours?',
      '  3. methodIsSound — read EVERY step of their working and check each one',
      '     is valid. This is a separate judgement from the final answer:',
      '       * A correct final answer reached through invalid steps is',
      '         methodIsSound=false. Getting the right number by luck is not',
      '         the same as doing it correctly.',
      '       * If the question says "show your work" and no working is given,',
      '         methodIsSound=false — you cannot mark reasoning that is absent.',
      '       * Never describe working the student did not actually write.',
      '  4. score — 0-100. Mark it as an experienced teacher of this subject',
      '     would, using your own judgement of what the answer is worth. Two',
      '     hard constraints, and they refer to the fields you just filled in:',
      '       * studentIsCorrect=false means the answer is WRONG. It cannot',
      '         score in the range you would give a correct one.',
      '       * methodIsSound=false means the working is invalid. It cannot',
      '         score as well as valid working.',
      '     A blank or irrelevant answer scores 0. Every grade object MUST',
      '     include studentIsCorrect and methodIsSound — never omit them.',
      '  5. feedback — one or two sentences addressed to the student. The score',
      '     you gave dictates what it must contain:',
      '       * Anything wrong: name the specific step and give the correct answer.',
      '       * Score below 95 with nothing outright wrong: say what is MISSING or',
      '         would make it stronger — a step asserted without justification, an',
      '         unstated assumption or condition, working that was not shown,',
      '         imprecise notation. If you deducted marks you know why; tell them.',
      '       * Praise alone is only ever acceptable at 95 or above.',
      '     Never write "correct, well done" for an answer you did not give full',
      '     marks to — it teaches the student nothing about the marks they lost.',
      '     Never contradict your own judgements.',
      '',
      'A well-presented wrong answer is still wrong, and a right answer reached',
      'the wrong way is still not good work.',
      '- Return one entry per questionId, in the order given.',
    ].join('\n');

    const user = items
      .map((it, i) => [
        `--- Answer ${i + 1} ---`,
        `questionId: ${it.questionId}`,
        `Question: ${it.question}`,
        `Student's answer: ${it.answer || '(left blank)'}`,
      ].join('\n'))
      .join('\n\n');

    const result = await this.complete({
      system, user, maxTokens: 3000, temperature: 0.1,
    });
    return result.grades ?? [];
  }

  /**
   * @param {object} stats
   * @returns {Promise<string>}
   */
  async summariseAnalytics(stats) {
    const system = [
      'You are advising a lecturer on how their class performed.',
      JSON_ONLY,
      'Schema: {"summary":string}',
      'Rules:',
      '- Three or four sentences of plain prose.',
      '- Say what the numbers imply for teaching: which topics need revisiting,',
      '  whether a question looks badly worded rather than simply hard.',
      '- Do not merely restate figures the lecturer can already see.',
    ].join('\n');

    const result = await this.complete({
      system,
      user: `Statistics:\n${JSON.stringify(stats, null, 2)}`,
      maxTokens: 600,
      temperature: 0.4,
    });
    return result.summary ?? '';
  }
}

export default ModelBackedProvider;
