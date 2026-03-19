// FOLLO PERF
// FOLLO PERF-2
// In-memory cache layer using node-cache (primary)
// Upstash Redis (optional upgrade — set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)

import NodeCache from 'node-cache';

// Configure cache with sensible defaults
// stdTTL: default TTL in seconds
// checkperiod: interval to check for expired keys
// useClones: false for better performance (be careful with mutations)
export const cache = new NodeCache({
  stdTTL:      60,
  checkperiod: 120,
  useClones:   false,
});

// Cache statistics for monitoring
export const getCacheStats = () => cache.getStats();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FOLLO PERF-2: Optional Upstash Redis (distributed cache)
// Falls back to node-cache if not configured — zero crash risk.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let redis = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    const { Redis } = await import('@upstash/redis');
    redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.info(JSON.stringify({
      level: 'info',
      event: 'cache.redis.connected',
    }));
  } catch (err) {
    console.warn(JSON.stringify({
      level:   'warn',
      event:   'cache.redis.init.failed',
      error:   err.message,
      message: 'Falling back to in-memory cache',
    }));
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// withCache — get from cache or compute
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Wrapper: get from cache or run the fetcher and cache the result.
 * Uses Redis when configured, falls back to node-cache.
 * @param {string} key         - Unique cache key
 * @param {number} ttlSeconds  - Time to live in seconds
 * @param {function} fetcher   - Async function to fetch data if not cached
 * @returns {Promise<any>}     - Cached or freshly fetched data
 */
export async function withCache(key, ttlSeconds, fetcher) {
  // Try Redis first (distributed, survives restarts)
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
      }
    } catch (err) {
      console.warn(JSON.stringify({
        level: 'warn', event: 'cache.redis.get.failed', key, error: err.message,
      }));
      // Fall through to in-memory
    }
  } else {
    // In-memory fallback
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
  }

  // Compute fresh value
  const result = await fetcher();

  // Store in cache (non-blocking)
  if (result !== null && result !== undefined) {
    if (redis) {
      redis.setex(key, ttlSeconds, JSON.stringify(result))
        .catch(err => console.warn(JSON.stringify({
          level: 'warn', event: 'cache.redis.set.failed', key, error: err.message,
        })));
    } else {
      cache.set(key, result, ttlSeconds);
    }
  }

  return result;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Invalidation helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Invalidate a single cache key
 */
export function invalidateCache(key) {
  cache.del(key);
  if (redis) {
    redis.del(key).catch(err => console.warn(JSON.stringify({
      level: 'warn', event: 'cache.redis.del.failed', key, error: err.message,
    })));
  }
}

/**
 * Invalidate all cache keys matching a prefix (in-memory only)
 */
export function invalidateCachePattern(prefix) {
  const keys = cache.keys().filter(k => k.startsWith(prefix));
  if (keys.length > 0) {
    cache.del(keys);
  }
  // Note: Redis wildcard deletes require SCAN — not implemented for simplicity
}

/**
 * Invalidate multiple specific keys
 */
export function invalidateCacheKeys(keys) {
  cache.del(keys);
  if (redis) {
    Promise.all(keys.map(k => redis.del(k)))
      .catch(err => console.warn(JSON.stringify({
        level: 'warn', event: 'cache.redis.del.failed', error: err.message,
      })));
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CACHE KEY GENERATORS (for consistency)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const CACHE_KEYS = {
  // User-related
  user:             (userId)      => `user:${userId}`,
  userWorkspaces:   (userId)      => `workspaces:${userId}`,
  userProjects:     (userId)      => `myprojects:${userId}`,

  // Project-related
  project:          (projectId)   => `project:${projectId}`,
  projectTasks:     (projectId)   => `tasks:${projectId}`,
  projectMembers:   (projectId)   => `members:${projectId}`,
  workspaceProjects:(workspaceId) => `ws-projects:${workspaceId}`,

  // Task-related
  task:             (taskId)      => `task:${taskId}`,
  taskComments:     (taskId)      => `comments:${taskId}`,

  // Dashboard — FOLLO PERF-2
  dashboard:        (workspaceId, userId) => `dashboard:${workspaceId}:${userId}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TTL CONSTANTS (seconds)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const CACHE_TTL = {
  USER_PROFILE:     300,  // 5 minutes
  WORKSPACE_LIST:   120,  // 2 minutes
  PROJECT_LIST:     120,  // 2 minutes
  PROJECT_DETAIL:   60,   // 1 minute
  PROJECT_MEMBERS:  300,  // 5 minutes
  TASK_LIST:        30,   // 30 seconds
  TASK_DETAIL:      30,   // 30 seconds
  COMMENTS:         30,   // 30 seconds
  // FOLLO PERF-2
  DASHBOARD_STATS:  120,  // 2 minutes — see TTL strategy in FOLLO PERF-2 docs
  // NOTE: task.status, slaStatus, comments — NO CACHE (must be fresh)
};
