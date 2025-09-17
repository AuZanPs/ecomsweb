import Order, { IOrder, OrderStatus } from '../models/Order';
import Product from '../models/Product';
import PaymentEvent from '../models/PaymentEvent';
import {
  OrderSearchData,
  OrderStatusUpdateData,
  OrderCancelData,
  OrderShipData,
  validateSchema,
  OrderSearchSchema,
  OrderStatusUpdateSchema,
  OrderCancelSchema,
  OrderShipSchema
} from '../utils/validation';
import ProductService from './ProductService';

// Interfaces for order responses
export interface OrderResponse {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    priceCents: number;
    subtotalCents: number;
  }>;
  totalAmountCents: number;
  totalAmount: number; // In dollars
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  shippingCostCents: number;
  shippingCost: number;
  taxCents: number;
  tax: number;
  notes?: string;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  createdAt: Date;
  updatedAt: Date;
  statusHistory: Array<{
    status: OrderStatus;
    timestamp: Date;
    reason?: string;
  }>;
}

export interface OrderListResponse {
  orders: OrderResponse[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface OrderStatistics {
  totalOrders: number;
  ordersByStatus: Record<OrderStatus, number>;
  totalRevenue: number;
  averageOrderValue: number;
  topSellingProducts: Array<{
    productId: string;
    productName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  recentOrders: OrderResponse[];
}

export interface OrderAnalytics {
  period: string;
  metrics: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    conversionRate: number;
    returnRate: number;
  };
  trends: {
    ordersGrowth: number;
    revenueGrowth: number;
    averageOrderValueGrowth: number;
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    totalSold: number;
    revenue: number;
  }>;
}

// Service class for order-related operations
export class OrderService {
  
  // ============================================================================
  // ORDER RETRIEVAL
  // ============================================================================
  
  static async getOrderById(orderId: string): Promise<OrderResponse | null> {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        return null;
      }
      
      return this.formatOrderResponse(order);
      
    } catch (error) {
      throw new Error('Failed to get order');
    }
  }
  
  static async getOrderByNumber(orderNumber: string): Promise<OrderResponse | null> {
    try {
      const order = await Order.findOne({ orderNumber });
      if (!order) {
        return null;
      }
      
      return this.formatOrderResponse(order);
      
    } catch (error) {
      throw new Error('Failed to get order by number');
    }
  }
  
  static async getOrdersByUser(userId: string, searchData: Partial<OrderSearchData> = {}): Promise<OrderListResponse> {
    const searchParams = {
      userId,
      page: 1,
      limit: 20,
      ...searchData
    };
    
    return this.searchOrders(searchParams);
  }
  
  static async searchOrders(searchData: OrderSearchData): Promise<OrderListResponse> {
    // Validate input data
    const validation = validateSchema(OrderSearchSchema, searchData);
    if (!validation.success) {
      throw new Error(`Order search validation failed: ${(validation as Extract<typeof validation, { success: false }>).errors.join(', ')}`);
    }
    
    try {
      // Build query filters
      const query: any = {};
      
      if (validation.data.userId) {
        query.userId = validation.data.userId;
      }
      
      if (validation.data.status) {
        query.status = validation.data.status;
      }
      
      if (validation.data.startDate || validation.data.endDate) {
        query.createdAt = {};
        if (validation.data.startDate) {
          query.createdAt.$gte = validation.data.startDate;
        }
        if (validation.data.endDate) {
          query.createdAt.$lte = validation.data.endDate;
        }
      }
      
      // Calculate pagination
      const page = validation.data.page;
      const limit = validation.data.limit;
      const skip = (page - 1) * limit;
      
      // Execute queries
      const [orders, totalCount] = await Promise.all([
        Order.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Order.countDocuments(query)
      ]);
      
      const totalPages = Math.ceil(totalCount / limit);
      
      return {
        orders: orders.map(order => this.formatOrderResponse(order)),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to search orders');
    }
  }
  
  // ============================================================================
  // ORDER STATUS MANAGEMENT
  // ============================================================================
  
  static async updateOrderStatus(orderId: string, statusData: OrderStatusUpdateData): Promise<OrderResponse> {
    // Validate input data
    const validation = validateSchema(OrderStatusUpdateSchema, statusData);
    if (!validation.success) {
      throw new Error(`Order status update validation failed: ${(validation as Extract<typeof validation, { success: false }>).errors.join(', ')}`);
    }
    
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Validate status transition (this could use StatusTransitionGuard)
      const isValidTransition = this.validateStatusTransition(order.status, validation.data.status as OrderStatus);
      if (!isValidTransition) {
        throw new Error(`Invalid status transition from ${order.status} to ${validation.data.status}`);
      }
      
      // Update order status
      await order.updateStatus(validation.data.status as OrderStatus, { reason: validation.data.reason });
      
      // Handle side effects of status changes
      await this.handleStatusChangeEffects(order, validation.data.status as OrderStatus);
      
      return this.formatOrderResponse(order);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to update order status');
    }
  }
  
  static async cancelOrder(orderId: string, cancelData: OrderCancelData): Promise<OrderResponse> {
    // Validate input data
    const validation = validateSchema(OrderCancelSchema, cancelData);
    if (!validation.success) {
      throw new Error(`Order cancellation validation failed: ${(validation as Extract<typeof validation, { success: false }>).errors.join(', ')}`);
    }
    
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Check if order can be cancelled
      if (!['Pending', 'Paid', 'Processing'].includes(order.status)) {
        throw new Error(`Cannot cancel order in ${order.status} status`);
      }
      
      // Release stock if order was paid/processing
      if (['Paid', 'Processing'].includes(order.status)) {
        await this.releaseOrderStock(order);
      }
      
      // Update order status to cancelled
      await order.updateStatus(OrderStatus.CANCELLED, { reason: validation.data.reason });
      
      return this.formatOrderResponse(order);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to cancel order');
    }
  }
  
  static async shipOrder(orderId: string, shipData: OrderShipData): Promise<OrderResponse> {
    // Validate input data
    const validation = validateSchema(OrderShipSchema, shipData);
    if (!validation.success) {
      throw new Error(`Order shipping validation failed: ${(validation as Extract<typeof validation, { success: false }>).errors.join(', ')}`);
    }
    
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Check if order can be shipped
      if (!['Paid', 'Processing'].includes(order.status)) {
        throw new Error(`Cannot ship order in ${order.status} status`);
      }
      
      // Update tracking information
      order.trackingNumber = validation.data.trackingNumber;
      if (validation.data.carrier) {
        order.set('carrier', validation.data.carrier);
      }
      
      // Calculate estimated delivery (business logic could be more sophisticated)
      const estimatedDelivery = new Date();
      estimatedDelivery.setDate(estimatedDelivery.getDate() + 5); // Default 5 days
      order.estimatedDelivery = estimatedDelivery;
      
      await order.save();
      
      // Update status to shipped
      await order.updateStatus(OrderStatus.SHIPPED, { reason: `Shipped with tracking number: ${validation.data.trackingNumber}` });
      
      return this.formatOrderResponse(order);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to ship order');
    }
  }
  
  static async markOrderDelivered(orderId: string): Promise<OrderResponse> {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Check if order can be marked as delivered
      if (order.status !== 'Shipped') {
        throw new Error(`Cannot mark order as delivered in ${order.status} status`);
      }
      
      // Set actual delivery date
      order.actualDelivery = new Date();
      await order.save();
      
      // Update status to delivered
      await order.updateStatus(OrderStatus.DELIVERED, { reason: 'Order successfully delivered' });
      
      return this.formatOrderResponse(order);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to mark order as delivered');
    }
  }
  
  // ============================================================================
  // ORDER TRACKING
  // ============================================================================
  
  static async getOrderTracking(orderNumber: string): Promise<{
    orderNumber: string;
    status: OrderStatus;
    trackingNumber?: string;
    estimatedDelivery?: Date;
    actualDelivery?: Date;
    statusHistory: Array<{
      status: OrderStatus;
      timestamp: Date;
      reason?: string;
    }>;
    shippingDetails?: {
      carrier?: string;
      trackingUrl?: string;
    };
  }> {
    try {
      const order = await Order.findOne({ orderNumber });
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Generate tracking URL (would be carrier-specific in real implementation)
      const trackingUrl = order.trackingNumber 
        ? `https://tracking.example.com/${order.trackingNumber}`
        : undefined;
      
      return {
        orderNumber: order.orderNumber,
        status: order.status,
        trackingNumber: order.trackingNumber,
        estimatedDelivery: order.estimatedDelivery,
        actualDelivery: order.actualDelivery,
        statusHistory: order.statusHistory.map(entry => ({
          status: entry.status,
          timestamp: entry.timestamp,
          reason: entry.reason
        })),
        shippingDetails: order.trackingNumber ? {
          carrier: order.get('carrier'),
          trackingUrl
        } : undefined
      };
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get order tracking');
    }
  }
  
  // ============================================================================
  // ORDER ANALYTICS
  // ============================================================================
  
  static async getOrderStatistics(): Promise<OrderStatistics> {
    try {
      const orders = await Order.find({});
      
      // Calculate basic statistics
      const totalOrders = orders.length;
      const ordersByStatus: Record<OrderStatus, number> = {
        'Pending': 0,
        'Paid': 0,
        'Processing': 0,
        'Shipped': 0,
        'Delivered': 0,
        'Cancelled': 0,
        'Failed': 0
      };
      
      let totalRevenue = 0;
      const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
      
      // Process each order
      orders.forEach(order => {
        ordersByStatus[order.status]++;
        
        if (['Paid', 'Processing', 'Shipped', 'Delivered'].includes(order.status)) {
          totalRevenue += order.totalAmountCents;
          
          // Track product sales
          order.items.forEach(item => {
            const productId = item.productId.toString();
            if (!productSales[productId]) {
              productSales[productId] = { name: item.productName, quantity: 0, revenue: 0 };
            }
            productSales[productId].quantity += item.quantity;
            productSales[productId].revenue += item.priceCents * item.quantity;
          });
        }
      });
      
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      // Get top selling products
      const topSellingProducts = Object.entries(productSales)
        .map(([productId, data]) => ({
          productId,
          productName: data.name,
          totalQuantity: data.quantity,
          totalRevenue: data.revenue / 100
        }))
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 10);
      
      // Get recent orders
      const recentOrders = orders
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5)
        .map(order => this.formatOrderResponse(order));
      
      return {
        totalOrders,
        ordersByStatus,
        totalRevenue: totalRevenue / 100,
        averageOrderValue: averageOrderValue / 100,
        topSellingProducts,
        recentOrders
      };
      
    } catch (error) {
      throw new Error('Failed to get order statistics');
    }
  }
  
  static async getOrderAnalytics(
    startDate: Date, 
    endDate: Date, 
    previousPeriodStartDate?: Date, 
    previousPeriodEndDate?: Date
  ): Promise<OrderAnalytics> {
    try {
      // Get orders for current period
      const currentOrders = await Order.find({
        createdAt: { $gte: startDate, $lte: endDate }
      });
      
      // Get orders for previous period (for growth calculations)
      let previousOrders: IOrder[] = [];
      if (previousPeriodStartDate && previousPeriodEndDate) {
        previousOrders = await Order.find({
          createdAt: { $gte: previousPeriodStartDate, $lte: previousPeriodEndDate }
        });
      }
      
      // Calculate current period metrics
      const totalOrders = currentOrders.length;
      const successfulOrders = currentOrders.filter(order => 
        ['Paid', 'Processing', 'Shipped', 'Delivered'].includes(order.status)
      );
      const cancelledOrders = currentOrders.filter(order => 
        ['Cancelled', 'Failed'].includes(order.status)
      );
      
      const totalRevenue = successfulOrders.reduce((sum, order) => sum + order.totalAmountCents, 0);
      const averageOrderValue = successfulOrders.length > 0 ? totalRevenue / successfulOrders.length : 0;
      const conversionRate = totalOrders > 0 ? (successfulOrders.length / totalOrders) * 100 : 0;
      const returnRate = successfulOrders.length > 0 ? (cancelledOrders.length / successfulOrders.length) * 100 : 0;
      
      // Calculate growth trends
      let ordersGrowth = 0;
      let revenueGrowth = 0;
      let averageOrderValueGrowth = 0;
      
      if (previousOrders.length > 0) {
        const previousSuccessfulOrders = previousOrders.filter(order => 
          ['Paid', 'Processing', 'Shipped', 'Delivered'].includes(order.status)
        );
        const previousRevenue = previousSuccessfulOrders.reduce((sum, order) => sum + order.totalAmountCents, 0);
        const previousAverageOrderValue = previousSuccessfulOrders.length > 0 ? previousRevenue / previousSuccessfulOrders.length : 0;
        
        ordersGrowth = previousOrders.length > 0 ? 
          ((totalOrders - previousOrders.length) / previousOrders.length) * 100 : 0;
        revenueGrowth = previousRevenue > 0 ? 
          ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
        averageOrderValueGrowth = previousAverageOrderValue > 0 ? 
          ((averageOrderValue - previousAverageOrderValue) / previousAverageOrderValue) * 100 : 0;
      }
      
      // Calculate top products
      const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
      
      successfulOrders.forEach(order => {
        order.items.forEach(item => {
          const productId = item.productId.toString();
          if (!productSales[productId]) {
            productSales[productId] = { name: item.productName, quantity: 0, revenue: 0 };
          }
          productSales[productId].quantity += item.quantity;
          productSales[productId].revenue += item.priceCents * item.quantity;
        });
      });
      
      const topProducts = Object.entries(productSales)
        .map(([productId, data]) => ({
          productId,
          productName: data.name,
          totalSold: data.quantity,
          revenue: data.revenue / 100
        }))
        .sort((a, b) => b.totalSold - a.totalSold)
        .slice(0, 10);
      
      return {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        metrics: {
          totalOrders,
          totalRevenue: totalRevenue / 100,
          averageOrderValue: averageOrderValue / 100,
          conversionRate: Math.round(conversionRate * 100) / 100,
          returnRate: Math.round(returnRate * 100) / 100
        },
        trends: {
          ordersGrowth: Math.round(ordersGrowth * 100) / 100,
          revenueGrowth: Math.round(revenueGrowth * 100) / 100,
          averageOrderValueGrowth: Math.round(averageOrderValueGrowth * 100) / 100
        },
        topProducts
      };
      
    } catch (error) {
      throw new Error('Failed to get order analytics');
    }
  }
  
  // ============================================================================
  // ORDER VALIDATION AND BUSINESS LOGIC
  // ============================================================================
  
  private static validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
    // Define valid status transitions
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.FAILED],
      [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [], // Terminal status
      [OrderStatus.CANCELLED]: [], // Terminal status
      [OrderStatus.FAILED]: [OrderStatus.PENDING] // Allow retry
    };
    
    return validTransitions[currentStatus].includes(newStatus);
  }
  
  private static async handleStatusChangeEffects(order: IOrder, newStatus: OrderStatus): Promise<void> {
    try {
      switch (newStatus) {
        case 'Cancelled':
        case 'Failed':
          // Release stock if order was previously paid/processing
          if (['Paid', 'Processing'].includes(order.status)) {
            await this.releaseOrderStock(order);
          }
          break;
          
        case 'Delivered':
          // Could trigger customer satisfaction surveys, loyalty points, etc.
          break;
          
        // Add other status-specific logic as needed
      }
    } catch (error) {
      console.error('Error handling status change effects:', error);
      // Don't throw here to avoid breaking the main status update
    }
  }
  
  private static async releaseOrderStock(order: IOrder): Promise<void> {
    try {
      for (const item of order.items) {
        await ProductService.increaseStock(item.productId.toString(), item.quantity);
      }
    } catch (error) {
      console.error('Failed to release order stock:', error);
      throw new Error('Failed to release stock for cancelled/failed order');
    }
  }
  
  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================
  
  static async bulkUpdateOrderStatus(
    orderIds: string[], 
    status: OrderStatus, 
    reason?: string
  ): Promise<OrderResponse[]> {
    try {
      const updatedOrders: OrderResponse[] = [];
      
      for (const orderId of orderIds) {
        try {
          const updatedOrder = await this.updateOrderStatus(orderId, { status, reason });
          updatedOrders.push(updatedOrder);
        } catch (error) {
          console.error(`Failed to update order ${orderId}:`, error);
          // Continue with other orders
        }
      }
      
      return updatedOrders;
      
    } catch (error) {
      throw new Error('Failed to bulk update order status');
    }
  }
  
  static async bulkCancelOrders(
    orderIds: string[], 
    reason: string
  ): Promise<OrderResponse[]> {
    try {
      const cancelledOrders: OrderResponse[] = [];
      
      for (const orderId of orderIds) {
        try {
          const cancelledOrder = await this.cancelOrder(orderId, { reason });
          cancelledOrders.push(cancelledOrder);
        } catch (error) {
          console.error(`Failed to cancel order ${orderId}:`, error);
          // Continue with other orders
        }
      }
      
      return cancelledOrders;
      
    } catch (error) {
      throw new Error('Failed to bulk cancel orders');
    }
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  private static formatOrderResponse(order: IOrder): OrderResponse {
    return {
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      userId: order.userId.toString(),
      status: order.status,
      items: order.items.map(item => ({
        productId: item.productId.toString(),
        productName: item.productName,
        quantity: item.quantity,
        priceCents: item.priceCents,
        subtotalCents: item.priceCents * item.quantity
      })),
      totalAmountCents: order.totalAmountCents,
      totalAmount: order.totalAmountCents / 100,
      shippingAddress: {
        street: order.shippingAddress.street,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        zipCode: order.shippingAddress.zipCode,
        country: order.shippingAddress.country
      },
      shippingCostCents: order.shippingCostCents || 0,
      shippingCost: (order.shippingCostCents || 0) / 100,
      taxCents: order.taxCents || 0,
      tax: (order.taxCents || 0) / 100,
      notes: order.notes,
      trackingNumber: order.trackingNumber,
      estimatedDelivery: order.estimatedDelivery,
      actualDelivery: order.actualDelivery,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      statusHistory: order.statusHistory.map(entry => ({
        status: entry.status,
        timestamp: entry.timestamp,
        reason: entry.reason
      }))
    };
  }
  
  static async checkOrderExists(orderId: string): Promise<boolean> {
    try {
      const order = await Order.findById(orderId);
      return !!order;
    } catch (error) {
      return false;
    }
  }
  
  static async getOrdersByStatus(status: OrderStatus): Promise<OrderResponse[]> {
    try {
      const orders = await Order.find({ status }).sort({ createdAt: -1 });
      return orders.map(order => this.formatOrderResponse(order));
    } catch (error) {
      throw new Error(`Failed to get orders by status: ${status}`);
    }
  }
  
  static async getOrdersRequiringAttention(): Promise<OrderResponse[]> {
    try {
      // Get orders that need attention (Paid but not processed for >24h, Shipped for >7d, etc.)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const ordersNeedingAttention = await Order.find({
        $or: [
          { status: 'Paid', createdAt: { $lt: oneDayAgo } },
          { status: 'Processing', createdAt: { $lt: oneDayAgo } },
          { status: 'Shipped', updatedAt: { $lt: oneWeekAgo } }
        ]
      }).sort({ createdAt: -1 });
      
      return ordersNeedingAttention.map(order => this.formatOrderResponse(order));
      
    } catch (error) {
      throw new Error('Failed to get orders requiring attention');
    }
  }
}

export default OrderService;