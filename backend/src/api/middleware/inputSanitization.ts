import { Request, Response, NextFunction } from 'express';

/**
 * Input Sanitization Middleware
 * Prevents XSS attacks by sanitizing user input
 * and validates common attack patterns
 */

/**
 * Simple HTML/XSS sanitization without external dependencies
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str;
  
  return str
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove potentially dangerous characters
    .replace(/[<>'"&]/g, (match) => {
      const htmlEntities: { [key: string]: string } = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return htmlEntities[match] || match;
    })
    // Remove null bytes and control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Recursively sanitizes an object's string values
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Detects common injection attack patterns
 */
function detectSuspiciousPatterns(value: string): boolean {
  const suspiciousPatterns = [
    // SQL injection patterns
    /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bDROP\b|\bCREATE\b)/i,
    /(--|\#|\/\*|\*\/)/,
    /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/i,
    
    // NoSQL injection patterns
    /\$where|\$ne|\$gt|\$lt|\$regex/i,
    
    // XSS patterns
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/i,
    /on\w+\s*=/i,
    
    // Path traversal
    /\.\.\/|\.\.\\/,
    
    // Command injection
    /;\s*(rm|ls|cat|wget|curl|nc|netcat)/i,
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(value));
}

/**
 * Validates and sanitizes request body, query, and params
 */
export function inputSanitizationMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Skip sanitization for webhook endpoints (they need raw data)
    if (req.path.includes('/webhooks/')) {
      return next();
    }
    
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    
    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }
    
    // Check for suspicious patterns in string values
    const allValues: string[] = [];
    
    // Collect all string values from request
    function collectStrings(obj: any) {
      if (typeof obj === 'string') {
        allValues.push(obj);
      } else if (Array.isArray(obj)) {
        obj.forEach(collectStrings);
      } else if (typeof obj === 'object' && obj !== null) {
        Object.values(obj).forEach(collectStrings);
      }
    }
    
    collectStrings(req.body);
    collectStrings(req.query);
    collectStrings(req.params);
    
    // Check for suspicious patterns
    const suspiciousValue = allValues.find(detectSuspiciousPatterns);
    if (suspiciousValue) {
      console.warn(`Suspicious input detected from ${req.ip}: ${suspiciousValue.substring(0, 100)}`);
      
      return res.status(400).json({
        success: false,
        message: 'Invalid input detected. Please check your request data.',
        code: 'SUSPICIOUS_INPUT'
      });
    }
    
    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    next(error);
  }
}

/**
 * Request size validation middleware
 */
export function requestSizeValidation(req: Request, res: Response, next: NextFunction) {
  const maxBodySize = 10 * 1024 * 1024; // 10MB
  const contentLength = parseInt(req.get('content-length') || '0');
  
  if (contentLength > maxBodySize) {
    return res.status(413).json({
      success: false,
      message: 'Request body too large',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }
  
  next();
}