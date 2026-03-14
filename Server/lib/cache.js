// FOLLO PERF
// In-memory cache layer using node-cache
// Zero infrastructure, fast reads, automatic TTL expiration

import NodeCache from 'node-cache';

// Configure cache with sensible defaults
// stdTTL: default TTL in seconds
// checkperiod: interval to check for expired keys
// useClones: false for better performance (be careful with mutations)
export const cache = new NodeCache({ 
  stdTTL: 60, 
  checkperiod: 120,
  useClones: false,
});

// Cache statistics for monitoring
export const getCacheStats = () => cache.getStats();

/**
 * Wrapper: get from cache or run the fetcher and cache the result
 * @param {string} key - Unique cache key
 * @param {number} ttlSeconds - Time to live in seconds
 * @param {function} fetcher - Async function to fetch data if not cached
 * @returns {Promise<any>} - Cached or freshly fetched data
 */
export async function withCache(key, ttlSeconds, fetcher) {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const result = await fetcher();
  cache.set(key, result, ttlSeconds);
  return result;
}

/**
 * Invalidate a single cache key
 * @param {string} key - Cache key to invalidate
 */
export function invalidateCache(key) {
  cache.del(key);
}

/**
 * Invalidate all cache keys matching a prefix
 * @param {string} prefix - Prefix to match (e.g., "user:123" removes "user:123:*")
 */
export function invalidateCachePattern(prefix) {
  const keys = cache.keys().filter(k => k.startsWith(prefix));
  if (keys.length > 0) {
    cache.del(keys);
  }
}

/**
 * Invalidate multiple specific keys
 * @param {string[]} keys - Array of keys to invalidate
 */
export function invalidateCacheKeys(keys) {
  cache.del(keys);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CACHE KEY GENERATORS (for consistency)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const CACHE_KEYS = {
  // User-related
  user: (userId) => `user:${userId}`,
  userWorkspaces: (userId) => `workspaces:${userId}`,
  userProjects: (userId) => `myprojects:${userId}`,
  
  // Project-related
  project: (projectId) => `project:${projectId}`,
  projectTasks: (projectId) => `tasks:${projectId}`,
  projectMembers: (projectId) => `members:${projectId}`,
  workspaceProjects: (workspaceId) => `ws-projects:${workspaceId}`,
  
  // Task-related
  task: (taskId) => `task:${taskId}`,
  taskComments: (taskId) => `comments:${taskId}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TTL CONSTANTS (seconds)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const CACHE_TTL = {
  USER_PROFILE: 300,      // 5 minutes
  WORKSPACE_LIST: 120,    // 2 minutes
  PROJECT_LIST: 120,      // 2 minutes
  PROJECT_DETAIL: 60,     // 1 minute
  PROJECT_MEMBERS: 300,   // 5 minutes
  TASK_LIST: 30,          // 30 seconds
  TASK_DETAIL: 30,        // 30 seconds
  COMMENTS: 30,           // 30 seconds
};
