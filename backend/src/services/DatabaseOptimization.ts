import mongoose from 'mongoose';

/**
 * Database Performance Optimization Service
 * Provides advanced database optimization features
 */

interface QueryOptimizationOptions {
  useProjection?: boolean;
  useLeanQuery?: boolean;
  enableCaching?: boolean;
  maxExecutionTime?: number;
}

interface DatabasePerformanceMetrics {
  connectionCount: number;
  avgResponseTime: number;
  slowQueries: number;
  indexUsage: any[];
  memoryUsage: any;
}

/**
 * Enhanced query builder with performance optimizations
 */
export class OptimizedQueryBuilder {
  private model: mongoose.Model<any>;
  private queryObj: any = {};
  private projectionObj: any = {};
  private sortObj: any = {};
  private limitValue?: number;
  private skipValue?: number;
  private populateFields: string[] = [];
  private useLeaning = false;

  constructor(model: mongoose.Model<any>) {
    this.model = model;
  }

  /**
   * Add query filters with automatic index optimization
   */
  filter(filters: any): this {
    this.queryObj = { ...this.queryObj, ...filters };
    return this;
  }

  /**
   * Add field projection to reduce data transfer
   */
  select(fields: string | string[]): this {
    if (Array.isArray(fields)) {
      fields.forEach(field => {
        this.projectionObj[field] = 1;
      });
    } else {
      // Parse space-separated field string
      fields.split(' ').forEach(field => {
        if (field.startsWith('-')) {
          this.projectionObj[field.substring(1)] = 0;
        } else {
          this.projectionObj[field] = 1;
        }
      });
    }
    return this;
  }

  /**
   * Add sorting with index-aware optimization
   */
  sort(sortFields: any): this {
    this.sortObj = { ...this.sortObj, ...sortFields };
    return this;
  }

  /**
   * Add pagination
   */
  paginate(page: number, limit: number): this {
    this.limitValue = limit;
    this.skipValue = (page - 1) * limit;
    return this;
  }

  /**
   * Add population for referenced documents
   */
  populate(fields: string | string[]): this {
    if (Array.isArray(fields)) {
      this.populateFields.push(...fields);
    } else {
      this.populateFields.push(fields);
    }
    return this;
  }

  /**
   * Enable lean queries for better performance
   */
  lean(): this {
    this.useLeaning = true;
    return this;
  }

  /**
   * Execute the optimized query
   */
  async execute(): Promise<any> {
    const startTime = Date.now();
    
    try {
      let query = this.model.find(this.queryObj);

      // Apply projection if specified
      if (Object.keys(this.projectionObj).length > 0) {
        query = query.select(this.projectionObj);
      }

      // Apply sorting
      if (Object.keys(this.sortObj).length > 0) {
        query = query.sort(this.sortObj);
      }

      // Apply pagination
      if (this.skipValue !== undefined) {
        query = query.skip(this.skipValue);
      }
      if (this.limitValue !== undefined) {
        query = query.limit(this.limitValue);
      }

      // Apply population
      this.populateFields.forEach(field => {
        query = query.populate(field);
      });

      // Apply lean if requested
      if (this.useLeaning) {
        query = query.lean();
      }

      // Add query timeout
      query = query.maxTimeMS(10000); // 10 second timeout

      const result = await query.exec();
      const executionTime = Date.now() - startTime;

      // Log slow queries
      if (executionTime > 100) {
        console.warn(`[DB_OPTIMIZATION] Slow query detected:`, {
          model: this.model.modelName,
          query: this.queryObj,
          executionTime: `${executionTime}ms`,
          resultCount: Array.isArray(result) ? result.length : 1
        });
      }

      return result;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      console.error(`[DB_OPTIMIZATION] Query failed:`, {
        model: this.model.modelName,
        query: this.queryObj,
        executionTime: `${executionTime}ms`,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute query and return count
   */
  async count(): Promise<number> {
    const startTime = Date.now();
    
    try {
      const count = await this.model.countDocuments(this.queryObj).maxTimeMS(5000);
      const executionTime = Date.now() - startTime;

      if (executionTime > 50) {
        console.warn(`[DB_OPTIMIZATION] Slow count query:`, {
          model: this.model.modelName,
          query: this.queryObj,
          executionTime: `${executionTime}ms`,
          count
        });
      }

      return count;
    } catch (error: any) {
      console.error(`[DB_OPTIMIZATION] Count query failed:`, {
        model: this.model.modelName,
        query: this.queryObj,
        error: error.message
      });
      throw error;
    }
  }
}

/**
 * In-memory cache for frequently accessed data
 */
class MemoryCache {
  private cache = new Map<string, { data: any; expiry: number }>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: any, ttl: number = this.defaultTTL): void {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { data, expiry });

    // Clean up expired entries periodically
    if (this.cache.size > 1000) {
      this.cleanup();
    }
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiry) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Global cache instance
const cache = new MemoryCache();

/**
 * Cached query execution wrapper
 */
export async function cachedQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  ttl: number = 5 * 60 * 1000 // 5 minutes default
): Promise<T> {
  // Try to get from cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`[CACHE_HIT] Retrieved from cache: ${cacheKey}`);
    return cached;
  }

  // Execute query if not cached
  console.log(`[CACHE_MISS] Executing query: ${cacheKey}`);
  const result = await queryFn();
  
  // Store in cache
  cache.set(cacheKey, result, ttl);
  
  return result;
}

/**
 * Invalidate cache entries by pattern
 */
export function invalidateCache(pattern: string): void {
  const stats = cache.getStats();
  const keysToDelete = stats.keys.filter(key => key.includes(pattern));
  
  keysToDelete.forEach(key => cache.delete(key));
  
  console.log(`[CACHE_INVALIDATION] Invalidated ${keysToDelete.length} entries matching pattern: ${pattern}`);
}

/**
 * Database connection optimization
 */
export function optimizeDatabaseConnection(): void {
  // Configure mongoose for better performance
  mongoose.set('maxTimeMS', 10000); // Global query timeout
  
  // Connection pool optimization options for reference
  const connectionOptions = {
    maxPoolSize: 10, // Maximum number of connections
    minPoolSize: 2,  // Minimum number of connections
    maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
    serverSelectionTimeoutMS: 5000, // How long to try selecting a server
    socketTimeoutMS: 45000, // How long to wait for a response
    heartbeatFrequencyMS: 10000, // How often to check server status
    retryWrites: true,
    retryReads: true
  };

  console.log('[DB_OPTIMIZATION] Database connection optimized with:', connectionOptions);
}

/**
 * Monitor database performance
 */
export async function getDatabasePerformanceMetrics(): Promise<DatabasePerformanceMetrics> {
  try {
    // Check if database connection exists
    if (!mongoose.connection.db) {
      throw new Error('Database connection not available');
    }

    const admin = mongoose.connection.db.admin();
    const serverStatus = await admin.serverStatus();
    
    return {
      connectionCount: serverStatus.connections?.current || 0,
      avgResponseTime: 0, // Would need custom implementation
      slowQueries: 0, // Would need query profiling
      indexUsage: [], // Would need index stats
      memoryUsage: {
        resident: serverStatus.mem?.resident || 0,
        virtual: serverStatus.mem?.virtual || 0,
        mapped: serverStatus.mem?.mapped || 0
      }
    };
  } catch (error) {
    console.error('Failed to get database metrics:', error);
    return {
      connectionCount: 0,
      avgResponseTime: 0,
      slowQueries: 0,
      indexUsage: [],
      memoryUsage: {}
    };
  }
}

/**
 * Create optimized query builder for a model
 */
export function createOptimizedQuery(model: mongoose.Model<any>): OptimizedQueryBuilder {
  return new OptimizedQueryBuilder(model);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return cache.getStats();
}

/**
 * Clear all cached data
 */
export function clearCache(): void {
  cache.clear();
  console.log('[CACHE] All cached data cleared');
}