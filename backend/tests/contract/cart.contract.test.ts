import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { testTokens } from '../setup';

// Note: This will fail initially as the app doesn't exist yet - TDD approach
describe('Cart Contract Tests', () => {

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe('GET /api/cart', () => {
    it('should return user cart with items', async () => {
      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', 'Bearer valid-user-token')
        .expect(200);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body).toHaveProperty('totalItems');
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('should return empty cart for new user', async () => {
      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', 'Bearer new-user-token')
        .expect(200);

      expect(response.body).toHaveProperty('items', []);
      expect(response.body).toHaveProperty('totalAmount', 0);
      expect(response.body).toHaveProperty('totalItems', 0);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/cart')
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('unauthorized');
    });

    it('should populate product details in cart items', async () => {
      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', 'Bearer user-with-cart-token')
        .expect(200);

      if (response.body.items.length > 0) {
        const item = response.body.items[0];
        expect(item).toHaveProperty('product');
        expect(item.product).toHaveProperty('name');
        expect(item.product).toHaveProperty('price');
        expect(item.product).toHaveProperty('images');
        expect(item).toHaveProperty('quantity');
        expect(item).toHaveProperty('subtotal');
      }
    });
  });

  describe('POST /api/cart/items', () => {
    it('should add new item to cart', async () => {
      const newItem = {
        productId: new mongoose.Types.ObjectId().toString(),
        quantity: 2
      };

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', 'Bearer valid-user-token')
        .send(newItem)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Item added to cart');
      expect(response.body).toHaveProperty('cart');
      expect(response.body.cart).toHaveProperty('items');
      expect(response.body.cart).toHaveProperty('totalAmount');
      expect(response.body.cart).toHaveProperty('totalItems');
    });

    it('should update quantity if item already exists in cart', async () => {
      const existingItem = {
        productId: new mongoose.Types.ObjectId().toString(),
        quantity: 1
      };

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', 'Bearer user-with-existing-item-token')
        .send(existingItem)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Cart updated');
      expect(response.body).toHaveProperty('cart');
    });

    it('should require authentication', async () => {
      const newItem = {
        productId: new mongoose.Types.ObjectId().toString(),
        quantity: 2
      };

      const response = await request(app)
        .post('/api/cart/items')
        .send(newItem)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('unauthorized');
    });

    it('should validate productId is provided', async () => {
      const invalidItem = {
        quantity: 2
      };

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', 'Bearer valid-user-token')
        .send(invalidItem)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('productId is required');
    });

    it('should validate quantity is positive integer', async () => {
      const invalidItem = {
        productId: new mongoose.Types.ObjectId().toString(),
        quantity: 0
      };

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', 'Bearer valid-user-token')
        .send(invalidItem)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('quantity must be positive');
    });

    it('should validate product exists', async () => {
      const nonExistentProduct = {
        productId: new mongoose.Types.ObjectId().toString(),
        quantity: 1
      };

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', 'Bearer valid-user-token')
        .send(nonExistentProduct)
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Product not found');
    });

    it('should check product inventory availability', async () => {
      const outOfStockItem = {
        productId: new mongoose.Types.ObjectId().toString(),
        quantity: 100 // Assuming this exceeds available inventory
      };

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', 'Bearer valid-user-token')
        .send(outOfStockItem)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('insufficient inventory');
    });

    it('should handle maximum quantity limits', async () => {
      const maxQuantityItem = {
        productId: new mongoose.Types.ObjectId().toString(),
        quantity: 999 // Assuming this exceeds max allowed per item
      };

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', 'Bearer valid-user-token')
        .send(maxQuantityItem)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('maximum quantity exceeded');
    });
  });

  describe('PUT /api/cart/items/:productId', () => {
    it('should update item quantity in cart', async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      const updateData = { quantity: 3 };

      const response = await request(app)
        .put(`/api/cart/items/${productId}`)
        .set('Authorization', 'Bearer user-with-cart-token')
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Cart item updated');
      expect(response.body).toHaveProperty('cart');
      expect(response.body.cart).toHaveProperty('items');
      expect(response.body.cart).toHaveProperty('totalAmount');
    });

    it('should remove item if quantity is set to 0', async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      const updateData = { quantity: 0 };

      const response = await request(app)
        .put(`/api/cart/items/${productId}`)
        .set('Authorization', 'Bearer user-with-cart-token')
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Item removed from cart');
      expect(response.body).toHaveProperty('cart');
    });

    it('should return 404 if item not in cart', async () => {
      const nonExistentProductId = new mongoose.Types.ObjectId().toString();
      const updateData = { quantity: 2 };

      const response = await request(app)
        .put(`/api/cart/items/${nonExistentProductId}`)
        .set('Authorization', 'Bearer valid-user-token')
        .send(updateData)
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Item not found in cart');
    });

    it('should require authentication', async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      const updateData = { quantity: 2 };

      const response = await request(app)
        .put(`/api/cart/items/${productId}`)
        .send(updateData)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('unauthorized');
    });

    it('should validate quantity is non-negative integer', async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      const invalidData = { quantity: -1 };

      const response = await request(app)
        .put(`/api/cart/items/${productId}`)
        .set('Authorization', 'Bearer user-with-cart-token')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('quantity must be non-negative');
    });

    it('should check inventory availability for quantity increase', async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      const updateData = { quantity: 50 }; // Assuming exceeds inventory

      const response = await request(app)
        .put(`/api/cart/items/${productId}`)
        .set('Authorization', 'Bearer user-with-cart-token')
        .send(updateData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('insufficient inventory');
    });
  });

  describe('DELETE /api/cart/items/:productId', () => {
    it('should remove item from cart', async () => {
      const productId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .delete(`/api/cart/items/${productId}`)
        .set('Authorization', 'Bearer user-with-cart-token')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Item removed from cart');
      expect(response.body).toHaveProperty('cart');
      expect(response.body.cart).toHaveProperty('items');
      expect(response.body.cart).toHaveProperty('totalAmount');
    });

    it('should return 404 if item not in cart', async () => {
      const nonExistentProductId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .delete(`/api/cart/items/${nonExistentProductId}`)
        .set('Authorization', 'Bearer valid-user-token')
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Item not found in cart');
    });

    it('should require authentication', async () => {
      const productId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .delete(`/api/cart/items/${productId}`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('unauthorized');
    });
  });

  describe('DELETE /api/cart', () => {
    it('should clear entire cart', async () => {
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', 'Bearer user-with-cart-token')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Cart cleared');
      expect(response.body).toHaveProperty('cart');
      expect(response.body.cart).toHaveProperty('items', []);
      expect(response.body.cart).toHaveProperty('totalAmount', 0);
      expect(response.body.cart).toHaveProperty('totalItems', 0);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/cart')
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('unauthorized');
    });

    it('should handle clearing already empty cart', async () => {
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', 'Bearer user-with-empty-cart-token')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Cart cleared');
      expect(response.body.cart).toHaveProperty('items', []);
    });
  });

  describe('GET /api/cart/summary', () => {
    it('should return cart summary with totals', async () => {
      const response = await request(app)
        .get('/api/cart/summary')
        .set('Authorization', 'Bearer user-with-cart-token')
        .expect(200);

      expect(response.body).toHaveProperty('totalItems');
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body).toHaveProperty('itemCount');
      expect(typeof response.body.totalItems).toBe('number');
      expect(typeof response.body.totalAmount).toBe('number');
      expect(typeof response.body.itemCount).toBe('number');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/cart/summary')
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('unauthorized');
    });

    it('should return zero values for empty cart', async () => {
      const response = await request(app)
        .get('/api/cart/summary')
        .set('Authorization', 'Bearer user-with-empty-cart-token')
        .expect(200);

      expect(response.body).toHaveProperty('totalItems', 0);
      expect(response.body).toHaveProperty('totalAmount', 0);
      expect(response.body).toHaveProperty('itemCount', 0);
    });
  });

  describe('POST /api/cart/merge', () => {
    it('should merge guest cart with user cart on login', async () => {
      const guestCartData = {
        items: [
          {
            productId: new mongoose.Types.ObjectId().toString(),
            quantity: 2
          }
        ]
      };

      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', 'Bearer valid-user-token')
        .send(guestCartData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Cart merged successfully');
      expect(response.body).toHaveProperty('cart');
      expect(response.body.cart).toHaveProperty('items');
      expect(response.body.cart).toHaveProperty('totalAmount');
    });

    it('should handle duplicate items during merge', async () => {
      const guestCartData = {
        items: [
          {
            productId: new mongoose.Types.ObjectId().toString(), // Same product already in user cart
            quantity: 1
          }
        ]
      };

      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', 'Bearer user-with-cart-token')
        .send(guestCartData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Cart merged successfully');
      expect(response.body).toHaveProperty('cart');
    });

    it('should require authentication', async () => {
      const guestCartData = {
        items: []
      };

      const response = await request(app)
        .post('/api/cart/merge')
        .send(guestCartData)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('unauthorized');
    });
  });
});