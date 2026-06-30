// FOLLO READINESS — pure-logic unit tests for the SLA library.
// These exercise the Phase 2 correctness fixes (pause/resume deadline crediting,
// atomic-score clamping math, status derivation) without a DB or live server, so
// they run in any environment (CI included) unlike the integration suites.
import { describe, it, expect } from '@jest/globals';
import {
  resumeClockData,
  stopClockData,
  scoreDelta,
  clampScore,
  calculateSlaStatus,
  overdueDays,
  SLA_STATUS,
  SLA_SCORE_RULES,
} from '../../lib/sla.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('resumeClockData — credits paused time back to the deadline', () => {
  it('pushes dueDate forward by the paused interval and accumulates paused ms', () => {
    const now = new Date('2026-01-10T12:00:00Z');
    const pausedAt = new Date(now.getTime() - 3 * DAY); // paused 3 days ago
    const due = new Date('2026-01-11T12:00:00Z');
    const task = { slaClockPausedAt: pausedAt, slaTotalPausedMs: 1000, dueDate: due };

    const data = resumeClockData(task, now);

    expect(data.slaClockPausedAt).toBeNull();
    expect(data.slaTotalPausedMs).toBe(1000 + 3 * DAY);
    // deadline extended by exactly the paused duration
    expect(data.dueDate.getTime()).toBe(due.getTime() + 3 * DAY);
  });

  it('does not touch dueDate when there was no real pause', () => {
    const now = new Date('2026-01-10T12:00:00Z');
    const task = { slaClockPausedAt: null, slaTotalPausedMs: 0, dueDate: new Date('2026-01-11T12:00:00Z') };
    const data = resumeClockData(task, now);
    expect(data.dueDate).toBeUndefined();
    expect(data.slaTotalPausedMs).toBe(0);
  });

  it('stopClockData still accumulates remaining pause without moving the deadline', () => {
    const now = new Date('2026-01-10T12:00:00Z');
    const pausedAt = new Date(now.getTime() - 2 * HOUR);
    const data = stopClockData({ slaClockPausedAt: pausedAt, slaTotalPausedMs: 0 }, now);
    expect(data.slaTotalPausedMs).toBe(2 * HOUR);
    expect(data.dueDate).toBeUndefined();
  });
});

describe('scoreDelta / clampScore — atomic-score math', () => {
  it('breach scales with overdue days', () => {
    expect(scoreDelta('BREACH_PER_DAY', { days: 3 })).toBe(SLA_SCORE_RULES.BREACH_PER_DAY * 3);
  });
  it('clamps to [MIN, MAX] (absorbing bounds for increment overshoot)', () => {
    expect(clampScore(130)).toBe(SLA_SCORE_RULES.MAX_SCORE);
    expect(clampScore(-40)).toBe(SLA_SCORE_RULES.MIN_SCORE);
    expect(clampScore(72)).toBe(72);
  });
});

describe('calculateSlaStatus / overdueDays', () => {
  it('reports BREACHED past due and AT_RISK within 24h', () => {
    const now = Date.now();
    expect(calculateSlaStatus({ dueDate: new Date(now - DAY) })).toBe(SLA_STATUS.BREACHED);
    expect(calculateSlaStatus({ dueDate: new Date(now + 2 * HOUR) })).toBe(SLA_STATUS.AT_RISK);
    expect(calculateSlaStatus({ dueDate: new Date(now + 5 * DAY) })).toBe(SLA_STATUS.HEALTHY);
  });
  it('keeps terminal + paused states sticky', () => {
    expect(calculateSlaStatus({ dueDate: new Date(), slaStatus: SLA_STATUS.RESOLVED_LATE })).toBe(SLA_STATUS.RESOLVED_LATE);
    expect(calculateSlaStatus({ dueDate: new Date(), slaStatus: SLA_STATUS.BLOCKED })).toBe(SLA_STATUS.BLOCKED);
  });
  it('overdueDays rounds up and is zero before the deadline', () => {
    const now = new Date('2026-01-10T12:00:00Z');
    expect(overdueDays({ dueDate: new Date(now.getTime() - 25 * HOUR) }, now)).toBe(2);
    expect(overdueDays({ dueDate: new Date(now.getTime() + HOUR) }, now)).toBe(0);
  });
});
