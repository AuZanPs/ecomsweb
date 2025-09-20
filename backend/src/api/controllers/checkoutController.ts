import { Request, Response } from 'express';
import { CheckoutService } from '../../services/CheckoutService';
import { AuthRequest } from '../middleware/auth';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_51234567890abcdef', {
  apiVersion: '2025-08-27.basil',
});

export class CheckoutController {
  createPaymentIntent = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const { amount, currency = 'usd', metadata } = req.body;

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        metadata: {
          userId: userId.toString(),
          ...metadata
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return res.json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  validateCheckout = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const validation = await CheckoutService.validateCheckout(userId);
      return res.json(validation);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  initiateCheckout = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const { shippingAddress, billingAddress, paymentMethod } = req.body;
      
      const checkoutData = {
        shippingAddress,
        billingAddress,
        paymentMethod
      };

      const result = await CheckoutService.initiateCheckout(userId, checkoutData);
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  confirmCheckout = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const { orderId, paymentIntentId, paymentMethodId } = req.body;
      
      const confirmData = {
        orderId,
        paymentIntentId,
        paymentMethodId
      };

      const result = await CheckoutService.confirmCheckout(userId, confirmData);
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  calculateOrderTotal = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const { shippingAddress } = req.body;
      const total = await CheckoutService.calculateOrderTotal(userId, shippingAddress);
      return res.json(total);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  cancelCheckout = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const { orderId, reason } = req.body;
      await CheckoutService.cancelCheckout(userId, orderId, reason);
      return res.json({ message: 'Checkout cancelled successfully' });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  expressCheckout = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user._id;
      const { productId, quantity, checkoutData } = req.body;
      
      const result = await CheckoutService.expressCheckout(
        userId,
        productId,
        quantity,
        checkoutData.shippingAddress
      );
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };
}