// FOLLO PROJECT-OVERVIEW
// FOLLO GANTT-FINAL
import { useMemo } from 'react';
import { calcCompletionPct } from '../lib/completionCalc';

export function useProjectStats(project, tasks = []) {
  return useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const total      = tasks.length;
    const done       = tasks.filter(t => t.status === 'DONE').length;
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const todo       = tasks.filter(t => t.status === 'TODO').length;
    const pendingApproval = tasks.filter(t => t.status === 'PENDING_APPROVAL').length;
    const overdue    = tasks.filter(t => {
      const due = t.dueDate ? new Date(t.dueDate) : null;
      return t.status !== 'DONE' && due && due < today;
    }).length;
    const blocked = tasks.filter(t =>
      t.slaStatus === 'BLOCKED' || t.status === 'BLOCKED'
    ).length;
    const pending = tasks.filter(t =>
      t.slaStatus === 'PENDING_APPROVAL'
    ).length;

    // Hybrid completion: manual weight > duration > equal (FOLLO GANTT-FINAL)
    let completionPct = calcCompletionPct(tasks);
    completionPct = Math.min(100, Math.max(0, completionPct));

    // Timeline
    const startDate = project?.startDate ? new Date(project.startDate) : null;
    const endDate = (project?.endDate || project?.dueDate)
      ? new Date(project?.endDate || project?.dueDate) : null;

    let totalDays      = null;
    let elapsedDays    = null;
    let remainingDays  = null;
    let timeElapsedPct = null;
    let isOnTrack      = true;
    let projectedDelay = 0;
    let projectedEndDate = null;

    if (startDate && endDate) {
      totalDays      = Math.max(1, Math.ceil((endDate - startDate) / 86400000));
      elapsedDays    = Math.max(0, Math.ceil((today - startDate) / 86400000));
      remainingDays  = Math.max(0, Math.ceil((endDate - today) / 86400000));
      timeElapsedPct = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

      isOnTrack = completionPct >= timeElapsedPct;

      if (!isOnTrack && completionPct > 0 && elapsedDays > 0) {
        const pctPerDay  = completionPct / elapsedDays;
        const daysNeeded = pctPerDay > 0
          ? Math.ceil((100 - completionPct) / pctPerDay) : 0;
        projectedEndDate = new Date(today);
        projectedEndDate.setDate(today.getDate() + daysNeeded);
        projectedDelay   = Math.max(0, Math.ceil((projectedEndDate - endDate) / 86400000));
      }
    }

    // Member stats
    const memberMap = {};
    tasks.forEach(task => {
      if (!task.assigneeId) return;
      const key = task.assigneeId;
      if (!memberMap[key]) {
        memberMap[key] = {
          id: task.assigneeId,
          name: task.assignee
            ? [task.assignee.firstName, task.assignee.lastName].filter(Boolean).join(' ') || task.assignee.email || 'Unknown'
            : 'Unknown',
          imageUrl: task.assignee?.imageUrl || null,
          initials: task.assignee
            ? `${task.assignee.firstName?.[0] ?? ''}${task.assignee.lastName?.[0] ?? ''}`
            : '?',
          total: 0, done: 0, overdue: 0, blocked: 0,
        };
      }
      memberMap[key].total++;
      if (task.status === 'DONE') memberMap[key].done++;
      const due = task.dueDate ? new Date(task.dueDate) : null;
      if (task.status !== 'DONE' && due && due < today) memberMap[key].overdue++;
      if (task.slaStatus === 'BLOCKED' || task.status === 'BLOCKED') memberMap[key].blocked++;
    });

    const memberStats = Object.values(memberMap).map(m => ({
      ...m,
      pct: m.total > 0 ? Math.min(100, Math.round((m.done / m.total) * 100)) : 0,
    }));

    // Risk tasks
    const riskTasks = tasks
      .filter(t => {
        if (t.status === 'DONE') return false;
        const due = t.dueDate ? new Date(t.dueDate) : null;
        const isTaskOverdue = due && due < today;
        const isTaskBlocked = t.slaStatus === 'BLOCKED' || t.status === 'BLOCKED';
        const isDueSoon = due && !isTaskOverdue && Math.ceil((due - today) / 86400000) <= 2;
        return isTaskOverdue || isTaskBlocked || isDueSoon;
      })
      .sort((a, b) => {
        const score = t => {
          if (t.slaStatus === 'BLOCKED' || t.status === 'BLOCKED') return 0;
          const due = t.dueDate ? new Date(t.dueDate) : null;
          if (due && due < today) return 1;
          return 2;
        };
        return score(a) - score(b);
      })
      .slice(0, 8);

    return {
      total, done, inProgress, todo, pendingApproval,
      overdue, blocked, pending,
      completionPct,
      totalDays, elapsedDays, remainingDays,
      timeElapsedPct, isOnTrack,
      projectedDelay, projectedEndDate,
      memberStats, riskTasks,
    };
  }, [project, tasks]);
}

export default useProjectStats;
