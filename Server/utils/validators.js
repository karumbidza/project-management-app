/**
 * Production-grade Zod validators
 * Validate ALL user inputs on the server - never trust the client
 */

import { z } from 'zod';
import { 
  WORKSPACE_ROLES, 
  PROJECT_ROLES, 
  TASK_STATUS, 
  TASK_TYPE, 
  PRIORITY, 
  PROJECT_STATUS,
  LIMITS 
} from './constants.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMON SCHEMAS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const uuidSchema = z.string().uuid('Invalid ID format');

export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(LIMITS.EMAIL_MAX_LENGTH, `Email must be less than ${LIMITS.EMAIL_MAX_LENGTH} characters`)
  .toLowerCase()
  .trim();

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WORKSPACE SCHEMAS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .min(LIMITS.NAME_MIN_LENGTH, 'Workspace name is required')
    .max(LIMITS.NAME_MAX_LENGTH, `Name must be less than ${LIMITS.NAME_MAX_LENGTH} characters`)
    .trim(),
  description: z
    .string()
    .max(LIMITS.DESCRIPTION_MAX_LENGTH, `Description must be less than ${LIMITS.DESCRIPTION_MAX_LENGTH} characters`)
    .optional()
    .nullable(),
});

export const addWorkspaceMemberSchema = z.object({
  email: emailSchema,
  role: z.nativeEnum(WORKSPACE_ROLES).default(WORKSPACE_ROLES.MEMBER),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  message: z.string().max(500).optional().default(''),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROJECT SCHEMAS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Base project schema without refinements (for partial)
const baseProjectSchema = z.object({
  name: z
    .string()
    .min(LIMITS.NAME_MIN_LENGTH, 'Project name is required')
    .max(LIMITS.NAME_MAX_LENGTH, `Name must be less than ${LIMITS.NAME_MAX_LENGTH} characters`)
    .trim(),
  description: z
    .string()
    .max(LIMITS.DESCRIPTION_MAX_LENGTH)
    .optional()
    .nullable(),
  priority: z.nativeEnum(PRIORITY).default(PRIORITY.MEDIUM),
  status: z.nativeEnum(PROJECT_STATUS).default(PROJECT_STATUS.PLANNING),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  budget: z.coerce.number().positive().optional().nullable(),
});

export const createProjectSchema = baseProjectSchema;

export const updateProjectSchema = baseProjectSchema.partial().extend({
  progress: z.coerce.number().int().min(0).max(100).optional(),
});

export const addProjectMemberSchema = z.object({
  email: emailSchema,
  role: z.nativeEnum(PROJECT_ROLES).default(PROJECT_ROLES.CONTRIBUTOR),
});

export const projectIdParamSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK SCHEMAS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(LIMITS.NAME_MIN_LENGTH, 'Task title is required')
    .max(LIMITS.NAME_MAX_LENGTH, `Title must be less than ${LIMITS.NAME_MAX_LENGTH} characters`)
    .trim(),
  description: z
    .string()
    .max(LIMITS.DESCRIPTION_MAX_LENGTH)
    .optional()
    .nullable(),
  status: z.nativeEnum(TASK_STATUS).default(TASK_STATUS.TODO),
  type: z.nativeEnum(TASK_TYPE).default(TASK_TYPE.TASK),
  priority: z.nativeEnum(PRIORITY).default(PRIORITY.MEDIUM),
  assigneeId: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  plannedStartDate: z.string().optional().nullable(),
  plannedEndDate: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().optional().default(0),
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(LIMITS.NAME_MIN_LENGTH)
    .max(LIMITS.NAME_MAX_LENGTH)
    .trim()
    .optional(),
  description: z
    .string()
    .max(LIMITS.DESCRIPTION_MAX_LENGTH)
    .optional()
    .nullable(),
  status: z.nativeEnum(TASK_STATUS).optional(),
  type: z.nativeEnum(TASK_TYPE).optional(),
  priority: z.nativeEnum(PRIORITY).optional(),
  assigneeId: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  plannedStartDate: z.string().optional().nullable(),
  plannedEndDate: z.string().optional().nullable(),
  actualStartDate: z.string().optional().nullable(),
  actualEndDate: z.string().optional().nullable(),
  isDelayed: z.boolean().optional(),
  delayDays: z.coerce.number().int().min(0).optional(),
  delayReason: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
});

export const taskIdParamSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK DEPENDENCY SCHEMAS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const createDependencySchema = z.object({
  predecessorId: z.string().min(1, 'Predecessor ID is required'),
  lagDays: z.coerce.number().int().min(0).default(0),
});

export const removeDependencySchema = z.object({
  predecessorId: z.string().min(1, 'Predecessor ID is required'),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMENT SCHEMAS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment content is required')
    .max(LIMITS.COMMENT_MAX_LENGTH, `Comment must be less than ${LIMITS.COMMENT_MAX_LENGTH} characters`)
    .trim(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION MIDDLEWARE FACTORY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Creates middleware that validates request data against a Zod schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {'body' | 'query' | 'params'} source - Request property to validate
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      });
    }
    
    // Replace request data with parsed/transformed data
    req[source] = result.data;
    next();
  };
}

/**
 * Validate multiple sources at once
 * @param {Object} schemas - Object with 'body', 'query', 'params' keys
 */
export function validateAll(schemas) {
  return (req, res, next) => {
    const errors = [];
    
    for (const [source, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[source]);
      
      if (!result.success) {
        errors.push(...result.error.errors.map(e => ({
          field: `${source}.${e.path.join('.')}`,
          message: e.message,
        })));
      } else {
        req[source] = result.data;
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errors,
        },
      });
    }
    
    next();
  };
}
