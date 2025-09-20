import { Request, Response } from 'express';
import Stripe from 'stripe';
import Order, { OrderStatus } from '../../models/Order';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_51234567890abcdef', {
  apiVersion: '2025-08-27.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

export class WebhookController {
  handleStripeWebhook = async (req: Request, res: Response): Promise<Response> => {
    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.log(`⚠️  Webhook signature verification failed.`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.handleSuccessfulPayment(paymentIntent);
        break;
        
      case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.handleFailedPayment(failedPaymentIntent);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return res.json({ received: true });
  };

  private handleSuccessfulPayment = async (paymentIntent: Stripe.PaymentIntent) => {
    try {
      const { userId } = paymentIntent.metadata;
      
      // Find the order associated with this payment intent
      const order = await Order.findOne({ 
        userId,
        paymentIntentId: paymentIntent.id 
      });

      if (order) {
        order.status = OrderStatus.PAID;
        // Note: paymentStatus and paymentMethod would need to be added to Order model
        await order.save();
        
        console.log(`✅ Payment succeeded for order ${order._id}`);
      } else {
        console.log(`⚠️  No order found for payment intent ${paymentIntent.id}`);
      }
    } catch (error) {
      console.error('Error handling successful payment:', error);
    }
  };

  private handleFailedPayment = async (paymentIntent: Stripe.PaymentIntent) => {
    try {
      const { userId } = paymentIntent.metadata;
      
      // Find the order associated with this payment intent
      const order = await Order.findOne({ 
        userId,
        paymentIntentId: paymentIntent.id 
      });

      if (order) {
        order.status = OrderStatus.FAILED;
        await order.save();
        
        console.log(`❌ Payment failed for order ${order._id}`);
      }
    } catch (error) {
      console.error('Error handling failed payment:', error);
    }
  };
}

export default new WebhookController();