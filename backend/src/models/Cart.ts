import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface for CartItem (embedded document)
export interface ICartItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  unitPriceCents: number;
  lineSubtotalCents: number; // quantity * unitPriceCents
}

// Interface for Cart document
export interface ICart extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  items: ICartItem[];
  updatedAt: Date;
  
  // Virtual getters
  totalItems: number;
  subtotalCents: number;
  subtotal: number; // In dollars
  isEmpty: boolean;
  
  // Instance methods
  addItem(productId: string, quantity: number, unitPriceCents: number): Promise<ICart>;
  updateItemQuantity(productId: string, quantity: number): Promise<ICart>;
  removeItem(productId: string): Promise<ICart>;
  clearCart(): Promise<ICart>;
  clearItems(): Promise<ICart>;
  calculateTotals(): Promise<{ subtotalCents: number; totalItems: number }>;
  recalculateSubtotals(): Promise<ICart>;
  validateStockAvailability(): Promise<StockValidationResult>;
  toJSON(): Partial<ICart>;
}

// Interface for Cart model (static methods)
export interface ICartModel extends Model<ICart> {
  createCart(userId: string): Promise<ICart>;
  findByUserId(userId: string): Promise<ICart | null>;
  findOrCreateByUserId(userId: string): Promise<ICart>;
  mergeGuestCart(userId: string, guestCartItems: ICartItem[]): Promise<ICart>;
  cleanupEmptyCarts(): Promise<number>;
}

// Helper interfaces
export interface StockValidationResult {
  isValid: boolean;
  issues: StockIssue[];
}

export interface StockIssue {
  productId: string;
  requestedQuantity: number;
  availableStock: number;
  shortfall: number;
}

// CartItem schema (embedded)
const cartItemSchema = new Schema<ICartItem>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required'],
    validate: {
      validator: function(productId: mongoose.Types.ObjectId) {
        return mongoose.Types.ObjectId.isValid(productId);
      },
      message: 'Invalid product ID'
    }
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    max: [100, 'Quantity cannot exceed 100'],
    validate: {
      validator: function(quantity: number) {
        return Number.isInteger(quantity) && quantity > 0;
      },
      message: 'Quantity must be a positive integer'
    }
  },
  unitPriceCents: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [1, 'Unit price must be greater than 0'],
    validate: {
      validator: function(price: number) {
        return Number.isInteger(price) && price > 0;
      },
      message: 'Unit price must be a positive integer in cents'
    }
  },
  lineSubtotalCents: {
    type: Number,
    required: [true, 'Line subtotal is required'],
    min: [1, 'Line subtotal must be greater than 0'],
    validate: {
      validator: function(this: ICartItem, subtotal: number) {
        // Validate that lineSubtotalCents = quantity * unitPriceCents
        const expectedSubtotal = this.quantity * this.unitPriceCents;
        return subtotal === expectedSubtotal;
      },
      message: 'Line subtotal must equal quantity × unit price'
    }
  }
}, {
  _id: false, // Don't create _id for embedded documents
  toJSON: {
    transform: function(doc, ret) {
      // Convert ObjectId to string for JSON serialization
      const result: any = {
        ...ret,
        productId: ret.productId.toString(),
        unitPrice: ret.unitPriceCents / 100,
        lineSubtotal: ret.lineSubtotalCents / 100
      };
      return result;
    }
  }
});

// Cart schema definition
const cartSchema = new Schema<ICart>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true, // One cart per user
    validate: {
      validator: function(userId: mongoose.Types.ObjectId) {
        return mongoose.Types.ObjectId.isValid(userId);
      },
      message: 'Invalid user ID'
    },
    index: true // For efficient user cart lookups
  },
  items: {
    type: [cartItemSchema],
    default: [],
    validate: {
      validator: function(items: ICartItem[]) {
        // Validate no duplicate products
        const productIds = items.map(item => item.productId.toString());
        const uniqueProductIds = new Set(productIds);
        return productIds.length === uniqueProductIds.size;
      },
      message: 'Cart cannot contain duplicate products'
    }
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: false, // Using custom updatedAt
  collection: 'carts',
  minimize: false,
  toJSON: {
    transform: function(doc, ret) {
      const result: any = {
        ...ret,
        id: ret._id.toString(),
        userId: ret.userId.toString(),
        totalItems: ret.items.reduce((sum: number, item: ICartItem) => sum + item.quantity, 0),
        subtotalCents: ret.items.reduce((sum: number, item: ICartItem) => sum + item.lineSubtotalCents, 0),
        subtotal: ret.items.reduce((sum: number, item: ICartItem) => sum + item.lineSubtotalCents, 0) / 100,
        isEmpty: ret.items.length === 0
      };
      
      delete result._id;
      delete result.__v;
      
      return result;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for efficient queries
cartSchema.index({ userId: 1 }, { unique: true }); // One cart per user
cartSchema.index({ updatedAt: -1 }); // For cleanup operations
cartSchema.index({ 'items.productId': 1 }); // For product-based queries

// Virtual for total items count
cartSchema.virtual('totalItems').get(function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Virtual for subtotal in cents
cartSchema.virtual('subtotalCents').get(function() {
  return this.items.reduce((sum, item) => sum + item.lineSubtotalCents, 0);
});

// Virtual for subtotal in dollars
cartSchema.virtual('subtotal').get(function() {
  return this.subtotalCents / 100;
});

// Virtual for empty status
cartSchema.virtual('isEmpty').get(function() {
  return this.items.length === 0;
});

// Instance methods
cartSchema.methods.addItem = async function(
  productId: string, 
  quantity: number, 
  unitPriceCents: number
): Promise<ICart> {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new Error('Invalid product ID');
  }
  
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive integer');
  }
  
  if (!Number.isInteger(unitPriceCents) || unitPriceCents <= 0) {
    throw new Error('Unit price must be a positive integer in cents');
  }
  
  const productObjectId = new mongoose.Types.ObjectId(productId);
  const existingItemIndex = this.items.findIndex(
    item => item.productId.toString() === productId
  );
  
  if (existingItemIndex >= 0) {
    // Update existing item
    const existingItem = this.items[existingItemIndex];
    const newQuantity = existingItem.quantity + quantity;
    
    if (newQuantity > 100) {
      throw new Error('Total quantity cannot exceed 100');
    }
    
    existingItem.quantity = newQuantity;
    existingItem.unitPriceCents = unitPriceCents; // Update price snapshot
    existingItem.lineSubtotalCents = newQuantity * unitPriceCents;
  } else {
    // Add new item
    const lineSubtotalCents = quantity * unitPriceCents;
    
    this.items.push({
      productId: productObjectId,
      quantity,
      unitPriceCents,
      lineSubtotalCents
    });
  }
  
  this.updatedAt = new Date();
  return await this.save();
};

cartSchema.methods.updateItemQuantity = async function(
  productId: string, 
  quantity: number
): Promise<ICart> {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new Error('Invalid product ID');
  }
  
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error('Quantity must be a non-negative integer');
  }
  
  const itemIndex = this.items.findIndex(
    item => item.productId.toString() === productId
  );
  
  if (itemIndex === -1) {
    throw new Error('Product not found in cart');
  }
  
  if (quantity === 0) {
    // Remove item if quantity is 0
    this.items.splice(itemIndex, 1);
  } else {
    if (quantity > 100) {
      throw new Error('Quantity cannot exceed 100');
    }
    
    const item = this.items[itemIndex];
    item.quantity = quantity;
    item.lineSubtotalCents = quantity * item.unitPriceCents;
  }
  
  this.updatedAt = new Date();
  return await this.save();
};

cartSchema.methods.removeItem = async function(productId: string): Promise<ICart> {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new Error('Invalid product ID');
  }
  
  const itemIndex = this.items.findIndex(
    item => item.productId.toString() === productId
  );
  
  if (itemIndex === -1) {
    throw new Error('Product not found in cart');
  }
  
  this.items.splice(itemIndex, 1);
  this.updatedAt = new Date();
  return await this.save();
};

cartSchema.methods.clearCart = async function(): Promise<ICart> {
  this.items = [];
  this.updatedAt = new Date();
  return await this.save();
};

cartSchema.methods.clearItems = async function(): Promise<ICart> {
  // Alias for clearCart to maintain compatibility
  return await this.clearCart();
};

cartSchema.methods.calculateTotals = async function(): Promise<{ subtotalCents: number; totalItems: number }> {
  const subtotalCents = this.items.reduce((sum: number, item: ICartItem) => sum + item.lineSubtotalCents, 0);
  const totalItems = this.items.reduce((sum: number, item: ICartItem) => sum + item.quantity, 0);
  
  return { subtotalCents, totalItems };
};

cartSchema.methods.recalculateSubtotals = async function(): Promise<ICart> {
  let hasChanges = false;
  
  this.items.forEach(item => {
    const expectedSubtotal = item.quantity * item.unitPriceCents;
    if (item.lineSubtotalCents !== expectedSubtotal) {
      item.lineSubtotalCents = expectedSubtotal;
      hasChanges = true;
    }
  });
  
  if (hasChanges) {
    this.updatedAt = new Date();
    return await this.save();
  }
  
  return this;
};

cartSchema.methods.validateStockAvailability = async function(): Promise<StockValidationResult> {
  const Product = mongoose.model('Product');
  const issues: StockIssue[] = [];
  
  // Get all products in cart
  const productIds = this.items.map(item => item.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  
  // Create a map for quick lookup
  const productMap = new Map();
  products.forEach(product => {
    productMap.set(product._id.toString(), product);
  });
  
  // Check each cart item against current stock
  for (const item of this.items) {
    const product = productMap.get(item.productId.toString());
    
    if (!product) {
      issues.push({
        productId: item.productId.toString(),
        requestedQuantity: item.quantity,
        availableStock: 0,
        shortfall: item.quantity
      });
      continue;
    }
    
    if (product.stock < item.quantity) {
      issues.push({
        productId: item.productId.toString(),
        requestedQuantity: item.quantity,
        availableStock: product.stock,
        shortfall: item.quantity - product.stock
      });
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
};

// Static methods
cartSchema.statics.createCart = async function(userId: string): Promise<ICart> {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  
  const cart = new this({
    userId,
    items: []
  });
  
  return await cart.save();
};

cartSchema.statics.findByUserId = function(userId: string): Promise<ICart | null> {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  
  return this.findOne({ userId }).populate('items.productId', 'name imageUrl stock');
};

cartSchema.statics.findOrCreateByUserId = async function(userId: string): Promise<ICart> {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  
  let cart = await (this as ICartModel).findByUserId(userId);
  
  if (!cart) {
    cart = new this({
      userId: new mongoose.Types.ObjectId(userId),
      items: []
    });
    await cart.save();
  }
  
  return cart;
};

cartSchema.statics.mergeGuestCart = async function(
  userId: string, 
  guestCartItems: ICartItem[]
): Promise<ICart> {
  const cart = await (this as ICartModel).findOrCreateByUserId(userId);
  
  // Add each guest cart item to user cart
  for (const guestItem of guestCartItems) {
    await cart.addItem(
      guestItem.productId.toString(),
      guestItem.quantity,
      guestItem.unitPriceCents
    );
  }
  
  return cart;
};

cartSchema.statics.cleanupEmptyCarts = async function(): Promise<number> {
  const result = await this.deleteMany({
    $or: [
      { items: { $size: 0 } },
      { items: { $exists: false } }
    ]
  });
  
  return result.deletedCount || 0;
};

// Pre-save middleware
cartSchema.pre('save', function(next) {
  // Update timestamp on any modification
  if (this.isModified()) {
    this.updatedAt = new Date();
  }
  
  // Recalculate line subtotals if items are modified
  if (this.isModified('items')) {
    this.items.forEach(item => {
      item.lineSubtotalCents = item.quantity * item.unitPriceCents;
    });
  }
  
  next();
});

// Post-save middleware for logging
cartSchema.post('save', function(doc) {
  console.log(`Cart updated for user ${doc.userId}: ${doc.items.length} items, subtotal: $${doc.subtotal}`);
});

// Handle errors
cartSchema.post('save', function(error: any, doc: any, next: any) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    if (error.keyPattern?.userId) {
      next(new Error('A cart already exists for this user'));
    } else {
      next(new Error('Duplicate key error'));
    }
  } else {
    next(error);
  }
});

// Validation utilities
export const validateCartItem = (item: Partial<ICartItem>): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!item.productId || !mongoose.Types.ObjectId.isValid(item.productId)) {
    errors.push('Valid product ID is required');
  }
  
  if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0) {
    errors.push('Quantity must be a positive integer');
  }
  
  if (item.quantity && item.quantity > 100) {
    errors.push('Quantity cannot exceed 100');
  }
  
  if (!item.unitPriceCents || !Number.isInteger(item.unitPriceCents) || item.unitPriceCents <= 0) {
    errors.push('Unit price must be a positive integer in cents');
  }
  
  return { isValid: errors.length === 0, errors };
};

export const calculateCartSubtotal = (items: ICartItem[]): number => {
  return items.reduce((sum, item) => sum + item.lineSubtotalCents, 0);
};

export const calculateCartItemCount = (items: ICartItem[]): number => {
  return items.reduce((sum, item) => sum + item.quantity, 0);
};

// Create and export the model
const Cart = mongoose.model<ICart, ICartModel>('Cart', cartSchema);

export default Cart;