import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface for OrderItem (embedded document)
export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  productName: string; // Store product name for reference
  quantity: number;
  unitPriceCents: number;
  priceCents: number; // Alias for unitPriceCents
  lineSubtotalCents: number; // quantity * unitPriceCents
  productSnapshot?: {
    name: string;
    imageUrl: string;
  };
}

// Order status enumeration
export enum OrderStatus {
  PENDING = 'Pending',
  PAID = 'Paid',
  PROCESSING = 'Processing',
  SHIPPED = 'Shipped',
  DELIVERED = 'Delivered',
  CANCELLED = 'Cancelled',
  FAILED = 'Failed'
}

// Interface for Order document
export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  orderNumber: string;
  status: OrderStatus;
  items: IOrderItem[];
  subtotalCents: number;
  totalCents: number;
  totalAmountCents: number; // Alias for totalCents
  shippingCostCents: number;
  taxCents: number;
  paymentRef: string | null;
  paymentIntentId?: string;
  paymentMethodId?: string;
  paymentStatus?: 'pending' | 'succeeded' | 'failed' | 'canceled';
  paymentMethod?: 'stripe' | 'paypal' | 'card' | 'bank_transfer';
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  trackingNumber?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  estimatedDelivery: Date | null;
  actualDelivery: Date | null;
  statusHistory: Array<{
    status: OrderStatus;
    timestamp: Date;
    reason?: string;
    userId?: string;
  }>;
  
  // Virtual getters
  subtotal: number; // In dollars
  total: number; // In dollars
  totalItems: number;
  isPaid: boolean;
  isShipped: boolean;
  isDelivered: boolean;
  isCancelled: boolean;
  canBeCancelled: boolean;
  
  // Instance methods
  updateStatus(newStatus: OrderStatus, context?: StatusUpdateContext): Promise<IOrder>;
  addPaymentReference(paymentRef: string): Promise<IOrder>;
  cancel(reason?: string, userId?: string): Promise<IOrder>;
  ship(trackingNumber: string, carrier?: string): Promise<IOrder>;
  markAsDelivered(): Promise<IOrder>;
  calculateTotals(): void;
  toJSON(): Partial<IOrder>;
}

// Interface for Order model (static methods)
export interface IOrderModel extends Model<IOrder> {
  createOrder(orderData: any): Promise<IOrder>;
  findByUserId(userId: string, options?: FindOrdersOptions): Promise<FindOrdersResult>;
  findByStatus(status: OrderStatus): Promise<IOrder[]>;
  findByPaymentRef(paymentRef: string): Promise<IOrder | null>;
  findRecentOrders(days?: number): Promise<IOrder[]>;
  createFromCart(userId: string, cartItems: IOrderItem[], options?: CreateOrderOptions): Promise<IOrder>;
  getOrderStatistics(userId?: string): Promise<OrderStatistics>;
  findPendingOrders(olderThanMinutes?: number): Promise<IOrder[]>;
}

// Helper interfaces
export interface StatusUpdateContext {
  userId?: string;
  isAdmin?: boolean;
  reason?: string;
  timestamp?: Date;
}

export interface FindOrdersOptions {
  status?: OrderStatus;
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface FindOrdersResult {
  orders: IOrder[];
  totalCount: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface CreateOrderOptions {
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  notes?: string;
}

export interface OrderStatistics {
  totalOrders: number;
  totalRevenueCents: number;
  totalRevenue: number;
  averageOrderValueCents: number;
  averageOrderValue: number;
  statusBreakdown: Record<OrderStatus, number>;
}

// OrderItem schema (embedded)
const orderItemSchema = new Schema<IOrderItem>({
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
      validator: function(this: IOrderItem, subtotal: number) {
        const expectedSubtotal = this.quantity * this.unitPriceCents;
        return subtotal === expectedSubtotal;
      },
      message: 'Line subtotal must equal quantity × unit price'
    }
  },
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  priceCents: {
    type: Number,
    required: [true, 'Price in cents is required'],
    min: [1, 'Price must be greater than 0']
  },
  productSnapshot: {
    name: {
      type: String,
      trim: true
    },
    imageUrl: {
      type: String,
      trim: true
    }
  }
}, {
  _id: false,
  toJSON: {
    transform: function(doc, ret) {
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

// Shipping address schema (embedded)
const shippingAddressSchema = new Schema({
  street: {
    type: String,
    required: [true, 'Street address is required'],
    trim: true,
    maxlength: [200, 'Street address cannot exceed 200 characters']
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
    maxlength: [100, 'City cannot exceed 100 characters']
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true,
    maxlength: [50, 'State cannot exceed 50 characters']
  },
  zipCode: {
    type: String,
    required: [true, 'ZIP code is required'],
    trim: true,
    validate: {
      validator: function(zipCode: string) {
        // Basic ZIP code validation (US format)
        return /^\d{5}(-\d{4})?$/.test(zipCode);
      },
      message: 'Please provide a valid ZIP code'
    }
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true,
    default: 'US',
    maxlength: [50, 'Country cannot exceed 50 characters']
  }
}, { _id: false });

// Order schema definition
const orderSchema = new Schema<IOrder>({
  orderNumber: {
    type: String,
    required: [true, 'Order number is required'],
    unique: true,
    trim: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    validate: {
      validator: function(userId: mongoose.Types.ObjectId) {
        return mongoose.Types.ObjectId.isValid(userId);
      },
      message: 'Invalid user ID'
    },
    index: true
  },
  status: {
    type: String,
    enum: Object.values(OrderStatus),
    default: OrderStatus.PENDING,
    required: [true, 'Order status is required'],
    index: true
  },
  items: {
    type: [orderItemSchema],
    required: [true, 'Order items are required'],
    validate: {
      validator: function(items: IOrderItem[]) {
        return items.length > 0;
      },
      message: 'Order must contain at least one item'
    }
  },
  totalAmountCents: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [1, 'Total amount must be greater than 0']
  },
  shippingCostCents: {
    type: Number,
    default: 0,
    min: [0, 'Shipping cost cannot be negative']
  },
  taxCents: {
    type: Number,
    default: 0,
    min: [0, 'Tax cannot be negative']
  },
  subtotalCents: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [1, 'Subtotal must be greater than 0'],
    validate: {
      validator: function(this: IOrder, subtotal: number) {
        if (this.items && this.items.length > 0) {
          const calculatedSubtotal = this.items.reduce(
            (sum, item) => sum + item.lineSubtotalCents, 0
          );
          return subtotal === calculatedSubtotal;
        }
        return true;
      },
      message: 'Subtotal must equal the sum of all line subtotals'
    }
  },
  totalCents: {
    type: Number,
    required: [true, 'Total is required'],
    min: [1, 'Total must be greater than 0']
  },
  paymentIntentId: {
    type: String,
    trim: true
  },
  shippingAddress: shippingAddressSchema,
  estimatedDelivery: {
    type: Date
  },
  actualDelivery: {
    type: Date
  },
  statusHistory: [{
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      required: [true, 'Status is required for history entry']
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: [true, 'Timestamp is required for history entry']
    },
    note: {
      type: String,
      trim: true
    }
  }],
  updatedAt: {
    type: Date,
    default: Date.now
  },
  paymentRef: {
    type: String,
    default: null,
    trim: true,
    sparse: true, // Allow multiple null values but unique non-null values
    index: true
  },
  paymentMethodId: {
    type: String,
    trim: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'succeeded', 'failed', 'canceled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'paypal', 'card', 'bank_transfer'],
    default: 'stripe'
  },
  trackingNumber: {
    type: String,
    trim: true,
    sparse: true,
    index: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  paidAt: {
    type: Date,
    default: null,
    validate: {
      validator: function(this: IOrder, paidAt: Date | null) {
        if (paidAt && this.createdAt) {
          return paidAt >= this.createdAt;
        }
        return true;
      },
      message: 'Payment date cannot be before order creation date'
    }
  },
  shippedAt: {
    type: Date,
    default: null,
    validate: {
      validator: function(this: IOrder, shippedAt: Date | null) {
        if (shippedAt && this.paidAt) {
          return shippedAt >= this.paidAt;
        }
        return true;
      },
      message: 'Shipping date cannot be before payment date'
    }
  },
  deliveredAt: {
    type: Date,
    default: null,
    validate: {
      validator: function(this: IOrder, deliveredAt: Date | null) {
        if (deliveredAt && this.shippedAt) {
          return deliveredAt >= this.shippedAt;
        }
        return true;
      },
      message: 'Delivery date cannot be before shipping date'
    }
  },
  cancelledAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: false, // Using custom timestamp fields
  collection: 'orders',
  minimize: false,
  toJSON: {
    transform: function(doc, ret) {
      const orderDoc = ret as any; // Type assertion for Mongoose document
      const result: any = {
        ...ret,
        id: ret._id.toString(),
        userId: orderDoc.userId?.toString(),
        subtotal: orderDoc.subtotalCents ? orderDoc.subtotalCents / 100 : 0,
        total: orderDoc.totalCents ? orderDoc.totalCents / 100 : 0,
        totalItems: orderDoc.items ? orderDoc.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) : 0,
        isPaid: orderDoc.status !== OrderStatus.PENDING && orderDoc.paidAt !== null,
        isShipped: orderDoc.shippedAt !== null,
        isDelivered: orderDoc.deliveredAt !== null,
        isCancelled: orderDoc.status === OrderStatus.CANCELLED
      };
      
      delete result._id;
      delete result.__v;
      
      return result;
    }
  }
});

// Compound indexes for efficient queries
orderSchema.index({ userId: 1, status: 1, createdAt: -1 }); // User order history
orderSchema.index({ status: 1, createdAt: -1 }); // Admin order management
orderSchema.index({ createdAt: -1 }); // Recent orders
orderSchema.index({ paymentRef: 1 }, { sparse: true }); // Payment lookup

// Virtual properties
orderSchema.virtual('subtotal').get(function() {
  return (this as any).subtotalCents / 100;
});

orderSchema.virtual('total').get(function() {
  return (this as any).totalCents / 100;
});

orderSchema.virtual('totalItems').get(function() {
  return (this as any).items.reduce((sum: number, item: any) => sum + item.quantity, 0);
});

orderSchema.virtual('isPaid').get(function() {
  return (this as any).status !== OrderStatus.PENDING && (this as any).paidAt !== null;
});

orderSchema.virtual('isShipped').get(function() {
  return (this as any).shippedAt !== null;
});

orderSchema.virtual('isDelivered').get(function() {
  return (this as any).deliveredAt !== null;
});

orderSchema.virtual('isCancelled').get(function() {
  return (this as any).status === OrderStatus.CANCELLED;
});

orderSchema.virtual('canBeCancelled').get(function() {
  return [OrderStatus.PENDING, OrderStatus.PAID].includes((this as any).status) && 
         (this as any).status !== OrderStatus.CANCELLED;
});

// Instance methods
orderSchema.methods.updateStatus = async function(
  newStatus: OrderStatus, 
  context: StatusUpdateContext = {}
): Promise<IOrder> {
  const validTransitions = getValidStatusTransitions(this.status);
  
  if (!validTransitions.includes(newStatus)) {
    throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
  }
  
  // Validate business rules for specific transitions
  if (newStatus === OrderStatus.CANCELLED) {
    if (this.status === OrderStatus.PROCESSING && !context.isAdmin) {
      throw new Error('Only administrators can cancel orders that are being processed');
    }
    
    if (this.status === OrderStatus.PAID) {
      const hoursSincePaid = (Date.now() - (this.paidAt?.getTime() || 0)) / (1000 * 60 * 60);
      if (hoursSincePaid > 1 && !context.isAdmin) {
        throw new Error('Orders can only be cancelled within 1 hour of payment');
      }
    }
  }
  
  // Update status and relevant timestamps
  this.status = newStatus;
  
  switch (newStatus) {
    case OrderStatus.PAID:
      this.paidAt = context.timestamp || new Date();
      break;
    case OrderStatus.SHIPPED:
      this.shippedAt = context.timestamp || new Date();
      break;
    case OrderStatus.DELIVERED:
      this.deliveredAt = context.timestamp || new Date();
      break;
    case OrderStatus.CANCELLED:
      this.cancelledAt = context.timestamp || new Date();
      break;
  }
  
  return await this.save();
};

orderSchema.methods.addPaymentReference = async function(paymentRef: string): Promise<IOrder> {
  if (!paymentRef || typeof paymentRef !== 'string') {
    throw new Error('Payment reference is required');
  }
  
  this.paymentRef = paymentRef.trim();
  return await this.save();
};

orderSchema.methods.cancel = async function(reason?: string, userId?: string): Promise<IOrder> {
  if (this.status === OrderStatus.CANCELLED) {
    throw new Error('Order is already cancelled');
  }
  
  if (!this.canBeCancelled) {
    throw new Error('Order cannot be cancelled in its current state');
  }
  
  await this.updateStatus(OrderStatus.CANCELLED, {
    reason,
    userId,
    timestamp: new Date()
  });
  
  if (reason) {
    this.notes = (this.notes || '') + `\nCancellation reason: ${reason}`;
    await this.save();
  }
  
  return this;
};

orderSchema.methods.ship = async function(trackingNumber: string, carrier?: string): Promise<IOrder> {
  if (this.status !== OrderStatus.PROCESSING) {
    throw new Error('Order must be in Processing status to be shipped');
  }
  
  if (!trackingNumber || typeof trackingNumber !== 'string') {
    throw new Error('Tracking number is required');
  }
  
  this.trackingNumber = trackingNumber.trim();
  
  if (carrier) {
    this.notes = (this.notes || '') + `\nCarrier: ${carrier}`;
  }
  
  await this.updateStatus(OrderStatus.SHIPPED);
  return this;
};

orderSchema.methods.markAsDelivered = async function(): Promise<IOrder> {
  if (this.status !== OrderStatus.SHIPPED) {
    throw new Error('Order must be shipped before it can be marked as delivered');
  }
  
  await this.updateStatus(OrderStatus.DELIVERED);
  return this;
};

orderSchema.methods.calculateTotals = function(): void {
  this.subtotalCents = this.items.reduce((sum, item) => sum + item.lineSubtotalCents, 0);
  
  // For now, total equals subtotal (no shipping, tax, etc.)
  // This can be extended later to include shipping costs, taxes, discounts
  this.totalCents = this.subtotalCents;
};

// Static methods
orderSchema.statics.createOrder = async function(orderData: any): Promise<IOrder> {
  if (!orderData) {
    throw new Error('Order data is required');
  }

  const { userId, items, shippingAddress, notes } = orderData;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Order items are required');
  }

  // Generate order number
  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  // Calculate totals
  const subtotalCents = items.reduce((sum: number, item: any) => {
    const lineSubtotal = item.quantity * item.unitPriceCents;
    return sum + lineSubtotal;
  }, 0);

  const order = new this({
    orderNumber,
    userId: new mongoose.Types.ObjectId(userId),
    items: items.map((item: any) => ({
      ...item,
      lineSubtotalCents: item.quantity * item.unitPriceCents
    })),
    subtotalCents,
    totalAmountCents: subtotalCents, // For now, no additional fees
    totalCents: subtotalCents,
    shippingAddress,
    notes,
    statusHistory: [{
      status: OrderStatus.PENDING,
      timestamp: new Date(),
      note: 'Order created'
    }]
  });

  return await order.save() as unknown as IOrder;
};

orderSchema.statics.findByUserId = async function(
  userId: string, 
  options: FindOrdersOptions = {}
): Promise<FindOrdersResult> {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  
  const {
    status,
    page = 1,
    limit = 20,
    startDate,
    endDate
  } = options;
  
  const criteria: any = { userId: new mongoose.Types.ObjectId(userId) };
  
  if (status) {
    criteria.status = status;
  }
  
  if (startDate || endDate) {
    criteria.createdAt = {};
    if (startDate) criteria.createdAt.$gte = startDate;
    if (endDate) criteria.createdAt.$lte = endDate;
  }
  
  const skip = (page - 1) * limit;
  
  const [orders, totalCount] = await Promise.all([
    this.find(criteria)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('items.productId', 'name imageUrl'),
    this.countDocuments(criteria)
  ]);
  
  const totalPages = Math.ceil(totalCount / limit);
  
  return {
    orders,
    totalCount,
    page,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
};

orderSchema.statics.findByStatus = function(status: OrderStatus): Promise<IOrder[]> {
  return this.find({ status }).sort({ createdAt: -1 });
};

orderSchema.statics.findByPaymentRef = function(paymentRef: string): Promise<IOrder | null> {
  return this.findOne({ paymentRef }).populate('items.productId', 'name imageUrl');
};

orderSchema.statics.findRecentOrders = function(days: number = 7): Promise<IOrder[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({ 
    createdAt: { $gte: startDate } 
  }).sort({ createdAt: -1 });
};

orderSchema.statics.createFromCart = async function(
  userId: string, 
  cartItems: IOrderItem[], 
  options: CreateOrderOptions = {}
): Promise<IOrder> {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  
  if (!cartItems || cartItems.length === 0) {
    throw new Error('Cart items are required');
  }
  
  // Calculate totals
  const subtotalCents = cartItems.reduce((sum, item) => sum + item.lineSubtotalCents, 0);
  
  const order = new this({
    userId: new mongoose.Types.ObjectId(userId),
    items: cartItems,
    subtotalCents,
    totalCents: subtotalCents, // For now, no additional fees
    shippingAddress: options.shippingAddress,
    notes: options.notes
  });
  
  return await order.save() as unknown as IOrder;
};

orderSchema.statics.getOrderStatistics = async function(userId?: string): Promise<OrderStatistics> {
  const matchCriteria: any = {};
  if (userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }
    matchCriteria.userId = new mongoose.Types.ObjectId(userId);
  }
  
  const [totalStats, statusBreakdown] = await Promise.all([
    this.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenueCents: { $sum: '$totalCents' },
          averageOrderValueCents: { $avg: '$totalCents' }
        }
      }
    ]),
    this.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ])
  ]);
  
  const stats = totalStats[0] || { totalOrders: 0, totalRevenueCents: 0, averageOrderValueCents: 0 };
  
  const statusBreakdownMap: Record<OrderStatus, number> = {} as Record<OrderStatus, number>;
  Object.values(OrderStatus).forEach(status => {
    statusBreakdownMap[status] = 0;
  });
  
  statusBreakdown.forEach(item => {
    statusBreakdownMap[item._id as OrderStatus] = item.count;
  });
  
  return {
    totalOrders: stats.totalOrders,
    totalRevenueCents: stats.totalRevenueCents,
    totalRevenue: stats.totalRevenueCents / 100,
    averageOrderValueCents: Math.round(stats.averageOrderValueCents || 0),
    averageOrderValue: Math.round((stats.averageOrderValueCents || 0) / 100 * 100) / 100,
    statusBreakdown: statusBreakdownMap
  };
};

orderSchema.statics.findPendingOrders = function(olderThanMinutes: number = 30): Promise<IOrder[]> {
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - olderThanMinutes);
  
  return this.find({
    status: OrderStatus.PENDING,
    createdAt: { $lte: cutoffTime }
  }).sort({ createdAt: 1 });
};

// Pre-save middleware
orderSchema.pre('save', function(next) {
  // Ensure totals are calculated
  if (this.isModified('items')) {
    (this as any).calculateTotals();
  }
  
  // Validate status transitions
  if (this.isModified('status') && !this.isNew) {
    // For status transition validation, we need to store the original value
    // This is a limitation - we'll need to handle this at the service level
    // For now, we'll skip the transition validation in the pre-save hook
    // and implement it in the service methods
  }
  
  next();
});

// Helper function for valid status transitions
function getValidStatusTransitions(currentStatus: OrderStatus): OrderStatus[] {
  const transitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.FAILED],
    [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.FAILED]: [OrderStatus.PENDING] // Allow retry
  };
  
  return transitions[currentStatus] || [];
}

// Validation utilities
export const validateOrderStatus = (status: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!status) {
    errors.push('Order status is required');
    return { isValid: false, errors };
  }
  
  if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
    errors.push(`Invalid order status. Must be one of: ${Object.values(OrderStatus).join(', ')}`);
  }
  
  return { isValid: errors.length === 0, errors };
};

export const validateShippingAddress = (address: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!address) {
    errors.push('Shipping address is required');
    return { isValid: false, errors };
  }
  
  const requiredFields = ['street', 'city', 'state', 'zipCode'];
  
  requiredFields.forEach(field => {
    if (!address[field] || typeof address[field] !== 'string' || !address[field].trim()) {
      errors.push(`${field} is required`);
    }
  });
  
  if (address.zipCode && !/^\d{5}(-\d{4})?$/.test(address.zipCode)) {
    errors.push('Please provide a valid ZIP code');
  }
  
  return { isValid: errors.length === 0, errors };
};

// Create and export the model
const Order = mongoose.model<IOrder, IOrderModel>('Order', orderSchema);

export default Order;