import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';

// Integration test for cart functionality: add items -> update quantities -> remove items -> subtotal calculation

describe('Cart Flow Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let testProducts: any[] = [];

  beforeEach(async () => {
    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }

    // Create test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'carttest@example.com',
        password: 'CartTest123!',
        firstName: 'Cart',
        lastName: 'Tester'
      });

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'carttest@example.com',
        password: 'CartTest123!'
      });

    authToken = loginResponse.body.token;
    userId = loginResponse.body.user.id;

    // Create test products
    testProducts = [
      {
        name: 'Test Product 1',
        description: 'Test product for cart flow',
        price: 29.99,
        stock: 100,
        category: 'Electronics',
        imageUrl: 'https://example.com/image1.jpg'
      },
      {
        name: 'Test Product 2',
        description: 'Another test product',
        price: 49.99,
        stock: 50,
        category: 'Books',
        imageUrl: 'https://example.com/image2.jpg'
      },
      {
        name: 'Limited Stock Product',
        description: 'Product with limited stock',
        price: 99.99,
        stock: 2,
        category: 'Clothing',
        imageUrl: 'https://example.com/image3.jpg'
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
  });

  describe('Cart Item Management', () => {
    it('should add item to cart', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 2
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        cart: {
          userId,
          items: [
            {
              productId: testProducts[0].id,
              quantity: 2,
              unitPrice: testProducts[0].price
            }
          ],
          subtotal: testProducts[0].price * 2
        }
      });
    });

    it('should update existing cart item quantity', async () => {
      // Add initial item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 1
        });

      // Update quantity
      const response = await request(app)
        .put(`/api/cart/items/${testProducts[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 3
        });

      expect(response.status).toBe(200);
      expect(response.body.cart.items[0].quantity).toBe(3);
      expect(response.body.cart.subtotal).toBe(testProducts[0].price * 3);
    });

    it('should add multiple different products to cart', async () => {
      // Add first product
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 2
        });

      // Add second product
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[1].id,
          quantity: 1
        });

      expect(response.status).toBe(201);
      expect(response.body.cart.items).toHaveLength(2);
      
      const expectedSubtotal = (testProducts[0].price * 2) + (testProducts[1].price * 1);
      expect(response.body.cart.subtotal).toBe(expectedSubtotal);
    });

    it('should remove item from cart', async () => {
      // Add two products
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

      // Remove first product
      const response = await request(app)
        .delete(`/api/cart/items/${testProducts[0].id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.cart.items).toHaveLength(1);
      expect(response.body.cart.items[0].productId).toBe(testProducts[1].id);
      expect(response.body.cart.subtotal).toBe(testProducts[1].price);
    });

    it('should clear entire cart', async () => {
      // Add multiple products
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

      // Clear cart
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.cart.items).toHaveLength(0);
      expect(response.body.cart.subtotal).toBe(0);
    });
  });

  describe('Stock Validation', () => {
    it('should reject adding item with quantity exceeding stock', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[2].id, // Limited stock product (2 items)
          quantity: 5
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'INSUFFICIENT_STOCK',
        message: expect.stringContaining('requested quantity exceeds available stock')
      });
    });

    it('should reject updating item to quantity exceeding stock', async () => {
      // Add valid quantity first
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[2].id,
          quantity: 1
        });

      // Try to update to invalid quantity
      const response = await request(app)
        .put(`/api/cart/items/${testProducts[2].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 5
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INSUFFICIENT_STOCK');
    });

    it('should allow adding maximum available stock', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[2].id,
          quantity: 2 // Exactly the available stock
        });

      expect(response.status).toBe(201);
      expect(response.body.cart.items[0].quantity).toBe(2);
    });
  });

  describe('Subtotal Calculation', () => {
    it('should calculate correct subtotal for single item', async () => {
      const quantity = 3;
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity
        });

      const expectedSubtotal = testProducts[0].price * quantity;
      expect(response.body.cart.subtotal).toBe(expectedSubtotal);
    });

    it('should calculate correct subtotal for multiple items', async () => {
      // Add first product
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 2
        });

      // Add second product
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[1].id,
          quantity: 3
        });

      // Get cart
      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      const expectedSubtotal = (testProducts[0].price * 2) + (testProducts[1].price * 3);
      expect(response.body.cart.subtotal).toBe(expectedSubtotal);
    });

    it('should recalculate subtotal after quantity update', async () => {
      // Add item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 2
        });

      // Update quantity
      const response = await request(app)
        .put(`/api/cart/items/${testProducts[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 5
        });

      const expectedSubtotal = testProducts[0].price * 5;
      expect(response.body.cart.subtotal).toBe(expectedSubtotal);
    });

    it('should recalculate subtotal after item removal', async () => {
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

      // Remove one item
      const response = await request(app)
        .delete(`/api/cart/items/${testProducts[0].id}`)
        .set('Authorization', `Bearer ${authToken}`);

      const expectedSubtotal = testProducts[1].price * 1;
      expect(response.body.cart.subtotal).toBe(expectedSubtotal);
    });
  });

  describe('Cart Retrieval', () => {
    it('should get empty cart for new user', async () => {
      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        cart: {
          userId,
          items: [],
          subtotal: 0
        }
      });
    });

    it('should get cart with items and correct subtotal', async () => {
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
          quantity: 1
        });

      // Get cart
      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.cart.items).toHaveLength(2);
      
      const expectedSubtotal = (testProducts[0].price * 2) + (testProducts[1].price * 1);
      expect(response.body.cart.subtotal).toBe(expectedSubtotal);
    });

    it('should include product details in cart items', async () => {
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 1
        });

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.body.cart.items[0]).toMatchObject({
        productId: testProducts[0].id,
        quantity: 1,
        unitPrice: testProducts[0].price,
        product: {
          id: testProducts[0].id,
          name: testProducts[0].name,
          description: testProducts[0].description,
          price: testProducts[0].price,
          imageUrl: testProducts[0].imageUrl
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should reject cart operations without authentication', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .send({
          productId: testProducts[0].id,
          quantity: 1
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    });

    it('should reject adding non-existent product', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: new mongoose.Types.ObjectId().toString(),
          quantity: 1
        });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: 'PRODUCT_NOT_FOUND',
        message: 'Product not found'
      });
    });

    it('should reject invalid quantity values', async () => {
      // Test zero quantity
      let response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: 0
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INVALID_QUANTITY');

      // Test negative quantity
      response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProducts[0].id,
          quantity: -1
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INVALID_QUANTITY');
    });

    it('should reject updating non-existent cart item', async () => {
      const response = await request(app)
        .put(`/api/cart/items/${testProducts[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 2
        });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: 'CART_ITEM_NOT_FOUND',
        message: 'Item not found in cart'
      });
    });

    it('should reject removing non-existent cart item', async () => {
      const response = await request(app)
        .delete(`/api/cart/items/${testProducts[0].id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: 'CART_ITEM_NOT_FOUND',
        message: 'Item not found in cart'
      });
    });
  });

  describe('Concurrent Cart Operations', () => {
    it('should handle concurrent add operations correctly', async () => {
      const promises = [
        request(app)
          .post('/api/cart/items')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            productId: testProducts[0].id,
            quantity: 1
          }),
        request(app)
          .post('/api/cart/items')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            productId: testProducts[1].id,
            quantity: 2
          })
      ];

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Verify final cart state
      const cartResponse = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      expect(cartResponse.body.cart.items).toHaveLength(2);
      const expectedSubtotal = testProducts[0].price + (testProducts[1].price * 2);
      expect(cartResponse.body.cart.subtotal).toBe(expectedSubtotal);
    });
  });
});