import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectMongo } from './api/bootstrap/mongo';
import { requestLogger } from './api/middleware/logging';
import { securityMiddleware } from './api/middleware/security';
import { errorHandler } from './api/middleware/errorHandler';
import { performanceTiming, performanceStatsHandler } from './api/middleware/timing';
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

// Load environment variables
dotenv.config();

const app = express();

// Initialize MongoDB connection (for serverless, this happens on each cold start)
connectMongo().catch(console.error);

// Global middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply security and logging middleware
app.use(securityMiddleware);
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

// API routes with specific rate limiting
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/products', searchRateLimit, productRoutes);
app.use('/api/cart', cartRateLimit, cartRoutes);
app.use('/api/checkout', apiRateLimit, checkoutRoutes);
app.use('/api/orders', apiRateLimit, orderRoutes);
app.use('/api/webhooks', webhookRateLimit, paymentWebhookRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;