// FOLLO SECURITY
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { getAuth } from '@clerk/express';

// FOLLO SECURITY — key on the authenticated Clerk userId so limits are per-user.
// clerkMiddleware runs before these limiters, so getAuth(req) is populated even
// though `protect` (which sets req.userId) has not run yet. Falls back to a
// normalised IP key for unauthenticated/pre-auth requests.
const userOrIpKey = (req) => {
  try {
    const { userId } = getAuth(req) || {};
    if (userId) return `user:${userId}`;
  } catch {
    // getAuth throws if clerkMiddleware hasn't run — fall through to IP
  }
  return ipKeyGenerator(req);
};

// Seconds until the limit window resets (resetTime is a Date).
const retryAfterSeconds = (req) => {
  const reset = req.rateLimit?.resetTime;
  if (!reset) return undefined;
  return Math.max(0, Math.ceil((reset.getTime() - Date.now()) / 1000));
};

// Standard API limiter — all routes
export const apiLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             300,             // 300 requests per window
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: userOrIpKey,
  handler: (req, res) => {
    res.status(429).json({
      error:      'Too many requests',
      message:    'Please slow down and try again in 15 minutes.',
      retryAfter: retryAfterSeconds(req),
    });
  },
});

// Strict limiter — write operations
export const writeLimiter = rateLimit({
  windowMs:        60 * 1000, // 1 minute
  max:             60,         // 60 write ops per minute per user
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: userOrIpKey,
  handler: (req, res) => {
    res.status(429).json({
      error:   'Too many requests',
      message: 'Too many write operations. Please wait a moment.',
    });
  },
});

// Comment limiter — prevent spam
export const commentLimiter = rateLimit({
  windowMs:        60 * 1000, // 1 minute
  max:             20,         // 20 comments per minute
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: userOrIpKey,
  handler: (req, res) => {
    res.status(429).json({
      error:   'Too many comments',
      message: 'Comment rate limit reached. Please wait.',
    });
  },
});

// Auth/sensitive limiter
export const authLimiter = rateLimit({
  windowMs:               15 * 60 * 1000, // 15 minutes
  max:                    10,              // 10 attempts per 15 min
  standardHeaders:        true,
  legacyHeaders:          false,
  skipSuccessfulRequests: true,            // only count failures
  handler: (req, res) => {
    res.status(429).json({
      error:   'Too many attempts',
      message: 'Account temporarily locked. Try again in 15 minutes.',
    });
  },
});
