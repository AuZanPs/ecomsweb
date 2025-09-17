import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';

// Note: This will fail initially as the app doesn't exist yet - TDD approach
describe('Products Contract Tests', () => {

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe('GET /api/products', () => {
    it('should return all products with pagination', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body).toHaveProperty('products');
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body).toHaveProperty('currentPage');
      expect(response.body).toHaveProperty('totalProducts');
      expect(Array.isArray(response.body.products)).toBe(true);
    });

    it('should filter products by category', async () => {
      const response = await request(app)
        .get('/api/products?category=electronics')
        .expect(200);

      expect(response.body).toHaveProperty('products');
      expect(Array.isArray(response.body.products)).toBe(true);
    });

    it('should filter products by price range', async () => {
      const response = await request(app)
        .get('/api/products?minPrice=10&maxPrice=100')
        .expect(200);

      expect(response.body).toHaveProperty('products');
      expect(Array.isArray(response.body.products)).toBe(true);
    });

    it('should search products by name', async () => {
      const response = await request(app)
        .get('/api/products?search=laptop')
        .expect(200);

      expect(response.body).toHaveProperty('products');
      expect(Array.isArray(response.body.products)).toBe(true);
    });

    it('should sort products by price ascending', async () => {
      const response = await request(app)
        .get('/api/products?sortBy=price&sortOrder=asc')
        .expect(200);

      expect(response.body).toHaveProperty('products');
      expect(Array.isArray(response.body.products)).toBe(true);
    });

    it('should sort products by price descending', async () => {
      const response = await request(app)
        .get('/api/products?sortBy=price&sortOrder=desc')
        .expect(200);

      expect(response.body).toHaveProperty('products');
      expect(Array.isArray(response.body.products)).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/products?page=2&limit=5')
        .expect(200);

      expect(response.body).toHaveProperty('products');
      expect(response.body).toHaveProperty('currentPage', 2);
      expect(response.body.products.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/products/:id', () => {
    it('should return a single product by ID', async () => {
      // This will need a valid product ID once products are seeded
      const productId = new mongoose.Types.ObjectId().toString();
      
      const response = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('price');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('category');
      expect(response.body).toHaveProperty('inventory');
      expect(response.body).toHaveProperty('images');
    });

    it('should return 404 for non-existent product', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      
      const response = await request(app)
        .get(`/api/products/${nonExistentId}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Product not found');
    });

    it('should return 400 for invalid product ID format', async () => {
      const response = await request(app)
        .get('/api/products/invalid-id')
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Invalid product ID');
    });
  });

  describe('POST /api/products (Admin only)', () => {
    it('should create a new product with valid data', async () => {
      const productData = {
        name: 'Test Product',
        description: 'A test product description',
        price: 29.99,
        category: 'electronics',
        inventory: 100,
        images: ['image1.jpg', 'image2.jpg'],
        specifications: {
          brand: 'Test Brand',
          model: 'Test Model'
        }
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer admin-token') // Will need proper admin token
        .send(productData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('name', productData.name);
      expect(response.body).toHaveProperty('price', productData.price);
      expect(response.body).toHaveProperty('category', productData.category);
      expect(response.body).toHaveProperty('inventory', productData.inventory);
    });

    it('should reject product creation without authentication', async () => {
      const productData = {
        name: 'Test Product',
        price: 29.99,
        category: 'electronics'
      };

      const response = await request(app)
        .post('/api/products')
        .send(productData)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('unauthorized');
    });

    it('should reject product creation with non-admin user', async () => {
      const productData = {
        name: 'Test Product',
        price: 29.99,
        category: 'electronics'
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer user-token') // Regular user token
        .send(productData)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('admin access required');
    });

    it('should validate required fields', async () => {
      const invalidProductData = {
        description: 'Missing required fields'
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer admin-token')
        .send(invalidProductData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('validation');
    });

    it('should validate price is positive number', async () => {
      const invalidProductData = {
        name: 'Test Product',
        price: -10,
        category: 'electronics'
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer admin-token')
        .send(invalidProductData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('price must be positive');
    });

    it('should validate inventory is non-negative integer', async () => {
      const invalidProductData = {
        name: 'Test Product',
        price: 29.99,
        category: 'electronics',
        inventory: -5
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer admin-token')
        .send(invalidProductData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('inventory must be non-negative');
    });
  });

  describe('PUT /api/products/:id (Admin only)', () => {
    it('should update an existing product', async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      const updateData = {
        name: 'Updated Product Name',
        price: 39.99,
        inventory: 50
      };

      const response = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', 'Bearer admin-token')
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('_id', productId);
      expect(response.body).toHaveProperty('name', updateData.name);
      expect(response.body).toHaveProperty('price', updateData.price);
      expect(response.body).toHaveProperty('inventory', updateData.inventory);
    });

    it('should return 404 for non-existent product update', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const updateData = { name: 'Updated Name' };

      const response = await request(app)
        .put(`/api/products/${nonExistentId}`)
        .set('Authorization', 'Bearer admin-token')
        .send(updateData)
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Product not found');
    });

    it('should reject update without admin authentication', async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      const updateData = { name: 'Updated Name' };

      const response = await request(app)
        .put(`/api/products/${productId}`)
        .send(updateData)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('unauthorized');
    });

    it('should validate update data', async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      const invalidUpdateData = { price: -20 };

      const response = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', 'Bearer admin-token')
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('price must be positive');
    });
  });

  describe('DELETE /api/products/:id (Admin only)', () => {
    it('should delete an existing product', async () => {
      const productId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .delete(`/api/products/${productId}`)
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Product deleted successfully');
    });

    it('should return 404 for non-existent product deletion', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .delete(`/api/products/${nonExistentId}`)
        .set('Authorization', 'Bearer admin-token')
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Product not found');
    });

    it('should reject deletion without admin authentication', async () => {
      const productId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .delete(`/api/products/${productId}`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('unauthorized');
    });
  });

  describe('GET /api/products/categories', () => {
    it('should return list of available categories', async () => {
      const response = await request(app)
        .get('/api/products/categories')
        .expect(200);

      expect(response.body).toHaveProperty('categories');
      expect(Array.isArray(response.body.categories)).toBe(true);
    });
  });

  describe('PUT /api/products/:id/inventory (Admin only)', () => {
    it('should update product inventory', async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      const inventoryUpdate = { inventory: 75 };

      const response = await request(app)
        .put(`/api/products/${productId}/inventory`)
        .set('Authorization', 'Bearer admin-token')
        .send(inventoryUpdate)
        .expect(200);

      expect(response.body).toHaveProperty('_id', productId);
      expect(response.body).toHaveProperty('inventory', inventoryUpdate.inventory);
    });

    it('should validate inventory is non-negative', async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      const invalidInventory = { inventory: -10 };

      const response = await request(app)
        .put(`/api/products/${productId}/inventory`)
        .set('Authorization', 'Bearer admin-token')
        .send(invalidInventory)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('inventory must be non-negative');
    });
  });
});