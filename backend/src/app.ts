import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectMongo } from './api/bootstrap/mongo';
import { requestLogger } from './api/middleware/logging';
import { securityMiddleware } from './api/middleware/security';
import { errorHandler } from './api/middleware/errorHandler';
import { inputSanitizationMiddleware, requestSizeValidation } from './api/middleware/inputSanitization';
import { performanceTiming, performanceStatsHandler } from './api/middleware/timing';
import { 
  compressionMiddleware,
  cacheControlMiddleware,
  performanceMonitoringMiddleware,
  memoryOptimizationMiddleware,
  dbQueryOptimizationMiddleware,
  getPerformanceMetrics
} from './api/middleware/performance';
import { optimizeDatabaseConnection, getDatabasePerformanceMetrics, getCacheStats } from './services/DatabaseOptimization';
import { 
  globalRateLimit, 
  authRateLimit, 
  apiRateLimit, 
  webhookRateLimit,
  cartRateLimit,
  searchRateLimit
} from './api/middleware/rateLimit';

// Import routes
import authRoutes from './api/routes/authRoutes';
import productRoutes from './api/routes/productRoutes';
import cartRoutes from './api/routes/cartRoutes';
import checkoutRoutes from './api/routes/checkoutRoute';
import orderRoutes from './api/routes/orderRoutes';
import paymentWebhookRoutes from './api/routes/paymentWebhookRoute';
import stripeWebhookRoutes from './api/routes/webhookRoute';

// Load environment variables
dotenv.config();

const app = express();

// Initialize MongoDB connection with optimizations
connectMongo().then(() => {
  optimizeDatabaseConnection();
  console.log('[PERFORMANCE] Database optimizations initialized');
}).catch(console.error);

// Global middleware - order is important for performance
app.use(compressionMiddleware);
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Performance and memory optimization
app.use(cacheControlMiddleware);
app.use(performanceMonitoringMiddleware);
app.use(memoryOptimizationMiddleware);
app.use(dbQueryOptimizationMiddleware);

// Request size validation (before body parsing)
app.use(requestSizeValidation);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply security and logging middleware
app.use(securityMiddleware);
app.use(inputSanitizationMiddleware);
app.use(performanceTiming);
app.use(requestLogger);

// Apply global rate limiting
app.use(globalRateLimit);

// Basic health check routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Performance statistics endpoint
app.get('/api/stats', performanceStatsHandler);

// Enhanced performance metrics endpoint
app.get('/api/performance', async (req, res) => {
  try {
    const performanceMetrics = getPerformanceMetrics();
    const dbMetrics = await getDatabasePerformanceMetrics();
    const cacheStats = getCacheStats();
    
    res.json({
      success: true,
      data: {
        server: performanceMetrics,
        database: dbMetrics,
        cache: cacheStats,
        serverInfo: {
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
          environment: process.env.NODE_ENV || 'development'
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve performance metrics',
      error: error.message
    });
  }
});

// API routes with specific rate limiting
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/products', searchRateLimit, productRoutes);
app.use('/api/cart', cartRateLimit, cartRoutes);
app.use('/api/checkout', apiRateLimit, checkoutRoutes);
app.use('/api/orders', apiRateLimit, orderRoutes);
app.use('/api/webhooks', webhookRateLimit, paymentWebhookRoutes);
app.use('/api/webhooks', webhookRateLimit, stripeWebhookRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;