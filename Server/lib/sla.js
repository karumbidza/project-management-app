// FOLLO SLA
/**
 * SLA State Machine — status calculation, clock management, and contractor scoring.
 * This module is pure logic — it does NOT import prisma or perform DB writes directly.
 * The caller (controller / Inngest job) is responsible for persisting results.
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLA STATUS CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const SLA_STATUS = Object.freeze({
  HEALTHY: 'HEALTHY',
  AT_RISK: 'AT_RISK',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  BLOCKED: 'BLOCKED',
  BREACHED: 'BREACHED',
  RESOLVED_ON_TIME: 'RESOLVED_ON_TIME',
  RESOLVED_LATE: 'RESOLVED_LATE',
});

export const SLA_EVENT_TYPE = Object.freeze({
  CLOCK_STARTED: 'CLOCK_STARTED',
  CLOCK_PAUSED: 'CLOCK_PAUSED',
  CLOCK_RESUMED: 'CLOCK_RESUMED',
  WARNING_24HR: 'WARNING_24HR',
  WARNING_2HR: 'WARNING_2HR',
  BREACHED: 'BREACHED',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  BLOCKER_RAISED: 'BLOCKER_RAISED',
  BLOCKER_RESOLVED: 'BLOCKER_RESOLVED',
  SCORE_UPDATED: 'SCORE_UPDATED',
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLA CLOCK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Calculate net elapsed time on the SLA clock (excludes paused intervals).
 * Net elapsed = (now - clockStart) - totalPausedMs - currentPauseDuration
 * @param {Object} task — must include slaClockStartedAt, slaTotalPausedMs, slaClockPausedAt
 * @returns {number} milliseconds of net working time
 */
export function calculateNetElapsedMs(task) {
  if (!task.slaClockStartedAt) return 0;
  const now = Date.now();
  const totalElapsed = now - new Date(task.slaClockStartedAt).getTime();
  const paused = task.slaTotalPausedMs || 0;
  const currentPause = task.slaClockPausedAt
    ? now - new Date(task.slaClockPausedAt).getTime()
    : 0;
  return Math.max(0, totalElapsed - paused - currentPause);
}

/**
 * Derive current SLA status from task fields.
 * Terminal states (RESOLVED_*) are sticky — once set they never change.
 * PENDING_APPROVAL and BLOCKED are also sticky while clock is paused.
 * @param {Object} task
 * @returns {string} SLA_STATUS value
 */
export function calculateSlaStatus(task) {
  if (!task.dueDate) return SLA_STATUS.HEALTHY;

  const due = new Date(task.dueDate);
  const now = new Date();

  // Terminal — never revert
  if (task.slaStatus === SLA_STATUS.RESOLVED_ON_TIME ||
      task.slaStatus === SLA_STATUS.RESOLVED_LATE) {
    return task.slaStatus;
  }

  // Clock-paused states — stay until explicitly changed by controller
  if (task.slaStatus === SLA_STATUS.PENDING_APPROVAL) return SLA_STATUS.PENDING_APPROVAL;
  if (task.slaStatus === SLA_STATUS.BLOCKED) return SLA_STATUS.BLOCKED;

  // Dynamic evaluation
  if (now > due) return SLA_STATUS.BREACHED;
  if (due - now < 24 * 60 * 60 * 1000) return SLA_STATUS.AT_RISK;
  return SLA_STATUS.HEALTHY;
}

/**
 * Build the data payload to PAUSE the SLA clock.
 * Returns Prisma-ready data object (does not perform the write).
 */
export function pauseClockData(now = new Date()) {
  return {
    slaClockPausedAt: now,
  };
}

/**
 * Build the data payload to RESUME the SLA clock.
 * Accumulates the paused interval into slaTotalPausedMs.
 * @param {Object} task — current task with slaClockPausedAt, slaTotalPausedMs
 * @param {Date}   now
 * @returns {Object} Prisma-ready update data
 */
export function resumeClockData(task, now = new Date()) {
  const pausedSince = task.slaClockPausedAt
    ? new Date(task.slaClockPausedAt).getTime()
    : now.getTime();
  const pausedMs = now.getTime() - pausedSince;

  return {
    slaClockPausedAt: null,
    slaTotalPausedMs: (task.slaTotalPausedMs || 0) + Math.max(0, pausedMs),
  };
}

/**
 * Build the data payload to STOP the SLA clock (task approved / resolved).
 * Clears the paused-at marker and accumulates any remaining pause.
 */
export function stopClockData(task, now = new Date()) {
  const extra = task.slaClockPausedAt
    ? now.getTime() - new Date(task.slaClockPausedAt).getTime()
    : 0;

  return {
    slaClockPausedAt: null,
    slaTotalPausedMs: (task.slaTotalPausedMs || 0) + Math.max(0, extra),
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCORING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const SLA_SCORE_RULES = Object.freeze({
  ON_TIME_APPROVAL:   +5,   // approved before or on dueDate
  EARLY_COMPLETION:   +3,   // approved > 24hrs before dueDate
  BREACH_PER_DAY:    -10,   // per day past dueDate (their fault)
  REJECTION:          -5,   // PM rejected their submission
  RESUBMIT_RECOVERY:  +2,   // submitted again after rejection
  BLOCKED_EXEMPT:      0,   // blocked = no penalty regardless
  MAX_SCORE:         100,
  MIN_SCORE:           0,
});

/**
 * Calculate the score delta for a given event.
 * @param {string} eventType — key from SLA_SCORE_RULES or custom
 * @param {Object} metadata — e.g. { overdueDays }
 * @returns {number} score change (positive or negative)
 */
export function scoreDelta(eventType, metadata = {}) {
  switch (eventType) {
    case 'ON_TIME_APPROVAL':
      return SLA_SCORE_RULES.ON_TIME_APPROVAL;
    case 'EARLY_COMPLETION':
      return SLA_SCORE_RULES.EARLY_COMPLETION;
    case 'BREACH_PER_DAY':
      return SLA_SCORE_RULES.BREACH_PER_DAY * (metadata.days || 1);
    case 'REJECTION':
      return SLA_SCORE_RULES.REJECTION;
    case 'RESUBMIT_RECOVERY':
      return SLA_SCORE_RULES.RESUBMIT_RECOVERY;
    case 'BLOCKED_EXEMPT':
      return SLA_SCORE_RULES.BLOCKED_EXEMPT;
    default:
      return 0;
  }
}

/**
 * Clamp a score between MIN and MAX.
 */
export function clampScore(value) {
  return Math.max(SLA_SCORE_RULES.MIN_SCORE, Math.min(SLA_SCORE_RULES.MAX_SCORE, value));
}

/**
 * Update (or upsert) a contractor's score.
 * Performs the DB write + logs an SlaEvent.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} userId
 * @param {string} taskId — for the SlaEvent log
 * @param {string} eventType — scoring event key
 * @param {Object} metadata — passed through to SlaEvent
 * @returns {Promise<Object>} updated ContractorScore record
 */
export async function updateContractorScore(prisma, userId, taskId, eventType, metadata = {}) {
  const delta = scoreDelta(eventType, metadata);

  // Upsert: create if first time, otherwise increment
  const existing = await prisma.contractorScore.findUnique({ where: { userId } });

  const newScore = clampScore((existing?.score ?? 100) + delta);

  const incrementFields = {};
  if (eventType === 'ON_TIME_APPROVAL' || eventType === 'EARLY_COMPLETION') {
    incrementFields.onTime = { increment: 1 };
  }
  if (eventType === 'BREACH_PER_DAY') {
    incrementFields.breaches = { increment: 1 };
  }
  if (eventType === 'REJECTION') {
    incrementFields.rejections = { increment: 1 };
  }
  if (eventType === 'BLOCKED_EXEMPT') {
    incrementFields.blocked = { increment: 1 };
  }

  const scoreRecord = await prisma.contractorScore.upsert({
    where: { userId },
    create: {
      userId,
      score: clampScore(100 + delta),
      onTime: (eventType === 'ON_TIME_APPROVAL' || eventType === 'EARLY_COMPLETION') ? 1 : 0,
      breaches: eventType === 'BREACH_PER_DAY' ? 1 : 0,
      rejections: eventType === 'REJECTION' ? 1 : 0,
      blocked: eventType === 'BLOCKED_EXEMPT' ? 1 : 0,
    },
    update: {
      score: newScore,
      ...incrementFields,
    },
  });

  // Immutable audit log
  await prisma.slaEvent.create({
    data: {
      taskId,
      type: SLA_EVENT_TYPE.SCORE_UPDATED,
      triggeredBy: 'SYSTEM',
      metadata: { eventType, delta, newScore: scoreRecord.score, ...metadata },
    },
  });

  return scoreRecord;
}

/**
 * Helper: log an SLA event (thin wrapper for consistency).
 */
export async function logSlaEvent(prisma, { taskId, type, triggeredBy, metadata }) {
  return prisma.slaEvent.create({
    data: {
      taskId,
      type,
      triggeredBy: triggeredBy || 'SYSTEM',
      metadata: metadata || undefined,
    },
  });
}

/**
 * Determine whether a task was completed on time.
 * Compares approval moment against dueDate.
 */
export function isOnTime(task, approvedAt = new Date()) {
  if (!task.dueDate) return true;
  return approvedAt <= new Date(task.dueDate);
}

/**
 * Determine whether a task was completed early (> 24hrs before due).
 */
export function isEarlyCompletion(task, approvedAt = new Date()) {
  if (!task.dueDate) return false;
  const due = new Date(task.dueDate);
  return (due - approvedAt) > 24 * 60 * 60 * 1000;
}

/**
 * Calculate overdue days (whole days past dueDate).
 */
export function overdueDays(task, now = new Date()) {
  if (!task.dueDate) return 0;
  const due = new Date(task.dueDate);
  if (now <= due) return 0;
  return Math.ceil((now - due) / (24 * 60 * 60 * 1000));
}
