/**
 * LoggerService unit tests.
 *
 * Verifies level filtering, console delegation, and setLevel validation.
 * console.* is spied on; no real output should reach the test runner.
 *
 * Source: docs/spec_brief.txt §8 — LoggerService
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import the class constructor indirectly so we can create isolated instances.
// We re-import the module fresh to get a clean singleton state.
import loggerSingleton from '../LoggerService.js';

describe('LoggerService', () => {
  let infoSpy, warnSpy, errorSpy, debugSpy;

  beforeEach(() => {
    // Spy on console methods to prevent output noise and to assert calls.
    infoSpy  = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy  = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    // Reset to default level before each test.
    loggerSingleton.setLevel('info');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── info ────────────────────────────────────────────────────────────────────
  describe('info()', () => {
    it('calls console.info when level is "info"', () => {
      loggerSingleton.info('hello');
      expect(infoSpy).toHaveBeenCalledOnce();
    });

    it('message contains the provided string', () => {
      loggerSingleton.info('test message');
      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('test message'));
    });

    it('is suppressed when level is set to "warn"', () => {
      loggerSingleton.setLevel('warn');
      loggerSingleton.info('should be dropped');
      expect(infoSpy).not.toHaveBeenCalled();
    });
  });

  // ── warn ────────────────────────────────────────────────────────────────────
  describe('warn()', () => {
    it('calls console.warn when level is "info"', () => {
      loggerSingleton.warn('a warning');
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it('is suppressed when level is set to "error"', () => {
      loggerSingleton.setLevel('error');
      loggerSingleton.warn('dropped');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('passes additional args through to console.warn', () => {
      loggerSingleton.warn('count: %d', 42);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('count: %d'), 42);
    });
  });

  // ── error ───────────────────────────────────────────────────────────────────
  describe('error()', () => {
    it('calls console.error when level is "info"', () => {
      loggerSingleton.error('an error');
      expect(errorSpy).toHaveBeenCalledOnce();
    });

    it('is still emitted when level is "error"', () => {
      loggerSingleton.setLevel('error');
      loggerSingleton.error('still emitted');
      expect(errorSpy).toHaveBeenCalledOnce();
    });
  });

  // ── debug ───────────────────────────────────────────────────────────────────
  describe('debug()', () => {
    it('is suppressed at default level "info"', () => {
      loggerSingleton.debug('debug msg');
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('is emitted when level is set to "debug"', () => {
      loggerSingleton.setLevel('debug');
      loggerSingleton.debug('debug msg');
      expect(debugSpy).toHaveBeenCalledOnce();
    });
  });

  // ── setLevel / getLevel ─────────────────────────────────────────────────────
  describe('setLevel() / getLevel()', () => {
    it('getLevel() returns "info" by default', () => {
      expect(loggerSingleton.getLevel()).toBe('info');
    });

    it('setLevel changes the active level', () => {
      loggerSingleton.setLevel('warn');
      expect(loggerSingleton.getLevel()).toBe('warn');
    });

    it('setLevel throws on an unknown level string', () => {
      expect(() => loggerSingleton.setLevel('verbose')).toThrow();
    });
  });
});
