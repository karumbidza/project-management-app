// FOLLO SLA
// FOLLO ENGINE
/**
 * Project Completion Calculator
 * Recomputed after task approval/creation/deletion AND after any subtask
 * change (add/remove/check-off/breakdown approval). Uses a weighted formula
 * that now rolls up *fractional* per-task progress from subtasks.
 */

/**
 * Per-task completion fraction in [0, 1].
 *
 *   - A DONE task is always 1 (PM sign-off overrides everything).
 *   - A task with subtasks is the weighted share of its checked-off subtasks,
 *     so progress moves as the contractor ticks work off — before final sign-off.
 *   - A task with no subtasks is binary: 1 if DONE, else 0 (backward compatible).
 *
 * @param {{status: string, completionWeight?: number, subtasks?: Array<{completionWeight?: number, isComplete: boolean}>}} task
 * @returns {number}
 */
export function taskCompletionFraction(task) {
  if (task.status === 'DONE') return 1;
  const subs = task.subtasks || [];
  if (subs.length === 0) return 0;
  const totalW = subs.reduce((s, st) => s + (st.completionWeight || 1), 0);
  if (totalW === 0) return 0;
  const doneW = subs
    .filter((st) => st.isComplete)
    .reduce((s, st) => s + (st.completionWeight || 1), 0);
  return doneW / totalW;
}

/**
 * Recalculate and persist project completion percentage.
 *
 * Formula:  % = round( Σ(taskWeight × taskFraction) / Σ(taskWeight) × 100 )
 *
 * Rules:
 *   - taskFraction folds in subtask check-offs (see taskCompletionFraction).
 *   - Adding a task lowers the %, deleting one raises it.
 *   - Weight comes from task.completionWeight (default 1).
 *
 * @param {string} projectId
 * @param {import('@prisma/client').PrismaClient} prisma
 * @returns {Promise<number>} new percentage (0-100)
 */
export async function recalculateProjectCompletion(projectId, prisma) {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: {
      status: true,
      completionWeight: true,
      subtasks: { select: { completionWeight: true, isComplete: true } },
    },
  });

  if (tasks.length === 0) {
    await prisma.project.update({
      where: { id: projectId },
      data: { progress: 0 },
    });
    return 0;
  }

  const totalWeight = tasks.reduce((sum, t) => sum + (t.completionWeight || 1), 0);
  const completedWeight = tasks.reduce(
    (sum, t) => sum + (t.completionWeight || 1) * taskCompletionFraction(t),
    0,
  );

  const percentage = Math.round((completedWeight / totalWeight) * 100);

  await prisma.project.update({
    where: { id: projectId },
    data: { progress: percentage },
  });

  return percentage;
}

/**
 * Milestone thresholds that deserve a system announcement.
 * Returns the milestone hit (25, 50, 75, 100) or null.
 *
 * @param {number} oldPct  — previous percentage
 * @param {number} newPct  — new percentage
 * @returns {number|null}
 */
export function milestoneCrossed(oldPct, newPct) {
  const milestones = [25, 50, 75, 100];
  for (const m of milestones) {
    if (oldPct < m && newPct >= m) return m;
  }
  return null;
}
