import { Request, Response } from 'express';
import { PaymentWebhookHandler } from '../../services/PaymentWebhookHandler';

export class PaymentWebhookController {
  stripeWebhook = async (req: Request, res: Response): Promise<Response> => {
    try {
      const signature = req.headers['stripe-signature'];
      const payload = req.body;

      if (!signature) {
        return res.status(400).json({ message: 'Missing stripe signature' });
      }

      const result = await PaymentWebhookHandler.handleStripeWebhook(payload, signature as string);
      return res.json(result);
    } catch (error: any) {
      console.error('Stripe webhook error:', error);
      return res.status(400).json({ message: error.message });
    }
  };

  paypalWebhook = async (req: Request, res: Response): Promise<Response> => {
    try {
      const headers = req.headers;
      const payload = req.body;

      // Convert headers to the expected format
      const webhookHeaders: Record<string, string> = {};
      Object.entries(headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          webhookHeaders[key] = value;
        } else if (Array.isArray(value)) {
          webhookHeaders[key] = value[0] || '';
        }
      });

      const result = await PaymentWebhookHandler.handlePayPalWebhook(payload, webhookHeaders);
      return res.json(result);
    } catch (error: any) {
      console.error('PayPal webhook error:', error);
      return res.status(400).json({ message: error.message });
    }
  };

  getWebhookHealth = async (req: Request, res: Response): Promise<Response> => {
    try {
      const health = await PaymentWebhookHandler.getWebhookHealth();
      return res.json(health);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  getPaymentEventSummary = async (req: Request, res: Response): Promise<Response> => {
    try {
      const summary = await PaymentWebhookHandler.getPaymentEventSummary();
      return res.json(summary);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}