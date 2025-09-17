import { z } from 'zod';

// ============================================================================
// SHARED VALIDATION UTILITIES
// ============================================================================

// Custom error messages
const REQUIRED_FIELD = 'This field is required';
const INVALID_EMAIL = 'Please provide a valid email address';
const INVALID_OBJECT_ID = 'Invalid ID format';

// Reusable schema components
export const ObjectIdSchema = z.string()
  .min(1, REQUIRED_FIELD)
  .regex(/^[0-9a-fA-F]{24}$/, INVALID_OBJECT_ID);

export const EmailSchema = z.string()
  .min(1, REQUIRED_FIELD)
  .email(INVALID_EMAIL)
  .toLowerCase()
  .trim();

export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain at least one special character');

export const NameSchema = z.string()
  .min(2, 'Name must be at least 2 characters long')
  .max(100, 'Name cannot exceed 100 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .trim();

export const ProductNameSchema = z.string()
  .min(2, 'Product name must be at least 2 characters long')
  .max(200, 'Product name cannot exceed 200 characters')
  .trim();

export const ProductDescriptionSchema = z.string()
  .min(10, 'Product description must be at least 10 characters long')
  .max(2000, 'Product description cannot exceed 2000 characters')
  .trim();

export const PriceCentsSchema = z.number()
  .int('Price must be an integer')
  .min(1, 'Price must be greater than 0')
  .max(100000000, 'Price cannot exceed $1,000,000');

export const StockSchema = z.number()
  .int('Stock must be an integer')
  .min(0, 'Stock cannot be negative')
  .max(1000000, 'Stock cannot exceed 1,000,000 units');

export const QuantitySchema = z.number()
  .int('Quantity must be an integer')
  .min(1, 'Quantity must be at least 1')
  .max(100, 'Quantity cannot exceed 100');

export const UrlSchema = z.string()
  .min(1, REQUIRED_FIELD)
  .url('Please provide a valid URL')
  .trim();

export const ZipCodeSchema = z.string()
  .regex(/^\d{5}(-\d{4})?$/, 'Please provide a valid ZIP code')
  .trim();

export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20)
});

// ============================================================================
// USER VALIDATION SCHEMAS
// ============================================================================

export const UserRegistrationSchema = z.object({
  email: EmailSchema,
  name: NameSchema,
  password: PasswordSchema
});

export const UserLoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required')
});

export const UserUpdateSchema = z.object({
  name: NameSchema.optional(),
  email: EmailSchema.optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: PasswordSchema
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password'
});

// ============================================================================
// PRODUCT VALIDATION SCHEMAS
// ============================================================================

export const ProductCreateSchema = z.object({
  name: ProductNameSchema,
  description: ProductDescriptionSchema,
  priceCents: PriceCentsSchema,
  imageUrl: UrlSchema,
  stock: StockSchema
});

export const ProductUpdateSchema = z.object({
  name: ProductNameSchema.optional(),
  description: ProductDescriptionSchema.optional(),
  priceCents: PriceCentsSchema.optional(),
  imageUrl: UrlSchema.optional(),
  stock: StockSchema.optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

export const ProductSearchSchema = z.object({
  query: z.string().trim().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'price', 'createdAt', 'stock']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  inStockOnly: z.boolean().default(false)
}).refine(data => {
  if (data.minPrice !== undefined && data.maxPrice !== undefined) {
    return data.minPrice <= data.maxPrice;
  }
  return true;
}, {
  message: 'Minimum price cannot be greater than maximum price'
});

export const StockUpdateSchema = z.object({
  productId: ObjectIdSchema,
  newStock: StockSchema
});

// ============================================================================
// CART VALIDATION SCHEMAS
// ============================================================================

export const CartItemSchema = z.object({
  productId: ObjectIdSchema,
  quantity: QuantitySchema
});

export const AddToCartSchema = CartItemSchema;

export const UpdateCartItemSchema = z.object({
  productId: ObjectIdSchema,
  quantity: z.number().int().min(0).max(100) // Allow 0 for removal
});

export const RemoveFromCartSchema = z.object({
  productId: ObjectIdSchema
});

export const CartValidationSchema = z.object({
  items: z.array(CartItemSchema).min(1, 'Cart must contain at least one item')
});

// ============================================================================
// ORDER VALIDATION SCHEMAS
// ============================================================================

export const ShippingAddressSchema = z.object({
  street: z.string().min(1, 'Street address is required').max(200).trim(),
  city: z.string().min(1, 'City is required').max(100).trim(),
  state: z.string().min(1, 'State is required').max(50).trim(),
  zipCode: ZipCodeSchema,
  country: z.string().min(1, 'Country is required').max(50).trim().default('US')
});

export const OrderCreateSchema = z.object({
  shippingAddress: ShippingAddressSchema.optional(),
  notes: z.string().max(1000).trim().optional()
});

export const OrderStatusUpdateSchema = z.object({
  status: z.enum(['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Failed']),
  reason: z.string().max(500).trim().optional()
});

export const OrderCancelSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(500).trim()
});

export const OrderShipSchema = z.object({
  trackingNumber: z.string().min(1, 'Tracking number is required').trim(),
  carrier: z.string().max(100).trim().optional()
});

export const OrderSearchSchema = z.object({
  userId: ObjectIdSchema.optional(),
  status: z.enum(['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Failed']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  startDate: z.date().optional(),
  endDate: z.date().optional()
}).refine(data => {
  if (data.startDate && data.endDate) {
    return data.startDate <= data.endDate;
  }
  return true;
}, {
  message: 'Start date cannot be after end date'
});

// ============================================================================
// PAYMENT VALIDATION SCHEMAS
// ============================================================================

export const PaymentIntentCreateSchema = z.object({
  amount: PriceCentsSchema,
  currency: z.string().length(3).toUpperCase().default('USD'),
  metadata: z.record(z.string()).optional()
});

export const PaymentEventCreateSchema = z.object({
  orderId: ObjectIdSchema,
  provider: z.enum(['stripe', 'paypal', 'square']),
  type: z.enum([
    'intent_created',
    'intent_processing', 
    'intent_succeeded',
    'intent_failed',
    'intent_cancelled',
    'payment_confirmed',
    'payment_failed',
    'refund_created',
    'refund_succeeded',
    'refund_failed',
    'webhook_received',
    'webhook_processed',
    'webhook_failed'
  ]),
  externalId: z.string().min(1, 'External ID is required').trim(),
  amount: z.number().int().min(0).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  status: z.string().trim().optional(),
  meta: z.record(z.any()).optional(),
  webhookId: z.string().trim().optional()
});

export const WebhookValidationSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({
    object: z.record(z.any())
  }),
  created: z.number().positive()
});

// ============================================================================
// CHECKOUT VALIDATION SCHEMAS
// ============================================================================

export const CheckoutInitiateSchema = z.object({
  shippingAddress: ShippingAddressSchema,
  notes: z.string().max(1000).trim().optional()
});

export const CheckoutConfirmSchema = z.object({
  paymentIntentId: z.string().min(1, 'Payment intent ID is required').trim(),
  paymentMethodId: z.string().min(1, 'Payment method ID is required').trim().optional()
});

// ============================================================================
// ADMIN VALIDATION SCHEMAS
// ============================================================================

export const AdminUserCreateSchema = z.object({
  email: EmailSchema,
  name: NameSchema,
  password: PasswordSchema,
  role: z.enum(['admin', 'customer']).default('customer')
});

export const AdminOrderUpdateSchema = z.object({
  status: z.enum(['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Failed']),
  notes: z.string().max(1000).trim().optional(),
  trackingNumber: z.string().trim().optional()
});

export const AdminStockBulkUpdateSchema = z.object({
  updates: z.array(z.object({
    productId: ObjectIdSchema,
    newStock: StockSchema
  })).min(1, 'At least one stock update is required')
});

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

export type ValidationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  errors: string[];
  fieldErrors: Record<string, string[]>;
};

export function validateSchema<T>(
  schema: z.ZodSchema<T>, 
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  }
  
  const errors: string[] = [];
  const fieldErrors: Record<string, string[]> = {};
  
  result.error.issues.forEach(issue => {
    const path = issue.path.join('.');
    const message = issue.message;
    
    errors.push(path ? `${path}: ${message}` : message);
    
    if (path) {
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(message);
    }
  });
  
  return {
    success: false,
    errors,
    fieldErrors
  };
}

// Simple validation that throws on error - most commonly used pattern
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = validateSchema(schema, data);
  if (result.success) {
    return result.data;
  }
  // Type assertion to help TypeScript understand the union type
  const errorResult = result as Extract<ValidationResult<T>, { success: false }>;
  throw createValidationError(errorResult.errors, errorResult.fieldErrors);
}

export function createValidationError(errors: string[], fieldErrors?: Record<string, string[]>) {
  const error = new Error(`Validation failed: ${errors.join(', ')}`);
  (error as any).name = 'ValidationError';
  (error as any).errors = errors;
  (error as any).fieldErrors = fieldErrors || {};
  return error;
}

export function isValidationError(error: any): boolean {
  return error && error.name === 'ValidationError';
}

// ============================================================================
// MIDDLEWARE VALIDATION HELPERS
// ============================================================================

export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    return validate(schema, data);
  };
}

export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    // Convert string query parameters to appropriate types
    const processedData = processQueryParams(data);
    return validate(schema, processedData);
  };
}

export function validateParams<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    return validate(schema, data);
  };
}

// Helper function to process query parameters
function processQueryParams(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const processed: any = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // Try to convert string values to appropriate types
      if (value === 'true') {
        processed[key] = true;
      } else if (value === 'false') {
        processed[key] = false;
      } else if (/^\d+$/.test(value)) {
        processed[key] = parseInt(value, 10);
      } else if (/^\d+\.\d+$/.test(value)) {
        processed[key] = parseFloat(value);
      } else {
        processed[key] = value;
      }
    } else {
      processed[key] = value;
    }
  }
  
  return processed;
}

// ============================================================================
// SPECIALIZED VALIDATION FUNCTIONS
// ============================================================================

export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const result = PasswordSchema.safeParse(password);
  
  if (result.success) {
    return { isValid: true, errors: [] };
  }
  
  return {
    isValid: false,
    errors: result.error.issues.map(issue => issue.message)
  };
}

export function validateEmail(email: string): { isValid: boolean; errors: string[] } {
  const result = EmailSchema.safeParse(email);
  
  if (result.success) {
    return { isValid: true, errors: [] };
  }
  
  return {
    isValid: false,
    errors: result.error.issues.map(issue => issue.message)
  };
}

export function validateObjectId(id: string): { isValid: boolean; errors: string[] } {
  const result = ObjectIdSchema.safeParse(id);
  
  if (result.success) {
    return { isValid: true, errors: [] };
  }
  
  return {
    isValid: false,
    errors: result.error.issues.map(issue => issue.message)
  };
}

export function validatePricing(priceCents: number): { isValid: boolean; errors: string[] } {
  const result = PriceCentsSchema.safeParse(priceCents);
  
  if (result.success) {
    return { isValid: true, errors: [] };
  }
  
  return {
    isValid: false,
    errors: result.error.issues.map(issue => issue.message)
  };
}

export function validateQuantity(quantity: number): { isValid: boolean; errors: string[] } {
  const result = QuantitySchema.safeParse(quantity);
  
  if (result.success) {
    return { isValid: true, errors: [] };
  }
  
  return {
    isValid: false,
    errors: result.error.issues.map(issue => issue.message)
  };
}

// ============================================================================
// EXPORT ALL SCHEMAS FOR TYPE INFERENCE
// ============================================================================

export type UserRegistrationData = z.infer<typeof UserRegistrationSchema>;
export type UserLoginData = z.infer<typeof UserLoginSchema>;
export type UserUpdateData = z.infer<typeof UserUpdateSchema>;
export type ChangePasswordData = z.infer<typeof ChangePasswordSchema>;

export type ProductCreateData = z.infer<typeof ProductCreateSchema>;
export type ProductUpdateData = z.infer<typeof ProductUpdateSchema>;
export type ProductSearchData = z.infer<typeof ProductSearchSchema>;

export type CartItemData = z.infer<typeof CartItemSchema>;
export type AddToCartData = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemData = z.infer<typeof UpdateCartItemSchema>;

export type ShippingAddressData = z.infer<typeof ShippingAddressSchema>;
export type OrderCreateData = z.infer<typeof OrderCreateSchema>;
export type OrderStatusUpdateData = z.infer<typeof OrderStatusUpdateSchema>;
export type OrderSearchData = z.infer<typeof OrderSearchSchema>;
export type OrderCancelData = z.infer<typeof OrderCancelSchema>;
export type OrderShipData = z.infer<typeof OrderShipSchema>;

export type PaymentIntentCreateData = z.infer<typeof PaymentIntentCreateSchema>;
export type PaymentEventCreateData = z.infer<typeof PaymentEventCreateSchema>;
export type WebhookValidationData = z.infer<typeof WebhookValidationSchema>;
export type CheckoutInitiateData = z.infer<typeof CheckoutInitiateSchema>;
export type CheckoutConfirmData = z.infer<typeof CheckoutConfirmSchema>;