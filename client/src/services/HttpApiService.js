/**
 * HttpApiService — the client's single point of contact with the Express API.
 *
 * Replaces MockApiService as the persistence seam. Everything above it
 * (AuthService, ExamService, SubmissionService) calls this instead of touching
 * storage, so the whole app moved from localStorage to a real backend without
 * the pages changing.
 *
 * Responsibilities:
 *   - attach the JWT to every request
 *   - unwrap the API's JSON envelope
 *   - turn an error response into an Error carrying a message worth showing
 *   - clear a dead session when the API says the token is no longer good
 *
 * Source: the milestone brief §8 — API service layer
 */

class HttpApiService {
  /**
   * @param {import('./ConfigService.js').default}  config
   * @param {import('./LoggerService.js').default}  logger
   * @param {import('./StorageService.js').default} storage
   */
  constructor(config, logger, storage) {
    if (!config)  throw new Error('HttpApiService: "config" dependency is required');
    if (!logger)  throw new Error('HttpApiService: "logger" dependency is required');
    if (!storage) throw new Error('HttpApiService: "storage" dependency is required');

    this._config  = config;
    this._logger  = logger;
    this._storage = storage;
    this._baseUrl = config.getApiBaseUrl();
    this._keys    = config.getStorageKeys();

    /**
     * Called when the API rejects our token. Set by AuthService so a expired
     * session can clear itself without this class importing AuthService and
     * creating a cycle.
     * @type {null | (() => void)}
     */
    this.onUnauthorized = null;
  }

  // ── Token ────────────────────────────────────────────────────────────────

  /** @returns {string|null} The stored JWT, if any. */
  getToken() {
    return this._storage.get(this._keys.authToken);
  }

  /** @param {string} token */
  setToken(token) {
    this._storage.set(this._keys.authToken, token);
  }

  /** Forget the stored token. */
  clearToken() {
    this._storage.remove(this._keys.authToken);
  }

  // ── Core request ─────────────────────────────────────────────────────────

  /**
   * Issue a request and return the parsed body.
   *
   * @param {string} method
   * @param {string} path   Path below the API base, e.g. '/exams'.
   * @param {object} [body]
   * @returns {Promise<object>}
   * @throws {Error} With the API's message, so a page can show it directly.
   * @private
   */
  async _request(method, path, body) {
    const token = this.getToken();
    const url = `${this._baseUrl}${path}`;

    let response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      // fetch only rejects when the request never completed — the server is
      // down, or the browser blocked it. Worth its own message, because
      // "failed to fetch" tells a user nothing.
      this._logger.error('HttpApiService: cannot reach the API at %s', this._baseUrl);
      throw new Error(
        'Cannot reach the server. Check that the API is running, then try again.'
      );
    }

    // 204 and other empty responses have no body to parse.
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken();
        this.onUnauthorized?.();
      }
      throw this._toError(data, response.status);
    }

    return data;
  }

  /**
   * Build an Error from an error response.
   *
   * Field-level validation details are folded into the message so a form can
   * show something specific rather than a generic "some fields need fixing".
   *
   * @param {object} data
   * @param {number} status
   * @returns {Error}
   * @private
   */
  _toError(data, status) {
    let message = data.error || `Request failed (${status})`;

    if (data.details?.fields?.length) {
      message = data.details.fields.map((f) => f.message).join('. ');
    }

    const err = new Error(message);
    err.status = status;
    err.details = data.details;
    return err;
  }

  // ── Verbs ────────────────────────────────────────────────────────────────

  /**
   * @param {string} path
   * @returns {Promise<object>}
   */
  get(path) { return this._request('GET', path); }

  /**
   * @param {string} path
   * @param {object} [body]
   * @returns {Promise<object>}
   */
  post(path, body) { return this._request('POST', path, body ?? {}); }

  /**
   * @param {string} path
   * @param {object} body
   * @returns {Promise<object>}
   */
  put(path, body) { return this._request('PUT', path, body); }

  /**
   * @param {string} path
   * @param {object} body
   * @returns {Promise<object>}
   */
  patch(path, body) { return this._request('PATCH', path, body); }

  /**
   * @param {string} path
   * @returns {Promise<object>}
   */
  delete(path) { return this._request('DELETE', path); }

  /**
   * Check that the API is reachable and its database is up.
   *
   * Used by App.jsx at boot so a server that is down produces a clear message
   * instead of every page failing separately.
   *
   * @returns {Promise<{ ok: boolean, detail: string }>}
   */
  async health() {
    try {
      const res = await fetch(`${this._baseUrl.replace(/\/api$/, '')}/health`);
      const data = await res.json();
      return { ok: res.ok && data.status === 'ok', detail: data.database || 'unknown' };
    } catch {
      return { ok: false, detail: 'unreachable' };
    }
  }
}

export default HttpApiService;
