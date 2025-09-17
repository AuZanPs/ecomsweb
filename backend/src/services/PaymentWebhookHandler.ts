import Order from '../models/Order';
import PaymentEvent, { CreatePaymentEventData } from '../models/PaymentEvent';
import {
  PaymentEventCreateData,
  WebhookValidationData,
  validateSchema,
  PaymentEventCreateSchema,
  WebhookValidationSchema
} from '../utils/validation';
import OrderService from './OrderService';

// Interfaces for webhook processing
export interface WebhookProcessingResult {
  success: boolean;
  eventId?: string;
  orderId?: string;
  message: string;
  requiresManualReview?: boolean;
  errors?: string[];
}

export interface PaymentIntentData {
  id: string;
  amount: number;
  currency: string;
  status: string;
  metadata?: Record<string, any>;
  payment_method?: string;
  created: number;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: PaymentIntentData;
  };
  created: number;
  livemode: boolean;
  pending_webhooks: number;
  request: {
    id: string | null;
    idempotency_key: string | null;
  };
}

export interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: {
    id: string;
    amount?: {
      total: string;
      currency: string;
    };
    state?: string;
    parent_payment?: string;
    invoice_number?: string;
  };
  create_time: string;
  resource_type: string;
}

export interface PaymentEventSummary {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByProvider: Record<string, number>;
  eventsByStatus: Record<string, number>;
  recentEvents: Array<{
    id: string;
    type: string;
    provider: string;
    orderId?: string;
    amount?: number;
    status: string;
    createdAt: Date;
  }>;
  failedEvents: number;
  pendingEvents: number;
}

// Service class for payment webhook handling
export class PaymentWebhookHandler {
  
  // Provider configurations
  private static readonly STRIPE_ENDPOINT_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
  private static readonly PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || '';
  
  // ============================================================================
  // WEBHOOK ENTRY POINTS
  // ============================================================================
  
  static async handleStripeWebhook(
    payload: string, 
    signature: string, 
    endpointSecret?: string
  ): Promise<WebhookProcessingResult> {
    try {
      // Verify webhook signature (mock implementation)
      const isValidSignature = this.verifyStripeSignature(payload, signature, endpointSecret);
      if (!isValidSignature) {
        return {
          success: false,
          message: 'Invalid webhook signature',
          errors: ['Webhook signature verification failed']
        };
      }
      
      // Parse webhook event
      const event: StripeWebhookEvent = JSON.parse(payload);
      
      // Validate event structure
      const validation = validateSchema(WebhookValidationSchema, {
        id: event.id,
        type: event.type,
        data: event.data,
        created: event.created
      });
      
      if (!validation.success) {
        return {
          success: false,
          message: 'Invalid webhook event structure',
          errors: (validation as Extract<typeof validation, { success: false }>).errors
        };
      }
      
      // Process the webhook event
      return await this.processStripeEvent(event);
      
    } catch (error) {
      console.error('Error handling Stripe webhook:', error);
      return {
        success: false,
        message: 'Failed to process webhook',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
  
  static async handlePayPalWebhook(
    payload: string, 
    headers: Record<string, string>
  ): Promise<WebhookProcessingResult> {
    try {
      // Verify webhook (mock implementation)
      const isValidWebhook = this.verifyPayPalWebhook(payload, headers);
      if (!isValidWebhook) {
        return {
          success: false,
          message: 'Invalid PayPal webhook',
          errors: ['Webhook verification failed']
        };
      }
      
      // Parse webhook event
      const event: PayPalWebhookEvent = JSON.parse(payload);
      
      // Process the webhook event
      return await this.processPayPalEvent(event);
      
    } catch (error) {
      console.error('Error handling PayPal webhook:', error);
      return {
        success: false,
        message: 'Failed to process webhook',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
  
  // ============================================================================
  // STRIPE EVENT PROCESSING
  // ============================================================================
  
  private static async processStripeEvent(event: StripeWebhookEvent): Promise<WebhookProcessingResult> {
    try {
      // Log webhook receipt
      await this.logWebhookEvent('stripe', event.type, event.id, event);
      
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata?.orderId;
      
      switch (event.type) {
        case 'payment_intent.created':
          return await this.handlePaymentIntentCreated(paymentIntent, orderId);
          
        case 'payment_intent.processing':
          return await this.handlePaymentIntentProcessing(paymentIntent, orderId);
          
        case 'payment_intent.succeeded':
          return await this.handlePaymentIntentSucceeded(paymentIntent, orderId);
          
        case 'payment_intent.payment_failed':
          return await this.handlePaymentIntentFailed(paymentIntent, orderId);
          
        case 'payment_intent.canceled':
          return await this.handlePaymentIntentCanceled(paymentIntent, orderId);
          
        case 'charge.dispute.created':
          return await this.handleChargeDispute(paymentIntent, orderId);
          
        case 'invoice.payment_succeeded':
          return await this.handleInvoicePaymentSucceeded(paymentIntent, orderId);
          
        case 'invoice.payment_failed':
          return await this.handleInvoicePaymentFailed(paymentIntent, orderId);
          
        default:
          // Log unhandled event types for monitoring
          console.warn(`Unhandled Stripe event type: ${event.type}`);
          return {
            success: true,
            eventId: event.id,
            message: `Event type ${event.type} received but not processed`
          };
      }
      
    } catch (error) {
      console.error('Error processing Stripe event:', error);
      return {
        success: false,
        eventId: event.id,
        message: 'Failed to process Stripe event',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
  
  private static async handlePaymentIntentCreated(
    paymentIntent: PaymentIntentData, 
    orderId?: string
  ): Promise<WebhookProcessingResult> {
    try {
      // Create payment event record
      await this.createPaymentEvent({
        orderId: orderId || '',
        provider: 'stripe',
        type: 'intent_created',
        externalId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        meta: { paymentIntent }
      });
      
      return {
        success: true,
        eventId: paymentIntent.id,
        orderId,
        message: 'Payment intent created successfully'
      };
      
    } catch (error) {
      throw new Error(`Failed to handle payment intent created: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private static async handlePaymentIntentProcessing(
    paymentIntent: PaymentIntentData, 
    orderId?: string
  ): Promise<WebhookProcessingResult> {
    try {
      // Create payment event record
      await this.createPaymentEvent({
        orderId: orderId || '',
        provider: 'stripe',
        type: 'intent_processing',
        externalId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        meta: { paymentIntent }
      });
      
      // Update order status if order exists
      if (orderId) {
        const order = await Order.findById(orderId);
        if (order && order.status === 'Pending') {
          await OrderService.updateOrderStatus(orderId, {
            status: 'Processing',
            reason: 'Payment is being processed'
          });
        }
      }
      
      return {
        success: true,
        eventId: paymentIntent.id,
        orderId,
        message: 'Payment intent processing'
      };
      
    } catch (error) {
      throw new Error(`Failed to handle payment intent processing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private static async handlePaymentIntentSucceeded(
    paymentIntent: PaymentIntentData, 
    orderId?: string
  ): Promise<WebhookProcessingResult> {
    try {
      // Create payment event record
      await this.createPaymentEvent({
        orderId: orderId || '',
        provider: 'stripe',
        type: 'intent_succeeded',
        externalId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        meta: { paymentIntent }
      });
      
      // Update order status to paid
      if (orderId) {
        const order = await Order.findById(orderId);
        if (order && ['Pending', 'Processing'].includes(order.status)) {
          await OrderService.updateOrderStatus(orderId, {
            status: 'Paid',
            reason: 'Payment confirmed by Stripe'
          });
        }
      }
      
      return {
        success: true,
        eventId: paymentIntent.id,
        orderId,
        message: 'Payment succeeded and order updated'
      };
      
    } catch (error) {
      throw new Error(`Failed to handle payment intent succeeded: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private static async handlePaymentIntentFailed(
    paymentIntent: PaymentIntentData, 
    orderId?: string
  ): Promise<WebhookProcessingResult> {
    try {
      // Create payment event record
      await this.createPaymentEvent({
        orderId: orderId || '',
        provider: 'stripe',
        type: 'intent_failed',
        externalId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        meta: { paymentIntent }
      });
      
      // Update order status to failed
      if (orderId) {
        const order = await Order.findById(orderId);
        if (order && ['Pending', 'Processing'].includes(order.status)) {
          await OrderService.updateOrderStatus(orderId, {
            status: 'Failed',
            reason: 'Payment failed'
          });
        }
      }
      
      return {
        success: true,
        eventId: paymentIntent.id,
        orderId,
        message: 'Payment failed and order updated',
        requiresManualReview: true
      };
      
    } catch (error) {
      throw new Error(`Failed to handle payment intent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private static async handlePaymentIntentCanceled(
    paymentIntent: PaymentIntentData, 
    orderId?: string
  ): Promise<WebhookProcessingResult> {
    try {
      // Create payment event record
      await this.createPaymentEvent({
        orderId: orderId || '',
        provider: 'stripe',
        type: 'intent_cancelled',
        externalId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        meta: { paymentIntent }
      });
      
      // Cancel order if it exists
      if (orderId) {
        const order = await Order.findById(orderId);
        if (order && ['Pending', 'Processing'].includes(order.status)) {
          await OrderService.cancelOrder(orderId, {
            reason: 'Payment intent was canceled'
          });
        }
      }
      
      return {
        success: true,
        eventId: paymentIntent.id,
        orderId,
        message: 'Payment canceled and order updated'
      };
      
    } catch (error) {
      throw new Error(`Failed to handle payment intent canceled: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private static async handleChargeDispute(
    paymentIntent: PaymentIntentData, 
    orderId?: string
  ): Promise<WebhookProcessingResult> {
    try {
      // Create payment event record
      await this.createPaymentEvent({
        orderId: orderId || '',
        provider: 'stripe',
        type: 'webhook_received',
        externalId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: 'dispute_created',
        meta: { paymentIntent, type: 'charge_dispute' }
      });
      
      return {
        success: true,
        eventId: paymentIntent.id,
        orderId,
        message: 'Charge dispute created - requires manual review',
        requiresManualReview: true
      };
      
    } catch (error) {
      throw new Error(`Failed to handle charge dispute: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private static async handleInvoicePaymentSucceeded(
    paymentIntent: PaymentIntentData, 
    orderId?: string
  ): Promise<WebhookProcessingResult> {
    try {
      // Create payment event record
      await this.createPaymentEvent({
        orderId: orderId || '',
        provider: 'stripe',
        type: 'payment_confirmed',
        externalId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        meta: { paymentIntent, type: 'invoice_payment' }
      });
      
      return {
        success: true,
        eventId: paymentIntent.id,
        orderId,
        message: 'Invoice payment succeeded'
      };
      
    } catch (error) {
      throw new Error(`Failed to handle invoice payment succeeded: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private static async handleInvoicePaymentFailed(
    paymentIntent: PaymentIntentData, 
    orderId?: string
  ): Promise<WebhookProcessingResult> {
    try {
      // Create payment event record
      await this.createPaymentEvent({
        orderId: orderId || '',
        provider: 'stripe',
        type: 'payment_failed',
        externalId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        meta: { paymentIntent, type: 'invoice_payment_failed' }
      });
      
      return {
        success: true,
        eventId: paymentIntent.id,
        orderId,
        message: 'Invoice payment failed',
        requiresManualReview: true
      };
      
    } catch (error) {
      throw new Error(`Failed to handle invoice payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // ============================================================================
  // PAYPAL EVENT PROCESSING
  // ============================================================================
  
  private static async processPayPalEvent(event: PayPalWebhookEvent): Promise<WebhookProcessingResult> {
    try {
      // Log webhook receipt
      await this.logWebhookEvent('paypal', event.event_type, event.id, event);
      
      const orderId = event.resource.invoice_number; // Assuming order ID is stored in invoice_number
      
      switch (event.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          return await this.handlePayPalPaymentCompleted(event, orderId);
          
        case 'PAYMENT.CAPTURE.DENIED':
          return await this.handlePayPalPaymentDenied(event, orderId);
          
        case 'PAYMENT.CAPTURE.PENDING':
          return await this.handlePayPalPaymentPending(event, orderId);
          
        case 'PAYMENT.CAPTURE.REFUNDED':
          return await this.handlePayPalPaymentRefunded(event, orderId);
          
        case 'CHECKOUT.ORDER.APPROVED':
          return await this.handlePayPalOrderApproved(event, orderId);
          
        case 'CHECKOUT.ORDER.COMPLETED':
          return await this.handlePayPalOrderCompleted(event, orderId);
          
        default:
          console.warn(`Unhandled PayPal event type: ${event.event_type}`);
          return {
            success: true,
            eventId: event.id,
            message: `Event type ${event.event_type} received but not processed`
          };
      }
      
    } catch (error) {
      console.error('Error processing PayPal event:', error);
      return {
        success: false,
        eventId: event.id,
        message: 'Failed to process PayPal event',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
  
  private static async handlePayPalPaymentCompleted(
    event: PayPalWebhookEvent, 
    orderId?: string
  ): Promise<WebhookProcessingResult> {
    try {
      const amount = event.resource.amount ? parseFloat(event.resource.amount.total) * 100 : undefined;
      
      // Create payment event record
      await this.createPaymentEvent({
        orderId: orderId || '',
        provider: 'paypal',
        type: 'payment_confirmed',
        externalId: event.resource.id,
        amount,
        currency: event.resource.amount?.currency,
        status: 'completed',
        meta: { event }
      });
      
      // Update order status to paid
      if (orderId) {
        const order = await Order.findById(orderId);
        if (order && ['Pending', 'Processing'].includes(order.status)) {
          await OrderService.updateOrderStatus(orderId, {
            status: 'Paid',
            reason: 'Payment confirmed by PayPal'
          });
        }
      }
      
      return {
        success: true,
        eventId: event.id,
        orderId,
        message: 'PayPal payment completed and order updated'
      };
      
    } catch (error) {
      throw new Error(`Failed to handle PayPal payment completed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private static async handlePayPalPaymentDenied(
    event: PayPalWebhookEvent, 
    orderId?: string
  ): Promise<WebhookProcessingResult> {
    try {
      const amount = event.resource.amount ? parseFloat(event.resource.amount.total) * 100 : undefined;
      
      // Create payment event record
      await this.createPaymentEvent({
        orderId: orderId || '',
        provider: 'paypal',
        type: 'payment_failed',
        externalId: event.resource.id,
        amount,
        currency: event.resource.amount?.currency,
        status: 'denied',
        meta: { event }
      });
      
      // Update order status to failed
      if (orderId) {
        const order = await Order.findById(orderId);
        if (order && ['Pending', 'Processing'].includes(order.status)) {
          await OrderService.updateOrderStatus(orderId, {
            status: 'Failed',
            reason: 'Payment denied by PayPal'
          });
        }
      }
      
      return {
        success: true,
        eventId: event.id,
        orderId,
        message: 'PayPal payment denied and order updated',
        requiresManualReview: true
      };
      
    } catch (error) {
      throw new Error(`Failed to handle PayPal payment denied: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private static async handlePayPalPaymentPending(
    event: PayPalWebhookEvent, 
    orderId?: string
  ): Promise<WebhookProcessingResult> {
    try {
      const amount = event.resource.amount ? parseFloat(event.resource.amount.total) * 100 : undefined;
      
      // Create payment event record
      await this.createPaymentEvent({
        orderId: orderId || '',
        provider: 'paypal',
        type: 'webhook_received',
        externalId: event.resource.id,
        amount,
        currency: event.resource.amount?.currency,
        status: 'pending',
        meta: { event }
      });
      
      return {
        success: true,
        eventId: event.id,
        orderId,
        message: 'PayPal payment pending'
      };
      
    } catch (error) {
      throw new Error(`Failed to handle PayPal payment pending: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private static async handlePayPalPaymentRefunded(
    event: PayPalWebhookEvent, 
    orderId?: string
  ): Promise<WebhookProcessingResult> {
    try {
      const amount = event.resource.amount ? parseFloat(event.resource.amount.total) * 100 : undefined;
      
      // Create payment event record
      await this.createPaymentEvent({
        orderId: orderId || '',
        provider: 'paypal',
        type: 'refund_succeeded',
        externalId: event.resource.id,
        amount,
        currency: event.resource.amount?.currency,
        status: 'refunded',
        meta: { event }
      });
      
      return {
        success: true,
        eventId: event.id,
        orderId,
        message: 'PayPal payment refunded',
        requiresManualReview: true
      };
      
    } catch (error) {
      throw new Error(`Failed to handle PayPal payment refunded: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private static async handlePayPalOrderApproved(
    event: PayPalWebhookEvent, 
    orderId?: string
  ): Promise<WebhookProcessingResult> {
    try {
      // Create payment event record
      await this.createPaymentEvent({
        orderId: orderId || '',
        provider: 'paypal',
        type: 'webhook_received',
        externalId: event.resource.id,
        status: 'approved',
        meta: { event, type: 'order_approved' }
      });
      
      return {
        success: true,
        eventId: event.id,
        orderId,
        message: 'PayPal order approved'
      };
      
    } catch (error) {
      throw new Error(`Failed to handle PayPal order approved: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private static async handlePayPalOrderCompleted(
    event: PayPalWebhookEvent, 
    orderId?: string
  ): Promise<WebhookProcessingResult> {
    try {
      // Create payment event record
      await this.createPaymentEvent({
        orderId: orderId || '',
        provider: 'paypal',
        type: 'payment_confirmed',
        externalId: event.resource.id,
        status: 'completed',
        meta: { event, type: 'order_completed' }
      });
      
      // Update order status to paid
      if (orderId) {
        const order = await Order.findById(orderId);
        if (order && ['Pending', 'Processing'].includes(order.status)) {
          await OrderService.updateOrderStatus(orderId, {
            status: 'Paid',
            reason: 'PayPal order completed'
          });
        }
      }
      
      return {
        success: true,
        eventId: event.id,
        orderId,
        message: 'PayPal order completed and order updated'
      };
      
    } catch (error) {
      throw new Error(`Failed to handle PayPal order completed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // ============================================================================
  // WEBHOOK VERIFICATION (Mock Implementations)
  // ============================================================================
  
  private static verifyStripeSignature(
    payload: string, 
    signature: string, 
    endpointSecret?: string
  ): boolean {
    // Mock implementation - in production, use Stripe's webhook signature verification
    try {
      const secret = endpointSecret || this.STRIPE_ENDPOINT_SECRET;
      if (!secret) {
        console.warn('Stripe webhook secret not configured');
        return false;
      }
      
      // In production, this would use Stripe's crypto verification
      // For now, just check that signature exists and is not empty
      return signature && signature.length > 0;
      
    } catch (error) {
      console.error('Error verifying Stripe signature:', error);
      return false;
    }
  }
  
  private static verifyPayPalWebhook(
    payload: string, 
    headers: Record<string, string>
  ): boolean {
    // Mock implementation - in production, use PayPal's webhook verification
    try {
      const webhookId = headers['paypal-transmission-id'];
      if (!webhookId) {
        console.warn('PayPal webhook ID missing');
        return false;
      }
      
      // In production, this would verify against PayPal's public key
      return true;
      
    } catch (error) {
      console.error('Error verifying PayPal webhook:', error);
      return false;
    }
  }
  
  // ============================================================================
  // PAYMENT EVENT MANAGEMENT
  // ============================================================================
  
  private static async createPaymentEvent(eventData: PaymentEventCreateData): Promise<void> {
    try {
      const validation = validateSchema(PaymentEventCreateSchema, eventData);
      if (!validation.success) {
        throw new Error(`Payment event validation failed: ${(validation as Extract<typeof validation, { success: false }>).errors.join(', ')}`);
      }
      
      await PaymentEvent.createEvent(validation.data as CreatePaymentEventData);
      
    } catch (error) {
      console.error('Failed to create payment event:', error);
      throw error;
    }
  }
  
  private static async logWebhookEvent(
    provider: string, 
    eventType: string, 
    webhookId: string, 
    eventData: any
  ): Promise<void> {
    try {
      // Log webhook receipt for monitoring and debugging
      console.log(`Webhook received: ${provider} - ${eventType} - ${webhookId}`);
      
      // Create a webhook received event
      await this.createPaymentEvent({
        orderId: '', // Will be filled if order ID is available
        provider: provider as 'stripe' | 'paypal',
        type: 'webhook_received',
        externalId: webhookId,
        status: 'received',
        meta: { eventType, eventData },
        webhookId
      });
      
    } catch (error) {
      console.error('Failed to log webhook event:', error);
      // Don't throw here to avoid breaking webhook processing
    }
  }
  
  // ============================================================================
  // WEBHOOK ANALYTICS AND MONITORING
  // ============================================================================
  
  static async getPaymentEventSummary(): Promise<PaymentEventSummary> {
    try {
      const events = await PaymentEvent.find({}).sort({ createdAt: -1 });
      
      const totalEvents = events.length;
      const eventsByType: Record<string, number> = {};
      const eventsByProvider: Record<string, number> = {};
      const eventsByStatus: Record<string, number> = {};
      
      let failedEvents = 0;
      let pendingEvents = 0;
      
      events.forEach(event => {
        // Count by type
        eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
        
        // Count by provider
        eventsByProvider[event.provider] = (eventsByProvider[event.provider] || 0) + 1;
        
        // Count by status
        if (event.status) {
          eventsByStatus[event.status] = (eventsByStatus[event.status] || 0) + 1;
        }
        
        // Count failed and pending
        if (event.type.includes('failed') || event.status === 'failed') {
          failedEvents++;
        }
        if (event.status === 'pending') {
          pendingEvents++;
        }
      });
      
      const recentEvents = events.slice(0, 10).map(event => ({
        id: event._id.toString(),
        type: event.type,
        provider: event.provider,
        orderId: event.orderId ? event.orderId.toString() : undefined,
        amount: event.amount ? event.amount / 100 : undefined,
        status: event.status || 'unknown',
        createdAt: event.createdAt
      }));
      
      return {
        totalEvents,
        eventsByType,
        eventsByProvider,
        eventsByStatus,
        recentEvents,
        failedEvents,
        pendingEvents
      };
      
    } catch (error) {
      throw new Error('Failed to get payment event summary');
    }
  }
  
  static async getFailedWebhooks(): Promise<Array<{
    id: string;
    provider: string;
    type: string;
    orderId?: string;
    error: string;
    createdAt: Date;
    retryCount: number;
  }>> {
    try {
      const failedEvents = await PaymentEvent.find({
        $or: [
          { type: { $regex: 'failed' } },
          { status: 'failed' },
          { 'meta.error': { $exists: true } }
        ]
      }).sort({ createdAt: -1 });
      
      return failedEvents.map(event => ({
        id: event._id.toString(),
        provider: event.provider,
        type: event.type,
        orderId: event.orderId ? event.orderId.toString() : undefined,
        error: event.meta?.error || 'Unknown error',
        createdAt: event.createdAt,
        retryCount: event.meta?.retryCount || 0
      }));
      
    } catch (error) {
      throw new Error('Failed to get failed webhooks');
    }
  }
  
  static async retryFailedWebhook(eventId: string): Promise<WebhookProcessingResult> {
    try {
      const event = await PaymentEvent.findById(eventId);
      if (!event) {
        return {
          success: false,
          message: 'Event not found'
        };
      }
      
      // Increment retry count
      const retryCount = (event.meta?.retryCount || 0) + 1;
      event.meta = { ...event.meta, retryCount };
      await event.save();
      
      // Attempt to reprocess based on provider
      if (event.provider === 'stripe' && event.meta?.eventData) {
        return await this.processStripeEvent(event.meta.eventData);
      } else if (event.provider === 'paypal' && event.meta?.eventData) {
        return await this.processPayPalEvent(event.meta.eventData);
      }
      
      return {
        success: false,
        message: 'Unable to retry - insufficient event data'
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Failed to retry webhook: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  // ============================================================================
  // WEBHOOK HEALTH MONITORING
  // ============================================================================
  
  static async getWebhookHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: {
      successRate: number;
      averageProcessingTime: number;
      recentFailures: number;
      lastSuccessfulWebhook?: Date;
      lastFailedWebhook?: Date;
    };
    issues: string[];
  }> {
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      
      const recentEvents = await PaymentEvent.find({
        createdAt: { $gte: oneHourAgo }
      });
      
      const totalEvents = recentEvents.length;
      const failedEvents = recentEvents.filter(event => 
        event.type.includes('failed') || event.status === 'failed'
      ).length;
      
      const successRate = totalEvents > 0 ? ((totalEvents - failedEvents) / totalEvents) * 100 : 100;
      
      // Get last successful and failed webhooks
      const lastSuccessful = await PaymentEvent.findOne({
        type: { $nin: ['webhook_failed', 'payment_failed', 'refund_failed'] }
      }).sort({ createdAt: -1 });
      
      const lastFailed = await PaymentEvent.findOne({
        $or: [
          { type: { $regex: 'failed' } },
          { status: 'failed' }
        ]
      }).sort({ createdAt: -1 });
      
      // Determine health status
      let status: 'healthy' | 'degraded' | 'unhealthy';
      const issues: string[] = [];
      
      if (successRate >= 95) {
        status = 'healthy';
      } else if (successRate >= 85) {
        status = 'degraded';
        issues.push(`Success rate below 95%: ${successRate.toFixed(1)}%`);
      } else {
        status = 'unhealthy';
        issues.push(`Success rate critically low: ${successRate.toFixed(1)}%`);
      }
      
      if (totalEvents === 0) {
        issues.push('No webhook events received in the last hour');
      }
      
      if (failedEvents > 5) {
        issues.push(`High number of failed events: ${failedEvents}`);
      }
      
      return {
        status,
        metrics: {
          successRate: Math.round(successRate * 100) / 100,
          averageProcessingTime: 150, // Mock - would calculate from actual processing times
          recentFailures: failedEvents,
          lastSuccessfulWebhook: lastSuccessful?.createdAt,
          lastFailedWebhook: lastFailed?.createdAt
        },
        issues
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        metrics: {
          successRate: 0,
          averageProcessingTime: 0,
          recentFailures: 0
        },
        issues: [`Failed to get webhook health: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
}

export default PaymentWebhookHandler;