// FOLLO WORKFLOW
import prisma from "../configs/prisma.js";

/**
 * Calculate priority for a task based on dependencies.
 * Returns: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null (null = skip, overridden)
 */
export async function calculateTaskPriority(taskId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      slaStatus: true,
      dueDate: true,
      priorityOverride: true,
      predecessors: { select: { predecessorId: true } },
    },
  });

  if (!task) return 'LOW';
  if (task.priorityOverride) return null;

  // Count tasks that depend ON this task (this task is a predecessor)
  const dependantCount = await prisma.taskDependency.count({
    where: { predecessorId: taskId },
  });

  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < today &&
    task.status !== 'DONE';

  const isBlocked = task.slaStatus === 'BLOCKED';
  const hasDependants = dependantCount > 0;
  const hasPrerequisites = task.predecessors.length > 0;

  if (isOverdue || (isBlocked && hasDependants)) return 'CRITICAL';
  if (hasDependants) return 'HIGH';
  if (hasPrerequisites) return 'MEDIUM';
  return 'LOW';
}

/**
 * Recalculate and save priority for a task.
 */
export async function updateTaskPriority(taskId) {
  const newPriority = await calculateTaskPriority(taskId);
  if (newPriority === null) return; // overridden, skip

  await prisma.task.update({
    where: { id: taskId },
    data: { priority: newPriority },
  });
}

/**
 * When a dependency changes, recalculate priority for BOTH tasks.
 */
export async function recalculateAfterDependencyChange(taskId, dependsOnTaskId) {
  await Promise.all([
    updateTaskPriority(taskId),
    updateTaskPriority(dependsOnTaskId),
  ]);
}
