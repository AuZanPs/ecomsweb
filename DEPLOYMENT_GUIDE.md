# EcomsWeb - Complete Deployment Guide

> **A step-by-step guide to deploy your full-stack e-commerce platform to production**

## 🎯 Overview

This guide will walk you through deploying the EcomsWeb project - a production-ready e-commerce platform with React frontend, Express backend, and MongoDB database. We'll deploy both services to Vercel for a seamless production setup.

**What we'll accomplish:**
- ✅ Set up local development environment
- ✅ Deploy backend API to Vercel
- ✅ Deploy frontend React app to Vercel  
- ✅ Configure production databases and services
- ✅ Test the complete production system

---

## 📋 Phase 1: Prerequisites & Preparation

### Required Accounts & Tools

Before starting, ensure you have these accounts and tools ready:

#### Essential Accounts
- [ ] **GitHub Account** - To access the repository
- [ ] **Vercel Account** - For deploying frontend and backend
- [ ] **MongoDB Atlas Account** - For production database
- [ ] **Stripe Account** - For payment processing

#### Development Tools
- [ ] **Node.js 18+** - Download from [nodejs.org](https://nodejs.org)
- [ ] **Git** - Download from [git-scm.com](https://git-scm.com)
- [ ] **Code Editor** - VS Code recommended

#### Required API Keys (Get these ready)
- [ ] **MongoDB Connection String** (from MongoDB Atlas)
- [ ] **Stripe Publishable Key** (from Stripe Dashboard)
- [ ] **Stripe Secret Key** (from Stripe Dashboard)
- [ ] **JWT Secret** (generate a secure random string)

---

## 🚀 Phase 2: Local Development Setup

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/AuZanPs/ecomsweb.git
cd ecomsweb

# Check the project structure
ls -la
```

You should see:
```
📁 backend/     # Express.js API
📁 frontend/    # React.js application
📁 docs/        # Documentation
📄 README.md    # Project overview
```

### Step 2: Backend Setup

#### Install Backend Dependencies
```bash
cd backend
npm install
```

#### Create Backend Environment File
```bash
# Create .env file in backend directory
touch .env
```

#### Configure Backend Environment Variables
Edit `backend/.env` and add:

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/ecomsweb
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ecomsweb

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-key-minimum-32-characters

# Stripe Configuration (Test Keys for Development)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Environment
NODE_ENV=development

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

#### Start Backend Development Server
```bash
npm run dev
```

✅ **Success Check:** Visit `http://localhost:5000/health` - should return `{"status":"OK"}`

### Step 3: Frontend Setup

#### Install Frontend Dependencies
```bash
# Open new terminal and navigate to frontend
cd frontend
npm install
```

#### Create Frontend Environment File
```bash
# Create .env file in frontend directory
touch .env
```

#### Configure Frontend Environment Variables
Edit `frontend/.env` and add:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:5000

# Stripe Configuration (Publishable Key for Development)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
```

#### Start Frontend Development Server
```bash
npm run dev
```

✅ **Success Check:** Visit `http://localhost:3000` (or the URL shown) - should load the e-commerce homepage

### Step 4: Database Setup

#### Option A: MongoDB Atlas (Recommended for Production)
1. Create account at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create a new cluster
3. Create database user
4. Get connection string
5. Update `MONGODB_URI` in backend `.env`

#### Option B: Local MongoDB
```bash
# Install MongoDB locally (macOS)
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Use local connection string
MONGODB_URI=mongodb://localhost:27017/ecomsweb
```

---

## 🌐 Phase 3: Production Deployment

### Step 1: Prepare for Production

#### Install Vercel CLI
```bash
npm install -g vercel
```

#### Login to Vercel
```bash
vercel login
```

### Step 2: Deploy Backend to Vercel

#### Navigate to Backend Directory
```bash
cd backend
```

#### Deploy Backend
```bash
vercel --prod
```

Follow the prompts:
- **Set up and deploy?** `Y`
- **Which scope?** Choose your account
- **Project name?** `ecomsweb-backend` (or your preferred name)
- **Directory?** Press Enter (current directory)

#### Configure Backend Environment Variables in Vercel

After deployment, go to your Vercel dashboard and add these environment variables for your backend project:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ecomsweb
JWT_SECRET=your-production-jwt-secret-key
STRIPE_SECRET_KEY=sk_live_your_production_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret
NODE_ENV=production
CORS_ORIGINS=https://your-frontend-domain.vercel.app
```

**Important:** 📝 Note your backend URL (e.g., `https://ecomsweb-backend.vercel.app`)

#### Redeploy Backend
```bash
vercel --prod
```

### Step 3: Deploy Frontend to Vercel

#### Navigate to Frontend Directory
```bash
cd ../frontend
```

#### Update Frontend Environment for Production
Edit `frontend/.env`:

```env
# Use your deployed backend URL
VITE_API_BASE_URL=https://your-backend-url.vercel.app

# Use production Stripe key
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_production_stripe_publishable_key
```

#### Deploy Frontend
```bash
vercel --prod
```

Follow the prompts:
- **Set up and deploy?** `Y`
- **Which scope?** Choose your account
- **Project name?** `ecomsweb-frontend` (or your preferred name)
- **Directory?** Press Enter (current directory)

#### Configure Frontend Environment Variables in Vercel

In your Vercel dashboard for the frontend project, add:

```env
VITE_API_BASE_URL=https://your-backend-url.vercel.app
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_production_stripe_publishable_key
```

**Important:** 📝 Note your frontend URL (e.g., `https://ecomsweb-frontend.vercel.app`)

---

## ⚙️ Phase 4: Production Configuration

### Step 1: Update CORS Settings

#### Update Backend CORS
In your backend Vercel dashboard, update the `CORS_ORIGINS` environment variable:

```env
CORS_ORIGINS=https://your-frontend-domain.vercel.app
```

Then redeploy the backend:
```bash
cd backend
vercel --prod
```

### Step 2: Configure Stripe Webhooks

#### Create Production Webhook
1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Webhooks
2. Click "Add endpoint"
3. **Endpoint URL:** `https://your-backend-url.vercel.app/api/webhooks/stripe`
4. **Events to send:**
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed` 
   - `checkout.session.completed`
5. Click "Add endpoint"
6. Copy the "Signing secret" (starts with `whsec_`)

#### Update Webhook Secret
In your backend Vercel dashboard, update:

```env
STRIPE_WEBHOOK_SECRET=whsec_your_new_webhook_signing_secret
```

Redeploy the backend:
```bash
cd backend
vercel --prod
```

### Step 3: MongoDB Atlas Production Setup

#### Configure Network Access
1. Go to MongoDB Atlas Dashboard
2. Navigate to "Network Access"
3. Click "Add IP Address"
4. Add `0.0.0.0/0` (allows access from Vercel's dynamic IPs)
5. Click "Confirm"

#### Verify Database Connection
Check your backend logs in Vercel dashboard for successful MongoDB connection.

---

## ✅ Phase 5: Testing & Verification

### Step 1: Health Checks

#### Test Backend API
```bash
curl https://your-backend-url.vercel.app/health
```
Expected response:
```json
{"status":"OK","timestamp":"2025-09-20T..."}
```

#### Test Frontend
Visit `https://your-frontend-url.vercel.app`
- ✅ Homepage loads
- ✅ Navigation works
- ✅ No console errors

### Step 2: Feature Testing

#### Test User Registration
1. Go to your frontend URL
2. Click "Sign Up" or "Register"
3. Create a test account
4. Verify email/password validation works

#### Test Product Browsing
1. Browse products on homepage
2. Test search functionality
3. View product details
4. Add items to cart

#### Test Payment Flow (Use Stripe Test Cards)
1. Add items to cart
2. Go to checkout
3. Use test card: `4242 4242 4242 4242`
4. Complete purchase
5. Verify order confirmation

**Stripe Test Cards:**
- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **Requires Auth:** `4000 0025 0000 3155`

### Step 3: Performance Monitoring

#### Check Performance Metrics
Visit these endpoints to monitor your app:

```bash
# Performance metrics
curl https://your-backend-url.vercel.app/api/performance

# Health stats
curl https://your-backend-url.vercel.app/api/stats
```

#### Monitor Response Times
Expected performance (based on optimizations):
- ✅ API responses: < 100ms average
- ✅ Database queries: < 50ms average
- ✅ Page load times: < 2 seconds

---

## 🔧 Phase 6: Production Monitoring & Maintenance

### Environment Variables Checklist

#### Backend Production Environment
```env
✅ MONGODB_URI           # MongoDB Atlas connection
✅ JWT_SECRET           # Secure random string (32+ chars)
✅ STRIPE_SECRET_KEY    # sk_live_... (production key)
✅ STRIPE_WEBHOOK_SECRET # whsec_... (from webhook config)
✅ NODE_ENV=production  # Set to production
✅ CORS_ORIGINS         # Your frontend domain
```

#### Frontend Production Environment
```env
✅ VITE_API_BASE_URL            # Your backend Vercel URL
✅ VITE_STRIPE_PUBLISHABLE_KEY  # pk_live_... (production key)
```

### Security Checklist
- [ ] Using HTTPS for all communications
- [ ] Environment variables secured in Vercel
- [ ] Database access restricted to your app
- [ ] Stripe webhook signatures verified
- [ ] CORS properly configured
- [ ] Rate limiting enabled

### Performance Monitoring
- [ ] Monitor Vercel function logs
- [ ] Check MongoDB Atlas metrics
- [ ] Monitor Stripe webhook delivery
- [ ] Test payment flows regularly
- [ ] Monitor error rates and response times

---

## 🆘 Troubleshooting Guide

### Common Issues & Solutions

#### Backend Issues

**❌ "MongoDB connection failed"**
```bash
# Check MongoDB Atlas network access
# Verify connection string format
# Check username/password encoding
```

**❌ "CORS error in browser"**
```bash
# Update CORS_ORIGINS in backend Vercel dashboard
# Redeploy backend after updating
```

**❌ "Stripe webhook verification failed"**
```bash
# Check STRIPE_WEBHOOK_SECRET matches Stripe dashboard
# Verify webhook URL is correct
# Redeploy backend after updating secret
```

#### Frontend Issues

**❌ "API calls failing"**
```bash
# Check VITE_API_BASE_URL points to backend
# Verify backend is deployed and accessible
# Check browser network tab for error details
```

**❌ "Stripe Elements not loading"**
```bash
# Verify VITE_STRIPE_PUBLISHABLE_KEY is correct
# Check browser console for Stripe errors
# Ensure you're using the correct key format (pk_live_ or pk_test_)
```

#### Deployment Issues

**❌ "Vercel build failing"**
```bash
# Check build logs in Vercel dashboard
# Verify all dependencies are in package.json
# Check for TypeScript errors
```

**❌ "Environment variables not working"**
```bash
# Verify variables are set in Vercel dashboard
# Check variable names match exactly (case-sensitive)
# Redeploy after adding/updating variables
```

### Getting Help

1. **Check Vercel Logs:** Vercel Dashboard → Your Project → Functions tab
2. **MongoDB Logs:** Atlas Dashboard → Clusters → Metrics
3. **Stripe Logs:** Stripe Dashboard → Events
4. **Browser Console:** F12 → Console tab for frontend errors

---

## 🎉 Congratulations!

You've successfully deployed EcomsWeb to production! Your e-commerce platform now features:

- ✅ **Secure Payment Processing** with Stripe Elements
- ✅ **Production Database** with MongoDB Atlas
- ✅ **Scalable Hosting** on Vercel
- ✅ **Enterprise Security** with rate limiting and CORS
- ✅ **Performance Optimization** with caching and compression

### Next Steps

1. **Add Custom Domain** (optional)
   - Configure custom domain in Vercel
   - Update CORS settings
   - Update Stripe webhook URLs

2. **Monitor Performance**
   - Set up alerts for downtime
   - Monitor transaction success rates
   - Track user engagement metrics

3. **Add Features**
   - Email notifications
   - Advanced analytics
   - Product recommendations
   - Admin dashboard

### Support

For issues specific to this deployment guide:
- Check the troubleshooting section above
- Review Vercel documentation
- Check MongoDB Atlas documentation
- Consult Stripe integration guides

**Happy deploying! 🚀**