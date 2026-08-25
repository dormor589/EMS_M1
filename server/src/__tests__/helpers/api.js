/**
 * supertest wrapper for the API.
 *
 * Drives the real Express app in-process — every middleware, guard and
 * validator included — without binding a port.
 */

import request from 'supertest';
import app from '../../app.js';

/**
 * Log in and return a bearer token.
 *
 * @param {string} email
 * @param {string} [password]
 * @returns {Promise<string>}
 */
export async function login(email, password = 'password1') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (!res.body.token) throw new Error(`login failed for ${email}: ${JSON.stringify(res.body)}`);
  return res.body.token;
}

/**
 * A request builder that attaches the token to every call.
 *
 * @param {string} token
 * @returns {object}
 */
export function as(token) {
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  return {
    get:    (url) => auth(request(app).get(url)),
    post:   (url, body) => auth(request(app).post(url)).send(body ?? {}),
    put:    (url, body) => auth(request(app).put(url)).send(body),
    patch:  (url, body) => auth(request(app).patch(url)).send(body),
    delete: (url) => auth(request(app).delete(url)),
  };
}

export { app, request };
