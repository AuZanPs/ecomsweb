/**
 * Rate Limiting Middleware
 * 
 * Implements rate limiting to protect the API from abuse and ensure fair usage.
 * Uses express-rate-limit to enforce different limits based on endpoint sensitivity.
 * 
 * Rate limit tiers:
 * - Authentication: Stricter limits (login, register)
 * - API endpoints: Standard limits for general API usage
 * - Static content: Higher limits for less sensitive operations
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Environment variables for rate limiting configuration
const isProduction = process.env.NODE_ENV === 'production';
const rateLimitMultiplier = isProduction ? 1 : 10; // More lenient in development

/**
 * Generic rate limit error handler
 */
const rateLimitHandler = (req: Request, res: Response) => {
  console.warn(`Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
  
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please try again later.',
    retryAfter: res.get('Retry-After'),
    type: 'RATE_LIMIT_EXCEEDED'
  });
};

/**
 * Key generator function for rate limiting
 * Uses IP address as the primary identifier
 */
const keyGenerator = (req: Request): string => {
  // Use forwarded IP if behind proxy, otherwise use connection IP
  return req.ip || req.connection.remoteAddress || 'unknown';
};

/**
 * Skip successful requests function
 * Only count failed requests towards rate limit for auth endpoints
 */
const skipSuccessfulRequests = (req: Request, res: Response): boolean => {
  return res.statusCode < 400;
};

/**
 * Authentication rate limiter
 * Stricter limits for login/register to prevent brute force attacks
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Math.max(5, 5 * rateLimitMultiplier), // 5 attempts per 15 minutes in production
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    type: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true, // Only count failed auth attempts
  skip: (req: Request) => {
    // Skip rate limiting for test environments
    return process.env.NODE_ENV === 'test';
  }
});

/**
 * API rate limiter
 * Standard rate limiting for general API endpoints
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Math.max(100, 100 * rateLimitMultiplier), // 100 requests per 15 minutes
  message: {
    success: false,
    message: 'API rate limit exceeded. Please try again later.',
    type: 'API_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: (req: Request) => {
    // Skip rate limiting for test environments
    return process.env.NODE_ENV === 'test';
  }
});

/**
 * Webhook rate limiter
 * Special rate limiting for webhook endpoints
 */
export const webhookRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: Math.max(50, 50 * rateLimitMultiplier), // 50 webhook calls per 5 minutes
  message: {
    success: false,
    message: 'Webhook rate limit exceeded.',
    type: 'WEBHOOK_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: (req: Request) => {
    // Skip rate limiting for test environments
    return process.env.NODE_ENV === 'test';
  }
});

/**
 * Password reset rate limiter
 * Prevents abuse of password reset functionality
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: Math.max(3, 3 * rateLimitMultiplier), // 3 password reset attempts per hour
  message: {
    success: false,
    message: 'Too many password reset attempts. Please try again in 1 hour.',
    type: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: (req: Request) => {
    // Skip rate limiting for test environments
    return process.env.NODE_ENV === 'test';
  }
});

/**
 * Cart operations rate limiter
 * Moderate rate limiting for cart operations
 */
export const cartRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: Math.max(30, 30 * rateLimitMultiplier), // 30 cart operations per 5 minutes
  message: {
    success: false,
    message: 'Too many cart operations. Please slow down.',
    type: 'CART_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: (req: Request) => {
    // Skip rate limiting for test environments
    return process.env.NODE_ENV === 'test';
  }
});

/**
 * Search rate limiter
 * Higher limits for product search operations
 */
export const searchRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: Math.max(60, 60 * rateLimitMultiplier), // 60 searches per 5 minutes
  message: {
    success: false,
    message: 'Too many search requests. Please wait a moment.',
    type: 'SEARCH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: (req: Request) => {
    // Skip rate limiting for test environments
    return process.env.NODE_ENV === 'test';
  }
});

/**
 * Global rate limiter
 * Basic protection against general abuse
 */
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Math.max(1000, 1000 * rateLimitMultiplier), // 1000 requests per 15 minutes
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
    type: 'GLOBAL_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: (req: Request) => {
    // Skip rate limiting for test environments and health checks
    return process.env.NODE_ENV === 'test' || req.path === '/health';
  }
});

/**
 * Rate limit configuration summary for logging
 */
export const rateLimitConfig = {
  production: isProduction,
  multiplier: rateLimitMultiplier,
  limits: {
    auth: `${Math.max(5, 5 * rateLimitMultiplier)} per 15 minutes`,
    api: `${Math.max(100, 100 * rateLimitMultiplier)} per 15 minutes`,
    webhook: `${Math.max(50, 50 * rateLimitMultiplier)} per 5 minutes`,
    passwordReset: `${Math.max(3, 3 * rateLimitMultiplier)} per hour`,
    cart: `${Math.max(30, 30 * rateLimitMultiplier)} per 5 minutes`,
    search: `${Math.max(60, 60 * rateLimitMultiplier)} per 5 minutes`,
    global: `${Math.max(1000, 1000 * rateLimitMultiplier)} per 15 minutes`
  }
};

// Log rate limit configuration on startup
console.log('🛡️  Rate limiting configured:', rateLimitConfig);