/**
 * Authentication and authorization — integration.
 *
 * Real HTTP against a real database. These cover the boundaries that decide
 * who can do what, so a regression here is a security regression rather than
 * a broken feature.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { request, app, login, as } from './helpers/api.js';
import { resetDatabase, createUser, pool } from './helpers/db.js';

beforeEach(resetDatabase);
afterAll(() => pool.end());

describe('POST /api/auth/register', () => {
  it('creates an account and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'New Teacher', email: 'new@ems.dev', password: 'password1', role: 'teacher',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('teacher');
  });

  it('NEVER returns the password or its hash', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'X', email: 'x@ems.dev', password: 'supersecret1', role: 'student',
    });

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('supersecret1');
    expect(body).not.toContain('$2b$');
  });

  it('stores a bcrypt hash, not the password', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'X', email: 'hash@ems.dev', password: 'supersecret1', role: 'student',
    });

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE email=$1', ['hash@ems.dev']);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
    expect(rows[0].password_hash).not.toContain('supersecret1');
  });

  it('rejects a duplicate email', async () => {
    await createUser({ email: 'taken@ems.dev' });
    const res = await request(app).post('/api/auth/register').send({
      name: 'X', email: 'taken@ems.dev', password: 'password1', role: 'student',
    });

    expect(res.status).toBe(409);
  });

  it('treats email as case-insensitive', async () => {
    await createUser({ email: 'case@ems.dev' });
    const res = await request(app).post('/api/auth/register').send({
      name: 'X', email: 'CASE@ems.dev', password: 'password1', role: 'student',
    });

    expect(res.status).toBe(409);
  });

  it('rejects a short password with a field-level message', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'X', email: 'short@ems.dev', password: 'abc', role: 'student',
    });

    expect(res.status).toBe(400);
    expect(res.body.details.fields[0].message).toMatch(/at least 8/i);
  });

  it('rejects an unknown role', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'X', email: 'r@ems.dev', password: 'password1', role: 'admin',
    });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token for correct credentials', async () => {
    await createUser({ email: 'ok@ems.dev', password: 'password1' });
    const res = await request(app).post('/api/auth/login').send({
      email: 'ok@ems.dev', password: 'password1',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('gives the SAME error for a wrong password and an unknown email', async () => {
    // Otherwise the response reveals which addresses are registered.
    await createUser({ email: 'real@ems.dev', password: 'password1' });

    const wrongPassword = await request(app).post('/api/auth/login')
      .send({ email: 'real@ems.dev', password: 'wrongpassword' });
    const unknownUser = await request(app).post('/api/auth/login')
      .send({ email: 'nobody@ems.dev', password: 'password1' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error).toBe(unknownUser.body.error);
  });
});

describe('token handling', () => {
  it('rejects a request with no token', async () => {
    expect((await request(app).get('/api/exams')).status).toBe(401);
  });

  it('rejects a malformed token', async () => {
    const res = await request(app).get('/api/exams').set('Authorization', 'Bearer nonsense');
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    // A forged token must not be accepted just because it parses.
    const jwt = (await import('jsonwebtoken')).default;
    const forged = jwt.sign({ sub: 'someone', role: 'teacher' }, 'not-the-real-secret');
    const res = await request(app).get('/api/exams').set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
  });

  it('rejects a valid token whose user has been deleted', async () => {
    // Identity is confirmed against the database, not taken from the claims.
    const user = await createUser({ email: 'gone@ems.dev' });
    const token = await login('gone@ems.dev');
    await pool.query('DELETE FROM users WHERE id=$1', [user.id]);

    expect((await as(token).get('/api/exams')).status).toBe(401);
  });

  it('GET /api/auth/me identifies the caller', async () => {
    await createUser({ email: 'me@ems.dev', name: 'Me', role: 'teacher' });
    const res = await as(await login('me@ems.dev')).get('/api/auth/me');

    expect(res.body.user.email).toBe('me@ems.dev');
  });
});

describe('role enforcement', () => {
  it('stops a student creating an exam', async () => {
    await createUser({ email: 'student@ems.dev', role: 'student' });
    const res = await as(await login('student@ems.dev'))
      .post('/api/exams', { title: 'Mine', durationMinutes: 30 });

    expect(res.status).toBe(403);
  });

  it('stops a teacher starting an attempt', async () => {
    const teacher = await createUser({ email: 'teacher@ems.dev', role: 'teacher' });
    const { createExam } = await import('./helpers/db.js');
    const exam = await createExam({ createdBy: teacher.id, status: 'Published' });
    const res = await as(await login('teacher@ems.dev')).post(`/api/exams/${exam.id}/attempt`);

    expect(res.status).toBe(403);
  });
});

describe('GET /health', () => {
  it('reports database connectivity without a token', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('connected');
  });
});
