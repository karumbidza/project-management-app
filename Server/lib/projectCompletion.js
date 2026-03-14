// FOLLO SLA
/**
 * Project Completion Calculator
 * Called after every task approval, task creation, or task deletion.
 * Uses weighted formula: only DONE (approved) tasks count toward completion.
 */

/**
 * Recalculate and persist project completion percentage.
 *
 * Formula:  % = round( (sum of weight for DONE tasks) / (sum of all weights) × 100 )
 *
 * Rules:
 *   - Only status === 'DONE' counts (PENDING_APPROVAL does NOT).
 *   - Adding a task lowers the %, deleting one raises it.
 *   - Weight comes from task.completionWeight (default 1, range 1-5).
 *
 * @param {string} projectId
 * @param {import('@prisma/client').PrismaClient} prisma
 * @returns {Promise<number>} new percentage (0-100)
 */
export async function recalculateProjectCompletion(projectId, prisma) {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: { status: true, completionWeight: true },
  });

  if (tasks.length === 0) {
    await prisma.project.update({
      where: { id: projectId },
      data: { progress: 0 },
    });
    return 0;
  }

  const totalWeight = tasks.reduce((sum, t) => sum + (t.completionWeight || 1), 0);
  const completedWeight = tasks
    .filter((t) => t.status === 'DONE')
    .reduce((sum, t) => sum + (t.completionWeight || 1), 0);

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
