-- FOLLO PERF
-- Performance indexes for common query patterns
-- Run with: psql $DATABASE_URL -f db/perf-indexes.sql
-- All indexes use CONCURRENTLY to avoid table locks

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TASK INDEXES (most queried table)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Task lists by project, sorted by priority and date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_project_priority_date
  ON "Task"("projectId", "priority" DESC, "plannedEndDate" ASC);

-- Task lists by assignee (for "My Tasks" view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_assignee_status
  ON "Task"("assigneeId", "status");

-- Task lists by assignee sorted by due date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_assignee_duedate
  ON "Task"("assigneeId", "dueDate" DESC);

-- Delayed tasks lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_delayed
  ON "Task"("isDelayed", "projectId") WHERE "isDelayed" = true;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- COMMENT INDEXES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Comment threads by task, ordered by creation (chat view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comment_task_created
  ON "Comment"("taskId", "createdAt" ASC);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PROJECT INDEXES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Projects by workspace sorted by creation (dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_workspace_created
  ON "Project"("workspaceId", "createdAt" DESC);

-- Projects by status (filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_workspace_status
  ON "Project"("workspaceId", "status");

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ACTIVITY INDEXES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Activity feed by task (task detail view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_task_created
  ON "TaskActivity"("taskId", "createdAt" DESC);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- NOTIFICATION INDEXES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Unread notifications for a user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_user_unread
  ON "Notification"("userId", "isRead", "createdAt" DESC) WHERE "isRead" = false;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- MEMBERSHIP INDEXES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Project members by project (team view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projectmember_project_joined
  ON "ProjectMember"("projectId", "joinedAt" DESC);

-- Workspace members
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspacemember_workspace
  ON "WorkspaceMember"("workspaceId", "role");
