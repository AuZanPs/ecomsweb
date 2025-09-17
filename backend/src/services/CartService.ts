import Cart, { ICart, ICartItem } from '../models/Cart';
import Product from '../models/Product';
import {
  AddToCartData,
  UpdateCartItemData,
  validate,
  AddToCartSchema,
  UpdateCartItemSchema,
  RemoveFromCartSchema
} from '../utils/validation';
import ProductService from './ProductService';

// Interfaces for service responses
export interface CartItemResponse {
  productId: string;
  productName: string;
  productPrice: number; // In dollars
  productPriceCents: number; // In cents
  productImageUrl: string;
  quantity: number;
  subtotal: number; // In dollars
  subtotalCents: number; // In cents
  isInStock: boolean;
  availableStock: number;
}

export interface CartResponse {
  id: string;
  userId: string;
  items: CartItemResponse[];
  totalItems: number;
  totalAmount: number; // In dollars
  totalAmountCents: number; // In cents
  createdAt: Date;
  updatedAt: Date;
  hasOutOfStockItems: boolean;
  hasInsufficientStockItems: boolean;
}

export interface CartSummary {
  totalItems: number;
  totalAmount: number;
  totalAmountCents: number;
  itemCount: number;
  isValid: boolean;
  validationIssues: string[];
}

export interface StockValidationResult {
  isValid: boolean;
  issues: Array<{
    productId: string;
    productName: string;
    requestedQuantity: number;
    availableStock: number;
    issue: string;
  }>;
}

// Service class for cart-related operations
export class CartService {
  
  // ============================================================================
  // CART RETRIEVAL
  // ============================================================================
  
  static async getCart(userId: string): Promise<CartResponse | null> {
    try {
      const cart = await Cart.findByUserId(userId);
      if (!cart) {
        return null;
      }
      
      return await this.formatCartResponse(cart);
      
    } catch (error) {
      throw new Error('Failed to get cart');
    }
  }
  
  static async getOrCreateCart(userId: string): Promise<CartResponse> {
    try {
      let cart = await Cart.findByUserId(userId);
      
      if (!cart) {
        cart = await Cart.createCart(userId);
      }
      
      return await this.formatCartResponse(cart);
      
    } catch (error) {
      throw new Error('Failed to get or create cart');
    }
  }
  
  static async getCartById(cartId: string): Promise<CartResponse | null> {
    try {
      const cart = await Cart.findById(cartId);
      if (!cart) {
        return null;
      }
      
      return await this.formatCartResponse(cart);
      
    } catch (error) {
      throw new Error('Failed to get cart by ID');
    }
  }
  
  // ============================================================================
  // CART ITEM MANAGEMENT
  // ============================================================================
  
  static async addToCart(userId: string, itemData: AddToCartData): Promise<CartResponse> {
    // Validate input data
    const validatedData = validate(AddToCartSchema, itemData);
    
    try {
      // Verify product exists and is available
      const product = await Product.findById(validatedData.productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      if (product.stock < validatedData.quantity) {
        throw new Error(`Insufficient stock. Available: ${product.stock}, Requested: ${validatedData.quantity}`);
      }
      
      // Get or create cart
      let cart = await Cart.findByUserId(userId);
      if (!cart) {
        cart = await Cart.createCart(userId);
      }
      
      // Add item to cart (need to pass unit price as well)
      await cart.addItem(validatedData.productId, validatedData.quantity, product.priceCents);
      
      return await this.formatCartResponse(cart);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to add item to cart');
    }
  }
  
  static async updateCartItem(userId: string, updateData: UpdateCartItemData): Promise<CartResponse> {
    // Validate input data
    const validatedData = validate(UpdateCartItemSchema, updateData);
    
    try {
      const cart = await Cart.findByUserId(userId);
      if (!cart) {
        throw new Error('Cart not found');
      }
      
      // If quantity is 0, remove the item
      if (validatedData.quantity === 0) {
        await cart.removeItem(validatedData.productId);
      } else {
        // Verify sufficient stock
        const product = await Product.findById(validatedData.productId);
        if (!product) {
          throw new Error('Product not found');
        }
        
        if (product.stock < validatedData.quantity) {
          throw new Error(`Insufficient stock. Available: ${product.stock}, Requested: ${validatedData.quantity}`);
        }
        
        await cart.updateItemQuantity(validatedData.productId, validatedData.quantity);
      }
      
      return await this.formatCartResponse(cart);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to update cart item');
    }
  }
  
  static async removeFromCart(userId: string, productId: string): Promise<CartResponse> {
    // Validate input data
    const validatedData = validate(RemoveFromCartSchema, { productId });
    
    try {
      const cart = await Cart.findByUserId(userId);
      if (!cart) {
        throw new Error('Cart not found');
      }
      
      await cart.removeItem(validatedData.productId);
      
      return await this.formatCartResponse(cart);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to remove item from cart');
    }
  }
  
  static async clearCart(userId: string): Promise<CartResponse> {
    try {
      const cart = await Cart.findByUserId(userId);
      if (!cart) {
        throw new Error('Cart not found');
      }
      
      await cart.clearItems();
      
      return await this.formatCartResponse(cart);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to clear cart');
    }
  }
  
  // ============================================================================
  // CART VALIDATION
  // ============================================================================
  
  static async validateCart(userId: string): Promise<StockValidationResult> {
    try {
      const cart = await Cart.findByUserId(userId);
      if (!cart || cart.items.length === 0) {
        return { isValid: true, issues: [] };
      }
      
      const issues: StockValidationResult['issues'] = [];
      
      // Check stock availability for each item
      for (const item of cart.items) {
        const product = await Product.findById(item.productId);
        
        if (!product) {
          issues.push({
            productId: item.productId.toString(),
            productName: 'Unknown Product',
            requestedQuantity: item.quantity,
            availableStock: 0,
            issue: 'Product no longer exists'
          });
        } else if (product.stock < item.quantity) {
          issues.push({
            productId: item.productId.toString(),
            productName: product.name,
            requestedQuantity: item.quantity,
            availableStock: product.stock,
            issue: product.stock === 0 ? 'Out of stock' : 'Insufficient stock'
          });
        }
      }
      
      return {
        isValid: issues.length === 0,
        issues
      };
      
    } catch (error) {
      throw new Error('Failed to validate cart');
    }
  }
  
  static async syncCartWithStock(userId: string): Promise<CartResponse> {
    try {
      const cart = await Cart.findByUserId(userId);
      if (!cart) {
        throw new Error('Cart not found');
      }
      
      const validationResult = await this.validateCart(userId);
      
      // Remove items that are no longer available or adjust quantities
      for (const issue of validationResult.issues) {
        if (issue.issue === 'Product no longer exists' || issue.availableStock === 0) {
          await cart.removeItem(issue.productId);
        } else if (issue.issue === 'Insufficient stock') {
          await cart.updateItemQuantity(issue.productId, issue.availableStock);
        }
      }
      
      return await this.formatCartResponse(cart);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to sync cart with stock');
    }
  }
  
  // ============================================================================
  // CART CALCULATIONS
  // ============================================================================
  
  static async getCartSummary(userId: string): Promise<CartSummary> {
    try {
      const cart = await Cart.findByUserId(userId);
      if (!cart) {
        return {
          totalItems: 0,
          totalAmount: 0,
          totalAmountCents: 0,
          itemCount: 0,
          isValid: true,
          validationIssues: []
        };
      }
      
      const validation = await this.validateCart(userId);
      const totals = await cart.calculateTotals();
      
      return {
        totalItems: totals.totalItems,
        totalAmount: totals.subtotalCents / 100,
        totalAmountCents: totals.subtotalCents,
        itemCount: cart.items.length,
        isValid: validation.isValid,
        validationIssues: validation.issues.map(issue => issue.issue)
      };
      
    } catch (error) {
      throw new Error('Failed to get cart summary');
    }
  }
  
  static async getCartTotals(userId: string): Promise<{
    totalQuantity: number;
    totalAmount: number;
    totalAmountCents: number;
  }> {
    try {
      const cart = await Cart.findByUserId(userId);
      if (!cart) {
        return {
          totalQuantity: 0,
          totalAmount: 0,
          totalAmountCents: 0
        };
      }
      
      const totals = await cart.calculateTotals();
      
      return {
        totalQuantity: totals.totalItems,
        totalAmount: totals.subtotalCents / 100,
        totalAmountCents: totals.subtotalCents
      };
      
    } catch (error) {
      throw new Error('Failed to get cart totals');
    }
  }
  
  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================
  
  static async bulkAddToCart(
    userId: string, 
    items: Array<{ productId: string; quantity: number }>
  ): Promise<CartResponse> {
    try {
      // Validate all items first
      for (const item of items) {
        const validatedData = validate(AddToCartSchema, item);
        // If validation passes, the item is valid - no need to check further
      }
      
      // Validate stock availability for all items
      const stockValidation = await ProductService.validateMultipleStockAvailability(items);
      if (!stockValidation.isValid) {
        const errors = stockValidation.issues.map(issue => 
          `${issue.productId}: ${issue.issue} (requested: ${issue.requestedQuantity}, available: ${issue.availableStock})`
        );
        throw new Error(`Stock validation failed: ${errors.join(', ')}`);
      }
      
      // Get or create cart
      let cart = await Cart.findByUserId(userId);
      if (!cart) {
        cart = await Cart.createCart(userId);
      }
      
      // Add all items
      for (const item of items) {
        // Fetch product to get price
        const product = await Product.findById(item.productId);
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }
        await cart.addItem(item.productId, item.quantity, product.priceCents);
      }
      
      return await this.formatCartResponse(cart);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to bulk add items to cart');
    }
  }
  
  static async bulkUpdateCart(
    userId: string, 
    updates: Array<{ productId: string; quantity: number }>
  ): Promise<CartResponse> {
    try {
      const cart = await Cart.findByUserId(userId);
      if (!cart) {
        throw new Error('Cart not found');
      }
      
      // Validate all updates first
      for (const update of updates) {
        const validatedData = validate(UpdateCartItemSchema, update);
        // If validation passes, the update is valid
      }
      
      // Apply updates
      for (const update of updates) {
        if (update.quantity === 0) {
          await cart.removeItem(update.productId);
        } else {
          // Verify stock for non-zero quantities
          const product = await Product.findById(update.productId);
          if (!product) {
            throw new Error(`Product not found: ${update.productId}`);
          }
          
          if (product.stock < update.quantity) {
            throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${update.quantity}`);
          }
          
          await cart.updateItemQuantity(update.productId, update.quantity);
        }
      }
      
      return await this.formatCartResponse(cart);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to bulk update cart');
    }
  }
  
  // ============================================================================
  // CART OPERATIONS
  // ============================================================================
  
  static async mergeCarts(sourceUserId: string, targetUserId: string): Promise<CartResponse> {
    try {
      const sourceCart = await Cart.findByUserId(sourceUserId);
      const targetCart = await Cart.findByUserId(targetUserId);
      
      if (!sourceCart || sourceCart.items.length === 0) {
        // Return target cart or create empty one
        return targetCart ? await this.formatCartResponse(targetCart) : await this.getOrCreateCart(targetUserId);
      }
      
      const finalCart = targetCart || await Cart.createCart(targetUserId);
      
      // Merge items from source cart
      for (const sourceItem of sourceCart.items) {
        // Fetch product to get price
        const product = await Product.findById(sourceItem.productId);
        if (!product) {
          throw new Error(`Product not found: ${sourceItem.productId}`);
        }
        await finalCart.addItem(sourceItem.productId.toString(), sourceItem.quantity, product.priceCents);
      }
      
      // Clear source cart
      await sourceCart.clearItems();
      
      return await this.formatCartResponse(finalCart);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to merge carts');
    }
  }
  
  static async transferCart(fromUserId: string, toUserId: string): Promise<CartResponse> {
    try {
      const sourceCart = await Cart.findByUserId(fromUserId);
      if (!sourceCart) {
        throw new Error('Source cart not found');
      }
      
      // Create new cart for target user or get existing
      let targetCart = await Cart.findByUserId(toUserId);
      if (!targetCart) {
        targetCart = await Cart.createCart(toUserId);
      }
      
      // Transfer all items
      for (const item of sourceCart.items) {
        // Fetch product to get price
        const product = await Product.findById(item.productId);
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }
        await targetCart.addItem(item.productId.toString(), item.quantity, product.priceCents);
      }
      
      // Clear source cart
      await sourceCart.clearItems();
      
      return await this.formatCartResponse(targetCart);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to transfer cart');
    }
  }
  
  static async duplicateCart(userId: string, newUserId: string): Promise<CartResponse> {
    try {
      const sourceCart = await Cart.findByUserId(userId);
      if (!sourceCart) {
        throw new Error('Source cart not found');
      }
      
      // Create new cart for target user
      let targetCart = await Cart.findByUserId(newUserId);
      if (!targetCart) {
        targetCart = await Cart.createCart(newUserId);
      }
      
      // Copy all items
      for (const item of sourceCart.items) {
        // Fetch product to get price
        const product = await Product.findById(item.productId);
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }
        await targetCart.addItem(item.productId.toString(), item.quantity, product.priceCents);
      }
      
      return await this.formatCartResponse(targetCart);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to duplicate cart');
    }
  }
  
  // ============================================================================
  // CART PERSISTENCE AND RECOVERY
  // ============================================================================
  
  static async saveCartForLater(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const cart = await Cart.findByUserId(userId);
      if (!cart || cart.items.length === 0) {
        return { success: false, message: 'No cart to save' };
      }
      
      // Mark cart as saved (this could be extended with a separate saved carts collection)
      cart.set('savedAt', new Date());
      await cart.save();
      
      return { success: true, message: 'Cart saved for later' };
      
    } catch (error) {
      throw new Error('Failed to save cart for later');
    }
  }
  
  static async restoreCart(userId: string): Promise<CartResponse> {
    try {
      const cart = await Cart.findByUserId(userId);
      if (!cart) {
        return await this.getOrCreateCart(userId);
      }
      
      // Sync with current stock levels
      return await this.syncCartWithStock(userId);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to restore cart');
    }
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  private static async formatCartResponse(cart: ICart): Promise<CartResponse> {
    try {
      const items: CartItemResponse[] = [];
      let hasOutOfStockItems = false;
      let hasInsufficientStockItems = false;
      
      // Get product details for all cart items
      const productIds = cart.items.map(item => item.productId.toString());
      const products = await ProductService.getProductsForCart(productIds);
      
      for (const cartItem of cart.items) {
        const productId = cartItem.productId.toString();
        const product = products.get(productId);
        
        if (product) {
          const isInStock = product.stock > 0;
          const hasSufficientStock = product.stock >= cartItem.quantity;
          
          if (!isInStock) hasOutOfStockItems = true;
          if (!hasSufficientStock) hasInsufficientStockItems = true;
          
          items.push({
            productId,
            productName: product.name,
            productPrice: product.price,
            productPriceCents: product.priceCents,
            productImageUrl: product.imageUrl,
            quantity: cartItem.quantity,
            subtotal: (product.priceCents * cartItem.quantity) / 100,
            subtotalCents: product.priceCents * cartItem.quantity,
            isInStock,
            availableStock: product.stock
          });
        }
      }
      
      const totals = await cart.calculateTotals();
      
      return {
        id: cart._id.toString(),
        userId: cart.userId.toString(),
        items,
        totalItems: totals.totalItems,
        totalAmount: totals.subtotalCents / 100,
        totalAmountCents: totals.subtotalCents,
        createdAt: cart.updatedAt, // Use updatedAt since createdAt doesn't exist
        updatedAt: cart.updatedAt,
        hasOutOfStockItems,
        hasInsufficientStockItems
      };
      
    } catch (error) {
      throw new Error('Failed to format cart response');
    }
  }
  
  static async checkCartExists(userId: string): Promise<boolean> {
    try {
      const cart = await Cart.findByUserId(userId);
      return !!cart && cart.items.length > 0;
      
    } catch (error) {
      return false;
    }
  }
  
  static async getCartItemCount(userId: string): Promise<number> {
    try {
      const cart = await Cart.findByUserId(userId);
      if (!cart) return 0;
      
      return cart.items.reduce((total, item) => total + item.quantity, 0);
      
    } catch (error) {
      return 0;
    }
  }
  
  static async isProductInCart(userId: string, productId: string): Promise<{ inCart: boolean; quantity: number }> {
    try {
      const cart = await Cart.findByUserId(userId);
      if (!cart) {
        return { inCart: false, quantity: 0 };
      }
      
      const item = cart.items.find(item => item.productId.toString() === productId);
      return {
        inCart: !!item,
        quantity: item ? item.quantity : 0
      };
      
    } catch (error) {
      return { inCart: false, quantity: 0 };
    }
  }
  
  // ============================================================================
  // CART ANALYTICS
  // ============================================================================
  
  static async getCartStatistics(): Promise<{
    totalCarts: number;
    activeCarts: number;
    emptyCarts: number;
    averageItemsPerCart: number;
    averageCartValue: number;
  }> {
    try {
      const allCarts = await Cart.find({});
      const activeCarts = allCarts.filter(cart => cart.items.length > 0);
      const emptyCarts = allCarts.length - activeCarts.length;
      
      let totalItems = 0;
      let totalValue = 0;
      
      for (const cart of activeCarts) {
        const totals = await cart.calculateTotals();
        totalItems += totals.totalItems;
        totalValue += totals.subtotalCents;
      }
      
      return {
        totalCarts: allCarts.length,
        activeCarts: activeCarts.length,
        emptyCarts,
        averageItemsPerCart: activeCarts.length > 0 ? Math.round((totalItems / activeCarts.length) * 100) / 100 : 0,
        averageCartValue: activeCarts.length > 0 ? Math.round((totalValue / activeCarts.length / 100) * 100) / 100 : 0
      };
      
    } catch (error) {
      throw new Error('Failed to get cart statistics');
    }
  }
  
  static async getAbandonedCarts(daysOld: number = 7): Promise<CartResponse[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const abandonedCarts = await Cart.find({
        updatedAt: { $lt: cutoffDate },
        'items.0': { $exists: true } // Has at least one item
      });
      
      const results: CartResponse[] = [];
      for (const cart of abandonedCarts) {
        const formatted = await this.formatCartResponse(cart);
        results.push(formatted);
      }
      
      return results;
      
    } catch (error) {
      throw new Error('Failed to get abandoned carts');
    }
  }
}

export default CartService;