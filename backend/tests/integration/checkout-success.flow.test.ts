import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Integration test for successful checkout flow: cart validation -> payment intent creation -> webhook processing -> order completion

describe('Checkout Success Flow Integration Tests', () => {
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
        retrieve: jest.fn()
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
        email: 'checkouttest@example.com',
        password: 'CheckoutTest123!',
        firstName: 'Checkout',
        lastName: 'Tester'
      });

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'checkouttest@example.com',
        password: 'CheckoutTest123!'
      });

    authToken = loginResponse.body.token;
    userId = loginResponse.body.user.id;

    // Create test products
    testProducts = [
      {
        name: 'Checkout Product 1',
        description: 'Test product for checkout',
        price: 29.99,
        stock: 100,
        category: 'Electronics',
        imageUrl: 'https://example.com/image1.jpg'
      },
      {
        name: 'Checkout Product 2',
        description: 'Another checkout test product',
        price: 49.99,
        stock: 50,
        category: 'Books',
        imageUrl: 'https://example.com/image2.jpg'
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
        quantity: 2
      });

    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        productId: testProducts[1].id,
        quantity: 1
      });
  });

  describe('Payment Intent Creation', () => {
    beforeEach(() => {
      // Mock successful payment intent creation
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test_payment_intent',
        client_secret: 'pi_test_payment_intent_secret_12345',
        amount: 10997, // (29.99 * 2 + 49.99) * 100
        currency: 'usd',
        status: 'requires_payment_method',
        metadata: {
          userId,
          cartId: 'test_cart_id'
        }
      });
    });

    it('should create payment intent for valid cart', async () => {
      const response = await request(app)
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

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        paymentIntent: {
          id: 'pi_test_payment_intent',
          clientSecret: 'pi_test_payment_intent_secret_12345',
          amount: 10997,
          currency: 'usd'
        },
        order: {
          id: expect.any(String),
          userId,
          status: 'Pending',
          paymentIntentId: 'pi_test_payment_intent',
          totalAmount: 109.97,
          items: expect.arrayContaining([
            expect.objectContaining({
              productId: testProducts[0].id,
              quantity: 2,
              unitPrice: 29.99
            }),
            expect.objectContaining({
              productId: testProducts[1].id,
              quantity: 1,
              unitPrice: 49.99
            })
          ]),
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        }
      });

      // Verify Stripe was called correctly
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 10997,
        currency: 'usd',
        metadata: {
          userId,
          orderId: expect.any(String)
        }
      });
    });

    it('should reject checkout with empty cart', async () => {
      // Clear cart first
      await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      const response = await request(app)
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

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'EMPTY_CART',
        message: 'Cannot checkout with empty cart'
      });
    });

    it('should reject checkout without shipping address', async () => {
      const response = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'MISSING_SHIPPING_ADDRESS',
        message: 'Shipping address is required'
      });
    });

    it('should validate stock availability before checkout', async () => {
      // Add product with limited stock
      const limitedProduct = {
        name: 'Limited Stock Product',
        description: 'Product with very limited stock',
        price: 199.99,
        stock: 1,
        category: 'Limited',
        imageUrl: 'https://example.com/limited.jpg'
      };

      const productResponse = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(limitedProduct);

      // Try to add more than available to cart
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: productResponse.body.id,
          quantity: 2 // More than stock (1)
        });

      const response = await request(app)
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

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'INSUFFICIENT_STOCK',
        message: expect.stringContaining('insufficient stock'),
        details: expect.arrayContaining([
          expect.objectContaining({
            productId: productResponse.body.id,
            requested: 2,
            available: 1
          })
        ])
      });
    });

    it('should handle Stripe payment intent creation failure', async () => {
      // Mock Stripe failure
      mockStripe.paymentIntents.create.mockRejectedValue(new Error('Stripe API error'));

      const response = await request(app)
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

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        error: 'PAYMENT_INTENT_CREATION_FAILED',
        message: 'Failed to create payment intent'
      });
    });
  });

  describe('Webhook Processing - Payment Success', () => {
    let orderId: string;
    let paymentIntentId: string;

    beforeEach(async () => {
      // Create an order first
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test_payment_intent',
        client_secret: 'pi_test_payment_intent_secret_12345',
        amount: 10997,
        currency: 'usd',
        status: 'requires_payment_method'
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

      orderId = checkoutResponse.body.order.id;
      paymentIntentId = checkoutResponse.body.paymentIntent.id;
    });

    it('should process payment_intent.succeeded webhook', async () => {
      const webhookPayload = {
        id: 'evt_test_webhook',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            status: 'succeeded',
            amount: 10997,
            currency: 'usd',
            metadata: {
              orderId
            }
          }
        }
      };

      // Mock webhook signature verification
      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookPayload));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Webhook processed successfully'
      });

      // Verify order status was updated
      const orderResponse = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(orderResponse.body.order.status).toBe('Paid');
      expect(orderResponse.body.order.paidAt).toBeDefined();
    });

    it('should process payment_intent.payment_failed webhook', async () => {
      const webhookPayload = {
        id: 'evt_test_webhook_failed',
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
              message: 'Your card was declined.'
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookPayload));

      expect(response.status).toBe(200);

      // Verify order status remains Pending for retry
      const orderResponse = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(orderResponse.body.order.status).toBe('Pending');
      expect(orderResponse.body.order.paymentFailureReason).toBe('Your card was declined.');
    });

    it('should handle duplicate webhook events (idempotency)', async () => {
      const webhookPayload = {
        id: 'evt_test_duplicate',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            status: 'succeeded',
            amount: 10997,
            currency: 'usd',
            metadata: {
              orderId
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      // Process webhook first time
      const response1 = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookPayload));

      expect(response1.status).toBe(200);

      // Process same webhook again
      const response2 = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookPayload));

      expect(response2.status).toBe(200);
      expect(response2.body.message).toContain('already processed');
    });

    it('should reject webhook with invalid signature', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send('{"invalid": "payload"}');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'INVALID_WEBHOOK_SIGNATURE',
        message: 'Invalid webhook signature'
      });
    });
  });

  describe('Stock Adjustment After Payment', () => {
    it('should reduce product stock after successful payment', async () => {
      // Check initial stock
      const initialProductResponse = await request(app)
        .get(`/api/products/${testProducts[0].id}`);
      const initialStock = initialProductResponse.body.product.stock;

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

      // Simulate successful payment webhook
      const webhookPayload = {
        id: 'evt_stock_test',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: checkoutResponse.body.paymentIntent.id,
            status: 'succeeded',
            metadata: {
              orderId: checkoutResponse.body.order.id
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookPayload));

      // Check updated stock
      const updatedProductResponse = await request(app)
        .get(`/api/products/${testProducts[0].id}`);
      const updatedStock = updatedProductResponse.body.product.stock;

      expect(updatedStock).toBe(initialStock - 2); // 2 items were ordered
    });

    it('should not adjust stock for failed payments', async () => {
      const initialProductResponse = await request(app)
        .get(`/api/products/${testProducts[0].id}`);
      const initialStock = initialProductResponse.body.product.stock;

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

      // Simulate failed payment webhook
      const webhookPayload = {
        id: 'evt_failed_stock_test',
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

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookPayload));

      // Check stock remains unchanged
      const unchangedProductResponse = await request(app)
        .get(`/api/products/${testProducts[0].id}`);
      const unchangedStock = unchangedProductResponse.body.product.stock;

      expect(unchangedStock).toBe(initialStock);
    });
  });

  describe('Order State Management', () => {
    it('should create order in Pending status', async () => {
      const response = await request(app)
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

      expect(response.body.order.status).toBe('Pending');
      expect(response.body.order.createdAt).toBeDefined();
      expect(response.body.order.paidAt).toBeNull();
    });

    it('should transition order from Pending to Paid', async () => {
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

      // Simulate successful payment
      const webhookPayload = {
        id: 'evt_transition_test',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: checkoutResponse.body.paymentIntent.id,
            status: 'succeeded',
            metadata: { orderId }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookPayload));

      // Verify order status transition
      const orderResponse = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(orderResponse.body.order.status).toBe('Paid');
      expect(orderResponse.body.order.paidAt).toBeDefined();
    });

    it('should clear user cart after successful payment', async () => {
      // Verify cart has items before checkout
      const initialCartResponse = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);
      expect(initialCartResponse.body.cart.items.length).toBeGreaterThan(0);

      // Create order and process payment
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

      // Simulate successful payment
      const webhookPayload = {
        id: 'evt_cart_clear_test',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: checkoutResponse.body.paymentIntent.id,
            status: 'succeeded',
            metadata: {
              orderId: checkoutResponse.body.order.id
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookPayload));

      // Verify cart is cleared
      const clearedCartResponse = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);
      expect(clearedCartResponse.body.cart.items).toHaveLength(0);
      expect(clearedCartResponse.body.cart.subtotal).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle webhook for non-existent order', async () => {
      const webhookPayload = {
        id: 'evt_nonexistent_order',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_nonexistent',
            status: 'succeeded',
            metadata: {
              orderId: new mongoose.Types.ObjectId().toString()
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookPayload));

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Order not found for payment intent'
      });
    });

    it('should reject checkout without authentication', async () => {
      const response = await request(app)
        .post('/api/checkout/create-payment-intent')
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    });
  });
});