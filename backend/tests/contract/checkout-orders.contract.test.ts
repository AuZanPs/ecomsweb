import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { testTokens } from '../setup';

// Note: This will fail initially as the app doesn't exist yet - TDD approach
describe('Checkout/Orders Contract Tests', () => {

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe('POST /api/checkout/create-payment-intent', () => {
    it('should create payment intent for valid cart', async () => {
      const checkoutData = {
        shippingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        }
      };

      const response = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', 'Bearer user-with-cart-token')
        .send(checkoutData)
        .expect(201);

      expect(response.body).toHaveProperty('clientSecret');
      expect(response.body).toHaveProperty('paymentIntentId');
      expect(response.body).toHaveProperty('amount');
      expect(response.body).toHaveProperty('currency', 'usd');
      expect(typeof response.body.clientSecret).toBe('string');
      expect(typeof response.body.paymentIntentId).toBe('string');
      expect(typeof response.body.amount).toBe('number');
    });

    it('should require authentication', async () => {
      const checkoutData = {
        shippingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        }
      };

      const response = await request(app)
        .post('/api/checkout/create-payment-intent')
        .send(checkoutData)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('unauthorized');
    });

    it('should reject empty cart', async () => {
      const checkoutData = {
        shippingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        }
      };

      const response = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', 'Bearer user-with-empty-cart-token')
        .send(checkoutData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('cart is empty');
    });

    it('should validate shipping address', async () => {
      const invalidCheckoutData = {
        shippingAddress: {
          street: '123 Main St'
          // Missing required fields
        }
      };

      const response = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', 'Bearer user-with-cart-token')
        .send(invalidCheckoutData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('invalid shipping address');
    });

    it('should check inventory availability before payment', async () => {
      const checkoutData = {
        shippingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        }
      };

      const response = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', 'Bearer user-with-out-of-stock-cart-token')
        .send(checkoutData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('insufficient inventory');
    });

    it('should calculate correct total including taxes and shipping', async () => {
      const checkoutData = {
        shippingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        }
      };

      const response = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', 'Bearer user-with-cart-token')
        .send(checkoutData)
        .expect(201);

      expect(response.body).toHaveProperty('breakdown');
      expect(response.body.breakdown).toHaveProperty('subtotal');
      expect(response.body.breakdown).toHaveProperty('tax');
      expect(response.body.breakdown).toHaveProperty('shipping');
      expect(response.body.breakdown).toHaveProperty('total');
    });
  });

  describe('POST /api/orders', () => {
    it('should create order after successful payment', async () => {
      const orderData = {
        paymentIntentId: 'pi_test_payment_intent_id',
        shippingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', 'Bearer valid-user-token')
        .send(orderData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('orderNumber');
      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('shippingAddress');
      expect(response.body).toHaveProperty('paymentStatus', 'paid');
      expect(response.body).toHaveProperty('orderStatus', 'processing');
      expect(response.body).toHaveProperty('totalAmount');
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('should require authentication', async () => {
      const orderData = {
        paymentIntentId: 'pi_test_payment_intent_id',
        shippingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('unauthorized');
    });

    it('should validate payment intent exists and is paid', async () => {
      const orderData = {
        paymentIntentId: 'pi_invalid_payment_intent',
        shippingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', 'Bearer valid-user-token')
        .send(orderData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('invalid payment intent');
    });

    it('should prevent duplicate order creation', async () => {
      const orderData = {
        paymentIntentId: 'pi_already_used_payment_intent',
        shippingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', 'Bearer valid-user-token')
        .send(orderData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('order already exists');
    });

    it('should clear cart after successful order creation', async () => {
      const orderData = {
        paymentIntentId: 'pi_test_payment_intent_id',
        shippingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', 'Bearer user-with-cart-token')
        .send(orderData)
        .expect(201);

      expect(response.body).toHaveProperty('cartCleared', true);
    });

    it('should reserve inventory on order creation', async () => {
      const orderData = {
        paymentIntentId: 'pi_test_payment_intent_id',
        shippingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', 'Bearer valid-user-token')
        .send(orderData)
        .expect(201);

      expect(response.body).toHaveProperty('inventoryReserved', true);
    });
  });

  describe('GET /api/orders', () => {
    it('should return user orders with pagination', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', 'Bearer user-with-orders-token')
        .expect(200);

      expect(response.body).toHaveProperty('orders');
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body).toHaveProperty('currentPage');
      expect(response.body).toHaveProperty('totalOrders');
      expect(Array.isArray(response.body.orders)).toBe(true);
    });

    it('should filter orders by status', async () => {
      const response = await request(app)
        .get('/api/orders?status=shipped')
        .set('Authorization', 'Bearer user-with-orders-token')
        .expect(200);

      expect(response.body).toHaveProperty('orders');
      expect(Array.isArray(response.body.orders)).toBe(true);
    });

    it('should sort orders by date (newest first)', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', 'Bearer user-with-orders-token')
        .expect(200);

      expect(response.body).toHaveProperty('orders');
      if (response.body.orders.length > 1) {
        const firstOrder = new Date(response.body.orders[0].createdAt);
        const secondOrder = new Date(response.body.orders[1].createdAt);
        expect(firstOrder.getTime()).toBeGreaterThanOrEqual(secondOrder.getTime());
      }
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/orders')
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('unauthorized');
    });

    it('should only return orders for authenticated user', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', 'Bearer valid-user-token')
        .expect(200);

      expect(response.body).toHaveProperty('orders');
      if (response.body.orders.length > 0) {
        response.body.orders.forEach((order: any) => {
          expect(order).toHaveProperty('userId');
          // Actual user ID validation would be done in implementation
        });
      }
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should return order details for valid order', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', 'Bearer order-owner-token')
        .expect(200);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('orderNumber');
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('shippingAddress');
      expect(response.body).toHaveProperty('paymentStatus');
      expect(response.body).toHaveProperty('orderStatus');
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('should return 404 for non-existent order', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/api/orders/${nonExistentId}`)
        .set('Authorization', 'Bearer valid-user-token')
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Order not found');
    });

    it('should require authentication', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('unauthorized');
    });

    it('should only allow access to own orders', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', 'Bearer different-user-token')
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('access denied');
    });

    it('should populate product details in order items', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', 'Bearer order-owner-token')
        .expect(200);

      if (response.body.items.length > 0) {
        const item = response.body.items[0];
        expect(item).toHaveProperty('product');
        expect(item.product).toHaveProperty('name');
        expect(item.product).toHaveProperty('price');
        expect(item).toHaveProperty('quantity');
        expect(item).toHaveProperty('subtotal');
      }
    });
  });

  describe('PUT /api/orders/:id/cancel', () => {
    it('should cancel order if cancellation is allowed', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .put(`/api/orders/${orderId}/cancel`)
        .set('Authorization', 'Bearer order-owner-token')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Order cancelled successfully');
      expect(response.body).toHaveProperty('order');
      expect(response.body.order).toHaveProperty('orderStatus', 'cancelled');
    });

    it('should prevent cancellation of shipped orders', async () => {
      const shippedOrderId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .put(`/api/orders/${shippedOrderId}/cancel`)
        .set('Authorization', 'Bearer order-owner-token')
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('cannot cancel shipped order');
    });

    it('should require authentication', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .put(`/api/orders/${orderId}/cancel`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('unauthorized');
    });

    it('should only allow order owner to cancel', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .put(`/api/orders/${orderId}/cancel`)
        .set('Authorization', 'Bearer different-user-token')
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('access denied');
    });

    it('should restore inventory on order cancellation', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .put(`/api/orders/${orderId}/cancel`)
        .set('Authorization', 'Bearer order-owner-token')
        .expect(200);

      expect(response.body).toHaveProperty('inventoryRestored', true);
    });
  });

  describe('POST /api/webhooks/stripe', () => {
    it('should process successful payment webhook', async () => {
      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_payment_intent_id',
            status: 'succeeded',
            amount: 5000,
            currency: 'usd'
          }
        }
      };

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toHaveProperty('received', true);
    });

    it('should process failed payment webhook', async () => {
      const webhookPayload = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_test_payment_intent_id',
            status: 'requires_payment_method',
            last_payment_error: {
              message: 'Your card was declined.'
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toHaveProperty('received', true);
    });

    it('should validate webhook signature', async () => {
      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_payment_intent_id'
          }
        }
      };

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .send(webhookPayload)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('invalid signature');
    });

    it('should handle unknown webhook event types gracefully', async () => {
      const webhookPayload = {
        type: 'unknown.event.type',
        data: {
          object: {}
        }
      };

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toHaveProperty('received', true);
    });
  });

  describe('PUT /api/orders/:id/status (Admin only)', () => {
    it('should update order status by admin', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();
      const statusUpdate = { status: 'shipped', trackingNumber: 'TRACK123456' };

      const response = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', 'Bearer admin-token')
        .send(statusUpdate)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Order status updated');
      expect(response.body).toHaveProperty('order');
      expect(response.body.order).toHaveProperty('orderStatus', 'shipped');
      expect(response.body.order).toHaveProperty('trackingNumber', 'TRACK123456');
    });

    it('should require admin authentication', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();
      const statusUpdate = { status: 'shipped' };

      const response = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', 'Bearer user-token')
        .send(statusUpdate)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('admin access required');
    });

    it('should validate status transitions', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();
      const invalidStatusUpdate = { status: 'processing' }; // Trying to go backwards

      const response = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', 'Bearer admin-token')
        .send(invalidStatusUpdate)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('invalid status transition');
    });
  });
});