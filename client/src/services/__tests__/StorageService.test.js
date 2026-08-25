/**
 * StorageService unit tests.
 *
 * Vitest runs in jsdom, which provides a real localStorage implementation.
 * localStorage is cleared before each test to ensure isolation.
 *
 * Source: the milestone brief §8 — StorageService
 */
import { describe, it, expect, beforeEach } from 'vitest';
import storage from '../StorageService.js';

beforeEach(() => {
  localStorage.clear();
});

describe('StorageService', () => {
  // ── set / get round-trip ────────────────────────────────────────────────────
  describe('set() + get() round-trip', () => {
    it('stores and retrieves a plain string value', () => {
      storage.set('ems_test', 'hello');
      expect(storage.get('ems_test')).toBe('hello');
    });

    it('stores and retrieves an object value', () => {
      const obj = { id: 1, name: 'Alice', role: 'teacher' };
      storage.set('ems_test_obj', obj);
      expect(storage.get('ems_test_obj')).toEqual(obj);
    });

    it('stores and retrieves an array value', () => {
      const arr = [1, 2, 3];
      storage.set('ems_arr', arr);
      expect(storage.get('ems_arr')).toEqual(arr);
    });

    it('stores and retrieves null explicitly', () => {
      storage.set('ems_null', null);
      // JSON.stringify(null) === 'null', JSON.parse('null') === null
      expect(storage.get('ems_null')).toBeNull();
    });
  });

  // ── get edge cases ──────────────────────────────────────────────────────────
  describe('get() edge cases', () => {
    it('returns null for a missing key', () => {
      expect(storage.get('ems_nonexistent')).toBeNull();
    });

    it('returns null and does not throw on malformed JSON', () => {
      // Inject malformed JSON directly to simulate corrupt storage.
      localStorage.setItem('ems_bad', '{not valid json}');
      expect(() => storage.get('ems_bad')).not.toThrow();
      expect(storage.get('ems_bad')).toBeNull();
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────
  describe('remove()', () => {
    it('deletes an existing key', () => {
      storage.set('ems_remove_me', 42);
      storage.remove('ems_remove_me');
      expect(storage.get('ems_remove_me')).toBeNull();
    });

    it('does not throw when removing a non-existent key', () => {
      expect(() => storage.remove('ems_no_such_key')).not.toThrow();
    });
  });

  // ── has ─────────────────────────────────────────────────────────────────────
  describe('has()', () => {
    it('returns true for a key that has been set', () => {
      storage.set('ems_check', 'value');
      expect(storage.has('ems_check')).toBe(true);
    });

    it('returns false for a key that has not been set', () => {
      expect(storage.has('ems_not_set')).toBe(false);
    });

    it('returns false after the key is removed', () => {
      storage.set('ems_temp', 'x');
      storage.remove('ems_temp');
      expect(storage.has('ems_temp')).toBe(false);
    });
  });

  // ── clear ───────────────────────────────────────────────────────────────────
  describe('clear()', () => {
    it('removes all ems_ prefixed keys', () => {
      storage.set('ems_users', []);
      storage.set('ems_exams', []);
      storage.clear();
      expect(storage.has('ems_users')).toBe(false);
      expect(storage.has('ems_exams')).toBe(false);
    });

    it('does NOT remove non-ems_ keys', () => {
      localStorage.setItem('other_app_key', 'keep me');
      storage.set('ems_data', 'remove me');
      storage.clear();
      expect(localStorage.getItem('other_app_key')).toBe('keep me');
    });

    it('is safe to call on an empty store', () => {
      expect(() => storage.clear()).not.toThrow();
    });
  });
});
