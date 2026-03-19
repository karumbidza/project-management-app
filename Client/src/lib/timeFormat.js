// FOLLO GANTT-FINAL
// Smart time formatting — always uses the most natural unit

export function formatTimeRemaining(dueDate, suffix = 'left') {
  if (!dueDate) return '';
  const now  = new Date();
  const due  = new Date(dueDate);
  const ms   = Math.abs(due - now);
  const minutes = Math.floor(ms / 60000);
  const hours   = Math.floor(ms / 3600000);
  const days    = Math.floor(ms / 86400000);
  const weeks   = Math.floor(days / 7);
  const months  = Math.floor(days / 30);
  const years   = Math.floor(days / 365);
  let amount;
  if (minutes < 60)    amount = `${minutes}m`;
  else if (hours < 24) amount = `${hours}h`;
  else if (days < 7)   amount = `${days}d`;
  else if (weeks < 5)  amount = `${weeks}w`;
  else if (months < 12) amount = `${months}mo`;
  else                  amount = `${years}yr`;
  return `${amount} ${suffix}`;
}

export function formatTimeLeft(dueDate) {
  return formatTimeRemaining(dueDate, 'left');
}

export function formatTimeOverdue(dueDate) {
  return formatTimeRemaining(dueDate, 'overdue');
}

export function getTimeOverdueShort(dueDate) {
  if (!dueDate) return '';
  const now  = new Date();
  const due  = new Date(dueDate);
  const ms   = Math.abs(due - now);
  const minutes = Math.floor(ms / 60000);
  const hours   = Math.floor(ms / 3600000);
  const days    = Math.floor(ms / 86400000);
  const weeks   = Math.floor(days / 7);
  const months  = Math.floor(days / 30);
  const years   = Math.floor(days / 365);
  if (minutes < 60)    return `+${minutes}m`;
  if (hours   < 24)    return `+${hours}h`;
  if (days    < 7)     return `+${days}d`;
  if (weeks   < 5)     return `+${weeks}w`;
  if (months  < 12)    return `+${months}mo`;
  return `+${years}yr`;
}

export function getTimeLeftShort(dueDate) {
  if (!dueDate) return '';
  const now  = new Date();
  const due  = new Date(dueDate);
  const ms   = due - now;
  if (ms <= 0) return getTimeOverdueShort(dueDate);
  const minutes = Math.floor(ms / 60000);
  const hours   = Math.floor(ms / 3600000);
  const days    = Math.floor(ms / 86400000);
  const weeks   = Math.floor(days / 7);
  const months  = Math.floor(days / 30);
  const years   = Math.floor(days / 365);
  if (minutes < 60)    return `${minutes}m`;
  if (hours   < 24)    return `${hours}h`;
  if (days    < 7)     return `${days}d`;
  if (weeks   < 5)     return `${weeks}w`;
  if (months  < 12)    return `${months}mo`;
  return `${years}yr`;
}
