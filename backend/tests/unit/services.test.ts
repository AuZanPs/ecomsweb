import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Cart, { ICart } from '../../src/models/Cart';
import Product, { IProduct } from '../../src/models/Product';
import User, { IUser } from '../../src/models/User';
import Order, { IOrder, OrderStatus } from '../../src/models/Order';
import CartService from '../../src/services/CartService';
import ProductService from '../../src/services/ProductService';
import OrderService from '../../src/services/OrderService';
import UserService from '../../src/services/UserService';
import CheckoutService from '../../src/services/CheckoutService';
import { StockAdjustment } from '../../src/services/StockAdjustment';

describe('Service Layer Unit Tests', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Cart.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({});
    await Order.deleteMany({});
  });

  // ============================================================================
  // CART SERVICE TESTS
  // ============================================================================

  describe('CartService', () => {
    let testUser: IUser;
    let testProduct: IProduct;

    beforeEach(async () => {
      testUser = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword123'
      });

      testProduct = await Product.create({
        name: 'Test Product',
        description: 'A test product',
        price: 29.99,
        priceCents: 2999,
        stock: 10,
        category: 'Electronics',
        imageUrl: 'https://example.com/image.jpg',
        isActive: true
      });
    });

    test('should create new cart when adding first item', async () => {
      const result = await CartService.addToCart(testUser._id.toString(), testProduct._id.toString(), 2);
      
      expect(result.success).toBe(true);
      expect(result.cart).toBeDefined();
      expect(result.cart!.items).toHaveLength(1);
      expect(result.cart!.items[0].quantity).toBe(2);
      expect(result.cart!.totalItems).toBe(2);
      expect(result.cart!.totalPrice).toBe(59.98);
    });

    test('should update quantity when adding existing item', async () => {
      // Add item first time
      await CartService.addToCart(testUser._id.toString(), testProduct._id.toString(), 2);
      
      // Add same item again
      const result = await CartService.addToCart(testUser._id.toString(), testProduct._id.toString(), 3);
      
      expect(result.success).toBe(true);
      expect(result.cart!.items).toHaveLength(1);
      expect(result.cart!.items[0].quantity).toBe(5);
      expect(result.cart!.totalItems).toBe(5);
    });

    test('should handle insufficient stock', async () => {
      const result = await CartService.addToCart(testUser._id.toString(), testProduct._id.toString(), 15);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient stock');
    });

    test('should update item quantity correctly', async () => {
      await CartService.addToCart(testUser._id.toString(), testProduct._id.toString(), 2);
      
      const result = await CartService.updateCartItem(testUser._id.toString(), testProduct._id.toString(), 5);
      
      expect(result.success).toBe(true);
      expect(result.cart!.items[0].quantity).toBe(5);
      expect(result.cart!.totalItems).toBe(5);
    });

    test('should remove item from cart', async () => {
      await CartService.addToCart(testUser._id.toString(), testProduct._id.toString(), 2);
      
      const result = await CartService.removeFromCart(testUser._id.toString(), testProduct._id.toString());
      
      expect(result.success).toBe(true);
      expect(result.cart!.items).toHaveLength(0);
      expect(result.cart!.totalItems).toBe(0);
      expect(result.cart!.totalPrice).toBe(0);
    });

    test('should clear entire cart', async () => {
      await CartService.addToCart(testUser._id.toString(), testProduct._id.toString(), 2);
      
      const result = await CartService.clearCart(testUser._id.toString());
      
      expect(result.success).toBe(true);
      expect(result.cart!.items).toHaveLength(0);
    });

    test('should validate cart stock availability', async () => {
      await CartService.addToCart(testUser._id.toString(), testProduct._id.toString(), 5);
      
      // Reduce product stock to simulate stock change
      await Product.findByIdAndUpdate(testProduct._id, { stock: 3 });
      
      const result = await CartService.validateCart(testUser._id.toString());
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Insufficient stock for Test Product. Available: 3, Requested: 5');
    });
  });

  // ============================================================================
  // PRODUCT SERVICE TESTS
  // ============================================================================

  describe('ProductService', () => {
    let testProducts: IProduct[];

    beforeEach(async () => {
      testProducts = await Product.create([
        {
          name: 'Laptop',
          description: 'Gaming laptop',
          price: 999.99,
          priceCents: 99999,
          stock: 5,
          category: 'Electronics',
          imageUrl: 'laptop.jpg',
          isActive: true
        },
        {
          name: 'Mouse',
          description: 'Gaming mouse',
          price: 49.99,
          priceCents: 4999,
          stock: 20,
          category: 'Electronics',
          imageUrl: 'mouse.jpg',
          isActive: true
        },
        {
          name: 'Keyboard',
          description: 'Mechanical keyboard',
          price: 129.99,
          priceCents: 12999,
          stock: 0, // Out of stock
          category: 'Electronics',
          imageUrl: 'keyboard.jpg',
          isActive: true
        }
      ]);
    });

    test('should get all products with pagination', async () => {
      const result = await ProductService.getProducts({ page: 1, limit: 2 });
      
      expect(result.products).toHaveLength(2);
      expect(result.pagination.totalProducts).toBe(3);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.currentPage).toBe(1);
    });

    test('should search products by name', async () => {
      const result = await ProductService.searchProducts('laptop', { page: 1, limit: 10 });
      
      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toBe('Laptop');
    });

    test('should filter products by category', async () => {
      const result = await ProductService.getProducts({ 
        page: 1, 
        limit: 10, 
        category: 'Electronics' 
      });
      
      expect(result.products).toHaveLength(3);
    });

    test('should filter products by price range', async () => {
      const result = await ProductService.getProducts({ 
        page: 1, 
        limit: 10, 
        minPrice: 50, 
        maxPrice: 150 
      });
      
      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toBe('Keyboard');
    });

    test('should get product by ID', async () => {
      const result = await ProductService.getProductById(testProducts[0]._id.toString());
      
      expect(result).toBeDefined();
      expect(result!.name).toBe('Laptop');
    });

    test('should return null for invalid product ID', async () => {
      const result = await ProductService.getProductById('507f1f77bcf86cd799439011');
      
      expect(result).toBeNull();
    });

    test('should check stock availability', async () => {
      const inStock = await ProductService.checkStock(testProducts[0]._id.toString(), 3);
      const outOfStock = await ProductService.checkStock(testProducts[0]._id.toString(), 10);
      
      expect(inStock).toBe(true);
      expect(outOfStock).toBe(false);
    });

    test('should get featured products', async () => {
      // Update one product to be featured
      await Product.findByIdAndUpdate(testProducts[0]._id, { isFeatured: true });
      
      const result = await ProductService.getFeaturedProducts();
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Laptop');
    });
  });

  // ============================================================================
  // USER SERVICE TESTS
  // ============================================================================

  describe('UserService', () => {
    test('should create user with hashed password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123!'
      };
      
      const result = await UserService.createUser(userData);
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user!.email).toBe('john@example.com');
      expect(result.user!.password).not.toBe('SecurePass123!'); // Should be hashed
    });

    test('should prevent duplicate email registration', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123!'
      };
      
      await UserService.createUser(userData);
      const result = await UserService.createUser(userData); // Duplicate
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    test('should authenticate user with correct credentials', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123!'
      };
      
      await UserService.createUser(userData);
      const result = await UserService.authenticateUser('john@example.com', 'SecurePass123!');
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    test('should reject authentication with wrong password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123!'
      };
      
      await UserService.createUser(userData);
      const result = await UserService.authenticateUser('john@example.com', 'WrongPassword');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid credentials');
    });

    test('should generate valid JWT tokens', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword123'
      });
      
      const tokens = UserService.generateTokens(user);
      
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });
  });

  // ============================================================================
  // ORDER SERVICE TESTS
  // ============================================================================

  describe('OrderService', () => {
    let testUser: IUser;
    let testProduct: IProduct;

    beforeEach(async () => {
      testUser = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword123'
      });

      testProduct = await Product.create({
        name: 'Test Product',
        description: 'A test product',
        price: 29.99,
        priceCents: 2999,
        stock: 10,
        category: 'Electronics',
        imageUrl: 'https://example.com/image.jpg',
        isActive: true
      });
    });

    test('should create order from cart', async () => {
      // Create a cart first
      await CartService.addToCart(testUser._id.toString(), testProduct._id.toString(), 2);
      
      const orderData = {
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'Test Country'
        }
      };
      
      const result = await OrderService.createOrderFromCart(testUser._id.toString(), orderData);
      
      expect(result.success).toBe(true);
      expect(result.order).toBeDefined();
      expect(result.order!.status).toBe(OrderStatus.Pending);
      expect(result.order!.items).toHaveLength(1);
      expect(result.order!.totalAmount).toBe(59.98);
    });

    test('should get user orders', async () => {
      // Create an order first
      const orderData = {
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'Test Country'
        }
      };
      
      await CartService.addToCart(testUser._id.toString(), testProduct._id.toString(), 1);
      await OrderService.createOrderFromCart(testUser._id.toString(), orderData);
      
      const result = await OrderService.getUserOrders(testUser._id.toString(), { page: 1, limit: 10 });
      
      expect(result.orders).toHaveLength(1);
      expect(result.pagination.totalOrders).toBe(1);
    });

    test('should update order status', async () => {
      const order = await Order.create({
        userId: testUser._id,
        orderNumber: 'ORD-123456',
        items: [{
          productId: testProduct._id,
          productName: testProduct.name,
          quantity: 1,
          priceCents: testProduct.priceCents,
          subtotalCents: testProduct.priceCents
        }],
        status: OrderStatus.Pending,
        totalAmountCents: testProduct.priceCents,
        totalAmount: testProduct.price,
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'Test Country'
        }
      });
      
      const result = await OrderService.updateOrderStatus(order._id.toString(), OrderStatus.Paid);
      
      expect(result.success).toBe(true);
      expect(result.order!.status).toBe(OrderStatus.Paid);
    });

    test('should cancel order if status allows', async () => {
      const order = await Order.create({
        userId: testUser._id,
        orderNumber: 'ORD-123456',
        items: [{
          productId: testProduct._id,
          productName: testProduct.name,
          quantity: 1,
          priceCents: testProduct.priceCents,
          subtotalCents: testProduct.priceCents
        }],
        status: OrderStatus.Pending,
        totalAmountCents: testProduct.priceCents,
        totalAmount: testProduct.price,
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'Test Country'
        }
      });
      
      const result = await OrderService.cancelOrder(order._id.toString(), 'Customer request');
      
      expect(result.success).toBe(true);
      expect(result.order!.status).toBe(OrderStatus.Cancelled);
    });
  });

  // ============================================================================
  // STOCK ADJUSTMENT TESTS
  // ============================================================================

  describe('StockAdjustment', () => {
    let testProduct: IProduct;

    beforeEach(async () => {
      testProduct = await Product.create({
        name: 'Test Product',
        description: 'A test product',
        price: 29.99,
        priceCents: 2999,
        stock: 10,
        category: 'Electronics',
        imageUrl: 'https://example.com/image.jpg',
        isActive: true
      });
    });

    test('should adjust stock for single product', async () => {
      const result = await StockAdjustment.adjustStock(testProduct._id.toString(), -3);
      
      expect(result.success).toBe(true);
      expect(result.newStock).toBe(7);
      
      // Verify in database
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct!.stock).toBe(7);
    });

    test('should prevent negative stock', async () => {
      const result = await StockAdjustment.adjustStock(testProduct._id.toString(), -15);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('insufficient stock');
    });

    test('should handle bulk stock adjustments', async () => {
      const adjustments = [
        { productId: testProduct._id.toString(), adjustment: -2 }
      ];
      
      const result = await StockAdjustment.bulkAdjustStock(adjustments);
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].newStock).toBe(8);
    });

    test('should reserve stock for pending orders', async () => {
      const result = await StockAdjustment.reserveStock(testProduct._id.toString(), 3);
      
      expect(result.success).toBe(true);
      expect(result.reservedQuantity).toBe(3);
      expect(result.availableStock).toBe(7);
    });

    test('should release reserved stock', async () => {
      // Reserve first
      await StockAdjustment.reserveStock(testProduct._id.toString(), 3);
      
      // Then release
      const result = await StockAdjustment.releaseStock(testProduct._id.toString(), 3);
      
      expect(result.success).toBe(true);
      expect(result.releasedQuantity).toBe(3);
      expect(result.availableStock).toBe(10);
    });
  });

  // ============================================================================
  // CHECKOUT SERVICE TESTS
  // ============================================================================

  describe('CheckoutService', () => {
    let testUser: IUser;
    let testProduct: IProduct;

    beforeEach(async () => {
      testUser = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword123'
      });

      testProduct = await Product.create({
        name: 'Test Product',
        description: 'A test product',
        price: 29.99,
        priceCents: 2999,
        stock: 10,
        category: 'Electronics',
        imageUrl: 'https://example.com/image.jpg',
        isActive: true
      });
    });

    test('should validate checkout eligibility', async () => {
      // Add item to cart first
      await CartService.addToCart(testUser._id.toString(), testProduct._id.toString(), 2);
      
      const result = await CheckoutService.validateCheckout(testUser._id.toString());
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject checkout with empty cart', async () => {
      const result = await CheckoutService.validateCheckout(testUser._id.toString());
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cart is empty');
    });

    test('should calculate shipping costs', async () => {
      const shippingAddress = {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'Test Country'
      };
      
      const result = await CheckoutService.calculateShipping(shippingAddress, 2500); // $25.00
      
      expect(result.cost).toBeGreaterThan(0);
      expect(result.costCents).toBeGreaterThan(0);
      expect(result.method).toBeDefined();
      expect(result.estimatedDays).toBeGreaterThan(0);
    });

    test('should calculate order total with shipping and tax', async () => {
      await CartService.addToCart(testUser._id.toString(), testProduct._id.toString(), 2);
      
      const shippingAddress = {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'Test Country'
      };
      
      const result = await CheckoutService.calculateOrderTotal(testUser._id.toString(), shippingAddress);
      
      expect(result.subtotal).toBe(59.98);
      expect(result.shipping).toBeGreaterThan(0);
      expect(result.tax).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(result.subtotal);
    });
  });
});