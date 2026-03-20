// FOLLO HEALTH
import { calcCompletionPct } from './completionCalc.js';

/** Time elapsed % for a project (0–100). */
export function calcTimeElapsed(project) {
  if (!project.startDate || !project.endDate) return 0;
  const start = new Date(project.startDate);
  const end   = new Date(project.endDate);
  const now   = new Date();
  if (now <= start) return 0;
  if (now >= end)   return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

/** Project completion % using hybrid weighting. */
export function calcWorkDone(project) {
  return calcCompletionPct(project.tasks ?? []);
}

/**
 * Estimate project finish date based on current velocity.
 * velocity = workDone% / timeElapsed%
 * projectedFinish = startDate + totalDays / velocity
 */
export function calcProjectedFinish(project) {
  if (!project.startDate || !project.endDate) return null;
  const start     = new Date(project.startDate);
  const now       = new Date();
  const elapsedMs = now - start;
  if (elapsedMs <= 0) return null;
  const workDone  = calcWorkDone(project);
  if (workDone === 0) return null;
  const projectedTotalMs = (elapsedMs / workDone) * 100;
  return new Date(start.getTime() + projectedTotalMs);
}

/** Days difference between projected finish and deadline (negative = ahead, positive = behind). */
export function calcScheduleVariance(project) {
  const projected = calcProjectedFinish(project);
  if (!projected || !project.endDate) return null;
  return Math.round((projected - new Date(project.endDate)) / 86400000);
}

/** Count tasks by status/condition for signal indicators. */
export function calcTaskSignals(project) {
  const tasks = project.tasks ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    total:           tasks.length,
    active:          tasks.filter(t => t.status === 'IN_PROGRESS').length,
    done:            tasks.filter(t => t.status === 'DONE').length,
    todo:            tasks.filter(t => t.status === 'TODO').length,
    overdue:         tasks.filter(t => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < today).length,
    blocked:         tasks.filter(t => t.slaStatus === 'BLOCKED').length,
    extensions:      tasks.filter(t => t.extensionStatus === 'PENDING').length,
    pendingApproval: tasks.filter(t => t.slaStatus === 'PENDING_APPROVAL').length,
  };
}

/** RAG score: 'green' | 'amber' | 'red' | 'grey' */
export function calcRAGScore(project) {
  const tasks   = project.tasks ?? [];
  if (tasks.length === 0 || !project.startDate || !project.endDate) return 'grey';

  const signals  = calcTaskSignals(project);
  const timePct  = calcTimeElapsed(project);
  const workPct  = calcWorkDone(project);
  const variance = calcScheduleVariance(project);
  const gap      = timePct - workPct; // positive = behind

  if (
    signals.overdue >= 3 ||
    signals.blocked >= 2 ||
    (variance !== null && variance > 7) ||
    gap > 20
  ) return 'red';

  if (
    signals.overdue >= 1 ||
    signals.blocked >= 1 ||
    signals.extensions >= 1 ||
    (variance !== null && variance > 0 && variance <= 7) ||
    (gap > 5 && gap <= 20)
  ) return 'amber';

  return 'green';
}

/** Full health object — single source of truth for the health card. */
export function getProjectHealth(project) {
  const signals  = calcTaskSignals(project);
  const timePct  = calcTimeElapsed(project);
  const workPct  = calcWorkDone(project);
  const rag      = calcRAGScore(project);
  const projected = calcProjectedFinish(project);
  const variance = calcScheduleVariance(project);

  const ragLabel = { green: 'On track', amber: 'At risk', red: 'Critical', grey: 'No data' }[rag];
  const ragColor = { green: '#16a34a', amber: '#d97706', red: '#dc2626', grey: '#a1a1aa' }[rag];

  let finishLabel = null;
  let finishSub   = null;

  if (projected && project.endDate) {
    const diffDays = Math.round((projected - new Date(project.endDate)) / 86400000);
    finishLabel = projected.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (diffDays < -1)      finishSub = `${Math.abs(diffDays)} days ahead`;
    else if (diffDays > 1)  finishSub = `${diffDays} days behind schedule`;
    else                    finishSub = 'On schedule';
  } else if (signals.total === 0) {
    finishLabel = 'No tasks yet';
    finishSub   = null;
  } else {
    finishLabel = 'Insufficient data';
    finishSub   = 'Add start / end dates to project';
  }

  return { rag, ragLabel, ragColor, timePct, workPct, signals, projected, variance, finishLabel, finishSub };
}
