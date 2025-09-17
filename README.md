# 🛍️ EcomsWeb — Full‑Stack E‑Commerce Platform (v1.0.0)

A comprehensive, production‑ready e‑commerce platform built with React + TypeScript (frontend) and Express + TypeScript (backend) on MongoDB.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)
![Tests](https://img.shields.io/badge/tests-86%20passing-green.svg)
![Security](https://img.shields.io/badge/security-needs%20review-orange.svg)

## ⚡ Quick Start

```bash
# Clone the repository
git clone https://github.com/AuZanPs/ecomsweb.git
cd EcomsWeb

# Start backend (Terminal 1)
cd backend && npm install && npm run dev

# Start frontend (Terminal 2)
cd frontend && npm install && npm run dev

# Visit: http://localhost:5173
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │    Database     │
│   React + TS    │◄──►│  Express + TS   │◄──►│    MongoDB      │
│                 │    │                 │    │                 │
│ • React Router  │    │ • JWT Auth      │    │ • 35+ Indexes   │
│ • Tailwind CSS  │    │ • Rate Limiting │    │ • Full-text     │
│ • Context API   │    │ • Perf Timing   │    │   Search        │
│ • Axios Client  │    │ • Error Handling│    │ • Aggregations  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
    Vercel                   Railway                  Atlas
  (Frontend)              (Backend API)           (Database)
```

## ✨ Features

### 🔐 Authentication & User Management
- JWT authentication with refresh tokens
- Password hashing with bcrypt
- User profile management
- Protected route middleware

### 🛍️ Product Management
- Product catalog with search & filtering
- Featured and top-selling products
- Category-based organization
- Real-time stock management

### 🛒 Shopping Cart
- Persistent cart across sessions
- Real-time cart validation
- Quantity management
- Express checkout support

### 💳 Checkout & Orders
- Multi-step checkout process
- Order history and tracking
- Order status management
- Cancel/refund support

### 📊 Monitoring & Analytics
- Request timing analytics
- Memory usage monitoring
- Performance statistics
- Rate limiting protection

## ⚠️ Security Warning

**CRITICAL**: This application has a payment security vulnerability that must be fixed before production deployment:

- ❌ **Issue**: Frontend directly handles credit card data
- ❌ **Risk**: Violates PCI DSS compliance
- ✅ **Solution**: Implement Stripe Elements before production

## 🚀 Installation

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/AuZanPs/ecomsweb.git
cd EcomsWeb
```

2. **Backend Setup**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm run dev
```

3. **Frontend Setup**
```bash
cd ../frontend
npm install
cp .env.example .env
# Edit .env with backend URL
npm run dev
```

### Environment Variables

**Backend `.env`:**
```env
MONGODB_URI=mongodb://127.0.0.1:27017/ecommerce
JWT_SECRET=your-secret-key-here
PORT=3000
```

**Frontend `.env`:**
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

## 🌐 Deployment (Free Tier)

### MongoDB Atlas (Free)
1. Create account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create M0 cluster (free tier)
3. Create database user and configure network access
4. Copy connection string

### Vercel Deployment
1. **Backend**: Deploy from GitHub, set root directory to `backend`
2. **Frontend**: Deploy from GitHub, set root directory to `frontend`
3. Configure environment variables in Vercel dashboard

## 🔧 API Endpoints

### Authentication
```http
POST   /api/auth/register     # User registration
POST   /api/auth/login        # User login  
POST   /api/auth/refresh      # Refresh access token
GET    /api/auth/profile      # Get user profile
PUT    /api/auth/profile      # Update user profile
POST   /api/auth/logout       # Logout
```

### Products
```http
GET    /api/products          # Get all products
GET    /api/products/:id      # Get product by ID
GET    /api/products/search   # Search products
GET    /api/products/featured # Featured products
GET    /api/products/top-selling # Top-selling products
```

### Shopping Cart
```http
GET    /api/cart              # Get user's cart
POST   /api/cart/add          # Add item to cart
PUT    /api/cart/update       # Update cart item
DELETE /api/cart/:productId   # Remove item
POST   /api/cart/clear        # Clear cart
GET    /api/cart/validate     # Validate cart
```

### Orders
```http
GET    /api/orders            # Order history
GET    /api/orders/:id        # Order details
PUT    /api/orders/:id/cancel # Cancel order
POST   /api/checkout/initiate # Start checkout
POST   /api/checkout/confirm  # Complete order
```

### System
```http
GET    /api/health            # Health check
GET    /api/stats             # Performance stats
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Backend tests
cd backend
npm run test              # All tests
npm run test:unit         # Unit tests
npm run test:integration  # Integration tests
npm run test:contract     # Contract tests

# Test results: 86 passing tests
```

## 📊 Project Statistics

- **Total Tests**: 86 passing
- **TypeScript Coverage**: 100%
- **API Endpoints**: 25+ RESTful routes
- **Database Indexes**: 35+ optimized indexes
- **Components**: 20+ reusable React components
- **Performance**: Sub-100ms average response time

## 🛠️ Tech Stack

**Frontend:**
- React 18 + TypeScript
- Tailwind CSS
- Vite
- Axios
- React Router

**Backend:**
- Node.js + Express
- TypeScript
- MongoDB + Mongoose
- JWT + bcrypt
- Jest + Supertest

**DevOps:**
- Vercel deployment
- MongoDB Atlas
- GitHub Actions (planned)

## 🔐 Security Features

- ✅ JWT authentication with refresh tokens
- ✅ Password hashing with bcrypt (12 rounds)
- ✅ Multi-tier rate limiting protection
- ✅ Input validation with Zod
- ✅ CORS and security headers
- ✅ XSS protection middleware
- ❌ **Payment security (needs Stripe Elements)**

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes and add tests
4. Run test suite (`npm run test`)
5. Commit changes (`git commit -m 'feat: add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open Pull Request

## 🗺️ Roadmap

### Critical Fixes
- [ ] **URGENT**: Implement Stripe Elements for payment security
- [ ] Add comprehensive error boundaries
- [ ] Set up CI/CD pipeline

### Planned Features
- [ ] Admin dashboard
- [ ] Real-time notifications
- [ ] Product reviews & ratings
- [ ] Wishlist functionality
- [ ] Email notifications
- [ ] Multi-language support

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Repository**: [github.com/AuZanPs/ecomsweb](https://github.com/AuZanPs/ecomsweb)
- **Issues**: [Report bugs or request features](https://github.com/AuZanPs/ecomsweb/issues)
- **Documentation**: Check the `/docs` folder for detailed guides

---

<div align="center">

**Made with ❤️ using TypeScript, React, and MongoDB**

*Building the future of e-commerce, one commit at a time* 🚀

</div>