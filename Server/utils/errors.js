// FOLLO FIX
/**
 * Production-grade error handling
 * Centralized error handler - never expose stack traces to client
 */

import { HTTP_STATUS, ERROR_CODES } from './constants.js';
import { sendError } from './response.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CUSTOM ERROR CLASSES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(message, statusCode, code, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Distinguishes operational errors from programming errors
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, details);
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.AUTHENTICATION_ERROR);
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.AUTHORIZATION_ERROR);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND_ERROR);
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message) {
    super(message, HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT_ERROR);
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_CODES.RATE_LIMIT_ERROR);
  }
}

/**
 * Database error (500)
 */
export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.DATABASE_ERROR);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ERROR HANDLER MIDDLEWARE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Centralized error handler middleware
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function errorHandler(err, req, res, next) {
  // Log error server-side with full details
  const logPayload = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    userId: req.userId || 'anonymous',
    errorName: err.name,
    errorMessage: err.message,
    errorCode: err.code || ERROR_CODES.INTERNAL_ERROR,
    stack: err.stack,
  };
  
  // Log full error in development, structured JSON in production
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', logPayload);
  } else {
    // Production: structured logging (JSON) without stack trace
    const { stack, ...safePayload } = logPayload;
    console.error(JSON.stringify(safePayload));
  }
  
  // Handle known operational errors
  if (err instanceof AppError) {
    return sendError(res, {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
    });
  }
  
  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    return handlePrismaError(err, res);
  }
  
  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    return sendError(res, {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Validation failed',
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }
  
  // Handle unknown errors - never expose internal details to client
  return sendError(res, {
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'An unexpected error occurred. Please try again later.',
  });
}

/**
 * Handle Prisma-specific errors
 */
function handlePrismaError(err, res) {
  switch (err.code) {
    case 'P2002':
      return sendError(res, {
        statusCode: HTTP_STATUS.CONFLICT,
        code: ERROR_CODES.CONFLICT_ERROR,
        message: 'A record with this information already exists',
        details: { field: err.meta?.target?.[0] },
      });
    
    case 'P2003':
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Referenced record does not exist',
      });
    
    case 'P2025':
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: ERROR_CODES.NOT_FOUND_ERROR,
        message: 'Record not found',
      });
    
    default:
      return sendError(res, {
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        code: ERROR_CODES.DATABASE_ERROR,
        message: 'Database operation failed',
      });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ASYNC HANDLER WRAPPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Wrap async route handlers to catch errors
 * Eliminates need for try/catch in every handler
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped handler
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOT FOUND HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Handle 404 for undefined routes
 */
export function notFoundHandler(req, res) {
  return sendError(res, {
    statusCode: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODES.NOT_FOUND_ERROR,
    message: `Route ${req.method} ${req.path} not found`,
  });
}
