# 🚀 EcomsWeb Quickstart Guide

## ⚡ Quick Setup (5 minutes)

### Prerequisites ✅
- **Node.js**: 18+ (check: `node --version`)
- **Git**: Latest version
- **MongoDB**: Local installation OR MongoDB Atlas account
- **Text Editor**: VS Code recommended

### 🏃‍♂️ Fast Track Setup

```bash
# 1. Clone & Navigate
git clone https://github.com/yourusername/EcomsWeb
cd EcomsWeb

# 2. Backend Setup (Terminal 1)
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm run dev

# 3. Frontend Setup (Terminal 2)
cd frontend
npm install
cp .env.example .env
# Edit .env with backend URL
npm run dev

# 4. Visit http://localhost:5173 🎉
```

### 🔧 Environment Configuration

**Backend `.env`:**
```bash
# Database
MONGODB_URI=mongodb://127.0.0.1:27017/ecommerce
# OR MongoDB Atlas: mongodb+srv://user:pass@cluster.mongodb.net/ecommerce

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Security
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development

# Server
PORT=3000
```

**Frontend `.env`:**
```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

## 🧪 Testing Guide

### Running the Test Suite

**Complete Test Suite:**
```bash
cd backend

# Run all tests (recommended first run)
npm test

# Run with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

**Test Categories:**

```bash
# Contract Tests - API endpoint validation
npm run test contract/

# Integration Tests - End-to-end workflows  
npm run test integration/

# Unit Tests - Individual component testing
npm run test unit/
```

### 📊 Expected Test Results
```
✅ Test Suites: 9 passed, 9 total
✅ Tests: 86 passed, 86 total  
⏱️ Time: ~15-20 seconds
📈 Coverage: 78% statements, 65% branches
```

### 🔍 Test Details

**Contract Tests** (API Validation):
- `auth.contract.test.ts` - Authentication endpoints
- `products.contract.test.ts` - Product CRUD operations
- `cart.contract.test.ts` - Shopping cart functionality
- `checkout-orders.contract.test.ts` - Checkout & order processing

**Integration Tests** (User Workflows):
- `auth.flow.test.ts` - Complete authentication flow
- `products.flow.test.ts` - Product browsing & search
- `cart.flow.test.ts` - Shopping cart operations
- `checkout-success.flow.test.ts` - Successful checkout process
- `stock-adjust.flow.test.ts` - Stock adjustment scenarios
- `payment-retry.flow.test.ts` - Payment failure handling
- `order-cancel.flow.test.ts` - Order cancellation logic

**Unit Tests** (Component Testing):
- `validation.schemas.test.ts` - Input validation rules
- `order-status-guard.test.ts` - Business logic validation

## 🚀 Development Workflow

### 🏁 First-Time Setup

1. **Database Preparation:**
```bash
# Option 1: Local MongoDB
mongod --dbpath /path/to/your/db

# Option 2: MongoDB Atlas (recommended)
# Create free cluster at https://cloud.mongodb.com
# Get connection string and update .env
```

2. **Create Database Indexes:**
```bash
cd backend
npm run create-indexes
# Creates 35+ performance indexes
```

3. **Seed Sample Data** (Optional):
```bash
cd backend
npm run seed-products
# Adds sample products for testing
```

### 🔄 Daily Development

```bash
# Start both servers
npm run dev:all

# Or separately:
cd backend && npm run dev    # Terminal 1
cd frontend && npm run dev   # Terminal 2
```

### 🧪 Testing During Development

```bash
# Run tests after making changes
npm test

# Watch mode for continuous testing
npm run test:watch

# Check specific functionality
npm test auth.flow.test.ts
npm test cart.contract.test.ts
```

## ✅ Verification Flow

### 🔐 Authentication Flow
1. **Register**: POST `/api/auth/register` with email/password
2. **Login**: POST `/api/auth/login` → receive JWT tokens
3. **Profile**: GET `/api/auth/profile` with Bearer token
4. **Refresh**: POST `/api/auth/refresh` to renew tokens

### 🛍️ Shopping Flow
1. **Browse Products**: GET `/api/products` → view catalog
2. **Search**: GET `/api/products/search?q=laptop` → filtered results
3. **Add to Cart**: POST `/api/cart/add` → cart item added
4. **View Cart**: GET `/api/cart` → see cart contents & total
5. **Update Quantity**: PUT `/api/cart/update` → recalculated total
6. **Checkout**: POST `/api/checkout/initiate` → order creation
7. **Confirm Order**: POST `/api/checkout/confirm` → order completion

### 📱 Frontend Navigation
1. **Home**: `http://localhost:5173/` → product catalog
2. **Login**: `/auth` → authentication page
3. **Cart**: `/cart` → shopping cart view
4. **Checkout**: `/checkout` → order completion
5. **Orders**: `/orders` → order history

## 🎯 Testing Specific Features

### 🧪 Manual Testing Checklist

**Authentication:**
- [ ] User can register with valid email/password
- [ ] User can login and receive tokens
- [ ] Protected routes require authentication
- [ ] Tokens refresh automatically

**Products:**
- [ ] Product list loads correctly
- [ ] Search functionality works
- [ ] Product details display properly
- [ ] Filtering by category works

**Shopping Cart:**
- [ ] Items can be added to cart
- [ ] Cart persists across browser sessions
- [ ] Quantities can be updated
- [ ] Items can be removed
- [ ] Cart totals calculate correctly

**Checkout:**
- [ ] Checkout process initiates
- [ ] Order confirmation works
- [ ] Order appears in history
- [ ] Order status updates properly

### 🔍 Automated Testing

```bash
# Comprehensive test coverage
npm run test:all

# Performance testing
npm run test:performance

# Security testing
npm run test:security

# API contract validation
npm run test:contracts
```

## 🚨 Troubleshooting

| **Issue** | **Solution** |
|-----------|-------------|
| **MongoDB Connection Failed** | Check `MONGODB_URI` in `.env`, ensure MongoDB is running |
| **JWT Authentication Errors** | Verify `JWT_SECRET` is set, check token format |
| **CORS Errors** | Update `CORS_ORIGIN` in backend `.env` |
| **Port Already in Use** | Change `PORT` in `.env` or kill existing process |
| **Tests Failing** | Run `npm run test:clean` and `npm test` |
| **Frontend Build Errors** | Check `VITE_API_BASE_URL` in frontend `.env` |
| **Database Index Errors** | Run `npm run create-indexes` manually |
| **Empty Product List** | Run `npm run seed-products` to add sample data |

### 📊 Health Checks

```bash
# Backend health
curl http://localhost:3000/api/health

# Frontend accessibility
curl http://localhost:5173

# Database connection
node -e "require('./src/api/bootstrap/mongo.ts')"

# Performance stats
curl http://localhost:3000/api/stats
```

### 🔧 Debug Mode

```bash
# Enable debug logging
DEBUG=* npm run dev

# TypeScript compilation check
npm run type-check

# Linting check
npm run lint

# Dependency audit
npm audit
```

## 🚀 Next Steps

After successful setup:

1. **🔒 Security**: Address payment card data vulnerability (implement Stripe Elements)
2. **📚 Explore**: Check out the comprehensive [README.md](../../README.md)
3. **🧪 Test**: Run the full test suite to understand functionality
4. **🎨 Customize**: Modify components and add your own features
5. **🚀 Deploy**: Follow deployment guide for production setup

---

**🎉 Happy Coding!** If you encounter any issues, check the [comprehensive README](../../README.md) or create an issue on GitHub.

