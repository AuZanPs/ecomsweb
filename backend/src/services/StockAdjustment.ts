import Product from '../models/Product';
import Order from '../models/Order';
import {
  validateSchema,
  StockUpdateSchema,
  AdminStockBulkUpdateSchema
} from '../utils/validation';
import ProductService from './ProductService';

// Interfaces for stock adjustment
export interface StockAdjustmentEntry {
  productId: string;
  productName: string;
  previousStock: number;
  newStock: number;
  adjustment: number;
  reason: string;
  adjustmentType: 'increase' | 'decrease' | 'set';
  adjustedBy?: string;
  timestamp: Date;
  orderId?: string;
  batchId?: string;
}

export interface LowStockAlert {
  productId: string;
  productName: string;
  currentStock: number;
  threshold: number;
  reorderPoint: number;
  recommendedOrderQuantity: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  lastRestocked?: Date;
  averageDailySales: number;
  daysUntilOutOfStock: number;
}

export interface StockAnalytics {
  totalProducts: number;
  totalStockValue: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  excessStockProducts: number;
  fastMovingProducts: Array<{
    productId: string;
    productName: string;
    velocity: number; // Units per day
    currentStock: number;
    recommendedStock: number;
  }>;
  slowMovingProducts: Array<{
    productId: string;
    productName: string;
    velocity: number;
    currentStock: number;
    daysOfStock: number;
  }>;
  stockTurnoverRate: number;
  averageDaysInStock: number;
}

export interface ReorderRecommendation {
  productId: string;
  productName: string;
  currentStock: number;
  reorderPoint: number;
  recommendedOrderQuantity: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedCost: number;
  supplier?: string;
  leadTimeDays: number;
  stockoutRisk: number; // Percentage
  reason: string;
}

export interface StockMovementReport {
  period: string;
  movements: Array<{
    date: Date;
    productId: string;
    productName: string;
    movementType: 'sale' | 'restock' | 'adjustment' | 'return' | 'damage';
    quantity: number;
    reason?: string;
    orderId?: string;
    adjustmentId?: string;
  }>;
  summary: {
    totalMovements: number;
    totalSales: number;
    totalRestocks: number;
    totalAdjustments: number;
    netStockChange: number;
  };
}

// Service class for stock adjustment and inventory management
export class StockAdjustment {
  
  // Default thresholds and settings
  private static readonly DEFAULT_LOW_STOCK_THRESHOLD = 10;
  private static readonly DEFAULT_REORDER_MULTIPLIER = 2.5;
  private static readonly DEFAULT_LEAD_TIME_DAYS = 7;
  private static readonly HIGH_VELOCITY_THRESHOLD = 5; // Units per day
  private static readonly SLOW_MOVING_THRESHOLD = 0.5; // Units per day
  
  // ============================================================================
  // STOCK ADJUSTMENTS
  // ============================================================================
  
  static async adjustStock(
    productId: string, 
    newStock: number, 
    reason: string,
    adjustedBy?: string
  ): Promise<StockAdjustmentEntry> {
    // Validate input
    const validation = validateSchema(StockUpdateSchema, { productId, newStock });
    if (!validation.success) {
      throw new Error(`Stock adjustment validation failed: ${validation.errors.join(', ')}`);
    }
    
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      const previousStock = product.stock;
      const adjustment = newStock - previousStock;
      const adjustmentType: 'increase' | 'decrease' | 'set' = 
        adjustment > 0 ? 'increase' : adjustment < 0 ? 'decrease' : 'set';
      
      // Update product stock
      await product.updateStock(newStock);
      
      // Create adjustment entry
      const adjustmentEntry: StockAdjustmentEntry = {
        productId,
        productName: product.name,
        previousStock,
        newStock,
        adjustment,
        reason,
        adjustmentType,
        adjustedBy,
        timestamp: new Date()
      };
      
      // Log the adjustment (in a real system, this would be stored in a separate collection)
      await this.logStockAdjustment(adjustmentEntry);
      
      return adjustmentEntry;
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to adjust stock');
    }
  }
  
  static async increaseStock(
    productId: string, 
    quantity: number, 
    reason: string,
    adjustedBy?: string
  ): Promise<StockAdjustmentEntry> {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      const newStock = product.stock + quantity;
      return await this.adjustStock(productId, newStock, reason, adjustedBy);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to increase stock');
    }
  }
  
  static async decreaseStock(
    productId: string, 
    quantity: number, 
    reason: string,
    adjustedBy?: string
  ): Promise<StockAdjustmentEntry> {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      const newStock = Math.max(0, product.stock - quantity);
      return await this.adjustStock(productId, newStock, reason, adjustedBy);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to decrease stock');
    }
  }
  
  static async bulkAdjustStock(
    adjustments: Array<{ productId: string; newStock: number; reason: string }>,
    adjustedBy?: string
  ): Promise<StockAdjustmentEntry[]> {
    // Validate bulk adjustments
    const validation = validateSchema(AdminStockBulkUpdateSchema, { 
      updates: adjustments.map(adj => ({ productId: adj.productId, newStock: adj.newStock }))
    });
    if (!validation.success) {
      throw new Error(`Bulk stock adjustment validation failed: ${validation.errors.join(', ')}`);
    }
    
    try {
      const results: StockAdjustmentEntry[] = [];
      const batchId = `batch_${Date.now()}`;
      
      for (const adjustment of adjustments) {
        try {
          const result = await this.adjustStock(
            adjustment.productId, 
            adjustment.newStock, 
            adjustment.reason, 
            adjustedBy
          );
          result.batchId = batchId;
          results.push(result);
        } catch (error) {
          console.error(`Failed to adjust stock for product ${adjustment.productId}:`, error);
          // Continue with other adjustments
        }
      }
      
      return results;
      
    } catch (error) {
      throw new Error('Failed to bulk adjust stock');
    }
  }
  
  // ============================================================================
  // LOW STOCK ALERTS AND MONITORING
  // ============================================================================
  
  static async getLowStockAlerts(threshold?: number): Promise<LowStockAlert[]> {
    try {
      const stockThreshold = threshold || this.DEFAULT_LOW_STOCK_THRESHOLD;
      const lowStockProducts = await ProductService.getLowStockProducts(stockThreshold);
      
      const alerts: LowStockAlert[] = [];
      
      for (const product of lowStockProducts) {
        // Calculate sales velocity (mock implementation)
        const velocity = await this.calculateSalesVelocity(product.id);
        const daysUntilOutOfStock = velocity > 0 ? Math.floor(product.stock / velocity) : Infinity;
        
        // Determine priority based on stock level and velocity
        let priority: LowStockAlert['priority'];
        if (product.stock === 0) {
          priority = 'critical';
        } else if (daysUntilOutOfStock <= 3) {
          priority = 'high';
        } else if (daysUntilOutOfStock <= 7) {
          priority = 'medium';
        } else {
          priority = 'low';
        }
        
        const reorderPoint = Math.max(velocity * this.DEFAULT_LEAD_TIME_DAYS, stockThreshold);
        const recommendedOrderQuantity = Math.ceil(velocity * this.DEFAULT_LEAD_TIME_DAYS * this.DEFAULT_REORDER_MULTIPLIER);
        
        alerts.push({
          productId: product.id,
          productName: product.name,
          currentStock: product.stock,
          threshold: stockThreshold,
          reorderPoint,
          recommendedOrderQuantity,
          priority,
          averageDailySales: velocity,
          daysUntilOutOfStock
        });
      }
      
      // Sort by priority (critical first)
      return alerts.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
      
    } catch (error) {
      throw new Error('Failed to get low stock alerts');
    }
  }
  
  static async getCriticalStockAlerts(): Promise<LowStockAlert[]> {
    try {
      const allAlerts = await this.getLowStockAlerts();
      return allAlerts.filter(alert => alert.priority === 'critical' || alert.priority === 'high');
    } catch (error) {
      throw new Error('Failed to get critical stock alerts');
    }
  }
  
  static async getOutOfStockProducts(): Promise<Array<{
    productId: string;
    productName: string;
    daysOutOfStock: number;
    lastSaleDate?: Date;
    pendingOrders: number;
  }>> {
    try {
      const outOfStockProducts = await Product.find({ stock: 0 });
      
      const results = [];
      for (const product of outOfStockProducts) {
        // Calculate days out of stock (mock implementation)
        const daysOutOfStock = await this.calculateDaysOutOfStock(product._id.toString());
        
        // Count pending orders for this product
        const pendingOrders = await this.countPendingOrdersForProduct(product._id.toString());
        
        results.push({
          productId: product._id.toString(),
          productName: product.name,
          daysOutOfStock,
          pendingOrders
        });
      }
      
      return results;
      
    } catch (error) {
      throw new Error('Failed to get out of stock products');
    }
  }
  
  // ============================================================================
  // REORDER RECOMMENDATIONS
  // ============================================================================
  
  static async getReorderRecommendations(): Promise<ReorderRecommendation[]> {
    try {
      const lowStockAlerts = await this.getLowStockAlerts();
      const recommendations: ReorderRecommendation[] = [];
      
      for (const alert of lowStockAlerts) {
        if (alert.currentStock <= alert.reorderPoint) {
          const estimatedCost = await this.estimateReorderCost(alert.productId, alert.recommendedOrderQuantity);
          const stockoutRisk = this.calculateStockoutRisk(alert.currentStock, alert.averageDailySales);
          
          let priority: ReorderRecommendation['priority'];
          if (alert.priority === 'critical') {
            priority = 'urgent';
          } else if (alert.priority === 'high') {
            priority = 'high';
          } else if (alert.priority === 'medium') {
            priority = 'medium';
          } else {
            priority = 'low';
          }
          
          recommendations.push({
            productId: alert.productId,
            productName: alert.productName,
            currentStock: alert.currentStock,
            reorderPoint: alert.reorderPoint,
            recommendedOrderQuantity: alert.recommendedOrderQuantity,
            priority,
            estimatedCost,
            leadTimeDays: this.DEFAULT_LEAD_TIME_DAYS,
            stockoutRisk,
            reason: this.generateReorderReason(alert)
          });
        }
      }
      
      // Sort by priority and stockout risk
      return recommendations.sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.stockoutRisk - a.stockoutRisk;
      });
      
    } catch (error) {
      throw new Error('Failed to get reorder recommendations');
    }
  }
  
  static async generateAutomaticReorders(
    maxBudget?: number,
    priorities: ReorderRecommendation['priority'][] = ['urgent', 'high']
  ): Promise<{
    recommendations: ReorderRecommendation[];
    totalCost: number;
    budgetRemaining: number;
    skippedRecommendations: ReorderRecommendation[];
  }> {
    try {
      const allRecommendations = await this.getReorderRecommendations();
      const filteredRecommendations = allRecommendations.filter(rec => priorities.includes(rec.priority));
      
      if (!maxBudget) {
        return {
          recommendations: filteredRecommendations,
          totalCost: filteredRecommendations.reduce((sum, rec) => sum + rec.estimatedCost, 0),
          budgetRemaining: 0,
          skippedRecommendations: []
        };
      }
      
      const selectedRecommendations: ReorderRecommendation[] = [];
      const skippedRecommendations: ReorderRecommendation[] = [];
      let totalCost = 0;
      
      for (const recommendation of filteredRecommendations) {
        if (totalCost + recommendation.estimatedCost <= maxBudget) {
          selectedRecommendations.push(recommendation);
          totalCost += recommendation.estimatedCost;
        } else {
          skippedRecommendations.push(recommendation);
        }
      }
      
      return {
        recommendations: selectedRecommendations,
        totalCost,
        budgetRemaining: maxBudget - totalCost,
        skippedRecommendations
      };
      
    } catch (error) {
      throw new Error('Failed to generate automatic reorders');
    }
  }
  
  // ============================================================================
  // STOCK ANALYTICS
  // ============================================================================
  
  static async getStockAnalytics(): Promise<StockAnalytics> {
    try {
      const allProducts = await Product.find({});
      const totalProducts = allProducts.length;
      
      let totalStockValue = 0;
      let lowStockProducts = 0;
      let outOfStockProducts = 0;
      let excessStockProducts = 0;
      
      const fastMovingProducts = [];
      const slowMovingProducts = [];
      
      for (const product of allProducts) {
        const stockValue = product.priceCents * product.stock;
        totalStockValue += stockValue;
        
        if (product.stock === 0) {
          outOfStockProducts++;
        } else if (product.stock <= this.DEFAULT_LOW_STOCK_THRESHOLD) {
          lowStockProducts++;
        }
        
        // Calculate velocity and categorize products
        const velocity = await this.calculateSalesVelocity(product._id.toString());
        const daysOfStock = velocity > 0 ? product.stock / velocity : Infinity;
        
        if (velocity >= this.HIGH_VELOCITY_THRESHOLD) {
          const recommendedStock = Math.ceil(velocity * this.DEFAULT_LEAD_TIME_DAYS * this.DEFAULT_REORDER_MULTIPLIER);
          fastMovingProducts.push({
            productId: product._id.toString(),
            productName: product.name,
            velocity,
            currentStock: product.stock,
            recommendedStock
          });
        } else if (velocity <= this.SLOW_MOVING_THRESHOLD && product.stock > 0) {
          slowMovingProducts.push({
            productId: product._id.toString(),
            productName: product.name,
            velocity,
            currentStock: product.stock,
            daysOfStock: Math.round(daysOfStock)
          });
        }
        
        // Check for excess stock (more than 60 days of inventory)
        if (daysOfStock > 60) {
          excessStockProducts++;
        }
      }
      
      // Calculate stock turnover rate (mock implementation)
      const stockTurnoverRate = await this.calculateStockTurnoverRate();
      const averageDaysInStock = stockTurnoverRate > 0 ? 365 / stockTurnoverRate : 0;
      
      return {
        totalProducts,
        totalStockValue: totalStockValue / 100, // Convert cents to dollars
        lowStockProducts,
        outOfStockProducts,
        excessStockProducts,
        fastMovingProducts: fastMovingProducts.slice(0, 10), // Top 10
        slowMovingProducts: slowMovingProducts.slice(0, 10), // Top 10
        stockTurnoverRate: Math.round(stockTurnoverRate * 100) / 100,
        averageDaysInStock: Math.round(averageDaysInStock)
      };
      
    } catch (error) {
      throw new Error('Failed to get stock analytics');
    }
  }
  
  // ============================================================================
  // STOCK MOVEMENT TRACKING
  // ============================================================================
  
  static async getStockMovementReport(
    startDate: Date, 
    endDate: Date, 
    productId?: string
  ): Promise<StockMovementReport> {
    try {
      // In a real implementation, this would query a stock movements collection
      // For now, we'll generate a mock report based on orders
      
      const query: any = {
        createdAt: { $gte: startDate, $lte: endDate }
      };
      
      const orders = await Order.find(query);
      const movements: StockMovementReport['movements'] = [];
      
      let totalSales = 0;
      let totalRestocks = 0;
      let totalAdjustments = 0;
      
      // Process order-based movements
      for (const order of orders) {
        if (['Paid', 'Processing', 'Shipped', 'Delivered'].includes(order.status)) {
          for (const item of order.items) {
            if (!productId || item.productId.toString() === productId) {
              movements.push({
                date: order.createdAt,
                productId: item.productId.toString(),
                productName: item.productName,
                movementType: 'sale',
                quantity: -item.quantity, // Negative for sales
                orderId: order._id.toString()
              });
              totalSales += item.quantity;
            }
          }
        }
      }
      
      // Sort movements by date
      movements.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      const netStockChange = totalRestocks + totalAdjustments - totalSales;
      
      return {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        movements,
        summary: {
          totalMovements: movements.length,
          totalSales,
          totalRestocks,
          totalAdjustments,
          netStockChange
        }
      };
      
    } catch (error) {
      throw new Error('Failed to get stock movement report');
    }
  }
  
  // ============================================================================
  // AUTOMATIC STOCK ADJUSTMENTS
  // ============================================================================
  
  static async processOrderFulfillment(orderId: string): Promise<StockAdjustmentEntry[]> {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.status !== 'Shipped') {
        throw new Error('Order must be shipped to process stock fulfillment');
      }
      
      const adjustments: StockAdjustmentEntry[] = [];
      
      for (const item of order.items) {
        const adjustment = await this.decreaseStock(
          item.productId.toString(),
          item.quantity,
          `Order fulfillment - Order #${order.orderNumber}`,
          'system'
        );
        adjustment.orderId = orderId;
        adjustments.push(adjustment);
      }
      
      return adjustments;
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to process order fulfillment');
    }
  }
  
  static async processOrderCancellation(orderId: string): Promise<StockAdjustmentEntry[]> {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.status !== 'Cancelled') {
        throw new Error('Order must be cancelled to process stock restoration');
      }
      
      const adjustments: StockAdjustmentEntry[] = [];
      
      for (const item of order.items) {
        const adjustment = await this.increaseStock(
          item.productId.toString(),
          item.quantity,
          `Order cancellation - Order #${order.orderNumber}`,
          'system'
        );
        adjustment.orderId = orderId;
        adjustments.push(adjustment);
      }
      
      return adjustments;
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to process order cancellation');
    }
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  private static async logStockAdjustment(adjustment: StockAdjustmentEntry): Promise<void> {
    try {
      // In a real implementation, this would save to a stock_adjustments collection
      console.log('Stock adjustment logged:', {
        productId: adjustment.productId,
        adjustment: adjustment.adjustment,
        reason: adjustment.reason,
        timestamp: adjustment.timestamp
      });
    } catch (error) {
      console.error('Failed to log stock adjustment:', error);
    }
  }
  
  private static async calculateSalesVelocity(productId: string): Promise<number> {
    try {
      // Calculate average daily sales over the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const orders = await Order.find({
        createdAt: { $gte: thirtyDaysAgo },
        status: { $in: ['Paid', 'Processing', 'Shipped', 'Delivered'] }
      });
      
      let totalQuantity = 0;
      for (const order of orders) {
        for (const item of order.items) {
          if (item.productId.toString() === productId) {
            totalQuantity += item.quantity;
          }
        }
      }
      
      return totalQuantity / 30; // Average per day
      
    } catch (error) {
      console.error('Error calculating sales velocity:', error);
      return 0;
    }
  }
  
  private static async calculateDaysOutOfStock(productId: string): Promise<number> {
    // Mock implementation - would track actual stock-out dates
    return Math.floor(Math.random() * 10) + 1;
  }
  
  private static async countPendingOrdersForProduct(productId: string): Promise<number> {
    try {
      const pendingOrders = await Order.find({
        status: { $in: ['Pending', 'Paid', 'Processing'] },
        'items.productId': productId
      });
      
      return pendingOrders.length;
      
    } catch (error) {
      return 0;
    }
  }
  
  private static async estimateReorderCost(productId: string, quantity: number): Promise<number> {
    try {
      const product = await Product.findById(productId);
      if (!product) return 0;
      
      // Estimate cost as 60% of retail price (mock supplier cost)
      const estimatedCostPerUnit = product.priceCents * 0.6;
      return Math.round((estimatedCostPerUnit * quantity) / 100 * 100) / 100; // Round to cents
      
    } catch (error) {
      return 0;
    }
  }
  
  private static calculateStockoutRisk(currentStock: number, dailySales: number): number {
    if (dailySales === 0) return 0;
    const daysRemaining = currentStock / dailySales;
    
    if (daysRemaining <= 1) return 95;
    if (daysRemaining <= 3) return 80;
    if (daysRemaining <= 7) return 60;
    if (daysRemaining <= 14) return 40;
    if (daysRemaining <= 30) return 20;
    return 5;
  }
  
  private static generateReorderReason(alert: LowStockAlert): string {
    if (alert.currentStock === 0) {
      return 'Product is out of stock';
    }
    if (alert.daysUntilOutOfStock <= 3) {
      return `Will be out of stock in ${alert.daysUntilOutOfStock} days`;
    }
    if (alert.currentStock <= alert.threshold) {
      return `Stock below threshold (${alert.threshold})`;
    }
    return 'Preventive reordering recommended';
  }
  
  private static async calculateStockTurnoverRate(): Promise<number> {
    // Mock implementation - in reality, would calculate based on COGS and average inventory
    return 6.5; // Example: 6.5 times per year
  }
}

export default StockAdjustment;