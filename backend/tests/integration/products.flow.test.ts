import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Integration test for complete product browsing flow: listing -> search -> pagination -> filtering
describe('Products Flow Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let app: any; // Will be the Express app once implemented

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe('Product Browsing Flow', () => {
    it('should complete product listing -> search -> pagination flow', async () => {
      // Step 1: Get initial product listing
      const listingResponse = await request(app)
        .get('/api/products')
        .expect(200);

      expect(listingResponse.body).toHaveProperty('products');
      expect(listingResponse.body).toHaveProperty('totalPages');
      expect(listingResponse.body).toHaveProperty('currentPage', 1);
      expect(listingResponse.body).toHaveProperty('totalProducts');
      expect(Array.isArray(listingResponse.body.products)).toBe(true);

      // Step 2: Search for specific products
      const searchResponse = await request(app)
        .get('/api/products?search=laptop')
        .expect(200);

      expect(searchResponse.body).toHaveProperty('products');
      expect(Array.isArray(searchResponse.body.products)).toBe(true);
      
      // If there are search results, verify they contain the search term
      if (searchResponse.body.products.length > 0) {
        const product = searchResponse.body.products[0];
        expect(product).toHaveProperty('name');
        // In real implementation, search term should appear in name or description
      }

      // Step 3: Test pagination on search results
      if (searchResponse.body.totalPages > 1) {
        const paginatedResponse = await request(app)
          .get('/api/products?search=laptop&page=2')
          .expect(200);

        expect(paginatedResponse.body).toHaveProperty('currentPage', 2);
        expect(paginatedResponse.body).toHaveProperty('products');
        expect(Array.isArray(paginatedResponse.body.products)).toBe(true);
      }

      // Step 4: Get detailed view of a specific product
      if (listingResponse.body.products.length > 0) {
        const productId = listingResponse.body.products[0]._id;
        
        const detailResponse = await request(app)
          .get(`/api/products/${productId}`)
          .expect(200);

        expect(detailResponse.body).toHaveProperty('_id', productId);
        expect(detailResponse.body).toHaveProperty('name');
        expect(detailResponse.body).toHaveProperty('price');
        expect(detailResponse.body).toHaveProperty('description');
        expect(detailResponse.body).toHaveProperty('category');
        expect(detailResponse.body).toHaveProperty('inventory');
        expect(detailResponse.body).toHaveProperty('images');
      }
    });

    it('should complete category filtering -> price filtering flow', async () => {
      // Step 1: Filter by category
      const categoryResponse = await request(app)
        .get('/api/products?category=electronics')
        .expect(200);

      expect(categoryResponse.body).toHaveProperty('products');
      expect(Array.isArray(categoryResponse.body.products)).toBe(true);

      // Verify all products belong to the filtered category
      if (categoryResponse.body.products.length > 0) {
        categoryResponse.body.products.forEach((product: any) => {
          expect(product).toHaveProperty('category', 'electronics');
        });
      }

      // Step 2: Apply price range filter to category results
      const priceFilteredResponse = await request(app)
        .get('/api/products?category=electronics&minPrice=50&maxPrice=500')
        .expect(200);

      expect(priceFilteredResponse.body).toHaveProperty('products');
      expect(Array.isArray(priceFilteredResponse.body.products)).toBe(true);

      // Verify all products are within price range
      if (priceFilteredResponse.body.products.length > 0) {
        priceFilteredResponse.body.products.forEach((product: any) => {
          expect(product).toHaveProperty('category', 'electronics');
          expect(product.price).toBeGreaterThanOrEqual(50);
          expect(product.price).toBeLessThanOrEqual(500);
        });
      }

      // Step 3: Sort filtered results by price
      const sortedResponse = await request(app)
        .get('/api/products?category=electronics&minPrice=50&maxPrice=500&sortBy=price&sortOrder=asc')
        .expect(200);

      expect(sortedResponse.body).toHaveProperty('products');
      
      // Verify sorting order
      if (sortedResponse.body.products.length > 1) {
        for (let i = 1; i < sortedResponse.body.products.length; i++) {
          expect(sortedResponse.body.products[i].price)
            .toBeGreaterThanOrEqual(sortedResponse.body.products[i - 1].price);
        }
      }
    });

    it('should handle empty search results gracefully', async () => {
      // Search for something that doesn't exist
      const emptySearchResponse = await request(app)
        .get('/api/products?search=nonexistentproduct12345')
        .expect(200);

      expect(emptySearchResponse.body).toHaveProperty('products', []);
      expect(emptySearchResponse.body).toHaveProperty('totalProducts', 0);
      expect(emptySearchResponse.body).toHaveProperty('totalPages', 0);
      expect(emptySearchResponse.body).toHaveProperty('currentPage', 1);
    });

    it('should maintain filter state across pagination', async () => {
      // Apply filters and go to page 2
      const filteredPage2Response = await request(app)
        .get('/api/products?category=electronics&minPrice=10&page=2&limit=5')
        .expect(200);

      expect(filteredPage2Response.body).toHaveProperty('products');
      expect(filteredPage2Response.body).toHaveProperty('currentPage', 2);

      // Verify filters are still applied on page 2
      if (filteredPage2Response.body.products.length > 0) {
        filteredPage2Response.body.products.forEach((product: any) => {
          expect(product).toHaveProperty('category', 'electronics');
          expect(product.price).toBeGreaterThanOrEqual(10);
        });
      }
    });

    it('should handle invalid page numbers gracefully', async () => {
      // Test page 0
      const page0Response = await request(app)
        .get('/api/products?page=0')
        .expect(400);

      expect(page0Response.body).toHaveProperty('message');
      expect(page0Response.body.message).toContain('Invalid page number');

      // Test negative page
      const negativePageResponse = await request(app)
        .get('/api/products?page=-1')
        .expect(400);

      expect(negativePageResponse.body).toHaveProperty('message');
      expect(negativePageResponse.body.message).toContain('Invalid page number');

      // Test extremely high page number
      const highPageResponse = await request(app)
        .get('/api/products?page=9999')
        .expect(200);

      expect(highPageResponse.body).toHaveProperty('products', []);
      expect(highPageResponse.body).toHaveProperty('currentPage', 9999);
    });

    it('should validate price range parameters', async () => {
      // Test negative minimum price
      const negativeMinResponse = await request(app)
        .get('/api/products?minPrice=-10')
        .expect(400);

      expect(negativeMinResponse.body).toHaveProperty('message');
      expect(negativeMinResponse.body.message).toContain('minimum price must be non-negative');

      // Test minPrice > maxPrice
      const invalidRangeResponse = await request(app)
        .get('/api/products?minPrice=100&maxPrice=50')
        .expect(400);

      expect(invalidRangeResponse.body).toHaveProperty('message');
      expect(invalidRangeResponse.body.message).toContain('minimum price cannot exceed maximum price');
    });

    it('should handle combined search and filter queries', async () => {
      // Search with category filter
      const searchCategoryResponse = await request(app)
        .get('/api/products?search=phone&category=electronics')
        .expect(200);

      expect(searchCategoryResponse.body).toHaveProperty('products');
      
      // Verify results match both search and category filter
      if (searchCategoryResponse.body.products.length > 0) {
        searchCategoryResponse.body.products.forEach((product: any) => {
          expect(product).toHaveProperty('category', 'electronics');
          // In real implementation, search term should appear in product
        });
      }

      // Search with price filter
      const searchPriceResponse = await request(app)
        .get('/api/products?search=laptop&minPrice=200&maxPrice=2000')
        .expect(200);

      expect(searchPriceResponse.body).toHaveProperty('products');
      
      // Verify results match both search and price filter
      if (searchPriceResponse.body.products.length > 0) {
        searchPriceResponse.body.products.forEach((product: any) => {
          expect(product.price).toBeGreaterThanOrEqual(200);
          expect(product.price).toBeLessThanOrEqual(2000);
        });
      }
    });

    it('should handle special characters in search queries', async () => {
      // Test search with special characters
      const specialCharResponse = await request(app)
        .get('/api/products?search=laptop%20%26%20mouse') // "laptop & mouse" URL encoded
        .expect(200);

      expect(specialCharResponse.body).toHaveProperty('products');
      expect(Array.isArray(specialCharResponse.body.products)).toBe(true);

      // Test search with quotes
      const quotedSearchResponse = await request(app)
        .get('/api/products?search=%22gaming%20laptop%22') // "gaming laptop" URL encoded
        .expect(200);

      expect(quotedSearchResponse.body).toHaveProperty('products');
      expect(Array.isArray(quotedSearchResponse.body.products)).toBe(true);
    });

    it('should return consistent product structure across all endpoints', async () => {
      // Get products from listing
      const listingResponse = await request(app)
        .get('/api/products?limit=1')
        .expect(200);

      if (listingResponse.body.products.length > 0) {
        const listProduct = listingResponse.body.products[0];
        const productId = listProduct._id;

        // Get same product from detail endpoint
        const detailResponse = await request(app)
          .get(`/api/products/${productId}`)
          .expect(200);

        const detailProduct = detailResponse.body;

        // Verify consistent structure
        expect(listProduct).toHaveProperty('_id', detailProduct._id);
        expect(listProduct).toHaveProperty('name', detailProduct.name);
        expect(listProduct).toHaveProperty('price', detailProduct.price);
        expect(listProduct).toHaveProperty('category', detailProduct.category);

        // Detail endpoint should have additional fields
        expect(detailProduct).toHaveProperty('description');
        expect(detailProduct).toHaveProperty('specifications');
        expect(detailProduct).toHaveProperty('images');
        expect(detailProduct).toHaveProperty('inventory');
      }
    });

    it('should handle concurrent requests for product data', async () => {
      // Make multiple concurrent requests
      const promises = [
        request(app).get('/api/products?page=1'),
        request(app).get('/api/products?category=electronics'),
        request(app).get('/api/products?search=laptop'),
        request(app).get('/api/products?sortBy=price&sortOrder=desc')
      ];

      const results = await Promise.all(promises);

      // All requests should succeed
      results.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('products');
        expect(Array.isArray(response.body.products)).toBe(true);
      });
    });

    it('should provide accurate pagination metadata', async () => {
      // Test with known limit
      const limitedResponse = await request(app)
        .get('/api/products?limit=5')
        .expect(200);

      expect(limitedResponse.body).toHaveProperty('products');
      expect(limitedResponse.body).toHaveProperty('totalPages');
      expect(limitedResponse.body).toHaveProperty('currentPage', 1);
      expect(limitedResponse.body).toHaveProperty('totalProducts');

      // Verify limit is respected
      expect(limitedResponse.body.products.length).toBeLessThanOrEqual(5);

      // Calculate expected total pages
      const { totalProducts } = limitedResponse.body;
      const expectedTotalPages = Math.ceil(totalProducts / 5);
      expect(limitedResponse.body.totalPages).toBe(expectedTotalPages);
    });

    it('should handle product availability filtering', async () => {
      // Filter for in-stock products only
      const inStockResponse = await request(app)
        .get('/api/products?inStock=true')
        .expect(200);

      expect(inStockResponse.body).toHaveProperty('products');
      
      // Verify all products have inventory > 0
      if (inStockResponse.body.products.length > 0) {
        inStockResponse.body.products.forEach((product: any) => {
          expect(product.inventory).toBeGreaterThan(0);
        });
      }

      // Filter for out-of-stock products
      const outOfStockResponse = await request(app)
        .get('/api/products?inStock=false')
        .expect(200);

      expect(outOfStockResponse.body).toHaveProperty('products');
      
      // Verify all products have inventory = 0
      if (outOfStockResponse.body.products.length > 0) {
        outOfStockResponse.body.products.forEach((product: any) => {
          expect(product.inventory).toBe(0);
        });
      }
    });
  });

  describe('Product Categories Flow', () => {
    it('should list all available categories', async () => {
      const categoriesResponse = await request(app)
        .get('/api/products/categories')
        .expect(200);

      expect(categoriesResponse.body).toHaveProperty('categories');
      expect(Array.isArray(categoriesResponse.body.categories)).toBe(true);

      // Each category should have name and product count
      if (categoriesResponse.body.categories.length > 0) {
        categoriesResponse.body.categories.forEach((category: any) => {
          expect(category).toHaveProperty('name');
          expect(category).toHaveProperty('count');
          expect(typeof category.count).toBe('number');
        });
      }
    });

    it('should navigate category hierarchy effectively', async () => {
      // Get categories
      const categoriesResponse = await request(app)
        .get('/api/products/categories')
        .expect(200);

      if (categoriesResponse.body.categories.length > 0) {
        const firstCategory = categoriesResponse.body.categories[0];
        
        // Get products in first category
        const categoryProductsResponse = await request(app)
          .get(`/api/products?category=${firstCategory.name}`)
          .expect(200);

        expect(categoryProductsResponse.body).toHaveProperty('products');
        expect(categoryProductsResponse.body.products.length).toBeLessThanOrEqual(firstCategory.count);
      }
    });
  });
});