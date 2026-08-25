/**
 * ai/index.js — chooses the AI backend once, at startup.
 *
 * Precedence: NVIDIA NIM if a key is present, otherwise the deterministic
 * fallback. The choice is made here rather than per request, so every part of
 * the app agrees on which provider is in use and GET /api/ai/status can report
 * it honestly.
 *
 * Adding another vendor means one subclass of ModelBackedProvider implementing
 * complete(), plus a branch here.
 */

import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import NimProvider from './NimProvider.js';
import FallbackProvider from './FallbackProvider.js';

/**
 * @param {string} model
 * @returns {import('./AiProvider.js').default}
 */
function selectProvider(model = config.ai.nim.model) {
  if (config.ai.nim.apiKey) {
    logger.info('AI provider: NVIDIA NIM', { model });
    return new NimProvider({
      apiKey: config.ai.nim.apiKey,
      baseUrl: config.ai.nim.baseUrl,
      model,
      timeoutMs: config.ai.timeoutMs,
    });
  }

  logger.warn(
    'AI provider: deterministic fallback (no NVIDIA_API_KEY set). '
    + 'Every AI feature still works, without a language model.'
  );
  return new FallbackProvider();
}

/**
 * The main provider — used for grading, where judgement matters more than speed.
 */
export const provider = selectProvider();

/**
 * A faster provider for exam generation and the analytics summary.
 *
 * Falls back to the deterministic provider with no key, exactly as the main one
 * does, so both degrade the same way.
 */
export const fastProvider = selectProvider(config.ai.nim.fastModel);

/** Always available, for when a model-backed call fails mid-request. */
export const fallback = new FallbackProvider();

export default provider;
