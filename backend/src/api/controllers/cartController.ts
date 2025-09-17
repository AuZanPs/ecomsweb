import { Request, Response } from 'express';
import { CartService } from '../../services/CartService';
import { AuthRequest } from '../middleware/auth';

export class CartController {
  getCart = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const cart = await CartService.getCart(userId);
      return res.json(cart);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  addToCart = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const { productId, quantity } = req.body;
      const cart = await CartService.addToCart(userId, { productId, quantity });
      return res.json(cart);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  updateCartItem = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const { productId, quantity } = req.body;
      const cart = await CartService.updateCartItem(userId, { productId, quantity });
      return res.json(cart);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  removeFromCart = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const { productId } = req.params;
      if (!productId) {
        return res.status(400).json({ message: 'Product ID is required' });
      }
      const cart = await CartService.removeFromCart(userId, productId);
      return res.json(cart);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  clearCart = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      await CartService.clearCart(userId);
      return res.json({ message: 'Cart cleared successfully' });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  validateCart = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const validation = await CartService.validateCart(userId);
      return res.json(validation);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };
}