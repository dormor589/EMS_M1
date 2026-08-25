/**
 * NimProvider — NVIDIA NIM, the default AI backend.
 *
 * Chosen because it is free for development, its endpoint is OpenAI-compatible
 * (so the adapter is a thin fetch wrapper rather than an SDK), and it serves
 * open models good enough for grading prose and drafting exam questions.
 *
 * Models on NIM reach end of life — `z-ai/glm-5.1` did — so a 404 or 410 is
 * treated as a provider failure and the caller falls back rather than crashing.
 */

import ModelBackedProvider from './ModelBackedProvider.js';
import { parseJsonReply } from './AiProvider.js';
import logger from '../../utils/logger.js';

class NimProvider extends ModelBackedProvider {
  /**
   * @param {object} settings
   * @param {string} settings.apiKey
   * @param {string} settings.baseUrl
   * @param {string} settings.model
   * @param {number} settings.timeoutMs
   */
  constructor({ apiKey, baseUrl, model, timeoutMs }) {
    super();
    this._apiKey = apiKey;
    this._baseUrl = baseUrl.replace(/\/$/, '');
    this._model = model;
    this._timeoutMs = timeoutMs;
  }

  /** @returns {string} */
  get name() { return `nim:${this._model}`; }

  /**
   * @param {object} request
   * @returns {Promise<object>}
   */
  async complete({ system, user, maxTokens = 2000, temperature = 0.3 }) {
    // A hung request must not hold an HTTP handler open indefinitely.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), this._timeoutMs);

    let response;
    try {
      response = await fetch(`${this._baseUrl}/chat/completions`, {
        method: 'POST',
        signal: abort.signal,
        headers: {
          Authorization: `Bearer ${this._apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this._model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          max_tokens: maxTokens,
          // Low but non-zero: enough variation that regenerating an exam gives
          // different questions, not so much that the JSON shape wanders.
          temperature,
        }),
      });
    } catch (err) {
      throw new Error(
        err.name === 'AbortError'
          ? `The AI provider did not respond within ${this._timeoutMs / 1000}s`
          : `Could not reach the AI provider: ${err.message}`
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 404 || response.status === 410) {
        // The pinned model was retired. Worth saying so plainly, because the fix
        // is to change NIM_MODEL rather than to debug the code.
        logger.error('AI model unavailable — set NIM_MODEL to a current model', {
          model: this._model, status: response.status,
        });
      }
      throw new Error(`AI provider returned ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    logger.info('AI call complete', {
      model: this._model, tokens: data.usage?.total_tokens ?? null,
    });

    return parseJsonReply(text);
  }
}

export default NimProvider;
