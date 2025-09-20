import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

/**
 * Performance Optimization Middleware Suite
 * Implements compression, caching headers, and performance monitoring
 */

/**
 * Enhanced compression configuration
 * Optimizes response sizes and transfer speeds
 */
export const compressionMiddleware = compression({
  // Compression level (1-9, higher = better compression but slower)
  level: 6,
  
  // Minimum response size to compress (in bytes)
  threshold: 1024,
  
  // Custom filter for what to compress
  filter: (req: Request, res: Response) => {
    // Don't compress if the client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // Don't compress already compressed files
    const contentType = res.getHeader('Content-Type') as string;
    if (contentType && (
      contentType.includes('image/') ||
      contentType.includes('video/') ||
      contentType.includes('audio/') ||
      contentType.includes('application/zip') ||
      contentType.includes('application/pdf')
    )) {
      return false;
    }
    
    // Use compression for text-based responses
    return compression.filter(req, res);
  },
  
  // Memory level (1-9, higher = more memory but better compression)
  memLevel: 8,
  
  // Window size for compression algorithm
  windowBits: 15,
  
  // Compression strategy
  strategy: 0 // Z_DEFAULT_STRATEGY equivalent
});

/**
 * Response caching headers middleware
 * Optimizes client-side caching for better performance
 */
export function cacheControlMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = req.path;
  const method = req.method;
  
  // Only apply caching to GET requests
  if (method !== 'GET') {
    return next();
  }
  
  // Static assets - aggressive caching
  if (path.match(/\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
  }
  
  // API responses - short-term caching with revalidation
  else if (path.startsWith('/api/')) {
    // Product data - moderate caching
    if (path.includes('/products')) {
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600'); // 5 min cache, 10 min stale
    }
    
    // User data - no caching for security
    else if (path.includes('/auth') || path.includes('/profile') || path.includes('/orders')) {
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    // Cart data - very short caching
    else if (path.includes('/cart')) {
      res.setHeader('Cache-Control', 'private, max-age=60'); // 1 minute
    }
    
    // General API - short caching
    else {
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120'); // 1 min cache, 2 min stale
    }
  }
  
  // Health checks - short caching
  else if (path === '/health' || path === '/api/health') {
    res.setHeader('Cache-Control', 'public, max-age=30'); // 30 seconds
  }
  
  // Default - no caching
  else {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  }
  
  // Add ETag support for conditional requests
  res.setHeader('ETag', `"${Date.now()}-${Math.random().toString(36).substr(2, 9)}"`);
  
  next();
}

/**
 * Performance monitoring middleware
 * Tracks response times and resource usage
 */
interface PerformanceMetric {
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  userAgent?: string;
  ip: string;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
}

// In-memory performance metrics storage (in production, use Redis or database)
const performanceMetrics: PerformanceMetric[] = [];
const MAX_METRICS_STORAGE = 1000; // Keep last 1000 metrics

export function performanceMonitoringMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = process.hrtime.bigint();
  const startCpuUsage = process.cpuUsage();
  
  // Override res.end to capture performance data
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const endTime = process.hrtime.bigint();
    const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const endCpuUsage = process.cpuUsage(startCpuUsage);
    
    const metric: PerformanceMetric = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      memoryUsage: process.memoryUsage(),
      cpuUsage: endCpuUsage
    };
    
    // Store metric (in production, send to monitoring service)
    performanceMetrics.push(metric);
    
    // Keep only recent metrics to prevent memory leaks
    if (performanceMetrics.length > MAX_METRICS_STORAGE) {
      performanceMetrics.shift();
    }
    
    // Log slow requests
    if (responseTime > 1000) { // Log requests taking more than 1 second
      console.warn(`[PERFORMANCE] Slow request detected:`, {
        method: req.method,
        path: req.path,
        responseTime: `${responseTime.toFixed(2)}ms`,
        statusCode: res.statusCode,
        memoryMB: Math.round(metric.memoryUsage.heapUsed / 1024 / 1024),
        cpuUser: endCpuUsage.user,
        cpuSystem: endCpuUsage.system
      });
    }
    
    // Add performance headers for debugging
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('X-Response-Time', `${responseTime.toFixed(2)}ms`);
      res.setHeader('X-Memory-Usage', `${Math.round(metric.memoryUsage.heapUsed / 1024 / 1024)}MB`);
    }
    
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
}

/**
 * Memory optimization middleware
 * Prevents memory leaks and optimizes garbage collection
 */
export function memoryOptimizationMiddleware(req: Request, res: Response, next: NextFunction) {
  // Force garbage collection periodically (development only)
  if (process.env.NODE_ENV === 'development' && global.gc) {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    
    // Force GC if heap usage is high
    if (heapUsedMB > 100) { // If using more than 100MB
      global.gc();
    }
  }
  
  // Clean up request-specific data
  res.on('finish', () => {
    // Clear any request-specific caches or temporary data
    delete (req as any).cachedData;
    delete (req as any).temporaryFiles;
  });
  
  next();
}

interface QueryTracker {
  queries: Array<{
    type: string;
    collection: string;
    query: string;
    duration: number;
    timestamp: string;
  }>;
  startTime: number;
  trackQuery: (queryType: string, collection: string, query: any, duration: number) => void;
  getStats: () => {
    totalQueries: number;
    totalTime: number;
    averageTime: number;
    slowQueries: any[];
  };
}

/**
 * Database query optimization middleware
 * Adds query performance monitoring and optimization hints
 */
export function dbQueryOptimizationMiddleware(req: Request, res: Response, next: NextFunction) {
  // Add query performance tracking to request context
  (req as any).queryTracker = {
    queries: [],
    startTime: Date.now(),
    
    trackQuery: function(queryType: string, collection: string, query: any, duration: number) {
      this.queries.push({
        type: queryType,
        collection,
        query: JSON.stringify(query).substring(0, 200), // Truncate large queries
        duration,
        timestamp: new Date().toISOString()
      });
    },
    
    getStats: function() {
      return {
        totalQueries: this.queries.length,
        totalTime: this.queries.reduce((sum: number, q: any) => sum + q.duration, 0),
        averageTime: this.queries.length > 0 
          ? this.queries.reduce((sum: number, q: any) => sum + q.duration, 0) / this.queries.length 
          : 0,
        slowQueries: this.queries.filter((q: any) => q.duration > 100) // Queries taking more than 100ms
      };
    }
  } as QueryTracker;
  
  // Log database performance at request end
  res.on('finish', () => {
    const tracker = (req as any).queryTracker;
    if (tracker && tracker.queries.length > 0) {
      const stats = tracker.getStats();
      
      if (stats.slowQueries.length > 0 || stats.totalTime > 500) {
        console.warn(`[DB_PERFORMANCE] Slow database queries detected:`, {
          path: req.path,
          totalQueries: stats.totalQueries,
          totalTime: `${stats.totalTime}ms`,
          averageTime: `${stats.averageTime.toFixed(2)}ms`,
          slowQueries: stats.slowQueries.length
        });
      }
    }
  });
  
  next();
}

/**
 * Get current performance metrics
 */
export function getPerformanceMetrics() {
  if (performanceMetrics.length === 0) {
    return {
      totalRequests: 0,
      averageResponseTime: 0,
      slowRequests: 0,
      errorRate: 0,
      memoryUsage: process.memoryUsage()
    };
  }
  
  const totalRequests = performanceMetrics.length;
  const averageResponseTime = performanceMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;
  const slowRequests = performanceMetrics.filter(m => m.responseTime > 1000).length;
  const errorRequests = performanceMetrics.filter(m => m.statusCode >= 400).length;
  
  return {
    totalRequests,
    averageResponseTime: Math.round(averageResponseTime * 100) / 100,
    slowRequests,
    errorRate: Math.round((errorRequests / totalRequests) * 10000) / 100, // Percentage with 2 decimals
    memoryUsage: process.memoryUsage(),
    recentMetrics: performanceMetrics.slice(-10) // Last 10 requests
  };
}