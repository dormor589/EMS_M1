/**
 * NotifyService unit tests.
 *
 * Verifies subscriber receives notifications, unsubscribe stops delivery,
 * and all three notification types carry correct shape.
 *
 * Source: the milestone brief §8 — NotifyService
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import notify from '../NotifyService.js';

beforeEach(() => {
  // Reset the singleton's listener set between tests.
  // We unsubscribe any listeners by replacing the internal set.
  // Easiest approach: subscribe then immediately unsubscribe all in each test.
  // (The singleton is shared — we track unsubs ourselves.)
});

describe('NotifyService', () => {
  // ── subscribe / emit ────────────────────────────────────────────────────────
  describe('subscribe() + success/error/warning', () => {
    it('subscriber receives a notification when success() is called', () => {
      const listener = vi.fn();
      const unsub = notify.subscribe(listener);

      notify.success('Exam created');

      expect(listener).toHaveBeenCalledOnce();
      unsub();
    });

    it('notification has type "success" for success()', () => {
      const listener = vi.fn();
      const unsub = notify.subscribe(listener);

      notify.success('OK');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', message: 'OK' })
      );
      unsub();
    });

    it('notification has type "error" for error()', () => {
      const listener = vi.fn();
      const unsub = notify.subscribe(listener);

      notify.error('Something went wrong');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', message: 'Something went wrong' })
      );
      unsub();
    });

    it('notification has type "warning" for warning()', () => {
      const listener = vi.fn();
      const unsub = notify.subscribe(listener);

      notify.warning('Low storage');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning', message: 'Low storage' })
      );
      unsub();
    });
  });

  // ── notification shape ──────────────────────────────────────────────────────
  describe('notification object shape', () => {
    it('notification includes id, timestamp, type, and message fields', () => {
      const listener = vi.fn();
      const unsub = notify.subscribe(listener);

      notify.success('Shape test');

      const notif = listener.mock.calls[0][0];
      expect(notif).toHaveProperty('id');
      expect(notif).toHaveProperty('timestamp');
      expect(notif).toHaveProperty('type');
      expect(notif).toHaveProperty('message');
      unsub();
    });

    it('each notification has a unique id', () => {
      const received = [];
      const unsub = notify.subscribe((n) => received.push(n));

      notify.success('First');
      notify.success('Second');

      expect(received[0].id).not.toBe(received[1].id);
      unsub();
    });

    it('timestamp is a recent Unix epoch millisecond number', () => {
      const before = Date.now();
      const listener = vi.fn();
      const unsub = notify.subscribe(listener);

      notify.success('ts test');

      const after = Date.now();
      const { timestamp } = listener.mock.calls[0][0];
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
      unsub();
    });
  });

  // ── unsubscribe ─────────────────────────────────────────────────────────────
  describe('unsubscribe', () => {
    it('returned unsubscribe fn stops further notifications', () => {
      const listener = vi.fn();
      const unsub = notify.subscribe(listener);

      notify.success('Before unsub');
      unsub();
      notify.success('After unsub');

      expect(listener).toHaveBeenCalledOnce();
    });

    it('unsubscribing is idempotent — calling twice does not throw', () => {
      const listener = vi.fn();
      const unsub = notify.subscribe(listener);
      unsub();
      expect(() => unsub()).not.toThrow();
    });
  });

  // ── multiple subscribers ────────────────────────────────────────────────────
  describe('multiple subscribers', () => {
    it('all active subscribers receive the same notification', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      const unsub1 = notify.subscribe(l1);
      const unsub2 = notify.subscribe(l2);

      notify.error('broadcast');

      expect(l1).toHaveBeenCalledOnce();
      expect(l2).toHaveBeenCalledOnce();
      unsub1();
      unsub2();
    });
  });
});
