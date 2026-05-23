/**
 * ConfigService unit tests.
 *
 * Verifies that every getter returns the correct type, shape, and values
 * declared in the spec.
 *
 * Source: docs/spec_brief.txt §8 — ConfigService
 */
import { describe, it, expect } from 'vitest';
import config from '../ConfigService.js';

describe('ConfigService', () => {
  // ── getApiMode ──────────────────────────────────────────────────────────────
  describe('getApiMode()', () => {
    it('returns "mock" in M1', () => {
      expect(config.getApiMode()).toBe('mock');
    });

    it('returns a string', () => {
      expect(typeof config.getApiMode()).toBe('string');
    });
  });

  // ── getStorageKeys ──────────────────────────────────────────────────────────
  describe('getStorageKeys()', () => {
    it('returns an object with the four required keys', () => {
      const keys = config.getStorageKeys();
      expect(keys).toHaveProperty('users');
      expect(keys).toHaveProperty('exams');
      expect(keys).toHaveProperty('submissions');
      expect(keys).toHaveProperty('currentUser');
    });

    it('all key values are prefixed "ems_"', () => {
      const keys = config.getStorageKeys();
      Object.values(keys).forEach((v) => {
        expect(v).toMatch(/^ems_/);
      });
    });

    it('returns exact expected key strings', () => {
      expect(config.getStorageKeys()).toEqual({
        users: 'ems_users',
        exams: 'ems_exams',
        submissions: 'ems_submissions',
        currentUser: 'ems_current_user',
      });
    });
  });

  // ── getDefaultExamStatus ────────────────────────────────────────────────────
  describe('getDefaultExamStatus()', () => {
    it('returns "Draft"', () => {
      expect(config.getDefaultExamStatus()).toBe('Draft');
    });

    it('is one of the valid exam status options', () => {
      expect(config.getExamStatusOptions()).toContain(config.getDefaultExamStatus());
    });
  });

  // ── getExamStatusOptions ────────────────────────────────────────────────────
  describe('getExamStatusOptions()', () => {
    it('returns an array of three statuses', () => {
      expect(config.getExamStatusOptions()).toHaveLength(3);
    });

    it('contains Draft, Published, and Closed', () => {
      const opts = config.getExamStatusOptions();
      expect(opts).toContain('Draft');
      expect(opts).toContain('Published');
      expect(opts).toContain('Closed');
    });

    it('preserves state-machine order: Draft → Published → Closed', () => {
      const opts = config.getExamStatusOptions();
      expect(opts[0]).toBe('Draft');
      expect(opts[1]).toBe('Published');
      expect(opts[2]).toBe('Closed');
    });
  });

  // ── getRoles ────────────────────────────────────────────────────────────────
  describe('getRoles()', () => {
    it('returns an array containing "teacher" and "student"', () => {
      const roles = config.getRoles();
      expect(roles).toContain('teacher');
      expect(roles).toContain('student');
    });

    it('returns exactly two roles in M1', () => {
      expect(config.getRoles()).toHaveLength(2);
    });
  });

  // ── getQuestionTypes ────────────────────────────────────────────────────────
  describe('getQuestionTypes()', () => {
    it('returns an array containing "multiple-choice" and "open-text"', () => {
      const types = config.getQuestionTypes();
      expect(types).toContain('multiple-choice');
      expect(types).toContain('open-text');
    });

    it('returns exactly two types in M1', () => {
      expect(config.getQuestionTypes()).toHaveLength(2);
    });
  });
});
