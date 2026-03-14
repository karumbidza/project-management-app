// FOLLO PERF
// Performance monitoring and HTTP caching middleware

/**
 * Response time logging middleware
 * Logs requests that exceed the threshold
 * @param {number} thresholdMs - Log requests slower than this (default 500ms)
 */
export const responseTimeLogger = (thresholdMs = 500) => {
  return (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      
      // Always log slow requests
      if (duration > thresholdMs) {
        console.warn(`[SLOW] ${req.method} ${req.path} — ${duration}ms (${statusCode})`);
      }
      
      // In development, log all API requests
      if (process.env.NODE_ENV === 'development' && req.path.startsWith('/api/')) {
        const level = duration > thresholdMs ? 'warn' : 'log';
        console[level](`[PERF] ${req.method} ${req.path} — ${duration}ms`);
      }
    });
    
    next();
  };
};

/**
 * HTTP Cache-Control header middleware
 * Sets appropriate caching headers for the response
 * @param {number} maxAgeSeconds - Max age in seconds for cache
 * @param {boolean} isPrivate - Whether cache is private (user-specific data)
 */
export const cacheHeaders = (maxAgeSeconds, isPrivate = true) => {
  return (req, res, next) => {
    if (req.method === 'GET') {
      const directive = isPrivate ? 'private' : 'public';
      res.set('Cache-Control', `${directive}, max-age=${maxAgeSeconds}`);
    }
    next();
  };
};

/**
 * No-cache middleware for real-time or sensitive routes
 */
export const noCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

/**
 * Timing headers middleware
 * Adds Server-Timing header for performance debugging
 */
export const serverTiming = () => {
  return (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      res.set('Server-Timing', `total;dur=${duration}`);
    });
    
    next();
  };
};
