/**
 * fakeApi — a test double for HttpApiService.
 *
 * Records every call and replays queued responses, so the service tests assert
 * the HTTP contract (right verb, right path, right body) without a server or a
 * database. Replaces Milestone 1's MockApiService, which tested a localStorage
 * backend that no longer exists.
 */

import { vi } from 'vitest';

/**
 * @param {Record<string, any>} [routes] Map of "VERB /path" to a response, or
 *   to an Error to be thrown.
 * @returns {object} A fake with the same surface as HttpApiService.
 */
export function makeFakeApi(routes = {}) {
  /** @type {Array<{method: string, path: string, body?: object}>} */
  const calls = [];
  let token = null;

  const respond = (method, path, body) => {
    calls.push({ method, path, body });
    const key = `${method} ${path}`;
    if (!(key in routes)) {
      const err = new Error(`fakeApi: no route for ${key}`);
      err.status = 404;
      return Promise.reject(err);
    }
    const value = routes[key];
    return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
  };

  return {
    calls,
    routes,
    getToken: () => token,
    setToken: vi.fn((t) => { token = t; }),
    clearToken: vi.fn(() => { token = null; }),
    get:    (p) => respond('GET', p),
    post:   (p, b) => respond('POST', p, b),
    put:    (p, b) => respond('PUT', p, b),
    patch:  (p, b) => respond('PATCH', p, b),
    delete: (p) => respond('DELETE', p),
    health: vi.fn(async () => ({ ok: true, detail: 'connected' })),
    onUnauthorized: null,
  };
}

/**
 * @param {number} status
 * @param {string} message
 * @returns {Error}
 */
export function apiError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
