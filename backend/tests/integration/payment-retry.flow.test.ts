import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Integration test for payment failure and retry scenarios: failed payments, retry attempts, order state preservation

describe('Payment Failure Retry Integration Tests', () => {
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
        retrieve: jest.fn(),
        confirm: jest.fn()
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
        email: 'retrytest@example.com',
        password: 'RetryTest123!',
        firstName: 'Retry',
        lastName: 'Tester'
      });

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'retrytest@example.com',
        password: 'RetryTest123!'
      });

    authToken = loginResponse.body.token;
    userId = loginResponse.body.user.id;

    // Create test products
    testProducts = [
      {
        name: 'Retry Test Product 1',
        description: 'Test product for payment retry',
        price: 49.99,
        stock: 100,
        category: 'Electronics',
        imageUrl: 'https://example.com/retry1.jpg'
      },
      {
        name: 'Retry Test Product 2',
        description: 'Another retry test product',
        price: 29.99,
        stock: 50,
        category: 'Books',
        imageUrl: 'https://example.com/retry2.jpg'
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

    // Add items to cart for testing
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
        quantity: 2
      });

    // Setup default successful payment intent mock
    mockStripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_test_retry',
      client_secret: 'pi_test_retry_secret_12345',
      amount: 10997,
      currency: 'usd',
      status: 'requires_payment_method'
    });
  });

  describe('Payment Failure Scenarios', () => {
    it('should handle card declined payment failure', async () => {
      // Create initial order
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

      // Simulate card declined webhook
      const webhookPayload = {
        id: 'evt_card_declined',
        object: 'event',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: paymentIntentId,
            status: 'requires_payment_method',
            amount: 10997,
            currency: 'usd',
            metadata: {
              orderId
            },
            last_payment_error: {
              code: 'card_declined',
              message: 'Your card was declined.',
              decline_code: 'generic_decline'
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      const webhookResponse = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookPayload));

      expect(webhookResponse.status).toBe(200);

      // Verify order remains in Pending status for retry
      const orderResponse = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(orderResponse.body.order.status).toBe('Pending');
      expect(orderResponse.body.order.paymentFailureReason).toBe('Your card was declined.');
      expect(orderResponse.body.order.paymentAttempts).toBe(1);
      expect(orderResponse.body.order.lastPaymentAttempt).toBeDefined();
    });

    it('should handle insufficient funds payment failure', async () => {
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

      // Simulate insufficient funds webhook
      const webhookPayload = {
        id: 'evt_insufficient_funds',
        object: 'event',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: paymentIntentId,
            status: 'requires_payment_method',
            metadata: {
              orderId
            },
            last_payment_error: {
              code: 'card_declined',
              message: 'Your card has insufficient funds.',
              decline_code: 'insufficient_funds'
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookPayload));

      const orderResponse = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(orderResponse.body.order.status).toBe('Pending');
      expect(orderResponse.body.order.paymentFailureReason).toBe('Your card has insufficient funds.');
      expect(orderResponse.body.order.canRetry).toBe(true);
    });

    it('should handle network/processing errors', async () => {
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

      // Simulate processing error webhook
      const webhookPayload = {
        id: 'evt_processing_error',
        object: 'event',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: paymentIntentId,
            status: 'requires_payment_method',
            metadata: {
              orderId
            },
            last_payment_error: {
              code: 'processing_error',
              message: 'An error occurred while processing your card. Please try again.',
              decline_code: 'processing_error'
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookPayload));

      const orderResponse = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(orderResponse.body.order.status).toBe('Pending');
      expect(orderResponse.body.order.paymentFailureReason).toContain('processing your card');
      expect(orderResponse.body.order.canRetry).toBe(true);
    });
  });

  describe('Payment Retry Mechanisms', () => {
    it('should allow retry with same payment intent', async () => {
      // Create initial order
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

      // First payment fails
      const failureWebhookPayload = {
        id: 'evt_first_failure',
        object: 'event',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: paymentIntentId,
            status: 'requires_payment_method',
            metadata: {
              orderId
            },
            last_payment_error: {
              code: 'card_declined',
              message: 'Your card was declined.'
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(failureWebhookPayload);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(failureWebhookPayload));

      // Mock retrieve for retry
      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        id: paymentIntentId,
        client_secret: 'pi_test_retry_secret_12345',
        amount: 10997,
        currency: 'usd',
        status: 'requires_payment_method'
      });

      // User attempts retry
      const retryResponse = await request(app)
        .post(`/api/checkout/retry-payment/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(retryResponse.status).toBe(200);
      expect(retryResponse.body).toMatchObject({
        success: true,
        paymentIntent: {
          id: paymentIntentId,
          clientSecret: 'pi_test_retry_secret_12345'
        },
        message: 'Payment retry initiated'
      });

      // Simulate successful retry
      const successWebhookPayload = {
        id: 'evt_retry_success',
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

      // Verify order is now paid
      const finalOrderResponse = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(finalOrderResponse.body.order.status).toBe('Paid');
      expect(finalOrderResponse.body.order.paymentAttempts).toBe(2);
      expect(finalOrderResponse.body.order.paidAt).toBeDefined();
    });

    it('should allow retry with new payment method', async () => {
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
      const originalPaymentIntentId = checkoutResponse.body.paymentIntent.id;

      // First payment fails
      const failureWebhookPayload = {
        id: 'evt_new_method_failure',
        object: 'event',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: originalPaymentIntentId,
            status: 'requires_payment_method',
            metadata: {
              orderId
            },
            last_payment_error: {
              code: 'card_declined',
              message: 'Your card was declined.'
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(failureWebhookPayload);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(failureWebhookPayload));

      // Mock new payment intent creation for retry
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_new_retry_intent',
        client_secret: 'pi_new_retry_secret_12345',
        amount: 10997,
        currency: 'usd',
        status: 'requires_payment_method'
      });

      // User retries with new payment method
      const retryResponse = await request(app)
        .post(`/api/checkout/retry-payment-new-method/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(retryResponse.status).toBe(201);
      expect(retryResponse.body.paymentIntent.id).toBe('pi_new_retry_intent');

      // Verify Stripe was called to create new payment intent
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 10997,
        currency: 'usd',
        metadata: {
          userId,
          orderId
        }
      });

      // Simulate successful payment with new method
      const successWebhookPayload = {
        id: 'evt_new_method_success',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_new_retry_intent',
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

      const finalOrderResponse = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(finalOrderResponse.body.order.status).toBe('Paid');
      expect(finalOrderResponse.body.order.paymentIntentId).toBe('pi_new_retry_intent');
    });

    it('should track multiple payment attempts', async () => {
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

      // Simulate multiple payment failures
      for (let attempt = 1; attempt <= 3; attempt++) {
        const failureWebhookPayload = {
          id: `evt_failure_${attempt}`,
          object: 'event',
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: paymentIntentId,
              status: 'requires_payment_method',
              metadata: {
                orderId
              },
              last_payment_error: {
                code: 'card_declined',
                message: `Card declined attempt ${attempt}`
              }
            }
          }
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(failureWebhookPayload);

        await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'test_signature')
          .send(JSON.stringify(failureWebhookPayload));

        const orderResponse = await request(app)
          .get(`/api/orders/${orderId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(orderResponse.body.order.paymentAttempts).toBe(attempt);
        expect(orderResponse.body.order.paymentFailureReason).toBe(`Card declined attempt ${attempt}`);
      }
    });
  });

  describe('Order State Preservation During Failures', () => {
    it('should preserve order details during payment failures', async () => {
      const shippingAddress = {
        street: '123 Test Street',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'US'
      };

      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress
        });

      const orderId = checkoutResponse.body.order.id;
      const originalOrder = checkoutResponse.body.order;

      // Simulate payment failure
      const failureWebhookPayload = {
        id: 'evt_preserve_test',
        object: 'event',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: checkoutResponse.body.paymentIntent.id,
            status: 'requires_payment_method',
            metadata: {
              orderId
            },
            last_payment_error: {
              code: 'card_declined',
              message: 'Your card was declined.'
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(failureWebhookPayload);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(failureWebhookPayload));

      // Verify order details are preserved
      const orderResponse = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const order = orderResponse.body.order;

      expect(order.status).toBe('Pending');
      expect(order.totalAmount).toBe(originalOrder.totalAmount);
      expect(order.items).toEqual(originalOrder.items);
      expect(order.shippingAddress).toEqual(shippingAddress);
      expect(order.userId).toBe(userId);
      expect(order.createdAt).toBe(originalOrder.createdAt);
    });

    it('should not affect cart contents during payment failures', async () => {
      // Get initial cart state
      const initialCartResponse = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

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

      // Simulate payment failure
      const failureWebhookPayload = {
        id: 'evt_cart_preserve',
        object: 'event',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: checkoutResponse.body.paymentIntent.id,
            status: 'requires_payment_method',
            metadata: {
              orderId: checkoutResponse.body.order.id
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(failureWebhookPayload);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(failureWebhookPayload));

      // Cart should remain unchanged after payment failure
      const cartAfterFailureResponse = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      expect(cartAfterFailureResponse.body.cart).toEqual(initialCartResponse.body.cart);
    });

    it('should not adjust stock for failed payments', async () => {
      // Get initial stock levels
      const initialStock0 = (await request(app).get(`/api/products/${testProducts[0].id}`)).body.product.stock;
      const initialStock1 = (await request(app).get(`/api/products/${testProducts[1].id}`)).body.product.stock;

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

      // Simulate payment failure
      const failureWebhookPayload = {
        id: 'evt_stock_preserve',
        object: 'event',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: checkoutResponse.body.paymentIntent.id,
            status: 'requires_payment_method',
            metadata: {
              orderId: checkoutResponse.body.order.id
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(failureWebhookPayload);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(failureWebhookPayload));

      // Stock levels should remain unchanged
      const finalStock0 = (await request(app).get(`/api/products/${testProducts[0].id}`)).body.product.stock;
      const finalStock1 = (await request(app).get(`/api/products/${testProducts[1].id}`)).body.product.stock;

      expect(finalStock0).toBe(initialStock0);
      expect(finalStock1).toBe(initialStock1);
    });
  });

  describe('Retry Limitations and Security', () => {
    it('should limit number of retry attempts', async () => {
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

      // Simulate maximum retry attempts (e.g., 5 attempts)
      for (let attempt = 1; attempt <= 5; attempt++) {
        const failureWebhookPayload = {
          id: `evt_limit_${attempt}`,
          object: 'event',
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: paymentIntentId,
              status: 'requires_payment_method',
              metadata: {
                orderId
              }
            }
          }
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(failureWebhookPayload);

        await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'test_signature')
          .send(JSON.stringify(failureWebhookPayload));
      }

      // 6th retry attempt should be rejected
      const retryResponse = await request(app)
        .post(`/api/checkout/retry-payment/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(retryResponse.status).toBe(400);
      expect(retryResponse.body).toMatchObject({
        success: false,
        error: 'MAX_RETRY_ATTEMPTS_REACHED',
        message: 'Maximum retry attempts reached for this order'
      });

      // Order should be marked as failed
      const orderResponse = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(orderResponse.body.order.status).toBe('Failed');
      expect(orderResponse.body.order.canRetry).toBe(false);
    });

    it('should prevent retry on orders owned by different users', async () => {
      // Create second user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'otheruser@example.com',
          password: 'OtherUser123!',
          firstName: 'Other',
          lastName: 'User'
        });

      const otherUserLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'otheruser@example.com',
          password: 'OtherUser123!'
        });

      const otherUserToken = otherUserLoginResponse.body.token;

      // Create order with first user
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

      // Second user tries to retry first user's order
      const retryResponse = await request(app)
        .post(`/api/checkout/retry-payment/${orderId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(retryResponse.status).toBe(403);
      expect(retryResponse.body).toMatchObject({
        success: false,
        error: 'FORBIDDEN',
        message: 'Not authorized to retry this order'
      });
    });

    it('should prevent retry on successfully paid orders', async () => {
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
        id: 'evt_success_no_retry',
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

      // Try to retry already paid order
      const retryResponse = await request(app)
        .post(`/api/checkout/retry-payment/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(retryResponse.status).toBe(400);
      expect(retryResponse.body).toMatchObject({
        success: false,
        error: 'ORDER_ALREADY_PAID',
        message: 'Cannot retry payment for already paid order'
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle retry for non-existent order', async () => {
      const nonExistentOrderId = new mongoose.Types.ObjectId().toString();

      const retryResponse = await request(app)
        .post(`/api/checkout/retry-payment/${nonExistentOrderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(retryResponse.status).toBe(404);
      expect(retryResponse.body).toMatchObject({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Order not found'
      });
    });

    it('should handle Stripe API failures during retry', async () => {
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

      // Simulate payment failure first
      const failureWebhookPayload = {
        id: 'evt_api_failure_setup',
        object: 'event',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: checkoutResponse.body.paymentIntent.id,
            status: 'requires_payment_method',
            metadata: {
              orderId
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(failureWebhookPayload);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(failureWebhookPayload));

      // Mock Stripe API failure for retry
      mockStripe.paymentIntents.retrieve.mockRejectedValue(new Error('Stripe API error'));

      const retryResponse = await request(app)
        .post(`/api/checkout/retry-payment/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(retryResponse.status).toBe(500);
      expect(retryResponse.body).toMatchObject({
        success: false,
        error: 'PAYMENT_RETRY_FAILED',
        message: 'Failed to initiate payment retry'
      });
    });

    it('should handle retry without authentication', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();

      const retryResponse = await request(app)
        .post(`/api/checkout/retry-payment/${orderId}`);

      expect(retryResponse.status).toBe(401);
      expect(retryResponse.body).toMatchObject({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    });
  });
});