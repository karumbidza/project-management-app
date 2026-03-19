// FOLLO GANTT-FINAL
import { getTimeLeftShort, getTimeOverdueShort } from '../../lib/timeFormat';

export function StatusBadge({ status, slaStatus }) {
  const cfg =
    slaStatus === 'BLOCKED'
      ? { bg:'#fef3c7', color:'#92400e', text:'BLOCKED' }
    : slaStatus === 'PENDING_APPROVAL'
      ? { bg:'#ede9fe', color:'#5b21b6', text:'REVIEW'  }
    : status === 'DONE'
      ? { bg:'#dcfce7', color:'#166534', text:'DONE'    }
    : status === 'IN_PROGRESS'
      ? { bg:'#dbeafe', color:'#1e40af', text:'ACTIVE'  }
    : { bg:'var(--color-background-secondary)', color:'var(--color-text-tertiary)', text:'TODO' };

  return (
    <span style={{
      fontSize: '10px', padding: '1px 5px', borderRadius: '3px',
      background: cfg.bg, color: cfg.color, fontWeight: 500, flexShrink: 0,
    }}>
      {cfg.text}
    </span>
  );
}

export function SmartTimeLabel({ task, state }) {
  if (state.isOverdue && task.dueDate) {
    return <span style={{ fontSize: '10px', color: '#dc2626' }}>{getTimeOverdueShort(task.dueDate)}</span>;
  }
  if (state.isActive && task.dueDate) {
    return <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>{getTimeLeftShort(task.dueDate)}</span>;
  }
  if (state.isBlocked) return null;
  if (state.isTodo && task.plannedStartDate) {
    const start = new Date(task.plannedStartDate);
    if (start > new Date()) {
      return <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>in {getTimeLeftShort(task.plannedStartDate)}</span>;
    }
  }
  return null;
}
