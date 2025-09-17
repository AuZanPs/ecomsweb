import Cart from '../models/Cart';
import Order, { IOrder, OrderStatus } from '../models/Order';
import Product from '../models/Product';
import {
  CheckoutInitiateData,
  CheckoutConfirmData,
  ShippingAddressData,
  validateSchema,
  CheckoutInitiateSchema,
  CheckoutConfirmSchema
} from '../utils/validation';
import CartService from './CartService';
import ProductService from './ProductService';

// Interfaces for checkout responses
export interface CheckoutInitiateResponse {
  orderId: string;
  clientSecret: string; // For payment processing
  totalAmount: number; // In dollars
  totalAmountCents: number; // In cents
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    priceCents: number;
    subtotalCents: number;
  }>;
  shippingAddress: ShippingAddressData;
  estimatedDelivery: Date;
  paymentMethods: string[];
}

export interface CheckoutConfirmResponse {
  orderId: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  totalAmountCents: number;
  paymentIntentId: string;
  estimatedDelivery: Date;
  trackingNumber?: string;
}

export interface ShippingCalculation {
  cost: number; // In dollars
  costCents: number; // In cents
  method: string;
  estimatedDays: number;
  estimatedDelivery: Date;
}

export interface CheckoutValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  cartIssues: Array<{
    productId: string;
    issue: string;
    severity: 'error' | 'warning';
  }>;
}

export interface PricingBreakdown {
  subtotal: number; // In dollars
  subtotalCents: number;
  shipping: number;
  shippingCents: number;
  tax: number;
  taxCents: number;
  total: number;
  totalCents: number;
  discounts?: {
    amount: number;
    amountCents: number;
    description: string;
  }[];
}

// Service class for checkout-related operations
export class CheckoutService {
  
  // Shipping rates (in cents) - this could be moved to a configuration service
  private static SHIPPING_RATES = {
    standard: { cost: 499, days: 5 }, // $4.99, 5 days
    expedited: { cost: 999, days: 2 }, // $9.99, 2 days
    overnight: { cost: 1999, days: 1 }, // $19.99, 1 day
    free: { cost: 0, days: 7, minOrder: 5000 } // Free over $50
  };
  
  private static TAX_RATE = 0.08; // 8% tax rate
  
  // ============================================================================
  // CHECKOUT INITIATION
  // ============================================================================
  
  static async initiateCheckout(userId: string, checkoutData: CheckoutInitiateData): Promise<CheckoutInitiateResponse> {
    // Validate input data
    const validation = validateSchema(CheckoutInitiateSchema, checkoutData);
    if (!validation.success) {
      throw new Error(`Checkout validation failed: ${(validation as Extract<typeof validation, { success: false }>).errors.join(', ')}`);
    }
    
    try {
      // Get user's cart
      const cart = await CartService.getCart(userId);
      if (!cart || cart.items.length === 0) {
        throw new Error('Cart is empty');
      }
      
      // Validate cart and stock availability
      const validationResult = await this.validateCheckout(userId);
      if (!validationResult.isValid) {
        throw new Error(`Checkout validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      // Calculate shipping
      const shipping = this.calculateShipping(cart.totalAmountCents, validation.data.shippingAddress);
      
      // Calculate final totals
      const pricing = this.calculatePricing(cart.totalAmountCents, shipping.costCents);
      
      // Create order in Pending status
      const orderData = {
        userId,
        items: cart.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          priceCents: item.productPriceCents
        })),
        totalAmountCents: pricing.totalCents,
        shippingAddress: validation.data.shippingAddress,
        shippingCostCents: shipping.costCents,
        taxCents: pricing.taxCents,
        notes: validation.data.notes
      };
      
      const order = await Order.createOrder(orderData);
      
      // Generate payment intent (mock implementation)
      const clientSecret = this.generateClientSecret(order._id.toString());
      
      return {
        orderId: order._id.toString(),
        clientSecret,
        totalAmount: pricing.total,
        totalAmountCents: pricing.totalCents,
        items: cart.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          priceCents: item.productPriceCents,
          subtotalCents: item.subtotalCents
        })),
        shippingAddress: validation.data.shippingAddress,
        estimatedDelivery: shipping.estimatedDelivery,
        paymentMethods: ['card', 'paypal', 'apple_pay', 'google_pay']
      };
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to initiate checkout');
    }
  }
  
  // ============================================================================
  // CHECKOUT CONFIRMATION
  // ============================================================================
  
  static async confirmCheckout(userId: string, confirmData: CheckoutConfirmData): Promise<CheckoutConfirmResponse> {
    // Validate input data
    const validation = validateSchema(CheckoutConfirmSchema, confirmData);
    if (!validation.success) {
      throw new Error(`Checkout confirmation validation failed: ${(validation as Extract<typeof validation, { success: false }>).errors.join(', ')}`);
    }
    
    try {
      // Find the order
      const order = await Order.findById(validation.data.paymentIntentId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Verify order belongs to user
      if (order.userId.toString() !== userId) {
        throw new Error('Unauthorized: Order does not belong to user');
      }
      
      // Verify order is in correct status
      if (order.status !== 'Pending') {
        throw new Error(`Cannot confirm order in ${order.status} status`);
      }
      
      // Final validation of cart and stock
      const validationResult = await this.validateCheckout(userId);
      if (!validationResult.isValid) {
        // Mark order as failed and throw error
        await order.updateStatus(OrderStatus.FAILED, { reason: 'Stock validation failed during confirmation' });
        throw new Error(`Final validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      // Process payment (mock implementation)
      const paymentSuccess = await this.processPayment(validation.data.paymentIntentId, validation.data.paymentMethodId);
      if (!paymentSuccess) {
        await order.updateStatus(OrderStatus.FAILED, { reason: 'Payment processing failed' });
        throw new Error('Payment processing failed');
      }
      
      // Update stock levels
      await this.reserveStock(order);
      
      // Update order status to Paid
      await order.updateStatus(OrderStatus.PAID, { reason: 'Payment confirmed' });
      
      // Clear user's cart
      await CartService.clearCart(userId);
      
      // Generate order number if not exists
      if (!order.orderNumber) {
        order.orderNumber = this.generateOrderNumber();
        await order.save();
      }
      
      return {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmountCents / 100,
        totalAmountCents: order.totalAmountCents,
        paymentIntentId: validation.data.paymentIntentId,
        estimatedDelivery: this.calculateEstimatedDelivery(order.shippingCostCents),
        trackingNumber: order.trackingNumber
      };
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to confirm checkout');
    }
  }
  
  // ============================================================================
  // CHECKOUT VALIDATION
  // ============================================================================
  
  static async validateCheckout(userId: string): Promise<CheckoutValidationResult> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];
      const cartIssues: CheckoutValidationResult['cartIssues'] = [];
      
      // Get and validate cart
      const cart = await CartService.getCart(userId);
      if (!cart || cart.items.length === 0) {
        errors.push('Cart is empty');
        return { isValid: false, errors, warnings, cartIssues };
      }
      
      // Validate cart stock
      const stockValidation = await CartService.validateCart(userId);
      if (!stockValidation.isValid) {
        stockValidation.issues.forEach(issue => {
          errors.push(`${issue.productName}: ${issue.issue}`);
          cartIssues.push({
            productId: issue.productId,
            issue: issue.issue,
            severity: 'error'
          });
        });
      }
      
      // Check for low stock warnings
      for (const item of cart.items) {
        const product = await Product.findById(item.productId);
        if (product && product.stock < 10 && product.stock >= item.quantity) {
          warnings.push(`${product.name} has low stock (${product.stock} remaining)`);
          cartIssues.push({
            productId: item.productId,
            issue: `Low stock: ${product.stock} remaining`,
            severity: 'warning'
          });
        }
      }
      
      // Validate minimum order amount (optional business rule)
      const MIN_ORDER_AMOUNT = 100; // $1.00 minimum
      if (cart.totalAmountCents < MIN_ORDER_AMOUNT) {
        errors.push(`Minimum order amount is $${MIN_ORDER_AMOUNT / 100}`);
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        cartIssues
      };
      
    } catch (error) {
      throw new Error('Failed to validate checkout');
    }
  }
  
  // ============================================================================
  // PRICING CALCULATIONS
  // ============================================================================
  
  static calculateShipping(subtotalCents: number, shippingAddress: ShippingAddressData): ShippingCalculation {
    // Determine shipping method based on order amount and address
    let shippingMethod: keyof typeof CheckoutService.SHIPPING_RATES;
    
    // Free shipping for orders over threshold
    if (subtotalCents >= CheckoutService.SHIPPING_RATES.free.minOrder) {
      shippingMethod = 'free';
    } else {
      shippingMethod = 'standard'; // Default to standard shipping
    }
    
    const rate = CheckoutService.SHIPPING_RATES[shippingMethod];
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + rate.days);
    
    return {
      cost: rate.cost / 100,
      costCents: rate.cost,
      method: shippingMethod,
      estimatedDays: rate.days,
      estimatedDelivery
    };
  }
  
  static calculatePricing(subtotalCents: number, shippingCents: number): PricingBreakdown {
    const taxCents = Math.round((subtotalCents + shippingCents) * CheckoutService.TAX_RATE);
    const totalCents = subtotalCents + shippingCents + taxCents;
    
    return {
      subtotal: subtotalCents / 100,
      subtotalCents,
      shipping: shippingCents / 100,
      shippingCents,
      tax: taxCents / 100,
      taxCents,
      total: totalCents / 100,
      totalCents
    };
  }
  
  static async calculateOrderTotal(userId: string, shippingAddress: ShippingAddressData): Promise<PricingBreakdown> {
    try {
      const cart = await CartService.getCart(userId);
      if (!cart) {
        throw new Error('Cart not found');
      }
      
      const shipping = this.calculateShipping(cart.totalAmountCents, shippingAddress);
      return this.calculatePricing(cart.totalAmountCents, shipping.costCents);
      
    } catch (error) {
      throw new Error('Failed to calculate order total');
    }
  }
  
  // ============================================================================
  // PAYMENT PROCESSING (Mock Implementation)
  // ============================================================================
  
  private static async processPayment(paymentIntentId: string, paymentMethodId?: string): Promise<boolean> {
    // Mock payment processing - in real implementation, this would integrate with Stripe/PayPal
    try {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock success rate (95% success for testing)
      const success = Math.random() > 0.05;
      
      if (!success) {
        console.error(`Payment failed for intent ${paymentIntentId}`);
        return false;
      }
      
      console.log(`Payment successful for intent ${paymentIntentId}`);
      return true;
      
    } catch (error) {
      console.error('Payment processing error:', error);
      return false;
    }
  }
  
  private static generateClientSecret(orderId: string): string {
    // Mock client secret generation - in real implementation, this would come from payment provider
    return `pi_mock_${orderId}_secret_${Date.now()}`;
  }
  
  // ============================================================================
  // STOCK MANAGEMENT
  // ============================================================================
  
  private static async reserveStock(order: IOrder): Promise<void> {
    try {
      // Reserve stock for each item in the order
      for (const item of order.items) {
        await ProductService.decreaseStock(item.productId.toString(), item.quantity);
      }
      
    } catch (error) {
      // If stock reservation fails, we should handle this gracefully
      // In a production system, this might trigger a stock adjustment workflow
      throw new Error(`Failed to reserve stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private static async releaseStock(order: IOrder): Promise<void> {
    try {
      // Release reserved stock back to inventory
      for (const item of order.items) {
        await ProductService.increaseStock(item.productId.toString(), item.quantity);
      }
      
    } catch (error) {
      throw new Error(`Failed to release stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // ============================================================================
  // ORDER UTILITIES
  // ============================================================================
  
  private static generateOrderNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD-${timestamp.slice(-6)}${random}`;
  }
  
  private static calculateEstimatedDelivery(shippingCostCents: number): Date {
    const delivery = new Date();
    
    // Determine delivery days based on shipping cost
    if (shippingCostCents >= 1999) { // Overnight
      delivery.setDate(delivery.getDate() + 1);
    } else if (shippingCostCents >= 999) { // Expedited
      delivery.setDate(delivery.getDate() + 2);
    } else if (shippingCostCents === 0) { // Free shipping
      delivery.setDate(delivery.getDate() + 7);
    } else { // Standard
      delivery.setDate(delivery.getDate() + 5);
    }
    
    return delivery;
  }
  
  // ============================================================================
  // CHECKOUT CANCELLATION
  // ============================================================================
  
  static async cancelCheckout(userId: string, orderId: string, reason: string): Promise<void> {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Verify order belongs to user
      if (order.userId.toString() !== userId) {
        throw new Error('Unauthorized: Order does not belong to user');
      }
      
      // Only allow cancellation of Pending or Paid orders
      if (!['Pending', 'Paid'].includes(order.status)) {
        throw new Error(`Cannot cancel order in ${order.status} status`);
      }
      
      // If order was paid, release the reserved stock
      if (order.status === 'Paid') {
        await this.releaseStock(order);
      }
      
      // Update order status
      await order.updateStatus(OrderStatus.CANCELLED, { reason });
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to cancel checkout');
    }
  }
  
  // ============================================================================
  // CHECKOUT ANALYTICS
  // ============================================================================
  
  static async getCheckoutStatistics(): Promise<{
    totalCheckouts: number;
    successfulCheckouts: number;
    failedCheckouts: number;
    abandonedCheckouts: number;
    conversionRate: number;
    averageOrderValue: number;
  }> {
    try {
      const allOrders = await Order.find({});
      const successful = allOrders.filter(order => ['Paid', 'Processing', 'Shipped', 'Delivered'].includes(order.status));
      const failed = allOrders.filter(order => ['Failed', 'Cancelled'].includes(order.status));
      const abandoned = allOrders.filter(order => order.status === 'Pending');
      
      const totalCheckouts = allOrders.length;
      const successfulCheckouts = successful.length;
      const failedCheckouts = failed.length;
      const abandonedCheckouts = abandoned.length;
      
      const conversionRate = totalCheckouts > 0 ? (successfulCheckouts / totalCheckouts) * 100 : 0;
      
      const totalValue = successful.reduce((sum, order) => sum + order.totalAmountCents, 0);
      const averageOrderValue = successfulCheckouts > 0 ? totalValue / successfulCheckouts / 100 : 0;
      
      return {
        totalCheckouts,
        successfulCheckouts,
        failedCheckouts,
        abandonedCheckouts,
        conversionRate: Math.round(conversionRate * 100) / 100,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100
      };
      
    } catch (error) {
      throw new Error('Failed to get checkout statistics');
    }
  }
  
  static async getCheckoutConversionFunnel(): Promise<{
    cartViews: number;
    checkoutInitiated: number;
    paymentAttempted: number;
    ordersCompleted: number;
    conversionRates: {
      cartToCheckout: number;
      checkoutToPayment: number;
      paymentToCompletion: number;
      overallConversion: number;
    };
  }> {
    try {
      // This would require additional tracking in a real implementation
      // For now, we'll use order data as a proxy
      const allOrders = await Order.find({});
      const pendingOrders = allOrders.filter(order => order.status === 'Pending');
      const paidOrders = allOrders.filter(order => ['Paid', 'Processing', 'Shipped', 'Delivered'].includes(order.status));
      const failedOrders = allOrders.filter(order => order.status === 'Failed');
      
      // Mock cart views (would come from analytics)
      const cartViews = allOrders.length * 2;
      const checkoutInitiated = allOrders.length;
      const paymentAttempted = paidOrders.length + failedOrders.length;
      const ordersCompleted = paidOrders.length;
      
      return {
        cartViews,
        checkoutInitiated,
        paymentAttempted,
        ordersCompleted,
        conversionRates: {
          cartToCheckout: cartViews > 0 ? (checkoutInitiated / cartViews) * 100 : 0,
          checkoutToPayment: checkoutInitiated > 0 ? (paymentAttempted / checkoutInitiated) * 100 : 0,
          paymentToCompletion: paymentAttempted > 0 ? (ordersCompleted / paymentAttempted) * 100 : 0,
          overallConversion: cartViews > 0 ? (ordersCompleted / cartViews) * 100 : 0
        }
      };
      
    } catch (error) {
      throw new Error('Failed to get checkout conversion funnel');
    }
  }
  
  // ============================================================================
  // SHIPPING METHODS
  // ============================================================================
  
  static getAvailableShippingMethods(subtotalCents: number): Array<{
    method: string;
    cost: number;
    costCents: number;
    estimatedDays: number;
    available: boolean;
  }> {
    return Object.entries(CheckoutService.SHIPPING_RATES).map(([method, rate]) => ({
      method,
      cost: rate.cost / 100,
      costCents: rate.cost,
      estimatedDays: rate.days,
      available: method === 'free' ? subtotalCents >= ((rate as any).minOrder || 0) : true
    }));
  }
  
  // ============================================================================
  // EXPRESS CHECKOUT
  // ============================================================================
  
  static async expressCheckout(
    userId: string, 
    productId: string, 
    quantity: number, 
    shippingAddress: ShippingAddressData
  ): Promise<CheckoutInitiateResponse> {
    try {
      // Validate product and stock
      const stockValidation = await ProductService.validateStockAvailability(productId, quantity);
      if (!stockValidation.isAvailable) {
        throw new Error('Product not available or insufficient stock');
      }
      
      // Create temporary cart-like structure for checkout
      const product = await ProductService.getProductById(productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      const subtotalCents = product.priceCents * quantity;
      const shipping = this.calculateShipping(subtotalCents, shippingAddress);
      const pricing = this.calculatePricing(subtotalCents, shipping.costCents);
      
      // Create order directly
      const orderData = {
        userId,
        items: [{
          productId,
          productName: product.name,
          quantity,
          priceCents: product.priceCents
        }],
        totalAmountCents: pricing.totalCents,
        shippingAddress,
        shippingCostCents: shipping.costCents,
        taxCents: pricing.taxCents
      };
      
      const order = await Order.createOrder(orderData);
      const clientSecret = this.generateClientSecret(order._id.toString());
      
      return {
        orderId: order._id.toString(),
        clientSecret,
        totalAmount: pricing.total,
        totalAmountCents: pricing.totalCents,
        items: [{
          productId,
          productName: product.name,
          quantity,
          priceCents: product.priceCents,
          subtotalCents: product.priceCents * quantity
        }],
        shippingAddress,
        estimatedDelivery: shipping.estimatedDelivery,
        paymentMethods: ['card', 'paypal', 'apple_pay', 'google_pay']
      };
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to process express checkout');
    }
  }
}

export default CheckoutService;