import { OrderStatus } from '../models/Order';
import Order from '../models/Order';
import User from '../models/User';

// Interfaces for status transition validation
export interface StatusTransitionRule {
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  conditions: Array<{
    type: 'time_based' | 'user_role' | 'payment_status' | 'stock_availability' | 'custom';
    description: string;
    validator: (context: StatusTransitionContext) => Promise<boolean> | boolean;
    errorMessage: string;
  }>;
  requiresApproval?: boolean;
  approvalRoles?: string[];
  allowedTransitionWindow?: number; // Minutes
  automaticRevert?: {
    afterMinutes: number;
    revertToStatus: OrderStatus;
    reason: string;
  };
}

export interface StatusTransitionContext {
  orderId: string;
  currentStatus: OrderStatus;
  targetStatus: OrderStatus;
  userId?: string;
  userRole?: string;
  reason?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface StatusTransitionResult {
  allowed: boolean;
  requiresApproval: boolean;
  approvalRequired?: {
    roles: string[];
    reason: string;
  };
  errors: string[];
  warnings: string[];
  autoRevertScheduled?: {
    afterMinutes: number;
    revertToStatus: OrderStatus;
  };
}

export interface StatusTransitionLog {
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  userId?: string;
  userRole?: string;
  reason?: string;
  approved: boolean;
  approvedBy?: string;
  timestamp: Date;
  reverted?: {
    revertedAt: Date;
    revertReason: string;
    revertedBy?: string;
  };
}

export interface PendingApproval {
  id: string;
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  requestedBy: string;
  requestedAt: Date;
  reason: string;
  requiredRoles: string[];
  approvals: Array<{
    userId: string;
    userRole: string;
    approved: boolean;
    timestamp: Date;
    comments?: string;
  }>;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt?: Date;
}

// Service class for order status transition validation and management
export class StatusTransitionGuard {
  
  // Define all valid status transition rules
  private static readonly TRANSITION_RULES: StatusTransitionRule[] = [
    // From Pending
    {
      fromStatus: 'Pending',
      toStatus: 'Paid',
      conditions: [
        {
          type: 'payment_status',
          description: 'Payment must be confirmed',
          validator: async (context) => {
            return await StatusTransitionGuard.validatePaymentReceived(context.orderId);
          },
          errorMessage: 'Payment has not been confirmed'
        },
        {
          type: 'stock_availability',
          description: 'All items must be in stock',
          validator: async (context) => {
            return await StatusTransitionGuard.validateStockAvailability(context.orderId);
          },
          errorMessage: 'One or more items are out of stock'
        }
      ]
    },
    {
      fromStatus: 'Pending',
      toStatus: 'Cancelled',
      conditions: [
        {
          type: 'time_based',
          description: 'Can be cancelled within 24 hours of creation',
          validator: async (context) => {
            return await StatusTransitionGuard.validateTimeWindow(context.orderId, 24 * 60);
          },
          errorMessage: 'Order can only be cancelled within 24 hours of creation'
        }
      ]
    },
    {
      fromStatus: 'Pending',
      toStatus: 'Failed',
      conditions: [
        {
          type: 'payment_status',
          description: 'Payment attempt must have failed',
          validator: async (context) => {
            return await StatusTransitionGuard.validatePaymentFailed(context.orderId);
          },
          errorMessage: 'No payment failure recorded'
        }
      ]
    },
    
    // From Paid
    {
      fromStatus: 'Paid',
      toStatus: 'Processing',
      conditions: [
        {
          type: 'stock_availability',
          description: 'All items must still be in stock',
          validator: async (context) => {
            return await StatusTransitionGuard.validateStockAvailability(context.orderId);
          },
          errorMessage: 'Stock is no longer available for one or more items'
        }
      ]
    },
    {
      fromStatus: 'Paid',
      toStatus: 'Cancelled',
      conditions: [
        {
          type: 'user_role',
          description: 'Only admins can cancel paid orders',
          validator: (context) => {
            return context.userRole === 'admin';
          },
          errorMessage: 'Only administrators can cancel paid orders'
        }
      ],
      requiresApproval: true,
      approvalRoles: ['admin', 'manager']
    },
    
    // From Processing
    {
      fromStatus: 'Processing',
      toStatus: 'Shipped',
      conditions: [
        {
          type: 'custom',
          description: 'Tracking number must be provided',
          validator: async (context) => {
            return await StatusTransitionGuard.validateTrackingNumber(context.orderId);
          },
          errorMessage: 'Tracking number is required to mark order as shipped'
        }
      ]
    },
    {
      fromStatus: 'Processing',
      toStatus: 'Cancelled',
      conditions: [
        {
          type: 'user_role',
          description: 'Only managers/admins can cancel processing orders',
          validator: (context) => {
            return ['admin', 'manager'].includes(context.userRole || '');
          },
          errorMessage: 'Only managers or administrators can cancel processing orders'
        }
      ],
      requiresApproval: true,
      approvalRoles: ['admin']
    },
    
    // From Shipped
    {
      fromStatus: 'Shipped',
      toStatus: 'Delivered',
      conditions: [
        {
          type: 'time_based',
          description: 'Must be at least 1 day since shipped',
          validator: async (context) => {
            return await StatusTransitionGuard.validateMinimumTimeSince(context.orderId, 'Shipped', 24 * 60);
          },
          errorMessage: 'Order can only be marked as delivered at least 1 day after shipping'
        }
      ],
      automaticRevert: {
        afterMinutes: 7 * 24 * 60, // 7 days
        revertToStatus: 'Delivered',
        reason: 'Automatic delivery confirmation after 7 days'
      }
    },
    
    // From Failed
    {
      fromStatus: 'Failed',
      toStatus: 'Pending',
      conditions: [
        {
          type: 'custom',
          description: 'Customer must retry payment',
          validator: async (context) => {
            return await StatusTransitionGuard.validateRetryAttempt(context.orderId);
          },
          errorMessage: 'Payment retry is required'
        }
      ]
    },
    
    // Terminal statuses (no outgoing transitions except special cases)
    // Delivered and Cancelled are terminal - no rules needed as they don't transition
  ];
  
  // ============================================================================
  // STATUS TRANSITION VALIDATION
  // ============================================================================
  
  static async validateStatusTransition(context: StatusTransitionContext): Promise<StatusTransitionResult> {
    try {
      const result: StatusTransitionResult = {
        allowed: false,
        requiresApproval: false,
        errors: [],
        warnings: []
      };
      
      // Find applicable transition rule
      const rule = this.TRANSITION_RULES.find(
        r => r.fromStatus === context.currentStatus && r.toStatus === context.targetStatus
      );
      
      if (!rule) {
        result.errors.push(`Invalid status transition from ${context.currentStatus} to ${context.targetStatus}`);
        return result;
      }
      
      // Validate all conditions
      const conditionResults = await Promise.all(
        rule.conditions.map(async condition => {
          try {
            const isValid = await condition.validator(context);
            return { condition, isValid };
          } catch (error) {
            console.error(`Error validating condition: ${condition.description}`, error);
            return { condition, isValid: false };
          }
        })
      );
      
      // Check for failed conditions
      const failedConditions = conditionResults.filter(cr => !cr.isValid);
      if (failedConditions.length > 0) {
        result.errors.push(...failedConditions.map(fc => fc.condition.errorMessage));
        return result;
      }
      
      // Check if approval is required
      if (rule.requiresApproval) {
        result.requiresApproval = true;
        result.approvalRequired = {
          roles: rule.approvalRoles || ['admin'],
          reason: `Status transition from ${context.currentStatus} to ${context.targetStatus} requires approval`
        };
      }
      
      // Check transition window
      if (rule.allowedTransitionWindow) {
        const withinWindow = await this.validateTimeWindow(context.orderId, rule.allowedTransitionWindow);
        if (!withinWindow) {
          result.errors.push(`Transition must occur within ${rule.allowedTransitionWindow} minutes`);
          return result;
        }
      }
      
      // Schedule automatic revert if configured
      if (rule.automaticRevert) {
        result.autoRevertScheduled = {
          afterMinutes: rule.automaticRevert.afterMinutes,
          revertToStatus: rule.automaticRevert.revertToStatus
        };
      }
      
      result.allowed = true;
      return result;
      
    } catch (error) {
      return {
        allowed: false,
        requiresApproval: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      };
    }
  }
  
  static async canTransitionStatus(
    orderId: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    userId?: string
  ): Promise<boolean> {
    try {
      // Get user role if userId provided
      let userRole: string | undefined;
      if (userId) {
        const user = await User.findById(userId);
        userRole = user?.get('role') || 'customer';
      }
      
      const context: StatusTransitionContext = {
        orderId,
        currentStatus: fromStatus,
        targetStatus: toStatus,
        userId,
        userRole,
        timestamp: new Date()
      };
      
      const result = await this.validateStatusTransition(context);
      return result.allowed && !result.requiresApproval;
      
    } catch (error) {
      console.error('Error checking status transition:', error);
      return false;
    }
  }
  
  static getValidTransitions(fromStatus: OrderStatus): OrderStatus[] {
    return this.TRANSITION_RULES
      .filter(rule => rule.fromStatus === fromStatus)
      .map(rule => rule.toStatus);
  }
  
  static getTransitionRequirements(fromStatus: OrderStatus, toStatus: OrderStatus): {
    conditions: string[];
    requiresApproval: boolean;
    approvalRoles: string[];
  } {
    const rule = this.TRANSITION_RULES.find(
      r => r.fromStatus === fromStatus && r.toStatus === toStatus
    );
    
    if (!rule) {
      return {
        conditions: ['Invalid transition'],
        requiresApproval: false,
        approvalRoles: []
      };
    }
    
    return {
      conditions: rule.conditions.map(c => c.description),
      requiresApproval: rule.requiresApproval || false,
      approvalRoles: rule.approvalRoles || []
    };
  }
  
  // ============================================================================
  // APPROVAL WORKFLOW
  // ============================================================================
  
  static async requestApproval(
    orderId: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    requestedBy: string,
    reason: string
  ): Promise<string> {
    try {
      const rule = this.TRANSITION_RULES.find(
        r => r.fromStatus === fromStatus && r.toStatus === toStatus
      );
      
      if (!rule || !rule.requiresApproval) {
        throw new Error('This transition does not require approval');
      }
      
      // Create pending approval (in real implementation, this would be stored in database)
      const approvalId = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry
      
      const pendingApproval: PendingApproval = {
        id: approvalId,
        orderId,
        fromStatus,
        toStatus,
        requestedBy,
        requestedAt: new Date(),
        reason,
        requiredRoles: rule.approvalRoles || ['admin'],
        approvals: [],
        status: 'pending',
        expiresAt
      };
      
      // Store approval request (mock implementation)
      await this.storePendingApproval(pendingApproval);
      
      return approvalId;
      
    } catch (error) {
      throw new Error(`Failed to request approval: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  static async approveTransition(
    approvalId: string,
    userId: string,
    approved: boolean,
    comments?: string
  ): Promise<boolean> {
    try {
      // Get pending approval (mock implementation)
      const pendingApproval = await this.getPendingApproval(approvalId);
      if (!pendingApproval) {
        throw new Error('Approval request not found');
      }
      
      if (pendingApproval.status !== 'pending') {
        throw new Error('Approval request is no longer pending');
      }
      
      if (pendingApproval.expiresAt && pendingApproval.expiresAt < new Date()) {
        throw new Error('Approval request has expired');
      }
      
      // Get user role
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      const userRole = user.get('role') || 'customer';
      
      // Check if user has required role
      if (!pendingApproval.requiredRoles.includes(userRole)) {
        throw new Error(`User role '${userRole}' is not authorized to approve this transition`);
      }
      
      // Add approval
      pendingApproval.approvals.push({
        userId,
        userRole,
        approved,
        timestamp: new Date(),
        comments
      });
      
      // Determine if approval is complete
      if (!approved) {
        pendingApproval.status = 'rejected';
      } else {
        // Check if we have enough approvals (for now, just need one from required roles)
        const hasRequiredApproval = pendingApproval.approvals.some(
          a => a.approved && pendingApproval.requiredRoles.includes(a.userRole)
        );
        
        if (hasRequiredApproval) {
          pendingApproval.status = 'approved';
        }
      }
      
      // Update stored approval
      await this.updatePendingApproval(pendingApproval);
      
      return pendingApproval.status === 'approved';
      
    } catch (error) {
      throw new Error(`Failed to process approval: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  static async getPendingApprovals(userId?: string): Promise<PendingApproval[]> {
    try {
      // Mock implementation - would query database
      const allPending = await this.getAllPendingApprovals();
      
      if (userId) {
        const user = await User.findById(userId);
        const userRole = user?.get('role') || 'customer';
        
        return allPending.filter(approval => 
          approval.status === 'pending' && 
          approval.requiredRoles.includes(userRole)
        );
      }
      
      return allPending.filter(approval => approval.status === 'pending');
      
    } catch (error) {
      throw new Error('Failed to get pending approvals');
    }
  }
  
  // ============================================================================
  // CONDITION VALIDATORS
  // ============================================================================
  
  private static async validatePaymentReceived(orderId: string): Promise<boolean> {
    try {
      // Check if payment events show successful payment
      // This would integrate with PaymentWebhookHandler in real implementation
      const order = await Order.findById(orderId);
      return order?.status === 'Paid' || false;
    } catch (error) {
      return false;
    }
  }
  
  private static async validatePaymentFailed(orderId: string): Promise<boolean> {
    try {
      // Check if payment events show failed payment
      // This would check PaymentEvent collection in real implementation
      return true; // Mock implementation
    } catch (error) {
      return false;
    }
  }
  
  private static async validateStockAvailability(orderId: string): Promise<boolean> {
    try {
      const order = await Order.findById(orderId);
      if (!order) return false;
      
      // Check if all order items are still in stock
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (!product || product.stock < item.quantity) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  private static async validateTimeWindow(orderId: string, windowMinutes: number): Promise<boolean> {
    try {
      const order = await Order.findById(orderId);
      if (!order) return false;
      
      const now = new Date();
      const orderTime = order.createdAt;
      const diffMinutes = (now.getTime() - orderTime.getTime()) / (1000 * 60);
      
      return diffMinutes <= windowMinutes;
    } catch (error) {
      return false;
    }
  }
  
  private static async validateMinimumTimeSince(
    orderId: string, 
    sinceStatus: OrderStatus, 
    minimumMinutes: number
  ): Promise<boolean> {
    try {
      const order = await Order.findById(orderId);
      if (!order) return false;
      
      // Find when the order reached the specified status
      const statusEntry = order.statusHistory.find(entry => entry.status === sinceStatus);
      if (!statusEntry) return false;
      
      const now = new Date();
      const statusTime = statusEntry.timestamp;
      const diffMinutes = (now.getTime() - statusTime.getTime()) / (1000 * 60);
      
      return diffMinutes >= minimumMinutes;
    } catch (error) {
      return false;
    }
  }
  
  private static async validateTrackingNumber(orderId: string): Promise<boolean> {
    try {
      const order = await Order.findById(orderId);
      if (!order) return false;
      
      return !!(order.trackingNumber && order.trackingNumber.trim().length > 0);
    } catch (error) {
      return false;
    }
  }
  
  private static async validateRetryAttempt(orderId: string): Promise<boolean> {
    try {
      // Check if this is a legitimate retry attempt
      // In real implementation, would check payment attempt history
      return true; // Mock implementation
    } catch (error) {
      return false;
    }
  }
  
  // ============================================================================
  // MOCK DATA STORAGE (In real implementation, these would use database)
  // ============================================================================
  
  private static pendingApprovals: Map<string, PendingApproval> = new Map();
  
  private static async storePendingApproval(approval: PendingApproval): Promise<void> {
    this.pendingApprovals.set(approval.id, approval);
  }
  
  private static async getPendingApproval(approvalId: string): Promise<PendingApproval | null> {
    return this.pendingApprovals.get(approvalId) || null;
  }
  
  private static async updatePendingApproval(approval: PendingApproval): Promise<void> {
    this.pendingApprovals.set(approval.id, approval);
  }
  
  private static async getAllPendingApprovals(): Promise<PendingApproval[]> {
    return Array.from(this.pendingApprovals.values());
  }
  
  // ============================================================================
  // TRANSITION LOGGING
  // ============================================================================
  
  static async logStatusTransition(
    orderId: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    userId?: string,
    reason?: string,
    approved: boolean = true,
    approvedBy?: string
  ): Promise<void> {
    try {
      const user = userId ? await User.findById(userId) : null;
      const userRole = user?.get('role');
      
      const log: StatusTransitionLog = {
        orderId,
        fromStatus,
        toStatus,
        userId,
        userRole,
        reason,
        approved,
        approvedBy,
        timestamp: new Date()
      };
      
      // In real implementation, this would be stored in a database collection
      console.log('Status transition logged:', log);
      
    } catch (error) {
      console.error('Failed to log status transition:', error);
    }
  }
  
  static async getTransitionHistory(orderId: string): Promise<StatusTransitionLog[]> {
    try {
      // Mock implementation - would query database
      // For now, reconstruct from order status history
      const order = await Order.findById(orderId);
      if (!order) return [];
      
      return order.statusHistory.map((entry, index) => ({
        orderId,
        fromStatus: index > 0 ? order.statusHistory[index - 1].status : 'Pending',
        toStatus: entry.status,
        reason: entry.reason,
        approved: true,
        timestamp: entry.timestamp
      }));
      
    } catch (error) {
      console.error('Failed to get transition history:', error);
      return [];
    }
  }
  
  // ============================================================================
  // AUTOMATIC REVERT SCHEDULING
  // ============================================================================
  
  static async scheduleAutoRevert(
    orderId: string,
    afterMinutes: number,
    revertToStatus: OrderStatus,
    reason: string
  ): Promise<void> {
    try {
      // In real implementation, this would schedule a job/task
      console.log(`Scheduled auto-revert for order ${orderId}: ${afterMinutes} minutes -> ${revertToStatus}`);
      
      // Mock implementation using setTimeout (not suitable for production)
      setTimeout(async () => {
        try {
          const order = await Order.findById(orderId);
          if (order && order.status !== revertToStatus) {
            await order.updateStatus(revertToStatus, reason);
            await this.logStatusTransition(orderId, order.status, revertToStatus, undefined, reason);
          }
        } catch (error) {
          console.error('Failed to execute auto-revert:', error);
        }
      }, afterMinutes * 60 * 1000);
      
    } catch (error) {
      console.error('Failed to schedule auto-revert:', error);
    }
  }
}

export default StatusTransitionGuard;