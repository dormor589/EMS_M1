/**
 * AuthService tests — Milestone 2.
 *
 * Milestone 1 tested plaintext password comparison against a localStorage mock.
 * That behaviour is gone: the server verifies a bcrypt hash and returns a JWT,
 * so these tests assert the HTTP contract and, above all, that no password ever
 * reaches browser storage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import AuthService from '../AuthService.js';
import config from '../ConfigService.js';
import { makeFakeApi, apiError } from './helpers/fakeApi.js';

const KEYS = config.getStorageKeys();

const TEACHER = {
  id: 'u1', name: 'Alice Teacher', email: 'teacher@ems.dev', role: 'teacher',
};

/** In-memory stand-in for StorageService. */
function makeStorage() {
  const data = new Map();
  return {
    data,
    get: (k) => (data.has(k) ? data.get(k) : null),
    set: vi.fn((k, v) => data.set(k, v)),
    remove: vi.fn((k) => data.delete(k)),
  };
}

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('AuthService', () => {
  let storage;
  beforeEach(() => { storage = makeStorage(); vi.clearAllMocks(); });

  describe('login', () => {
    it('posts the credentials and stores the token and user', async () => {
      const api = makeFakeApi({ 'POST /auth/login': { user: TEACHER, token: 'jwt-abc' } });
      const auth = new AuthService(api, storage, config, logger);

      const user = await auth.login('teacher@ems.dev', 'password');

      expect(api.calls[0]).toEqual({
        method: 'POST', path: '/auth/login',
        body: { email: 'teacher@ems.dev', password: 'password' },
      });
      expect(api.setToken).toHaveBeenCalledWith('jwt-abc');
      expect(storage.get(KEYS.currentUser)).toEqual(TEACHER);
      expect(user.role).toBe('teacher');
    });

    it('NEVER writes a password into storage', async () => {
      const api = makeFakeApi({ 'POST /auth/login': { user: TEACHER, token: 'jwt-abc' } });
      await new AuthService(api, storage, config, logger).login('teacher@ems.dev', 'hunter2');

      const everythingStored = JSON.stringify([...storage.data.values()]);
      expect(everythingStored).not.toContain('hunter2');
      expect(everythingStored).not.toContain('password');
    });

    it('rejects empty credentials without calling the API', async () => {
      const api = makeFakeApi({});
      const auth = new AuthService(api, storage, config, logger);

      await expect(auth.login('', '')).rejects.toThrow(/email and password/i);
      expect(api.calls).toHaveLength(0);
    });

    it('propagates the server’s rejection and stores nothing', async () => {
      const api = makeFakeApi({ 'POST /auth/login': apiError(401, 'Invalid email or password') });
      const auth = new AuthService(api, storage, config, logger);

      await expect(auth.login('nobody@ems.dev', 'wrong')).rejects.toThrow('Invalid email or password');
      expect(storage.get(KEYS.currentUser)).toBeNull();
    });
  });

  describe('register', () => {
    it('validates locally before calling the API', async () => {
      const api = makeFakeApi({});
      const auth = new AuthService(api, storage, config, logger);

      await expect(auth.register({ name: 'A', email: 'bad', password: 'password1', role: 'student' }))
        .rejects.toThrow(/valid email/i);
      await expect(auth.register({ name: 'A', email: 'a@b.co', password: 'short', role: 'student' }))
        .rejects.toThrow(/at least 8/i);
      await expect(auth.register({ name: 'A', email: 'a@b.co', password: 'password1', role: 'admin' }))
        .rejects.toThrow(/invalid role/i);

      expect(api.calls).toHaveLength(0);
    });

    it('signs the new account in on success', async () => {
      const api = makeFakeApi({ 'POST /auth/register': { user: TEACHER, token: 'jwt-new' } });
      const auth = new AuthService(api, storage, config, logger);

      await auth.register({ name: 'Alice', email: 'teacher@ems.dev', password: 'password1', role: 'teacher' });

      expect(api.setToken).toHaveBeenCalledWith('jwt-new');
      expect(auth.isAuthenticated()).toBe(true);
    });
  });

  describe('session', () => {
    it('reads the current user synchronously, as the route guards need', () => {
      const api = makeFakeApi({});
      const auth = new AuthService(api, storage, config, logger);
      storage.set(KEYS.currentUser, TEACHER);

      // Not a promise: ProtectedRoute and NavigationMenu call this during render.
      expect(auth.getCurrentUser().email).toBe('teacher@ems.dev');
      expect(auth.isTeacher()).toBe(true);
      expect(auth.isStudent()).toBe(false);
    });

    it('logout clears both the token and the cached user', () => {
      const api = makeFakeApi({});
      const auth = new AuthService(api, storage, config, logger);
      storage.set(KEYS.currentUser, TEACHER);

      auth.logout();

      expect(api.clearToken).toHaveBeenCalled();
      expect(auth.getCurrentUser()).toBeNull();
    });

    it('clears a corrupt stored user instead of throwing', () => {
      const api = makeFakeApi({});
      const auth = new AuthService(api, storage, config, logger);
      storage.set(KEYS.currentUser, { garbage: true });

      expect(auth.getCurrentUser()).toBeNull();
      expect(storage.remove).toHaveBeenCalledWith(KEYS.currentUser);
    });

    it('clears the session when the API rejects the token', () => {
      const api = makeFakeApi({});
      new AuthService(api, storage, config, logger);
      storage.set(KEYS.currentUser, TEACHER);

      api.onUnauthorized();

      expect(storage.remove).toHaveBeenCalledWith(KEYS.currentUser);
    });

    it('refreshSession does nothing without a token', async () => {
      const api = makeFakeApi({});
      const auth = new AuthService(api, storage, config, logger);

      expect(await auth.refreshSession()).toBeNull();
      expect(api.calls).toHaveLength(0);
    });

    it('refreshSession refreshes the cached user from /auth/me', async () => {
      const api = makeFakeApi({ 'GET /auth/me': { user: { ...TEACHER, name: 'Renamed' } } });
      api.setToken('jwt-abc');
      const auth = new AuthService(api, storage, config, logger);

      const user = await auth.refreshSession();

      expect(user.name).toBe('Renamed');
      expect(storage.get(KEYS.currentUser).name).toBe('Renamed');
    });

    it('keeps a valid session when the API is merely unreachable', async () => {
      const api = makeFakeApi({ 'GET /auth/me': new Error('Cannot reach the server') });
      api.setToken('jwt-abc');
      const auth = new AuthService(api, storage, config, logger);
      storage.set(KEYS.currentUser, TEACHER);

      // A network blip must not log a legitimate user out.
      expect((await auth.refreshSession()).email).toBe('teacher@ems.dev');
    });
  });
});
