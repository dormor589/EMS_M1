/**
 * MockApiService unit tests.
 *
 * Uses real StorageService + jsdom localStorage (cleared between tests).
 * Creates a fresh MockApiService instance per suite to avoid singleton bleed.
 *
 * Source: the milestone brief §8 — MockApiService
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import MockApiService from '../MockApiService.js';
import storage from '../StorageService.js';
import config  from '../ConfigService.js';
import logger  from '../LoggerService.js';

// Silence logger output during tests
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Helper: fresh MockApiService instance (deps are stateless singletons). */
function mkApi() {
  return new MockApiService(storage, config, logger);
}

// ── Constructor guard ──────────────────────────────────────────────────────────
describe('MockApiService constructor', () => {
  it('throws when storage is missing', () => {
    expect(() => new MockApiService(null, config, logger)).toThrow(/storage/);
  });

  it('throws when config is missing', () => {
    expect(() => new MockApiService(storage, null, logger)).toThrow(/config/);
  });

  it('throws when logger is missing', () => {
    expect(() => new MockApiService(storage, config, null)).toThrow(/logger/);
  });

  it('throws on unknown collection name', async () => {
    const api = mkApi();
    await expect(api.get('badcollection')).rejects.toThrow(/unknown collection/i);
  });
});

// ── seedIfEmpty ────────────────────────────────────────────────────────────────
describe('seedIfEmpty()', () => {
  it('seeds all three collections when storage is empty', async () => {
    const api = mkApi();
    await api.seedIfEmpty();

    const users = await api.get('users');
    const exams = await api.get('exams');
    const subs  = await api.get('submissions');

    expect(users.length).toBeGreaterThan(0);
    expect(exams.length).toBeGreaterThan(0);
    expect(Array.isArray(subs)).toBe(true);
  });

  it('seeds one teacher and one student', async () => {
    const api = mkApi();
    await api.seedIfEmpty();
    const users = await api.get('users');
    const roles = users.map((u) => u.role);
    expect(roles).toContain('teacher');
    expect(roles).toContain('student');
  });

  it('does NOT re-seed when storage already has users', async () => {
    const api = mkApi();
    await api.seedIfEmpty();
    // Add a sentinel record manually
    await api.post('users', { id: 'sentinel', name: 'Sentinel', email: 'x@x.com', password: 'x', role: 'student' });
    const countAfterFirst = (await api.get('users')).length;

    // Second seedIfEmpty should be a no-op
    await api.seedIfEmpty();
    const countAfterSecond = (await api.get('users')).length;
    expect(countAfterSecond).toBe(countAfterFirst);
  });
});

// ── get / getById ──────────────────────────────────────────────────────────────
describe('get() and getById()', () => {
  it('returns empty array when collection is empty', async () => {
    const api = mkApi();
    expect(await api.get('submissions')).toEqual([]);
  });

  it('getById returns the matching record', async () => {
    const api = mkApi();
    await api.seedIfEmpty();
    const [first] = await api.get('users');
    const found = await api.getById('users', first.id);
    expect(found).toEqual(first);
  });

  it('getById returns null for a missing id', async () => {
    const api = mkApi();
    expect(await api.getById('users', 'nonexistent')).toBeNull();
  });
});

// ── post ───────────────────────────────────────────────────────────────────────
describe('post()', () => {
  it('appends a record and returns it with an id', async () => {
    const api = mkApi();
    const result = await api.post('submissions', { examId: 'e1', studentId: 'u1' });
    expect(result.id).toBeTruthy();
    expect(result.examId).toBe('e1');
  });

  it('post + get round-trip for each collection', async () => {
    const api = mkApi();
    await api.post('users',       { name: 'U', email: 'u@u.com', password: 'p', role: 'student' });
    await api.post('exams',       { title: 'E', createdBy: 'u1' });
    await api.post('submissions', { examId: 'e1', studentId: 'u1' });

    expect(await api.get('users')).toHaveLength(1);
    expect(await api.get('exams')).toHaveLength(1);
    expect(await api.get('submissions')).toHaveLength(1);
  });

  it('preserves a provided id instead of generating one', async () => {
    const api = mkApi();
    const r = await api.post('submissions', { id: 'fixed', examId: 'e1', studentId: 'u1' });
    expect(r.id).toBe('fixed');
  });
});

// ── put ────────────────────────────────────────────────────────────────────────
describe('put()', () => {
  it('updates an existing record', async () => {
    const api = mkApi();
    const posted = await api.post('submissions', { examId: 'e1', studentId: 'u1', grade: null });
    const updated = await api.put('submissions', posted.id, { ...posted, grade: 90 });
    expect(updated.grade).toBe(90);
    // Verify persisted
    const found = await api.getById('submissions', posted.id);
    expect(found.grade).toBe(90);
  });

  it('throws when id argument is missing', async () => {
    const api = mkApi();
    await expect(api.put('users', undefined, {})).rejects.toThrow(/"id" is required/);
  });

  it('throws when record id does not exist', async () => {
    const api = mkApi();
    await expect(api.put('users', 'ghost', {})).rejects.toThrow(/not found/);
  });
});

// ── delete ─────────────────────────────────────────────────────────────────────
describe('delete()', () => {
  it('removes a record by id', async () => {
    const api = mkApi();
    const r = await api.post('submissions', { examId: 'e1', studentId: 'u1' });
    await api.delete('submissions', r.id);
    expect(await api.getById('submissions', r.id)).toBeNull();
  });

  it('throws when record does not exist', async () => {
    const api = mkApi();
    await expect(api.delete('users', 'ghost')).rejects.toThrow(/not found/);
  });
});

// ── clear ──────────────────────────────────────────────────────────────────────
describe('clear()', () => {
  it('wipes a single collection', async () => {
    const api = mkApi();
    await api.post('submissions', { examId: 'e1', studentId: 'u1' });
    await api.clear('submissions');
    expect(await api.get('submissions')).toEqual([]);
  });

  it('does NOT touch other collections when clearing one', async () => {
    const api = mkApi();
    await api.seedIfEmpty();
    const usersBefore = (await api.get('users')).length;
    await api.clear('submissions');
    expect((await api.get('users')).length).toBe(usersBefore);
  });
});
