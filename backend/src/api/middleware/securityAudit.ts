import { Request, Response, NextFunction } from 'express';

/**
 * Security Audit Logging Middleware
 * Tracks security-relevant events for monitoring and compliance
 */

interface SecurityEvent {
  timestamp: string;
  type: 'AUTH_ATTEMPT' | 'AUTH_SUCCESS' | 'AUTH_FAILURE' | 'ACCESS_DENIED' | 'SUSPICIOUS_ACTIVITY' | 'RATE_LIMIT_HIT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  ip: string;
  userAgent: string;
  endpoint: string;
  method: string;
  details?: any;
}

/**
 * Logs security events with structured format
 */
function logSecurityEvent(event: SecurityEvent): void {
  const logLevel = event.severity === 'CRITICAL' ? 'error' : 
                   event.severity === 'HIGH' ? 'warn' : 'info';
  
  console[logLevel](`[SECURITY_AUDIT] ${event.type}:`, {
    ...event,
    environment: process.env.NODE_ENV || 'development'
  });
  
  // In production, you might want to send this to a security monitoring service
  // Example: await sendToSecurityMonitoring(event);
}

/**
 * Extracts user information from request
 */
function extractUserInfo(req: Request): { userId?: string, ip: string, userAgent: string } {
  return {
    userId: (req as any).user?.id || (req as any).user?._id?.toString(),
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown'
  };
}

/**
 * Middleware to log authentication attempts
 */
export function auditAuthAttempt(req: Request, res: Response, next: NextFunction) {
  const userInfo = extractUserInfo(req);
  
  // Log the authentication attempt
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    type: 'AUTH_ATTEMPT',
    severity: 'LOW',
    ...userInfo,
    endpoint: req.path,
    method: req.method,
    details: {
      email: req.body?.email ? req.body.email.substring(0, 5) + '***' : undefined,
      action: req.path.includes('login') ? 'LOGIN' : 
             req.path.includes('register') ? 'REGISTER' : 'AUTH'
    }
  });
  
  // Override res.json to capture the response
  const originalJson = res.json;
  res.json = function(body: any) {
    const success = body?.success !== false && !body?.error && res.statusCode < 400;
    
    logSecurityEvent({
      timestamp: new Date().toISOString(),
      type: success ? 'AUTH_SUCCESS' : 'AUTH_FAILURE',
      severity: success ? 'LOW' : 'MEDIUM',
      ...userInfo,
      userId: success ? body?.user?.id : userInfo.userId,
      endpoint: req.path,
      method: req.method,
      details: {
        statusCode: res.statusCode,
        action: req.path.includes('login') ? 'LOGIN' : 
               req.path.includes('register') ? 'REGISTER' : 'AUTH'
      }
    });
    
    return originalJson.call(this, body);
  };
  
  next();
}

/**
 * Middleware to log access denied events
 */
export function auditAccessDenied(req: Request, res: Response, next: NextFunction) {
  const userInfo = extractUserInfo(req);
  
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    type: 'ACCESS_DENIED',
    severity: 'MEDIUM',
    ...userInfo,
    endpoint: req.path,
    method: req.method,
    details: {
      statusCode: res.statusCode,
      reason: 'INSUFFICIENT_PERMISSIONS'
    }
  });
  
  next();
}

/**
 * Middleware to log suspicious activity
 */
export function auditSuspiciousActivity(reason: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userInfo = extractUserInfo(req);
    
    logSecurityEvent({
      timestamp: new Date().toISOString(),
      type: 'SUSPICIOUS_ACTIVITY',
      severity: 'HIGH',
      ...userInfo,
      endpoint: req.path,
      method: req.method,
      details: {
        reason,
        headers: {
          'x-forwarded-for': req.get('X-Forwarded-For'),
          'origin': req.get('Origin'),
          'referer': req.get('Referer')
        }
      }
    });
    
    next();
  };
}

/**
 * Middleware to log rate limit hits
 */
export function auditRateLimitHit(req: Request, res: Response, next: NextFunction) {
  const userInfo = extractUserInfo(req);
  
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    type: 'RATE_LIMIT_HIT',
    severity: 'MEDIUM',
    ...userInfo,
    endpoint: req.path,
    method: req.method,
    details: {
      rateLimitType: res.get('X-RateLimit-Limit') ? 'API' : 'UNKNOWN',
      remaining: res.get('X-RateLimit-Remaining'),
      reset: res.get('X-RateLimit-Reset')
    }
  });
  
  next();
}

/**
 * General security event logger function for manual use
 */
export function logManualSecurityEvent(
  req: Request,
  type: SecurityEvent['type'],
  severity: SecurityEvent['severity'],
  details?: any
) {
  const userInfo = extractUserInfo(req);
  
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    type,
    severity,
    ...userInfo,
    endpoint: req.path,
    method: req.method,
    details
  });
}