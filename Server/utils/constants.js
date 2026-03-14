/**
 * Production-grade constants
 * No magic numbers or hardcoded strings in code
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HTTP STATUS CODES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAGINATION DEFAULTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROLES & PERMISSIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const WORKSPACE_ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
});

export const PROJECT_ROLES = Object.freeze({
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  CONTRIBUTOR: 'CONTRIBUTOR',
  VIEWER: 'VIEWER',
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK STATUSES & TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const TASK_STATUS = Object.freeze({
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  DONE: 'DONE',
});

export const TASK_TYPE = Object.freeze({
  TASK: 'TASK',
  BUG: 'BUG',
  FEATURE: 'FEATURE',
  IMPROVEMENT: 'IMPROVEMENT',
  MILESTONE: 'MILESTONE',
  OTHER: 'OTHER',
});

export const PRIORITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

export const PROJECT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  PLANNING: 'PLANNING',
  COMPLETED: 'COMPLETED',
  ON_HOLD: 'ON_HOLD',
  CANCELLED: 'CANCELLED',
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOTIFICATION TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const NOTIFICATION_TYPE = Object.freeze({
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_STARTING_SOON: 'TASK_STARTING_SOON',
  TASK_OVERDUE: 'TASK_OVERDUE',
  PREDECESSOR_COMPLETE: 'PREDECESSOR_COMPLETE',
  COMMENT_ADDED: 'COMMENT_ADDED',
  PROJECT_INVITE: 'PROJECT_INVITE',
  DELAY_ALERT: 'DELAY_ALERT',
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACTIVITY TYPES (for audit trail)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const ACTIVITY_TYPE = Object.freeze({
  TASK_CREATED: 'TASK_CREATED',
  TASK_UPDATED: 'TASK_UPDATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  ASSIGNEE_CHANGED: 'ASSIGNEE_CHANGED',
  DUE_DATE_CHANGED: 'DUE_DATE_CHANGED',
  DELAY_REPORTED: 'DELAY_REPORTED',
  COMMENT_ADDED: 'COMMENT_ADDED',
  DEPENDENCY_ADDED: 'DEPENDENCY_ADDED',
  DEPENDENCY_REMOVED: 'DEPENDENCY_REMOVED',
  HANDOFF_INITIATED: 'HANDOFF_INITIATED',
  HANDOFF_COMPLETED: 'HANDOFF_COMPLETED',
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TIMING CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const TIMING = Object.freeze({
  TASK_WARNING_DAYS: 5,                    // Days before task start to send warning
  REQUEST_TIMEOUT_MS: 10000,               // 10 seconds
  DB_CONNECTION_TIMEOUT_MS: 5000,          // 5 seconds
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,    // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 500,            // Max requests per window
  AUTH_RATE_LIMIT_MAX: 10,                 // Max auth attempts per window
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION LIMITS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const LIMITS = Object.freeze({
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 2000,
  COMMENT_MAX_LENGTH: 5000,
  EMAIL_MAX_LENGTH: 255,
  SLUG_MAX_LENGTH: 100,
  FILE_MAX_SIZE_MB: 10,
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ERROR CODES (for client-side handling)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
});
