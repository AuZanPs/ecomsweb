# EcomsWeb Production Deployment Checklist

## 🚀 Pre-Deployment Requirements

### **Environment Variables (Vercel Dashboard)**

#### Backend Variables (.env)
```bash
# Database
MONGODB_URI=mongodb+srv://username:REPLACE_PASSWORD@cluster.mongodb.net/ecomsweb

# Authentication  
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-chars

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... # Replace with live key for production
STRIPE_PUBLISHABLE_KEY=pk_test_... # Replace with live key for production  
STRIPE_WEBHOOK_SECRET=whsec_... # Replace with live webhook secret

# CORS Configuration
CORS_ORIGINS=https://your-frontend-domain.vercel.app,https://your-custom-domain.com

# Server Configuration
PORT=3000
NODE_ENV=production
```

#### Frontend Variables (.env)
```bash
# API Configuration
VITE_API_BASE_URL=https://your-backend-domain.vercel.app

# Stripe Configuration  
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... # Replace with live key for production
```

## 🔍 Deployment Verification Steps

### **Step 1: Deploy to Vercel**
```bash
vercel --prod
```

### **Step 2: Verify CSP Configuration**
- ✅ Open browser DevTools → Console
- ✅ Navigate to deployed frontend
- ✅ Confirm NO "Content-Security-Policy" errors
- ✅ Check for "default-src 'none'" blocking messages (should be NONE)

### **Step 3: Test API Connectivity** 
- ✅ Open browser DevTools → Network tab
- ✅ Test login/register functionality
- ✅ Verify API calls reach backend (status 200/201)
- ✅ Confirm CORS headers present in responses

### **Step 4: Security Headers Validation**
```bash
# Test security headers
curl -I https://your-frontend-domain.vercel.app

# Expected headers:
# Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'...
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
```

### **Step 5: Functional Testing**
- ✅ User registration/login
- ✅ Product browsing and search
- ✅ Add to cart functionality
- ✅ Checkout process
- ✅ Payment processing (test mode)

## 🚨 Troubleshooting Guide

### **CSP Errors Return**
1. Check Vercel dashboard for conflicting headers
2. Verify single `vercel.json` in root only
3. Confirm `useDefaults: false` in security middleware

### **CORS Errors**
1. Verify `CORS_ORIGINS` includes exact frontend URL
2. Check backend deployment logs for CORS debug messages
3. Confirm both HTTP and HTTPS origins if needed

### **API Connectivity Issues**
1. Verify `VITE_API_BASE_URL` matches backend deployment URL
2. Check backend health endpoint: `/api/health`
3. Confirm environment variables deployed correctly

## ✅ Success Criteria

- [ ] Zero CSP errors in browser console
- [ ] API calls successfully reach backend
- [ ] User authentication flows work
- [ ] Product data loads correctly
- [ ] Cart operations function
- [ ] Security headers properly configured

## 📝 Post-Deployment Notes

- Monitor Vercel deployment logs for initial 24 hours
- Test with multiple browsers (Chrome, Firefox, Safari)
- Verify mobile responsiveness
- Schedule security header verification with online tools