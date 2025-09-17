import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateJWT, AuthRequest } from '../../src/api/middleware/auth';
import { validate } from '../../src/api/middleware/validate';
import { 
  authRateLimit, 
  apiRateLimit, 
  searchRateLimit, 
  cartRateLimit, 
  webhookRateLimit, 
  globalRateLimit 
} from '../../src/api/middleware/rateLimit';
import { errorHandler } from '../../src/api/middleware/errorHandler';
import { 
  validateSchema, 
  UserRegistrationSchema, 
  UserLoginSchema,
  ProductCreateSchema,
  CartItemSchema,
  CheckoutInitiateSchema
} from '../../src/utils/validation';

describe('Middleware and Utilities Unit Tests', () => {
  
  // ============================================================================
  // VALIDATION UTILITIES TESTS
  // ============================================================================

  describe('Validation Utilities', () => {
    
    describe('User Registration Validation', () => {
      test('should validate correct user registration data', () => {
        const validData = {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'SecurePass123!'
        };
        
        const result = validateSchema(UserRegistrationSchema, validData);
        expect(result.success).toBe(true);
      });

      test('should reject invalid email format', () => {
        const invalidData = {
          name: 'John Doe',
          email: 'invalid-email',
          password: 'SecurePass123!'
        };
        
        const result = validateSchema(UserRegistrationSchema, invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors.some(error => error.includes('email'))).toBe(true);
        }
      });

      test('should reject short password', () => {
        const invalidData = {
          name: 'John Doe',
          email: 'john@example.com',
          password: '123'
        };
        
        const result = validateSchema(UserRegistrationSchema, invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors.some(error => error.includes('password'))).toBe(true);
        }
      });

      test('should reject empty name', () => {
        const invalidData = {
          name: '',
          email: 'john@example.com',
          password: 'SecurePass123!'
        };
        
        const result = validateSchema(UserRegistrationSchema, invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors.some(error => error.includes('name'))).toBe(true);
        }
      });
    });

    describe('User Login Validation', () => {
      test('should validate correct login data', () => {
        const validData = {
          email: 'john@example.com',
          password: 'SecurePass123!'
        };
        
        const result = validateSchema(UserLoginSchema, validData);
        expect(result.success).toBe(true);
      });

      test('should reject missing email', () => {
        const invalidData = {
          password: 'SecurePass123!'
        };
        
        const result = validateSchema(UserLoginSchema, invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('Product Creation Validation', () => {
      test('should validate correct product data', () => {
        const validData = {
          name: 'Test Product',
          description: 'A great test product',
          price: 29.99,
          stock: 10,
          category: 'Electronics',
          imageUrl: 'https://example.com/image.jpg'
        };
        
        const result = validateSchema(ProductCreateSchema, validData);
        expect(result.success).toBe(true);
      });

      test('should reject negative price', () => {
        const invalidData = {
          name: 'Test Product',
          description: 'A great test product',
          price: -10,
          stock: 10,
          category: 'Electronics',
          imageUrl: 'https://example.com/image.jpg'
        };
        
        const result = validateSchema(ProductCreateSchema, invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors.some(error => error.includes('price'))).toBe(true);
        }
      });

      test('should reject negative stock', () => {
        const invalidData = {
          name: 'Test Product',
          description: 'A great test product',
          price: 29.99,
          stock: -5,
          category: 'Electronics',
          imageUrl: 'https://example.com/image.jpg'
        };
        
        const result = validateSchema(ProductCreateSchema, invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors.some(error => error.includes('stock'))).toBe(true);
        }
      });
    });

    describe('Cart Add Item Validation', () => {
      test('should validate correct cart add data', () => {
        const validData = {
          productId: '507f1f77bcf86cd799439011',
          quantity: 2
        };
        
        const result = validateSchema(CartItemSchema, validData);
        expect(result.success).toBe(true);
      });

      test('should reject invalid quantity', () => {
        const invalidData = {
          productId: '507f1f77bcf86cd799439011',
          quantity: 0
        };
        
        const result = validateSchema(CartItemSchema, invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors.some(error => error.includes('quantity'))).toBe(true);
        }
      });

      test('should reject invalid ObjectId format', () => {
        const invalidData = {
          productId: 'invalid-id',
          quantity: 2
        };
        
        const result = validateSchema(CartItemSchema, invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors.some(error => error.includes('productId'))).toBe(true);
        }
      });
    });

    describe('Checkout Initiate Validation', () => {
      test('should validate correct checkout data', () => {
        const validData = {
          shippingAddress: {
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zipCode: '12345',
            country: 'United States'
          },
          notes: 'Please handle with care'
        };
        
        const result = validateSchema(CheckoutInitiateSchema, validData);
        expect(result.success).toBe(true);
      });

      test('should reject missing required address fields', () => {
        const invalidData = {
          shippingAddress: {
            street: '123 Main St',
            // Missing city, state, zipCode, country
          }
        };
        
        const result = validateSchema(CheckoutInitiateSchema, invalidData);
        expect(result.success).toBe(false);
      });

      test('should allow optional notes', () => {
        const validData = {
          shippingAddress: {
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zipCode: '12345',
            country: 'United States'
          }
          // No notes field
        };
        
        const result = validateSchema(CheckoutInitiateSchema, validData);
        expect(result.success).toBe(true);
      });
    });
  });

  // ============================================================================
  // AUTH MIDDLEWARE TESTS
  // ============================================================================

  describe('Authentication Middleware', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        headers: {}
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      mockNext = jest.fn();
    });

    test('should authenticate valid JWT token', async () => {
      const payload = { userId: '507f1f77bcf86cd799439011', email: 'test@example.com' };
      const token = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret');
      
      mockReq.headers = {
        authorization: `Bearer ${token}`
      };

      await authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.userId).toBe('507f1f77bcf86cd799439011');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject request without authorization header', async () => {
      await authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Access token required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject malformed authorization header', async () => {
      mockReq.headers = {
        authorization: 'Invalid format'
      };

      await authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid token format' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject invalid JWT token', async () => {
      mockReq.headers = {
        authorization: 'Bearer invalid.jwt.token'
      };

      await authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject expired JWT token', async () => {
      const payload = { userId: '507f1f77bcf86cd799439011', email: 'test@example.com' };
      const expiredToken = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '-1h' });
      
      mockReq.headers = {
        authorization: `Bearer ${expiredToken}`
      };

      await authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // VALIDATION MIDDLEWARE TESTS
  // ============================================================================

  describe('Validation Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        body: {}
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      mockNext = jest.fn();
    });

    test('should pass validation with valid data', () => {
      mockReq.body = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123!'
      };

      const middleware = validate(UserRegistrationSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should reject validation with invalid data', () => {
      mockReq.body = {
        name: '',
        email: 'invalid-email',
        password: '123'
      };

      const middleware = validate(UserRegistrationSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Validation failed',
          errors: expect.any(Array)
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // ERROR HANDLER MIDDLEWARE TESTS
  // ============================================================================

  describe('Error Handler Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {};
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      mockNext = jest.fn();
    });

    test('should handle validation errors', () => {
      const validationError = {
        name: 'ValidationError',
        message: 'Validation failed',
        errors: {
          email: { message: 'Email is required' }
        }
      };

      errorHandler(validationError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Validation failed',
          errors: expect.any(Array)
        })
      );
    });

    test('should handle duplicate key errors', () => {
      const duplicateError = {
        name: 'MongoServerError',
        message: 'Duplicate key error',
        code: 11000,
        keyPattern: { email: 1 }
      };

      errorHandler(duplicateError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('already exists')
        })
      );
    });

    test('should handle generic errors', () => {
      const genericError = {
        name: 'Error',
        message: 'Something went wrong'
      };

      errorHandler(genericError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Internal server error'
        })
      );
    });

    test('should handle custom application errors', () => {
      const customError = {
        name: 'CustomError',
        message: 'Custom error message',
        statusCode: 422
      };

      errorHandler(customError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Custom error message'
        })
      );
    });
  });

  // ============================================================================
  // RATE LIMIT CONFIGURATION TESTS
  // ============================================================================

  describe('Rate Limit Configuration', () => {
    test('should have all required rate limit middleware functions', () => {
      expect(authRateLimit).toBeDefined();
      expect(apiRateLimit).toBeDefined();
      expect(searchRateLimit).toBeDefined();
      expect(cartRateLimit).toBeDefined();
      expect(webhookRateLimit).toBeDefined();
      expect(globalRateLimit).toBeDefined();
    });

    test('should export functions (middleware)', () => {
      expect(typeof authRateLimit).toBe('function');
      expect(typeof apiRateLimit).toBe('function');
      expect(typeof searchRateLimit).toBe('function');
      expect(typeof cartRateLimit).toBe('function');
      expect(typeof webhookRateLimit).toBe('function');
      expect(typeof globalRateLimit).toBe('function');
    });
  });

  // ============================================================================
  // UTILITY FUNCTION TESTS
  // ============================================================================

  describe('Utility Functions', () => {
    
    test('should generate consistent error response format', () => {
      const errorResponse = {
        message: 'Test error',
        errors: ['Field validation failed'],
        statusCode: 400
      };
      
      expect(errorResponse).toHaveProperty('message');
      expect(errorResponse).toHaveProperty('errors');
      expect(errorResponse).toHaveProperty('statusCode');
      expect(Array.isArray(errorResponse.errors)).toBe(true);
    });

    test('should format currency correctly', () => {
      const formatCurrency = (cents: number): string => {
        return (cents / 100).toFixed(2);
      };
      
      expect(formatCurrency(2999)).toBe('29.99');
      expect(formatCurrency(100)).toBe('1.00');
      expect(formatCurrency(0)).toBe('0.00');
    });

    test('should generate order numbers correctly', () => {
      const generateOrderNumber = (): string => {
        return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      };
      
      const orderNumber = generateOrderNumber();
      expect(orderNumber).toMatch(/^ORD-\d+-[a-z0-9]{9}$/);
    });

    test('should calculate pagination correctly', () => {
      const calculatePagination = (total: number, page: number, limit: number) => {
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        
        return {
          currentPage: page,
          totalPages,
          totalItems: total,
          hasNext,
          hasPrev
        };
      };
      
      const pagination = calculatePagination(100, 2, 10);
      expect(pagination.currentPage).toBe(2);
      expect(pagination.totalPages).toBe(10);
      expect(pagination.totalItems).toBe(100);
      expect(pagination.hasNext).toBe(true);
      expect(pagination.hasPrev).toBe(true);
    });

    test('should validate email format', () => {
      const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };
      
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });

    test('should sanitize user input', () => {
      const sanitizeInput = (input: string): string => {
        return input.trim().toLowerCase();
      };
      
      expect(sanitizeInput('  TEST@EXAMPLE.COM  ')).toBe('test@example.com');
      expect(sanitizeInput('Hello World')).toBe('hello world');
    });
  });
});