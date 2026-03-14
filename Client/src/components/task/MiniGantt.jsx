// FOLLO MEMBER-GANTT
import { useMemo } from 'react';

// ─── Match ProjectGantt constants ───
const ROW_HEIGHT = 46;
const LEFT_COL = 190;
const BAR_H = 20;

function getTaskBarState(task, today) {
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const start = task.plannedStartDate ? new Date(task.plannedStartDate) : null;
  const actual = task.actualStartDate ? new Date(task.actualStartDate) : null;
  const t = new Date(today); t.setHours(0,0,0,0);
  if (due) due.setHours(0,0,0,0);
  if (start) start.setHours(0,0,0,0);

  const isDone    = task.status === 'DONE';
  const isBlocked = task.slaStatus === 'BLOCKED' || task.status === 'BLOCKED';
  const isPending = task.slaStatus === 'PENDING_APPROVAL';
  const autoStarted = task.status === 'TODO' && !isBlocked && !isPending && start && start <= t;
  const isActive  = task.status === 'IN_PROGRESS' || autoStarted;
  const isTodo    = task.status === 'TODO' && !autoStarted;
  const isOverdue = !isDone && due && due < t;
  const daysOverdue = isOverdue ? Math.floor((t - due) / 864e5) : 0;
  const daysUntilDue = due ? Math.floor((due - t) / 864e5) : null;
  const isAtRisk  = isActive && daysUntilDue !== null && daysUntilDue > 0 && daysUntilDue <= 2 && !isOverdue;
  const hasStarted = !!actual || isActive || isDone;

  return { isDone, isBlocked, isActive, isPending, isTodo, isOverdue, isAtRisk, daysOverdue, daysUntilDue, hasStarted, autoStarted };
}

function getProgressBarColors(state) {
  if (state.isDone)    return { fill: '#16a34a', shimmer: false };
  if (state.isBlocked) return { fill: '#d97706', shimmer: false, breathe: true };
  if (state.isPending) return { fill: '#3b82f6', shimmer: false };
  if (state.isOverdue) return { fill: '#93c5fd', shimmer: false, spillColor: '#dc2626' };
  if (state.isAtRisk)  return { fill: '#f97316', shimmer: true };
  if (state.isActive)  return { fill: '#2563eb', shimmer: true };
  return { fill: 'transparent', shimmer: false };
}

export default function MiniGantt({ tasks }) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Show 10 days: 4 before today, 6 after
  const windowStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 4);
    return d;
  }, [today]);

  const DAYS = 10;

  // Generate date column headers
  const columns = useMemo(() => {
    return Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(windowStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [windowStart]);

  // Convert date to % position
  const dateToX = (date) => {
    if (!date) return null;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const diffMs = d - windowStart;
    const diffDays = diffMs / 86400000;
    return (diffDays / DAYS) * 100;
  };

  const todayX = dateToX(today);

  // Filter to tasks with dates, sort by urgency
  const visibleTasks = useMemo(() => {
    const t2 = new Date();
    t2.setHours(0, 0, 0, 0);
    return tasks
      .filter(t => t.status !== 'DONE' &&
        (t.plannedStartDate || t.dueDate))
      .sort((a, b) => {
        const score = t => {
          const due = t.dueDate ? new Date(t.dueDate) : null;
          if (due && due < t2) return 0;
          if (t.slaStatus === 'BLOCKED' || t.status === 'BLOCKED') return 1;
          if (t.status === 'IN_PROGRESS') return 2;
          return 3;
        };
        return score(a) - score(b);
      })
      .slice(0, 6); // max 6 rows
  }, [tasks]);

  if (visibleTasks.length === 0) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Section label */}
      <div style={{ padding: '10px 12px 4px', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary, #a1a1aa)', letterSpacing: '.05em' }}>
        MY TIMELINE
      </div>

      {/* Date column headers — matches ProjectGantt header pattern */}
      <div style={{ display: 'grid', gridTemplateColumns: `${LEFT_COL}px 1fr`, marginBottom: 2 }}>
        <div style={{ fontSize: 10, color: 'var(--color-text-tertiary, #a1a1aa)', padding: '0 12px', letterSpacing: '.05em', display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
          TASK
        </div>
        <div style={{ display: 'flex' }}>
          {columns.map((d, i) => {
            const isToday = d.toDateString() === today.toDateString();
            return (
              <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: isToday ? 500 : 400, color: isToday ? 'var(--color-text-secondary, #52525b)' : 'var(--color-text-tertiary, #a1a1aa)' }}>
                {d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Task rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {visibleTasks.map(task => {
          const state = getTaskBarState(task, today);
          const colors = getProgressBarColors(state);
          const startX = dateToX(task.actualStartDate || task.plannedStartDate);
          const plannedEndX = dateToX(task.dueDate);

          // Ghost track
          const ghostLeft  = Math.max(0, startX ?? 0);
          const ghostWidth = Math.max(2,
            Math.min(100, plannedEndX ?? 100) - ghostLeft
          );

          // Progress fill
          const progressLeft  = Math.max(0, startX ?? ghostLeft);
          const progressEnd   = state.isOverdue
            ? Math.min(100, plannedEndX ?? 100)
            : Math.min(100, todayX);
          const progressWidth = Math.max(0, progressEnd - progressLeft);

          // Spill (overdue past due date)
          const spillLeft  = Math.min(100, plannedEndX ?? 100);
          const spillWidth = state.isOverdue
            ? Math.min(20, Math.max(0, todayX - spillLeft))
            : 0;

          // Row styling — matches ProjectGantt rowStyle
          const rowStyle = {
            display: 'grid', gridTemplateColumns: `${LEFT_COL}px 1fr`, alignItems: 'center',
            height: ROW_HEIGHT, borderRadius: 7,
            background: state.isOverdue ? '#fff5f5' : state.isBlocked ? '#fffbeb' : 'var(--color-background-secondary, #fafafa)',
            border: state.isOverdue ? '0.5px solid #fecaca' : state.isBlocked ? '0.5px solid #fde68a' : 'none',
            boxShadow: state.isBlocked ? '0 0 0 3px rgba(217,119,6,.08)' : undefined,
          };

          return (
            <div key={task.id} style={rowStyle}>
              {/* LEFT COLUMN: task name + project subtitle */}
              <div style={{ padding: '0 12px', overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary, #18181b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {task.title}
                </div>
                <div style={{ fontSize: 10, marginTop: 1, color: state.isOverdue ? '#dc2626' : state.isBlocked ? '#d97706' : state.isDone ? '#16a34a' : 'var(--color-text-tertiary, #a1a1aa)' }}>
                  {task.projectName || ''}
                  {state.isOverdue && ` · ${state.daysOverdue}d overdue`}
                  {state.isBlocked && ' · Blocked'}
                  {state.isActive && state.daysUntilDue !== null && !state.isOverdue && ` · ${state.daysUntilDue}d left`}
                </div>
              </div>

              {/* RIGHT COLUMN: bar area */}
              <div style={{ position: 'relative', height: ROW_HEIGHT, display: 'flex', alignItems: 'center' }}>
                {/* Today line */}
                {todayX >= 0 && todayX <= 100 && (
                  <div style={{ position: 'absolute', left: `${todayX}%`, top: 0, bottom: 0, width: '1.5px', background: state.isOverdue ? '#dc2626' : '#2563eb', opacity: state.isOverdue ? 0.35 : 0.2, zIndex: 4, pointerEvents: 'none' }} />
                )}

                {/* Ghost track */}
                <div style={{ position: 'absolute', left: `${ghostLeft}%`, width: `${ghostWidth}%`, height: BAR_H, background: 'var(--color-border-tertiary, #d4d4d8)', borderRadius: 3 }} />

                {/* Progress bar */}
                {(state.isActive || state.isOverdue || state.isBlocked) && progressWidth > 0 && (
                  <div style={{
                    position: 'absolute', left: `${progressLeft}%`,
                    width: `${state.isOverdue ? ghostWidth : progressWidth}%`,
                    height: BAR_H,
                    background: colors.fill,
                    borderRadius: state.isOverdue ? '3px 0 0 3px' : 3,
                    overflow: 'hidden', pointerEvents: 'none',
                    animation: colors.breathe ? 'gantt-breathe 2s ease-in-out infinite' : undefined,
                  }}>
                    {colors.shimmer && (
                      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '40%', height: '100%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent)', animation: 'gantt-shimmer 2s ease-in-out infinite' }} />
                      </div>
                    )}
                  </div>
                )}

                {/* Spill bar (overdue) */}
                {state.isOverdue && spillWidth > 0 && (
                  <div style={{
                    position: 'absolute', left: `${spillLeft}%`, height: BAR_H,
                    background: '#dc2626', borderRadius: '0 3px 3px 0', pointerEvents: 'none',
                    '--spill-width': `${spillWidth}%`,
                    animation: 'gantt-spill .55s cubic-bezier(.34,1.56,.64,1) forwards',
                  }} />
                )}

                {/* Pulse dot */}
                {(state.isActive || state.isBlocked) && !state.isOverdue && progressWidth > 0 && (
                  <div style={{
                    position: 'absolute', left: `calc(${progressLeft}% + ${progressWidth}% - 4px)`,
                    width: 8, height: 8,
                    background: state.isBlocked ? '#d97706' : '#2563eb',
                    borderRadius: '50%', zIndex: 2, pointerEvents: 'none',
                    boxShadow: state.isBlocked ? '0 0 0 3px rgba(217,119,6,.25)' : '0 0 0 3px rgba(37,99,235,.2)',
                    animation: 'gantt-pulse 1.2s ease-in-out infinite',
                  }} />
                )}

                {/* Inline status label — matches ProjectGantt */}
                {(() => {
                  let label = null;
                  let color = '#a1a1aa';
                  let bg = undefined;
                  const afterBar = state.isOverdue
                    ? `calc(${spillLeft}% + ${spillWidth}% + 6px)`
                    : `calc(${progressLeft}% + ${progressWidth}% + 8px)`;

                  if (state.isBlocked)       { label = 'blocked'; color = '#d97706'; bg = '#fef3c7'; }
                  else if (state.isPending)  { label = 'awaiting approval'; color = '#3b82f6'; }
                  else if (state.isOverdue)  { label = `+${state.daysOverdue}d`; color = '#dc2626'; }
                  else if (state.isAtRisk)   { label = `${state.daysUntilDue}d left`; color = '#f97316'; }
                  else if (state.isActive && state.daysUntilDue !== null) { label = `${state.daysUntilDue}d left`; }
                  else if (state.autoStarted){ label = 'starts today'; }
                  else if (state.isTodo && task.plannedStartDate) {
                    const sd = new Date(task.plannedStartDate);
                    label = `starts ${sd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
                  }

                  return label ? (
                    <div style={{
                      position: 'absolute', left: afterBar, top: ROW_HEIGHT / 2 - 7,
                      fontSize: 10, color, fontWeight: 500, whiteSpace: 'nowrap', pointerEvents: 'none',
                      background: bg, padding: bg ? '1px 6px' : undefined, borderRadius: bg ? 3 : undefined,
                    }}>
                      {label}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {/* TODAY label */}
      <div style={{ display: 'grid', gridTemplateColumns: `${LEFT_COL}px 1fr`, marginTop: 4 }}>
        <div />
        <div style={{ position: 'relative', height: 14 }}>
          {todayX >= 0 && todayX <= 100 && (
            <div style={{ position: 'absolute', left: `calc(${todayX}% - 14px)`, fontSize: 10, color: '#2563eb', fontWeight: 500 }}>TODAY</div>
          )}
        </div>
      </div>

      {/* Legend — matches ProjectGantt */}
      <div style={{ display: 'flex', gap: 16, padding: '10px 12px 8px', borderTop: '0.5px solid var(--color-border-tertiary, #e4e4e7)', flexWrap: 'wrap', marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-secondary, #71717a)' }}>
          <div style={{ width: 22, height: 8, background: 'var(--color-border-secondary, #d4d4d8)', borderRadius: 2 }} />Scheduled
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-secondary, #71717a)' }}>
          <div style={{ width: 22, height: 8, background: '#2563eb', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)', animation: 'gantt-shimmer 2s ease-in-out infinite' }} />
          </div>Active
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-secondary, #71717a)' }}>
          <div style={{ display: 'flex' }}>
            <div style={{ width: 10, height: 8, borderRadius: '2px 0 0 2px', background: '#93c5fd' }} />
            <div style={{ width: 12, height: 8, borderRadius: '0 2px 2px 0', background: '#dc2626', marginLeft: -1 }} />
          </div>Overdue
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-secondary, #71717a)' }}>
          <div style={{ width: 22, height: 8, background: '#d97706', borderRadius: 2, animation: 'gantt-breathe 2s ease-in-out infinite' }} />Blocked
        </div>
      </div>
    </div>
  );
}
