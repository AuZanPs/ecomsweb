import { Request, Response } from 'express';
import { OrderService } from '../../services/OrderService';
import { AuthRequest } from '../middleware/auth';

export class OrderController {
  getOrders = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const { page = '1', limit = '10', status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

      const searchData = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status && ['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Failed'].includes(status as string) 
          ? status as 'Pending' | 'Paid' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Failed' 
          : undefined,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      const orders = await OrderService.getOrdersByUser(userId, searchData);
      return res.json(orders);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  getOrder = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const { orderId } = req.params;

      if (!orderId) {
        return res.status(400).json({ message: 'Order ID is required' });
      }

      const order = await OrderService.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Verify the order belongs to the user
      if (order.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      return res.json(order);
    } catch (error: any) {
      return res.status(404).json({ message: error.message });
    }
  };

  cancelOrder = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const { orderId } = req.params;
      const { reason } = req.body;

      if (!orderId) {
        return res.status(400).json({ message: 'Order ID is required' });
      }

      const cancelData = {
        reason: reason || 'Cancelled by user',
        cancelledBy: userId
      };

      const result = await OrderService.cancelOrder(orderId, cancelData);
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  getOrderTracking = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { orderNumber } = req.params;

      if (!orderNumber) {
        return res.status(400).json({ message: 'Order number is required' });
      }

      const tracking = await OrderService.getOrderTracking(orderNumber);
      return res.json(tracking);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  getOrderStatistics = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const statistics = await OrderService.getOrderStatistics();
      return res.json(statistics);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  getOrdersByStatus = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { status } = req.params;
      if (!status) {
        return res.status(400).json({ message: 'Status is required' });
      }
      
      const orders = await OrderService.getOrdersByStatus(status as any);
      return res.json(orders);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };
}