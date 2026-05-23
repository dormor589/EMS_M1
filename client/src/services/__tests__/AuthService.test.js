/**
 * AuthService unit tests.
 *
 * Uses the real singletons (mockApi, storage, config, logger) with a fresh
 * jsdom localStorage cleared before each test. Seed data is loaded per-test
 * so the teacher@ems.dev / password credentials are always available.
 *
 * Source: docs/spec_brief.txt §8 — AuthService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AuthService from '../AuthService.js';
import storage     from '../StorageService.js';
import config      from '../ConfigService.js';
import logger      from '../LoggerService.js';
import MockApiService from '../MockApiService.js';

// Silence logger output during tests.
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Fresh wired AuthService + mockApi per test (localStorage cleared above). */
async function mkAuth() {
  const mockApi = new MockApiService(storage, config, logger);
  await mockApi.seedIfEmpty(); // loads teacher@ems.dev + student@ems.dev
  return new AuthService(mockApi, storage, config, logger);
}

// ── Constructor guard ──────────────────────────────────────────────────────────
describe('AuthService constructor', () => {
  it('throws when mockApi is missing', () => {
    expect(() => new AuthService(null, storage, config, logger)).toThrow(/mockApi/);
  });
});

// ── login ──────────────────────────────────────────────────────────────────────
describe('login()', () => {
  it('returns a User on valid seed teacher credentials', async () => {
    const auth = await mkAuth();
    const user = await auth.login('teacher@ems.dev', 'password');
    expect(user.email).toBe('teacher@ems.dev');
    expect(user.role).toBe('teacher');
  });

  it('returns a User on valid seed student credentials', async () => {
    const auth = await mkAuth();
    const user = await auth.login('student@ems.dev', 'password');
    expect(user.email).toBe('student@ems.dev');
    expect(user.role).toBe('student');
  });

  it('throws "Invalid credentials" on wrong password', async () => {
    const auth = await mkAuth();
    await expect(auth.login('teacher@ems.dev', 'wrongpass')).rejects.toThrow('Invalid credentials');
  });

  it('throws "Invalid credentials" on unknown email', async () => {
    const auth = await mkAuth();
    await expect(auth.login('nobody@ems.dev', 'password')).rejects.toThrow('Invalid credentials');
  });

  it('throws "Invalid credentials" when email is empty', async () => {
    const auth = await mkAuth();
    await expect(auth.login('', 'password')).rejects.toThrow('Invalid credentials');
  });

  it('persists user to storage so getCurrentUser() returns them', async () => {
    const auth = await mkAuth();
    await auth.login('teacher@ems.dev', 'password');
    const current = auth.getCurrentUser();
    expect(current).not.toBeNull();
    expect(current.email).toBe('teacher@ems.dev');
  });
});

// ── register ───────────────────────────────────────────────────────────────────
describe('register()', () => {
  it('creates a new user and auto-logs them in', async () => {
    const auth = await mkAuth();
    const user = await auth.register({ name: 'New User', email: 'new@ems.dev', password: 'pass', role: 'student' });
    expect(user.email).toBe('new@ems.dev');
    expect(auth.getCurrentUser().email).toBe('new@ems.dev');
  });

  it('persists the new user in the mock DB', async () => {
    const mockApi = new MockApiService(storage, config, logger);
    await mockApi.seedIfEmpty();
    const auth = new AuthService(mockApi, storage, config, logger);

    await auth.register({ name: 'T', email: 't@ems.dev', password: 'pass', role: 'teacher' });
    const users = await mockApi.get('users');
    expect(users.find((u) => u.email === 't@ems.dev')).toBeTruthy();
  });

  it('throws "Email already registered" on duplicate email', async () => {
    const auth = await mkAuth();
    await expect(
      auth.register({ name: 'X', email: 'teacher@ems.dev', password: 'pass', role: 'student' })
    ).rejects.toThrow('Email already registered');
  });

  it('throws on invalid email format', async () => {
    const auth = await mkAuth();
    await expect(
      auth.register({ name: 'X', email: 'notanemail', password: 'pass', role: 'student' })
    ).rejects.toThrow(/invalid email/i);
  });

  it('throws when password is too short', async () => {
    const auth = await mkAuth();
    await expect(
      auth.register({ name: 'X', email: 'x@ems.dev', password: 'ab', role: 'student' })
    ).rejects.toThrow(/password/i);
  });

  it('throws when name is missing', async () => {
    const auth = await mkAuth();
    await expect(
      auth.register({ name: '', email: 'x@ems.dev', password: 'pass', role: 'student' })
    ).rejects.toThrow(/name/i);
  });
});

// ── logout ─────────────────────────────────────────────────────────────────────
describe('logout()', () => {
  it('clears the current user from storage', async () => {
    const auth = await mkAuth();
    await auth.login('teacher@ems.dev', 'password');
    expect(auth.getCurrentUser()).not.toBeNull();
    auth.logout();
    expect(auth.getCurrentUser()).toBeNull();
  });

  it('isAuthenticated() returns false after logout', async () => {
    const auth = await mkAuth();
    await auth.login('teacher@ems.dev', 'password');
    auth.logout();
    expect(auth.isAuthenticated()).toBe(false);
  });
});

// ── getCurrentUser / isAuthenticated ──────────────────────────────────────────
describe('getCurrentUser() + isAuthenticated()', () => {
  it('returns null when no session exists', async () => {
    const auth = await mkAuth();
    expect(auth.getCurrentUser()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('returns User after login', async () => {
    const auth = await mkAuth();
    await auth.login('student@ems.dev', 'password');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.getCurrentUser().role).toBe('student');
  });
});

// ── isTeacher / isStudent ──────────────────────────────────────────────────────
describe('isTeacher() + isStudent()', () => {
  it('isTeacher() returns true when logged in as teacher', async () => {
    const auth = await mkAuth();
    await auth.login('teacher@ems.dev', 'password');
    expect(auth.isTeacher()).toBe(true);
    expect(auth.isStudent()).toBe(false);
  });

  it('isStudent() returns true when logged in as student', async () => {
    const auth = await mkAuth();
    await auth.login('student@ems.dev', 'password');
    expect(auth.isStudent()).toBe(true);
    expect(auth.isTeacher()).toBe(false);
  });

  it('both return false when not authenticated', async () => {
    const auth = await mkAuth();
    expect(auth.isTeacher()).toBe(false);
    expect(auth.isStudent()).toBe(false);
  });
});

// ── getUserById (D010) ──────────────────────────────────────────────────────────
describe('getUserById()', () => {
  it('returns the user record for a known seeded user id', async () => {
    const auth = await mkAuth();
    const teacher = await auth.login('teacher@ems.dev', 'password');
    const found = await auth.getUserById(teacher.id);
    expect(found).not.toBeNull();
    expect(found.email).toBe('teacher@ems.dev');
    expect(found.role).toBe('teacher');
  });

  it('returns null for an unknown id', async () => {
    const auth = await mkAuth();
    const result = await auth.getUserById('non-existent-user-id');
    expect(result).toBeNull();
  });

  it('throws when id is missing', async () => {
    const auth = await mkAuth();
    await expect(auth.getUserById('')).rejects.toThrow(/id/i);
  });
});
