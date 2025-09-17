/**
 * Performance Timing Middleware
 * 
 * Tracks request duration and provides performance metrics for monitoring and optimization.
 * Records timing data for analysis and includes response time headers for client visibility.
 * 
 * Features:
 * - Request duration tracking
 * - Response time headers
 * - Performance logging
 * - Memory usage monitoring
 * - Slow request detection
 */

import { Request, Response, NextFunction } from 'express';

// Interface for performance metrics
interface PerformanceMetrics {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  memoryUsage: NodeJS.MemoryUsage;
  timestamp: Date;
  userAgent?: string;
  ip: string;
}

// Environment configuration
const SLOW_REQUEST_THRESHOLD = parseInt(process.env.SLOW_REQUEST_THRESHOLD || '1000'); // 1 second
const LOG_ALL_REQUESTS = process.env.LOG_ALL_REQUESTS === 'true';
const ENABLE_MEMORY_TRACKING = process.env.ENABLE_MEMORY_TRACKING !== 'false';

/**
 * Format memory usage for logging
 */
function formatMemoryUsage(memUsage: NodeJS.MemoryUsage): string {
  const formatBytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);
  
  return `RSS: ${formatBytes(memUsage.rss)}MB, ` +
         `Heap Used: ${formatBytes(memUsage.heapUsed)}MB, ` +
         `Heap Total: ${formatBytes(memUsage.heapTotal)}MB, ` +
         `External: ${formatBytes(memUsage.external)}MB`;
}

/**
 * Sanitize path for logging (remove sensitive data)
 */
function sanitizePath(path: string): string {
  // Remove potential sensitive data from URLs
  return path
    .replace(/\/\d+(?=\/|$)/g, '/:id') // Replace numeric IDs
    .replace(/[?&]token=[^&]*/g, '') // Remove token parameters
    .replace(/[?&]key=[^&]*/g, '') // Remove key parameters
    .replace(/[?&]password=[^&]*/g, ''); // Remove password parameters
}

/**
 * Performance timing middleware
 */
export const performanceTiming = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = process.hrtime.bigint();
  const startMemory = ENABLE_MEMORY_TRACKING ? process.memoryUsage() : null;
  
  // Add start time to request for potential use by other middleware
  (req as any).startTime = startTime;
  
  // Override res.end to capture timing when response completes
  const originalEnd = res.end.bind(res);
  res.end = function(...args: any[]): Response {
    // Calculate duration
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    // Get final memory usage
    const endMemory = ENABLE_MEMORY_TRACKING ? process.memoryUsage() : null;
    
    // Add timing headers to response
    res.set({
      'X-Response-Time': `${duration.toFixed(2)}ms`,
      'X-Request-ID': req.headers['x-request-id'] as string || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
    
    // Create performance metrics
    const metrics: PerformanceMetrics = {
      method: req.method,
      path: sanitizePath(req.path),
      statusCode: res.statusCode,
      duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
      memoryUsage: endMemory || { rss: 0, heapUsed: 0, heapTotal: 0, external: 0, arrayBuffers: 0 },
      timestamp: new Date(),
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress || 'unknown'
    };
    
    // Log performance data
    logPerformanceMetrics(metrics, startMemory);
    
    // Call original end method
    return originalEnd(...args);
  };
  
  next();
};

/**
 * Log performance metrics based on configuration and thresholds
 */
function logPerformanceMetrics(metrics: PerformanceMetrics, startMemory: NodeJS.MemoryUsage | null): void {
  const isSlowRequest = metrics.duration >= SLOW_REQUEST_THRESHOLD;
  const isErrorResponse = metrics.statusCode >= 400;
  
  // Always log slow requests and errors
  if (isSlowRequest || isErrorResponse || LOG_ALL_REQUESTS) {
    const logLevel = isSlowRequest ? 'warn' : isErrorResponse ? 'error' : 'info';
    const emoji = isSlowRequest ? '🐌' : isErrorResponse ? '❌' : '⚡';
    
    let logMessage = `${emoji} ${metrics.method} ${metrics.path} - ${metrics.statusCode} - ${metrics.duration}ms`;
    
    // Add slow request indicator
    if (isSlowRequest) {
      logMessage += ` (SLOW REQUEST - threshold: ${SLOW_REQUEST_THRESHOLD}ms)`;
    }
    
    // Add memory usage for slow requests or if memory tracking is enabled
    if (ENABLE_MEMORY_TRACKING && (isSlowRequest || LOG_ALL_REQUESTS)) {
      logMessage += ` - Memory: ${formatMemoryUsage(metrics.memoryUsage)}`;
      
      if (startMemory) {
        const memoryDelta = {
          rss: metrics.memoryUsage.rss - startMemory.rss,
          heapUsed: metrics.memoryUsage.heapUsed - startMemory.heapUsed
        };
        
        if (Math.abs(memoryDelta.rss) > 1024 * 1024 || Math.abs(memoryDelta.heapUsed) > 1024 * 1024) { // > 1MB change
          logMessage += ` - ΔMemory: RSS ${memoryDelta.rss > 0 ? '+' : ''}${(memoryDelta.rss / 1024 / 1024).toFixed(2)}MB, `;
          logMessage += `Heap ${memoryDelta.heapUsed > 0 ? '+' : ''}${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`;
        }
      }
    }
    
    // Add client info for errors or slow requests
    if ((isSlowRequest || isErrorResponse) && metrics.userAgent) {
      logMessage += ` - Client: ${metrics.ip} (${metrics.userAgent.substring(0, 50)}${metrics.userAgent.length > 50 ? '...' : ''})`;
    }
    
    console[logLevel](logMessage);
  }
  
  // Store metrics for potential external monitoring (could be extended)
  storeMetricsForMonitoring(metrics);
}

/**
 * Store metrics for external monitoring systems
 * This can be extended to send data to monitoring services like New Relic, DataDog, etc.
 */
function storeMetricsForMonitoring(metrics: PerformanceMetrics): void {
  // For now, just keep in-memory stats for basic monitoring
  // In production, this could send to monitoring services
  
  if (!global.performanceStats) {
    global.performanceStats = {
      totalRequests: 0,
      slowRequests: 0,
      errorRequests: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity
    };
  }
  
  const stats = global.performanceStats;
  stats.totalRequests++;
  
  if (metrics.duration >= SLOW_REQUEST_THRESHOLD) {
    stats.slowRequests++;
  }
  
  if (metrics.statusCode >= 400) {
    stats.errorRequests++;
  }
  
  // Update response time statistics
  stats.averageResponseTime = ((stats.averageResponseTime * (stats.totalRequests - 1)) + metrics.duration) / stats.totalRequests;
  stats.maxResponseTime = Math.max(stats.maxResponseTime, metrics.duration);
  stats.minResponseTime = Math.min(stats.minResponseTime, metrics.duration);
}

/**
 * Middleware to expose performance statistics endpoint
 */
export const performanceStatsHandler = (req: Request, res: Response): void => {
  const stats = global.performanceStats || {
    totalRequests: 0,
    slowRequests: 0,
    errorRequests: 0,
    averageResponseTime: 0,
    maxResponseTime: 0,
    minResponseTime: 0
  };
  
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  res.json({
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(uptime),
      human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
    },
    requests: {
      total: stats.totalRequests,
      slow: stats.slowRequests,
      errors: stats.errorRequests,
      slowPercentage: stats.totalRequests > 0 ? ((stats.slowRequests / stats.totalRequests) * 100).toFixed(2) + '%' : '0%',
      errorPercentage: stats.totalRequests > 0 ? ((stats.errorRequests / stats.totalRequests) * 100).toFixed(2) + '%' : '0%'
    },
    responseTime: {
      average: Math.round(stats.averageResponseTime * 100) / 100,
      max: stats.maxResponseTime === 0 ? 0 : stats.maxResponseTime,
      min: stats.minResponseTime === Infinity ? 0 : stats.minResponseTime,
      slowThreshold: SLOW_REQUEST_THRESHOLD
    },
    memory: {
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`,
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`,
      heapUsedPercentage: `${((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(1)}%`
    },
    configuration: {
      slowRequestThreshold: `${SLOW_REQUEST_THRESHOLD}ms`,
      logAllRequests: LOG_ALL_REQUESTS,
      memoryTrackingEnabled: ENABLE_MEMORY_TRACKING,
      environment: process.env.NODE_ENV || 'development'
    }
  });
};

// Log configuration on startup
console.log('⏱️  Performance timing configured:', {
  slowRequestThreshold: `${SLOW_REQUEST_THRESHOLD}ms`,
  logAllRequests: LOG_ALL_REQUESTS,
  memoryTracking: ENABLE_MEMORY_TRACKING
});

// Declare global type for TypeScript
declare global {
  var performanceStats: {
    totalRequests: number;
    slowRequests: number;
    errorRequests: number;
    averageResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
  } | undefined;
}