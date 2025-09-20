import helmet from 'helmet';
import cors from 'cors';
import { RequestHandler } from 'express';

/**
 * Enhanced Security Middleware Configuration
 * Implements comprehensive security headers and CORS policies
 * for production-grade security posture with e-commerce support
 */
export const securityMiddleware: RequestHandler[] = [
  // Enhanced Helmet configuration with e-commerce-optimized CSP
  helmet({
    // Content Security Policy - secure but functional for e-commerce with Stripe
    contentSecurityPolicy: {
      useDefaults: false, // Explicitly override any platform defaults
      directives: {
        // Default fallback - allow self and basic resources
        defaultSrc: ["'self'"],
        
        // Scripts - allow self, Stripe JS SDK, and inline scripts for Vite/React
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for Vite HMR and React development
          "'unsafe-eval'", // Sometimes needed for React dev tools
          "https://js.stripe.com", // Stripe Elements SDK
          "https://checkout.stripe.com", // Stripe Checkout
        ],
        
        // Script elements - same as scriptSrc for modern browsers
        scriptSrcElem: [
          "'self'",
          "'unsafe-inline'", // Required for Vite inline scripts
          "https://js.stripe.com",
          "https://checkout.stripe.com",
        ],
        
        // Styles - allow self, inline styles, and Google Fonts
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Required for styled-components and Tailwind
          "https://fonts.googleapis.com", // Google Fonts CSS
        ],
        
        // Style elements - same as styleSrc
        styleSrcElem: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        
        // Fonts - allow self and Google Fonts
        fontSrc: [
          "'self'",
          "data:", // For base64 encoded fonts
          "https://fonts.gstatic.com", // Google Fonts assets
        ],
        
        // Images - allow self, data URLs, and HTTPS images
        imgSrc: [
          "'self'",
          "data:", // For base64 images and icons
          "https:", // Allow all HTTPS images (product images, etc.)
          "blob:", // For dynamically generated images
        ],
        
        // Frames/iframes - allow Stripe for secure payment processing
        frameSrc: [
          "'self'",
          "https://js.stripe.com", // Stripe Elements iframes
          "https://hooks.stripe.com", // Stripe webhooks
          "https://checkout.stripe.com", // Stripe Checkout
        ],
        
        // Connect/fetch - allow API calls to backend and Stripe
        connectSrc: [
          "'self'",
          "https://api.stripe.com", // Stripe API
          "https://checkout.stripe.com", // Stripe Checkout API
          "wss:", // WebSocket support for development
          "ws:", // WebSocket support for development HMR
        ],
        
        // Media - allow self for product videos/audio
        mediaSrc: ["'self'", "data:", "blob:"],
        
        // Objects - block all object embeds for security
        objectSrc: ["'none'"],
        
        // Base URI - restrict to self only
        baseUri: ["'self'"],
        
        // Form actions - allow self for checkout forms
        formAction: ["'self'"],
        
        // Frame ancestors - prevent embedding (clickjacking protection)
        frameAncestors: ["'none'"],
        
        // Upgrade insecure requests in production
        ...(process.env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {}),
        
        // Worker scripts - allow self for service workers
        workerSrc: ["'self'", "blob:"],
        
        // Manifest - allow self for PWA manifest
        manifestSrc: ["'self'"],
      },
    },
    // HTTP Strict Transport Security - forces HTTPS
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    // Prevent MIME type sniffing
    noSniff: true,
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    // Remove X-Powered-By header
    hidePoweredBy: true,
    // Referrer Policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }),

  // Enhanced CORS configuration with environment-based origins and debugging
  cors({
    origin: function (origin, callback) {
      // Debug logging for CORS issues
      console.log(`[CORS] Request from origin: ${origin}`);
      
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        console.log('[CORS] Allowing request with no origin');
        return callback(null, true);
      }
      
      const allowedOrigins = process.env.CORS_ORIGINS 
        ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
        : ['http://localhost:3000', 'http://localhost:5173'];
      
      console.log(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);
      
      if (allowedOrigins.includes(origin)) {
        console.log(`[CORS] Origin ${origin} allowed`);
        callback(null, true);
      } else {
        console.log(`[CORS] Origin ${origin} BLOCKED - not in allowed list`);
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200
  }),
];
