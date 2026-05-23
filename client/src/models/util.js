/**
 * models/util.js — shared utilities for entity models.
 *
 * Kept separate so models stay pure (no service imports).
 * Source: docs/spec_brief.txt §7 — ID generation note in D003.
 */

/**
 * Generate a RFC-4122 v4 UUID.
 *
 * Uses the browser-native `crypto.randomUUID()` when available (Vite + modern
 * jsdom both expose it). Falls back to a Math.random-based implementation so
 * unit tests in environments that polyfill crypto partially still work.
 *
 * @returns {string} UUID string, e.g. "550e8400-e29b-41d4-a716-446655440000"
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: RFC-4122 v4 using Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
