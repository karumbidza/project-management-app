// FOLLO SECURITY
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Standard API limiter — all routes
export const apiLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             300,             // 300 requests per window
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req),
  handler: (req, res) => {
    res.status(429).json({
      error:      'Too many requests',
      message:    'Please slow down and try again in 15 minutes.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

// Strict limiter — write operations
export const writeLimiter = rateLimit({
  windowMs:        60 * 1000, // 1 minute
  max:             60,         // 60 write ops per minute per user
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req),
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
  keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req),
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
