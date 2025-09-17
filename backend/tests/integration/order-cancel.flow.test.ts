import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Integration test for order cancellation rules: cancellation windows, status transitions, refund handling

describe('Order Cancellation Rules Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let app: any;
  let authToken: string;
  let userId: string;
  let testProducts: any[] = [];
  let mockStripe: any;

  beforeAll(async () => {
    // Setup MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Mock Stripe for testing
    mockStripe = {
      paymentIntents: {
        create: jest.fn(),
        cancel: jest.fn()
      },
      refunds: {
        create: jest.fn()
      },
      webhooks: {
        constructEvent: jest.fn()
      }
    };

    // Create test app (will be imported when backend is implemented)
    // app = require('../../src/index').default;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }

    // Reset mock calls
    jest.clearAllMocks();

    // Create test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'canceltest@example.com',
        password: 'CancelTest123!',
        firstName: 'Cancel',
        lastName: 'Tester'
      });

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'canceltest@example.com',
        password: 'CancelTest123!'
      });

    authToken = loginResponse.body.token;
    userId = loginResponse.body.user.id;

    // Create test products
    testProducts = [
      {
        name: 'Cancellation Test Product 1',
        description: 'Test product for cancellation',
        price: 99.99,
        stock: 100,
        category: 'Electronics',
        imageUrl: 'https://example.com/cancel1.jpg'
      },
      {
        name: 'Cancellation Test Product 2',
        description: 'Another cancellation test product',
        price: 49.99,
        stock: 50,
        category: 'Books',
        imageUrl: 'https://example.com/cancel2.jpg'
      }
    ];

    // Insert test products
    for (const product of testProducts) {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(product);
      product.id = response.body.id;
    }

    // Setup Stripe mocks
    mockStripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_test_cancel',
      client_secret: 'pi_test_cancel_secret_12345',
      amount: 14998,
      currency: 'usd',
      status: 'requires_payment_method'
    });

    mockStripe.paymentIntents.cancel.mockResolvedValue({
      id: 'pi_test_cancel',
      status: 'canceled'
    });

    mockStripe.refunds.create.mockResolvedValue({
      id: 'ref_test_refund',
      amount: 14998,
      currency: 'usd',
      status: 'succeeded'
    });
  });

  describe('Pending Order Cancellation', () => {
    it('should allow cancellation of pending order', async () => {
      // Add items to cart
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 1
        });

      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[1].id,
          quantity: 1
        });

      // Create order
      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      const orderId = checkoutResponse.body.order.id;
      const paymentIntentId = checkoutResponse.body.paymentIntent.id;

      // Cancel the pending order
      const cancelResponse = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Changed my mind'
        });

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body).toMatchObject({
        success: true,
        order: {
          id: orderId,
          status: 'Cancelled',
          cancellationReason: 'Changed my mind',
          cancelledAt: expect.any(String)
        },
        message: 'Order cancelled successfully'
      });

      // Verify Stripe payment intent was cancelled
      expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith(paymentIntentId);
    });

    it('should require cancellation reason', async () => {
      // Create pending order
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 1
        });

      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      const orderId = checkoutResponse.body.order.id;

      // Try to cancel without reason
      const cancelResponse = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(cancelResponse.status).toBe(400);
      expect(cancelResponse.body).toMatchObject({
        success: false,
        error: 'MISSING_CANCELLATION_REASON',
        message: 'Cancellation reason is required'
      });
    });

    it('should restore stock after pending order cancellation', async () => {
      const initialStock0 = (await request(app).get(`/api/products/${testProducts[0].id}`)).body.product.stock;
      const initialStock1 = (await request(app).get(`/api/products/${testProducts[1].id}`)).body.product.stock;

      // Add items to cart
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 2
        });

      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[1].id,
          quantity: 3
        });

      // Create order (this doesn't affect stock yet since it's only pending)
      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      // Cancel order
      await request(app)
        .post(`/api/orders/${checkoutResponse.body.order.id}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Changed my mind'
        });

      // Stock should remain unchanged (no stock was reserved for pending orders)
      const finalStock0 = (await request(app).get(`/api/products/${testProducts[0].id}`)).body.product.stock;
      const finalStock1 = (await request(app).get(`/api/products/${testProducts[1].id}`)).body.product.stock;

      expect(finalStock0).toBe(initialStock0);
      expect(finalStock1).toBe(initialStock1);
    });
  });

  describe('Paid Order Cancellation', () => {
    it('should allow cancellation of paid order within cancellation window', async () => {
      // Create and complete a paid order
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 1
        });

      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      const orderId = checkoutResponse.body.order.id;
      const paymentIntentId = checkoutResponse.body.paymentIntent.id;

      // Simulate successful payment
      const successWebhookPayload = {
        id: 'evt_cancel_success',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            status: 'succeeded',
            metadata: {
              orderId
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(successWebhookPayload);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(successWebhookPayload));

      // Cancel the paid order
      const cancelResponse = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Product not as expected'
        });

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body).toMatchObject({
        success: true,
        order: {
          id: orderId,
          status: 'Cancelled',
          cancellationReason: 'Product not as expected',
          cancelledAt: expect.any(String),
          refundStatus: 'Pending'
        },
        message: 'Order cancelled successfully. Refund will be processed.'
      });

      // Verify refund was initiated
      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: paymentIntentId,
        reason: 'requested_by_customer'
      });
    });

    it('should restore stock after paid order cancellation', async () => {
      const initialStock = (await request(app).get(`/api/products/${testProducts[0].id}`)).body.product.stock;

      // Create paid order
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 2
        });

      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      const orderId = checkoutResponse.body.order.id;
      const paymentIntentId = checkoutResponse.body.paymentIntent.id;

      // Complete payment (this reduces stock)
      const successWebhookPayload = {
        id: 'evt_stock_restore',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            status: 'succeeded',
            metadata: {
              orderId
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(successWebhookPayload);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(successWebhookPayload));

      // Verify stock was reduced
      const stockAfterPayment = (await request(app).get(`/api/products/${testProducts[0].id}`)).body.product.stock;
      expect(stockAfterPayment).toBe(initialStock - 2);

      // Cancel order
      await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Product not as expected'
        });

      // Stock should be restored
      const stockAfterCancel = (await request(app).get(`/api/products/${testProducts[0].id}`)).body.product.stock;
      expect(stockAfterCancel).toBe(initialStock);
    });

    it('should handle refund webhooks correctly', async () => {
      // Create and pay for order
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 1
        });

      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      const orderId = checkoutResponse.body.order.id;
      const paymentIntentId = checkoutResponse.body.paymentIntent.id;

      // Complete payment
      const successWebhookPayload = {
        id: 'evt_refund_test_success',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            status: 'succeeded',
            metadata: { orderId }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(successWebhookPayload);
      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(successWebhookPayload));

      // Cancel order
      await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Product not as expected'
        });

      // Simulate refund webhook
      const refundWebhookPayload = {
        id: 'evt_refund_succeeded',
        object: 'event',
        type: 'charge.refunded',
        data: {
          object: {
            payment_intent: paymentIntentId,
            refunded: true,
            amount_refunded: 9999
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(refundWebhookPayload);

      const refundWebhookResponse = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(refundWebhookPayload));

      expect(refundWebhookResponse.status).toBe(200);

      // Verify order refund status was updated
      const orderResponse = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(orderResponse.body.order.refundStatus).toBe('Completed');
      expect(orderResponse.body.order.refundedAt).toBeDefined();
    });
  });

  describe('Cancellation Time Limits', () => {
    it('should reject cancellation after time limit for shipped orders', async () => {
      // Create and complete order
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 1
        });

      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      const orderId = checkoutResponse.body.order.id;
      const paymentIntentId = checkoutResponse.body.paymentIntent.id;

      // Complete payment
      const successWebhookPayload = {
        id: 'evt_time_limit_test',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            status: 'succeeded',
            metadata: { orderId }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(successWebhookPayload);
      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(successWebhookPayload));

      // Mark order as shipped
      await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'Shipped',
          trackingNumber: 'TRACK123'
        });

      // Try to cancel shipped order (should be rejected based on business rules)
      const cancelResponse = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Changed my mind'
        });

      expect(cancelResponse.status).toBe(400);
      expect(cancelResponse.body).toMatchObject({
        success: false,
        error: 'CANCELLATION_NOT_ALLOWED',
        message: 'Cannot cancel order that has already been shipped'
      });
    });

    it('should allow cancellation within grace period for paid orders', async () => {
      // Create and complete order
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 1
        });

      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      const orderId = checkoutResponse.body.order.id;
      const paymentIntentId = checkoutResponse.body.paymentIntent.id;

      // Complete payment
      const successWebhookPayload = {
        id: 'evt_grace_period_test',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            status: 'succeeded',
            metadata: { orderId }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(successWebhookPayload);
      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(successWebhookPayload));

      // Cancel within grace period (should succeed)
      const cancelResponse = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Changed my mind'
        });

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.order.status).toBe('Cancelled');
    });
  });

  describe('Cancellation Authorization', () => {
    it('should prevent users from cancelling other users orders', async () => {
      // Create second user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'othercancel@example.com',
          password: 'OtherCancel123!',
          firstName: 'Other',
          lastName: 'User'
        });

      const otherLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'othercancel@example.com',
          password: 'OtherCancel123!'
        });

      const otherToken = otherLoginResponse.body.token;

      // Create order with first user
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 1
        });

      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      const orderId = checkoutResponse.body.order.id;

      // Try to cancel with second user
      const cancelResponse = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          reason: 'Malicious cancellation attempt'
        });

      expect(cancelResponse.status).toBe(403);
      expect(cancelResponse.body).toMatchObject({
        success: false,
        error: 'FORBIDDEN',
        message: 'Not authorized to cancel this order'
      });
    });

    it('should require authentication for cancellation', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();

      const cancelResponse = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .send({
          reason: 'Unauthorized attempt'
        });

      expect(cancelResponse.status).toBe(401);
      expect(cancelResponse.body).toMatchObject({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    });
  });

  describe('Cancellation Status Validation', () => {
    it('should prevent cancellation of already cancelled orders', async () => {
      // Create order
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 1
        });

      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      const orderId = checkoutResponse.body.order.id;

      // Cancel once
      await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'First cancellation'
        });

      // Try to cancel again
      const secondCancelResponse = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Second cancellation attempt'
        });

      expect(secondCancelResponse.status).toBe(400);
      expect(secondCancelResponse.body).toMatchObject({
        success: false,
        error: 'ORDER_ALREADY_CANCELLED',
        message: 'Order is already cancelled'
      });
    });

    it('should prevent cancellation of delivered orders', async () => {
      // Create and complete order
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 1
        });

      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      const orderId = checkoutResponse.body.order.id;
      const paymentIntentId = checkoutResponse.body.paymentIntent.id;

      // Complete payment
      const successWebhookPayload = {
        id: 'evt_delivered_test',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            status: 'succeeded',
            metadata: { orderId }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(successWebhookPayload);
      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(successWebhookPayload));

      // Mark as delivered
      await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'Delivered',
          deliveredAt: new Date().toISOString()
        });

      // Try to cancel delivered order
      const cancelResponse = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Changed my mind'
        });

      expect(cancelResponse.status).toBe(400);
      expect(cancelResponse.body).toMatchObject({
        success: false,
        error: 'CANCELLATION_NOT_ALLOWED',
        message: 'Cannot cancel delivered order'
      });
    });
  });

  describe('Partial Cancellation', () => {
    it('should handle partial item cancellation for multi-item orders', async () => {
      // Add multiple items
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 2
        });

      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[1].id,
          quantity: 1
        });

      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      const orderId = checkoutResponse.body.order.id;
      const paymentIntentId = checkoutResponse.body.paymentIntent.id;

      // Complete payment
      const successWebhookPayload = {
        id: 'evt_partial_cancel',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            status: 'succeeded',
            metadata: { orderId }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(successWebhookPayload);
      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(successWebhookPayload));

      // Partially cancel order (cancel only one product)
      const partialCancelResponse = await request(app)
        .post(`/api/orders/${orderId}/cancel-items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              productId: testProducts[0].id,
              quantity: 1 // Cancel 1 out of 2
            }
          ],
          reason: 'Partial cancellation test'
        });

      expect(partialCancelResponse.status).toBe(200);
      expect(partialCancelResponse.body).toMatchObject({
        success: true,
        order: {
          id: orderId,
          status: 'Partially Cancelled'
        },
        refundAmount: testProducts[0].price,
        message: 'Items cancelled successfully. Partial refund will be processed.'
      });

      // Verify partial refund was initiated
      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: paymentIntentId,
        amount: Math.round(testProducts[0].price * 100), // Convert to cents
        reason: 'requested_by_customer'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle cancellation of non-existent order', async () => {
      const nonExistentOrderId = new mongoose.Types.ObjectId().toString();

      const cancelResponse = await request(app)
        .post(`/api/orders/${nonExistentOrderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Test reason'
        });

      expect(cancelResponse.status).toBe(404);
      expect(cancelResponse.body).toMatchObject({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Order not found'
      });
    });

    it('should handle Stripe refund failures', async () => {
      // Create paid order
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 1
        });

      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      const orderId = checkoutResponse.body.order.id;
      const paymentIntentId = checkoutResponse.body.paymentIntent.id;

      // Complete payment
      const successWebhookPayload = {
        id: 'evt_refund_fail_test',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            status: 'succeeded',
            metadata: { orderId }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(successWebhookPayload);
      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(successWebhookPayload));

      // Mock Stripe refund failure
      mockStripe.refunds.create.mockRejectedValue(new Error('Refund failed'));

      // Try to cancel (refund should fail)
      const cancelResponse = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Test refund failure'
        });

      // Order should still be cancelled but refund should be marked as failed
      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.order.status).toBe('Cancelled');
      expect(cancelResponse.body.order.refundStatus).toBe('Failed');
      expect(cancelResponse.body.message).toContain('cancellation succeeded but refund failed');
    });
  });
});