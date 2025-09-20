import { Request, Response, NextFunction } from 'express';

/**
 * Enhanced Error Handler with Security-First Approach
 * Sanitizes error messages to prevent information leakage
 * while maintaining useful debugging information in development
 */

interface SecurityError extends Error {
  status?: number;
  statusCode?: number;
  errors?: any;
  code?: string;
}

/**
 * Sanitizes error messages to prevent sensitive information exposure
 * Returns generic messages in production, detailed ones in development
 */
function sanitizeErrorMessage(err: SecurityError, isDevelopment: boolean): string {
  // In production, return generic messages for security
  if (!isDevelopment) {
    const status = err.status || err.statusCode || 500;
    
    switch (status) {
      case 400:
        return 'Invalid request data provided';
      case 401:
        return 'Authentication required';
      case 403:
        return 'Access denied';
      case 404:
        return 'Resource not found';
      case 429:
        return 'Too many requests. Please try again later';
      case 500:
      default:
        return 'An internal error occurred. Please try again later';
    }
  }
  
  // In development, provide more detailed error information
  return err.message || 'Internal Server Error';
}

/**
 * Determines if additional error details should be included
 * Only includes details in development environment
 */
function shouldIncludeErrorDetails(isDevelopment: boolean): boolean {
  return isDevelopment;
}

/**
 * Logs error details for monitoring and debugging
 * Includes request context for better troubleshooting
 */
function logError(err: SecurityError, req: Request): void {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    status: err.status || err.statusCode || 500,
    message: err.message,
    stack: err.stack,
    // Avoid logging sensitive data
    body: req.method !== 'GET' ? '[REDACTED]' : undefined,
    headers: {
      // Only log safe headers
      'content-type': req.get('Content-Type'),
      'accept': req.get('Accept'),
      'origin': req.get('Origin'),
    }
  };
  
  // Log based on severity
  if (errorInfo.status >= 500) {
    console.error('Server Error:', errorInfo);
  } else if (errorInfo.status >= 400) {
    console.warn('Client Error:', errorInfo);
  }
}

export function errorHandler(err: SecurityError, req: Request, res: Response, next: NextFunction) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const status = err.status || err.statusCode || 500;
  
  // Log error for monitoring
  logError(err, req);
  
  // Prepare sanitized response
  const response: any = {
    success: false,
    message: sanitizeErrorMessage(err, isDevelopment),
  };
  
  // Include additional details only in development
  if (shouldIncludeErrorDetails(isDevelopment)) {
    response.details = {
      originalMessage: err.message,
      code: err.code,
      errors: err.errors,
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method
    };
  }
  
  // Set security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });
  
  // Send sanitized error response
  res.status(status).json(response);
}
