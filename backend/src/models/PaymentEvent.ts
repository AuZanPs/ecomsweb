import mongoose, { Document, Schema, Model } from 'mongoose';

// Payment event type enumeration
export enum PaymentEventType {
  INTENT_CREATED = 'intent_created',
  INTENT_PROCESSING = 'intent_processing',
  INTENT_SUCCEEDED = 'intent_succeeded',
  INTENT_FAILED = 'intent_failed',
  INTENT_CANCELLED = 'intent_cancelled',
  PAYMENT_CONFIRMED = 'payment_confirmed',
  PAYMENT_FAILED = 'payment_failed',
  REFUND_CREATED = 'refund_created',
  REFUND_SUCCEEDED = 'refund_succeeded',
  REFUND_FAILED = 'refund_failed',
  WEBHOOK_RECEIVED = 'webhook_received',
  WEBHOOK_PROCESSED = 'webhook_processed',
  WEBHOOK_FAILED = 'webhook_failed'
}

// Payment provider enumeration
export enum PaymentProvider {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  SQUARE = 'square'
}

// Interface for PaymentEvent document
export interface IPaymentEvent extends Document {
  _id: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  provider: PaymentProvider;
  type: PaymentEventType;
  externalId: string; // Provider's event/transaction ID
  amount?: number; // Amount in cents
  currency?: string;
  status?: string; // Provider-specific status
  meta: Record<string, any>; // Minimal payload subset
  webhookId?: string; // For webhook events
  processed: boolean;
  processedAt?: Date;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  
  // Instance methods
  markAsProcessed(): Promise<IPaymentEvent>;
  markAsFailed(errorMessage: string): Promise<IPaymentEvent>;
  incrementRetry(): Promise<IPaymentEvent>;
  canRetry(): boolean;
  toJSON(): Partial<IPaymentEvent>;
}

// Interface for PaymentEvent model (static methods)
export interface IPaymentEventModel extends Model<IPaymentEvent> {
  findByOrderId(orderId: string): Promise<IPaymentEvent[]>;
  findByExternalId(externalId: string, provider?: PaymentProvider): Promise<IPaymentEvent | null>;
  findUnprocessedEvents(): Promise<IPaymentEvent[]>;
  findFailedEvents(maxRetries?: number): Promise<IPaymentEvent[]>;
  createEvent(eventData: CreatePaymentEventData): Promise<IPaymentEvent>;
  findRecentEvents(hours?: number): Promise<IPaymentEvent[]>;
  getEventStatistics(orderId?: string): Promise<PaymentEventStatistics>;
}

// Helper interfaces
export interface CreatePaymentEventData {
  orderId: string;
  provider: PaymentProvider;
  type: PaymentEventType;
  externalId: string;
  amount?: number;
  currency?: string;
  status?: string;
  meta?: Record<string, any>;
  webhookId?: string;
}

export interface PaymentEventStatistics {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  pendingEvents: number;
  typeBreakdown: Record<PaymentEventType, number>;
  providerBreakdown: Record<PaymentProvider, number>;
}

// PaymentEvent schema definition
const paymentEventSchema = new Schema<IPaymentEvent>({
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order ID is required'],
    validate: {
      validator: function(orderId: mongoose.Types.ObjectId) {
        return mongoose.Types.ObjectId.isValid(orderId);
      },
      message: 'Invalid order ID'
    },
    index: true // For order-based queries
  },
  provider: {
    type: String,
    enum: Object.values(PaymentProvider),
    required: [true, 'Payment provider is required'],
    index: true
  },
  type: {
    type: String,
    enum: Object.values(PaymentEventType),
    required: [true, 'Event type is required'],
    index: true
  },
  externalId: {
    type: String,
    required: [true, 'External ID is required'],
    trim: true,
    index: true, // For provider event lookups
    validate: {
      validator: function(externalId: string) {
        return externalId && externalId.trim().length > 0;
      },
      message: 'External ID cannot be empty'
    }
  },
  amount: {
    type: Number,
    min: [0, 'Amount cannot be negative'],
    validate: {
      validator: function(amount?: number) {
        if (amount !== undefined) {
          return Number.isInteger(amount) && amount >= 0;
        }
        return true;
      },
      message: 'Amount must be a non-negative integer in cents'
    }
  },
  currency: {
    type: String,
    trim: true,
    uppercase: true,
    default: 'USD',
    validate: {
      validator: function(currency?: string) {
        if (currency) {
          // Basic currency code validation (ISO 4217)
          return /^[A-Z]{3}$/.test(currency);
        }
        return true;
      },
      message: 'Currency must be a valid 3-letter ISO code'
    }
  },
  status: {
    type: String,
    trim: true,
    index: true
  },
  meta: {
    type: Schema.Types.Mixed,
    default: {},
    validate: {
      validator: function(meta: any) {
        // Ensure meta is an object and not too large
        if (typeof meta !== 'object' || meta === null) {
          return false;
        }
        
        // Limit meta size to prevent excessive storage
        const metaString = JSON.stringify(meta);
        return metaString.length <= 10000; // 10KB limit
      },
      message: 'Meta must be an object and cannot exceed 10KB'
    }
  },
  webhookId: {
    type: String,
    trim: true,
    sparse: true,
    index: true // For webhook deduplication
  },
  processed: {
    type: Boolean,
    default: false,
    required: true,
    index: true // For finding unprocessed events
  },
  processedAt: {
    type: Date,
    default: null,
    validate: {
      validator: function(this: IPaymentEvent, processedAt: Date | null) {
        if (processedAt && this.createdAt) {
          return processedAt >= this.createdAt;
        }
        return true;
      },
      message: 'Processed date cannot be before creation date'
    }
  },
  errorMessage: {
    type: String,
    trim: true,
    maxlength: [1000, 'Error message cannot exceed 1000 characters']
  },
  retryCount: {
    type: Number,
    default: 0,
    min: [0, 'Retry count cannot be negative'],
    max: [10, 'Retry count cannot exceed 10'],
    validate: {
      validator: function(retryCount: number) {
        return Number.isInteger(retryCount) && retryCount >= 0;
      },
      message: 'Retry count must be a non-negative integer'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true // For chronological queries
  }
}, {
  timestamps: false, // Using custom createdAt
  collection: 'payment_events',
  minimize: false,
  toJSON: {
    transform: function(doc, ret) {
      const result: any = {
        ...ret,
        id: ret._id.toString(),
        orderId: ret.orderId.toString(),
        canRetry: ret.retryCount < 5 && ret.processed === false,
        age: Date.now() - ret.createdAt.getTime(),
        ageHours: Math.round((Date.now() - ret.createdAt.getTime()) / (1000 * 60 * 60) * 100) / 100
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

// Compound indexes for efficient queries
paymentEventSchema.index({ orderId: 1, createdAt: -1 }); // Order event history
paymentEventSchema.index({ provider: 1, externalId: 1 }, { unique: true }); // Prevent duplicates
paymentEventSchema.index({ processed: 1, createdAt: 1 }); // Unprocessed events queue
paymentEventSchema.index({ type: 1, createdAt: -1 }); // Event type analysis
paymentEventSchema.index({ webhookId: 1 }, { sparse: true }); // Webhook deduplication

// Instance methods
paymentEventSchema.methods.markAsProcessed = async function(): Promise<IPaymentEvent> {
  this.processed = true;
  this.processedAt = new Date();
  this.errorMessage = undefined; // Clear any previous error
  return await this.save();
};

paymentEventSchema.methods.markAsFailed = async function(errorMessage: string): Promise<IPaymentEvent> {
  if (!errorMessage || typeof errorMessage !== 'string') {
    throw new Error('Error message is required');
  }
  
  this.processed = false;
  this.errorMessage = errorMessage.trim().substring(0, 1000); // Truncate if too long
  this.processedAt = null;
  return await this.save();
};

paymentEventSchema.methods.incrementRetry = async function(): Promise<IPaymentEvent> {
  if (this.retryCount >= 10) {
    throw new Error('Maximum retry count reached');
  }
  
  this.retryCount += 1;
  return await this.save();
};

paymentEventSchema.methods.canRetry = function(): boolean {
  return this.retryCount < 5 && !this.processed && !!this.errorMessage;
};

// Static methods
paymentEventSchema.statics.findByOrderId = function(orderId: string): Promise<IPaymentEvent[]> {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new Error('Invalid order ID');
  }
  
  return this.find({ 
    orderId: new mongoose.Types.ObjectId(orderId) 
  }).sort({ createdAt: -1 });
};

paymentEventSchema.statics.findByExternalId = function(
  externalId: string, 
  provider?: PaymentProvider
): Promise<IPaymentEvent | null> {
  const criteria: any = { externalId: externalId.trim() };
  
  if (provider) {
    criteria.provider = provider;
  }
  
  return this.findOne(criteria);
};

paymentEventSchema.statics.findUnprocessedEvents = function(): Promise<IPaymentEvent[]> {
  return this.find({ 
    processed: false,
    retryCount: { $lt: 5 } // Don't include events that have exceeded retry limit
  }).sort({ createdAt: 1 }); // Process oldest first
};

paymentEventSchema.statics.findFailedEvents = function(maxRetries: number = 5): Promise<IPaymentEvent[]> {
  return this.find({
    processed: false,
    errorMessage: { $exists: true, $ne: null },
    retryCount: { $lt: maxRetries }
  }).sort({ createdAt: 1 });
};

paymentEventSchema.statics.createEvent = async function(
  eventData: CreatePaymentEventData
): Promise<IPaymentEvent> {
  const {
    orderId,
    provider,
    type,
    externalId,
    amount,
    currency = 'USD',
    status,
    meta = {},
    webhookId
  } = eventData;
  
  // Validate required fields
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    throw new Error('Valid order ID is required');
  }
  
  if (!provider || !Object.values(PaymentProvider).includes(provider)) {
    throw new Error('Valid payment provider is required');
  }
  
  if (!type || !Object.values(PaymentEventType).includes(type)) {
    throw new Error('Valid event type is required');
  }
  
  if (!externalId || typeof externalId !== 'string') {
    throw new Error('External ID is required');
  }
  
  // Check for duplicate events
  const existingEvent = await (this as IPaymentEventModel).findByExternalId(externalId, provider);
  if (existingEvent) {
    throw new Error(`Event with external ID ${externalId} already exists for provider ${provider}`);
  }
  
  // Create event
  const event = new this({
    orderId: new mongoose.Types.ObjectId(orderId),
    provider,
    type,
    externalId: externalId.trim(),
    amount,
    currency: currency?.toUpperCase(),
    status: status?.trim(),
    meta,
    webhookId: webhookId?.trim()
  });
  
  return await event.save();
};

paymentEventSchema.statics.findRecentEvents = function(hours: number = 24): Promise<IPaymentEvent[]> {
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - hours);
  
  return this.find({
    createdAt: { $gte: startTime }
  }).sort({ createdAt: -1 });
};

paymentEventSchema.statics.getEventStatistics = async function(
  orderId?: string
): Promise<PaymentEventStatistics> {
  const matchCriteria: any = {};
  
  if (orderId) {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error('Invalid order ID');
    }
    matchCriteria.orderId = new mongoose.Types.ObjectId(orderId);
  }
  
  const [totalStats, typeBreakdown, providerBreakdown] = await Promise.all([
    this.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          successfulEvents: {
            $sum: { $cond: [{ $eq: ['$processed', true] }, 1, 0] }
          },
          failedEvents: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$processed', false] },
                    { $ne: ['$errorMessage', null] }
                  ]
                },
                1,
                0
              ]
            }
          },
          pendingEvents: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$processed', false] },
                    { $eq: ['$errorMessage', null] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]),
    this.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]),
    this.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 }
        }
      }
    ])
  ]);
  
  const stats = totalStats[0] || {
    totalEvents: 0,
    successfulEvents: 0,
    failedEvents: 0,
    pendingEvents: 0
  };
  
  // Initialize breakdowns with zero counts
  const typeBreakdownMap: Record<PaymentEventType, number> = {} as Record<PaymentEventType, number>;
  Object.values(PaymentEventType).forEach(type => {
    typeBreakdownMap[type] = 0;
  });
  
  const providerBreakdownMap: Record<PaymentProvider, number> = {} as Record<PaymentProvider, number>;
  Object.values(PaymentProvider).forEach(provider => {
    providerBreakdownMap[provider] = 0;
  });
  
  // Fill in actual counts
  typeBreakdown.forEach(item => {
    typeBreakdownMap[item._id as PaymentEventType] = item.count;
  });
  
  providerBreakdown.forEach(item => {
    providerBreakdownMap[item._id as PaymentProvider] = item.count;
  });
  
  return {
    totalEvents: stats.totalEvents,
    successfulEvents: stats.successfulEvents,
    failedEvents: stats.failedEvents,
    pendingEvents: stats.pendingEvents,
    typeBreakdown: typeBreakdownMap,
    providerBreakdown: providerBreakdownMap
  };
};

// Pre-save middleware
paymentEventSchema.pre('save', function(next) {
  // Ensure externalId is trimmed
  if (this.isModified('externalId')) {
    this.externalId = this.externalId.trim();
  }
  
  // Ensure status is trimmed if provided
  if (this.isModified('status') && this.status) {
    this.status = this.status.trim();
  }
  
  // Set processedAt when marking as processed
  if (this.isModified('processed') && this.processed && !this.processedAt) {
    this.processedAt = new Date();
  }
  
  // Clear processedAt when marking as unprocessed
  if (this.isModified('processed') && !this.processed) {
    this.processedAt = null;
  }
  
  next();
});

// Post-save middleware for logging
paymentEventSchema.post('save', function(doc) {
  console.log(`Payment event ${doc.type} for order ${doc.orderId}: ${doc.externalId} (${doc.provider})`);
});

// Handle unique constraint errors
paymentEventSchema.post('save', function(error: any, doc: any, next: any) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    if (error.keyPattern?.externalId && error.keyPattern?.provider) {
      next(new Error(`Payment event with external ID ${doc.externalId} already exists for provider ${doc.provider}`));
    } else {
      next(new Error('Duplicate payment event'));
    }
  } else {
    next(error);
  }
});

// Validation utilities
export const validatePaymentEventType = (type: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!type) {
    errors.push('Payment event type is required');
    return { isValid: false, errors };
  }
  
  if (!Object.values(PaymentEventType).includes(type as PaymentEventType)) {
    errors.push(`Invalid payment event type. Must be one of: ${Object.values(PaymentEventType).join(', ')}`);
  }
  
  return { isValid: errors.length === 0, errors };
};

export const validatePaymentProvider = (provider: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!provider) {
    errors.push('Payment provider is required');
    return { isValid: false, errors };
  }
  
  if (!Object.values(PaymentProvider).includes(provider as PaymentProvider)) {
    errors.push(`Invalid payment provider. Must be one of: ${Object.values(PaymentProvider).join(', ')}`);
  }
  
  return { isValid: errors.length === 0, errors };
};

export const validatePaymentAmount = (amount?: number): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (amount !== undefined) {
    if (typeof amount !== 'number') {
      errors.push('Amount must be a number');
      return { isValid: false, errors };
    }
    
    if (!Number.isInteger(amount)) {
      errors.push('Amount must be an integer (in cents)');
    }
    
    if (amount < 0) {
      errors.push('Amount cannot be negative');
    }
    
    if (amount > 100000000) {
      errors.push('Amount cannot exceed $1,000,000');
    }
  }
  
  return { isValid: errors.length === 0, errors };
};

// Create and export the model
const PaymentEvent = mongoose.model<IPaymentEvent, IPaymentEventModel>('PaymentEvent', paymentEventSchema);

export default PaymentEvent;