import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Integration test for stock adjustment scenarios: concurrent purchases, stock changes during checkout, low stock handling

describe('Stock Adjustment Flow Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let app: any;
  let authToken1: string;
  let authToken2: string;
  let userId1: string;
  let userId2: string;
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

    // Create two test users for concurrent testing
    const user1Response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'stocktest1@example.com',
        password: 'StockTest123!',
        firstName: 'Stock',
        lastName: 'Tester1'
      });

    const user2Response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'stocktest2@example.com',
        password: 'StockTest123!',
        firstName: 'Stock',
        lastName: 'Tester2'
      });

    // Login both users
    const login1Response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'stocktest1@example.com',
        password: 'StockTest123!'
      });

    const login2Response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'stocktest2@example.com',
        password: 'StockTest123!'
      });

    authToken1 = login1Response.body.token;
    authToken2 = login2Response.body.token;
    userId1 = login1Response.body.user.id;
    userId2 = login2Response.body.user.id;

    // Create test products with specific stock levels
    testProducts = [
      {
        name: 'Limited Stock Product',
        description: 'Product with very limited stock',
        price: 99.99,
        stock: 3, // Only 3 items available
        category: 'Limited',
        imageUrl: 'https://example.com/limited.jpg'
      },
      {
        name: 'Single Item Product',
        description: 'Product with only one item',
        price: 199.99,
        stock: 1, // Only 1 item available
        category: 'Exclusive',
        imageUrl: 'https://example.com/exclusive.jpg'
      },
      {
        name: 'Regular Stock Product',
        description: 'Product with normal stock',
        price: 29.99,
        stock: 100,
        category: 'Regular',
        imageUrl: 'https://example.com/regular.jpg'
      }
    ];

    // Insert test products
    for (const product of testProducts) {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken1}`)
        .send(product);
      product.id = response.body.id;
    }

    // Setup successful payment intent mock
    mockStripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_test_payment_intent',
      client_secret: 'pi_test_payment_intent_secret_12345',
      amount: 9999,
      currency: 'usd',
      status: 'requires_payment_method'
    });
  });

  describe('Concurrent Cart Operations', () => {
    it('should handle two users adding last items to cart', async () => {
      const singleItemProduct = testProducts[1]; // Only 1 item in stock

      // Both users try to add the same single item to cart simultaneously
      const promises = [
        request(app)
          .post('/api/cart/items')
          .set('Authorization', `Bearer ${authToken1}`)
          .send({
            productId: singleItemProduct.id,
            quantity: 1
          }),
        request(app)
          .post('/api/cart/items')
          .set('Authorization', `Bearer ${authToken2}`)
          .send({
            productId: singleItemProduct.id,
            quantity: 1
          })
      ];

      const responses = await Promise.all(promises);

      // One should succeed, one should fail
      const successCount = responses.filter(r => r.status === 201).length;
      const failCount = responses.filter(r => r.status === 400).length;

      expect(successCount).toBe(1);
      expect(failCount).toBe(1);

      // The failed response should indicate insufficient stock
      const failedResponse = responses.find(r => r.status === 400);
      expect(failedResponse?.body.error).toBe('INSUFFICIENT_STOCK');
    });

    it('should handle partial stock allocation correctly', async () => {
      const limitedProduct = testProducts[0]; // 3 items in stock

      // User 1 adds 2 items
      const response1 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          productId: limitedProduct.id,
          quantity: 2
        });

      expect(response1.status).toBe(201);

      // User 2 tries to add 2 items (should fail, only 1 left)
      const response2 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          productId: limitedProduct.id,
          quantity: 2
        });

      expect(response2.status).toBe(400);
      expect(response2.body.error).toBe('INSUFFICIENT_STOCK');

      // User 2 should be able to add 1 item (the remaining stock)
      const response3 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          productId: limitedProduct.id,
          quantity: 1
        });

      expect(response3.status).toBe(201);
    });
  });

  describe('Stock Changes During Checkout Process', () => {
    it('should detect stock change between cart and checkout', async () => {
      const limitedProduct = testProducts[0]; // 3 items in stock

      // User 1 adds 2 items to cart
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          productId: limitedProduct.id,
          quantity: 2
        });

      // User 2 adds 1 item to cart
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          productId: limitedProduct.id,
          quantity: 1
        });

      // User 1 successfully checks out
      const checkout1Response = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      expect(checkout1Response.status).toBe(201);

      // Simulate payment success for User 1
      const webhookPayload1 = {
        id: 'evt_user1_success',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: checkout1Response.body.paymentIntent.id,
            status: 'succeeded',
            metadata: {
              orderId: checkout1Response.body.order.id
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload1);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookPayload1));

      // Now User 2 tries to checkout (should fail due to insufficient stock)
      const checkout2Response = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          shippingAddress: {
            street: '456 Another Street',
            city: 'Another City',
            state: 'AS',
            zipCode: '67890',
            country: 'US'
          }
        });

      expect(checkout2Response.status).toBe(400);
      expect(checkout2Response.body.error).toBe('INSUFFICIENT_STOCK');
      expect(checkout2Response.body.details[0]).toMatchObject({
        productId: limitedProduct.id,
        requested: 1,
        available: 1 // 3 - 2 (sold to User 1) = 1 remaining
      });
    });

    it('should handle stock becoming zero during checkout attempt', async () => {
      const singleItemProduct = testProducts[1]; // Only 1 item in stock

      // User 1 adds item to cart
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          productId: singleItemProduct.id,
          quantity: 1
        });

      // Admin or system reduces stock to 0 (simulating external stock update)
      await request(app)
        .put(`/api/products/${singleItemProduct.id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          ...testProducts[1],
          stock: 0
        });

      // User 1 tries to checkout
      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      expect(checkoutResponse.status).toBe(400);
      expect(checkoutResponse.body.error).toBe('INSUFFICIENT_STOCK');
      expect(checkoutResponse.body.details[0]).toMatchObject({
        productId: singleItemProduct.id,
        requested: 1,
        available: 0
      });
    });
  });

  describe('Stock Adjustment After Payment', () => {
    it('should correctly adjust stock for multiple items in single order', async () => {
      // Add multiple products to cart
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          productId: testProducts[0].id, // Limited stock: 3 items
          quantity: 2
        });

      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          productId: testProducts[2].id, // Regular stock: 100 items
          quantity: 5
        });

      // Get initial stock levels
      const initialStock0 = (await request(app).get(`/api/products/${testProducts[0].id}`)).body.product.stock;
      const initialStock2 = (await request(app).get(`/api/products/${testProducts[2].id}`)).body.product.stock;

      // Checkout
      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken1}`)
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
        id: 'evt_multi_item_success',
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

      // Verify stock adjustments
      const finalStock0 = (await request(app).get(`/api/products/${testProducts[0].id}`)).body.product.stock;
      const finalStock2 = (await request(app).get(`/api/products/${testProducts[2].id}`)).body.product.stock;

      expect(finalStock0).toBe(initialStock0 - 2);
      expect(finalStock2).toBe(initialStock2 - 5);
    });

    it('should handle stock adjustment failure gracefully', async () => {
      // Add item to cart
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          productId: testProducts[0].id,
          quantity: 2
        });

      // Create order
      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      // Manually reduce stock below ordered quantity (simulate race condition)
      await request(app)
        .put(`/api/products/${testProducts[0].id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          ...testProducts[0],
          stock: 1 // Less than ordered quantity (2)
        });

      // Simulate successful payment
      const webhookPayload = {
        id: 'evt_stock_adjustment_fail',
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

      const webhookResponse = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookPayload));

      // Webhook should still succeed but log the issue
      expect(webhookResponse.status).toBe(200);

      // Order should be marked as Paid but with stock adjustment warning
      const orderResponse = await request(app)
        .get(`/api/orders/${checkoutResponse.body.order.id}`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(orderResponse.body.order.status).toBe('Paid');
      expect(orderResponse.body.order.stockAdjustmentWarning).toBeDefined();
    });
  });

  describe('Stock Recovery After Payment Failure', () => {
    it('should not adjust stock for failed payments', async () => {
      // Add item to cart
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          productId: testProducts[0].id,
          quantity: 2
        });

      const initialStock = (await request(app).get(`/api/products/${testProducts[0].id}`)).body.product.stock;

      // Create order
      const checkoutResponse = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      // Simulate failed payment
      const webhookPayload = {
        id: 'evt_payment_failed',
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

      // Stock should remain unchanged
      const finalStock = (await request(app).get(`/api/products/${testProducts[0].id}`)).body.product.stock;
      expect(finalStock).toBe(initialStock);

      // Order should still be Pending
      const orderResponse = await request(app)
        .get(`/api/orders/${checkoutResponse.body.order.id}`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(orderResponse.body.order.status).toBe('Pending');
    });
  });

  describe('Low Stock Warnings', () => {
    it('should warn when adding items that would exceed low stock threshold', async () => {
      const limitedProduct = testProducts[0]; // 3 items in stock

      // Add 2 items (leaving only 1)
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          productId: limitedProduct.id,
          quantity: 2
        });

      expect(response.status).toBe(201);
      expect(response.body.warnings).toContainEqual({
        type: 'LOW_STOCK_WARNING',
        productId: limitedProduct.id,
        message: expect.stringContaining('low stock'),
        remainingStock: 1
      });
    });

    it('should provide stock availability information in checkout errors', async () => {
      const limitedProduct = testProducts[0]; // 3 items in stock

      // User 1 purchases 2 items
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          productId: limitedProduct.id,
          quantity: 2
        });

      const checkout1Response = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          shippingAddress: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        });

      // Complete User 1's payment
      const webhookPayload1 = {
        id: 'evt_user1_complete',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: checkout1Response.body.paymentIntent.id,
            status: 'succeeded',
            metadata: {
              orderId: checkout1Response.body.order.id
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload1);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookPayload1));

      // User 2 tries to add 2 items (only 1 remaining)
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          productId: limitedProduct.id,
          quantity: 2
        });

      const checkout2Response = await request(app)
        .post('/api/checkout/create-payment-intent')
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          shippingAddress: {
            street: '456 Another Street',
            city: 'Another City',
            state: 'AS',
            zipCode: '67890',
            country: 'US'
          }
        });

      expect(checkout2Response.status).toBe(400);
      expect(checkout2Response.body.details[0]).toMatchObject({
        productId: limitedProduct.id,
        productName: limitedProduct.name,
        requested: 2,
        available: 1,
        suggestion: 'Reduce quantity to 1 or less'
      });
    });
  });

  describe('Inventory Management Edge Cases', () => {
    it('should handle negative stock gracefully', async () => {
      // This test simulates a scenario where external systems might cause negative stock
      const product = testProducts[2];

      // Manually set negative stock (simulating external inventory issue)
      await request(app)
        .put(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          ...product,
          stock: -1
        });

      // Try to add to cart
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          productId: product.id,
          quantity: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('PRODUCT_UNAVAILABLE');
      expect(response.body.message).toContain('currently unavailable');
    });

    it('should handle very large quantity requests', async () => {
      const product = testProducts[2]; // 100 items in stock

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          productId: product.id,
          quantity: 999999
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INSUFFICIENT_STOCK');
      expect(response.body.details[0]).toMatchObject({
        productId: product.id,
        requested: 999999,
        available: 100
      });
    });
  });
});