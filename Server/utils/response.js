/**
 * Production-grade response helpers
 * Consistent response envelope: { success, data, error, meta }
 */

import { HTTP_STATUS, PAGINATION } from './constants.js';

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether the request was successful
 * @property {*} [data] - The response data (on success)
 * @property {Object} [error] - Error details (on failure)
 * @property {string} error.code - Machine-readable error code
 * @property {string} error.message - Human-readable error message
 * @property {*} [error.details] - Additional error details
 * @property {Object} [meta] - Metadata (pagination, etc.)
 */

/**
 * Send a successful response
 * @param {import('express').Response} res
 * @param {*} data - Response data
 * @param {string} [message] - Optional success message
 * @param {number} [statusCode=200] - HTTP status code
 */
export function sendSuccess(res, data, message = null, statusCode = HTTP_STATUS.OK) {
  const response = {
    success: true,
    data,
    error: null,
  };
  
  if (message) {
    response.message = message;
  }
  
  return res.status(statusCode).json(response);
}

/**
 * Send a paginated response
 * @param {import('express').Response} res
 * @param {Object} options
 * @param {Array} options.data - Array of items
 * @param {number} options.total - Total count of items
 * @param {number} options.page - Current page number
 * @param {number} options.limit - Items per page
 */
export function sendPaginated(res, { data, total, page, limit }) {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  
  return sendSuccess(res, {
    data,
    meta: {
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    },
  });
}

/**
 * Send an error response
 * Never returns 200 with an error body
 * @param {import('express').Response} res
 * @param {Object} options
 * @param {number} options.statusCode - HTTP status code (must be 4xx or 5xx)
 * @param {string} options.code - Machine-readable error code
 * @param {string} options.message - Human-readable error message
 * @param {*} [options.details] - Additional error details (validation errors, etc.)
 */
export function sendError(res, { statusCode, code, message, details = null }) {
  // Ensure we never return success status with error
  const safeStatusCode = statusCode >= 400 ? statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
  
  const response = {
    success: false,
    data: null,
    error: {
      code,
      message,
    },
  };
  
  if (details) {
    response.error.details = details;
  }
  
  return res.status(safeStatusCode).json(response);
}

/**
 * Parse pagination parameters from request query
 * @param {Object} query - Request query object
 * @returns {{ page: number, limit: number, skip: number }}
 */
export function parsePagination(query) {
  const page = Math.max(
    PAGINATION.DEFAULT_PAGE,
    parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE
  );
  
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(
      PAGINATION.MIN_LIMIT,
      parseInt(query.limit, 10) || PAGINATION.DEFAULT_LIMIT
    )
  );
  
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}

/**
 * Send a created response (201)
 * @param {import('express').Response} res
 * @param {*} data - Created resource data
 */
export function sendCreated(res, data, message = null) {
  return sendSuccess(res, data, message, HTTP_STATUS.CREATED);
}

/**
 * Send a no content response (204)
 * @param {import('express').Response} res
 */
export function sendNoContent(res) {
  return res.status(HTTP_STATUS.NO_CONTENT).send();
}
