// FOLLO GANTT-FINAL
// Hybrid completion: manual weight > duration > equal

export function getTaskWeight(task) {
  if (task.completionWeight && task.completionWeight > 0) {
    return task.completionWeight;
  }
  const start = task.plannedStartDate ? new Date(task.plannedStartDate) : null;
  const end   = task.dueDate ? new Date(task.dueDate)
              : task.plannedEndDate ? new Date(task.plannedEndDate)
              : null;
  if (start && end && end > start) {
    return Math.max(1, Math.ceil((end - start) / 86400000));
  }
  return 1;
}

export function calcCompletionPct(tasks = []) {
  if (!tasks.length) return 0;
  const totalWeight = tasks.reduce((sum, t) => sum + getTaskWeight(t), 0);
  if (totalWeight === 0) return 0;
  const doneWeight = tasks
    .filter(t => t.status === 'DONE')
    .reduce((sum, t) => sum + getTaskWeight(t), 0);
  return Math.round((doneWeight / totalWeight) * 100);
}

export function calcTaskContribution(task, allTasks) {
  const totalWeight = allTasks.reduce((sum, t) => sum + getTaskWeight(t), 0);
  if (totalWeight === 0) return 0;
  return Math.round((getTaskWeight(task) / totalWeight) * 100);
}

// FOLLO ENGINE — a task's own completion %, rolled up from its subtask
// check-offs. DONE is always 100; a task with subtasks reports the weighted
// share ticked off; a task with none has no intrinsic % (returns 0). Mirrors the
// server's taskCompletionFraction so the Gantt fill matches project progress.
export function getTaskProgressPct(task) {
  if (task.status === 'DONE') return 100;
  const subs = task.subtasks || [];
  if (!subs.length) return 0;
  const total = subs.reduce((s, st) => s + (st.completionWeight || 1), 0);
  if (!total) return 0;
  const done = subs
    .filter((st) => st.isComplete)
    .reduce((s, st) => s + (st.completionWeight || 1), 0);
  return Math.round((done / total) * 100);
}
