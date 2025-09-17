import Product, { IProduct, SearchResult, SearchOptions, CreateProductData } from '../models/Product';
import { 
  ProductUpdateData, 
  ProductSearchData,
  validate,
  ProductCreateSchema,
  ProductUpdateSchema,
  ProductSearchSchema,
  StockUpdateSchema
} from '../utils/validation';

// Interfaces for service responses
export interface ProductResponse {
  id: string;
  name: string;
  description: string;
  price: number; // In dollars
  priceCents: number; // In cents
  imageUrl: string;
  stock: number;
  isInStock: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductListResponse {
  products: ProductResponse[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface StockUpdateRequest {
  productId: string;
  newStock: number;
}

export interface BulkStockUpdateRequest {
  updates: StockUpdateRequest[];
}

export interface ProductStatistics {
  totalProducts: number;
  inStockProducts: number;
  outOfStockProducts: number;
  lowStockProducts: number;
  averagePrice: number;
  totalValue: number; // Total inventory value
}

// Service class for product-related operations
export class ProductService {
  
  // ============================================================================
  // PRODUCT CRUD OPERATIONS
  // ============================================================================
  
  static async createProduct(productData: CreateProductData): Promise<ProductResponse> {
    // Validate input data
    const validatedData = validate(ProductCreateSchema, productData) as CreateProductData;
    
    try {
      const product = await Product.createProduct(validatedData);
      return this.formatProductResponse(product);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to create product');
    }
  }
  
  static async getProductById(productId: string): Promise<ProductResponse | null> {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        return null;
      }
      
      return this.formatProductResponse(product);
      
    } catch (error) {
      throw new Error('Failed to get product');
    }
  }
  
  static async updateProduct(productId: string, updateData: ProductUpdateData): Promise<ProductResponse> {
    // Validate input data
    const validatedData = validate(ProductUpdateSchema, updateData);
    
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      // Update allowed fields
      if (validatedData.name !== undefined) {
        product.name = validatedData.name;
      }
      if (validatedData.description !== undefined) {
        product.description = validatedData.description;
      }
      if (validatedData.priceCents !== undefined) {
        product.priceCents = validatedData.priceCents;
      }
      if (validatedData.imageUrl !== undefined) {
        product.imageUrl = validatedData.imageUrl;
      }
      if (validatedData.stock !== undefined) {
        product.stock = validatedData.stock;
      }
      
      await product.save();
      return this.formatProductResponse(product);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to update product');
    }
  }
  
  static async deleteProduct(productId: string): Promise<void> {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      await Product.findByIdAndDelete(productId);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to delete product');
    }
  }
  
  // ============================================================================
  // PRODUCT LISTING AND SEARCH
  // ============================================================================
  
  static async getAllProducts(searchData: Partial<ProductSearchData> = {}): Promise<ProductListResponse> {
    // Set defaults and validate
    const searchParams = {
      page: 1,
      limit: 20,
      sortBy: 'createdAt' as const,
      sortOrder: 'desc' as const,
      inStockOnly: false,
      ...searchData
    };
    
    const validatedData = validate(ProductSearchSchema, searchParams);
    
    try {
      const searchOptions: SearchOptions = {
        page: validatedData.page,
        limit: validatedData.limit,
        sortBy: validatedData.sortBy,
        sortOrder: validatedData.sortOrder,
        minPrice: validatedData.minPrice,
        maxPrice: validatedData.maxPrice,
        inStockOnly: validatedData.inStockOnly
      };
      
      const result = await Product.searchProducts(validatedData.query || '', searchOptions);
      
      return {
        products: result.products.map(product => this.formatProductResponse(product)),
        pagination: {
          page: result.page,
          limit: validatedData.limit,
          totalCount: result.totalCount,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage
        }
      };
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get products');
    }
  }
  
  static async searchProducts(query: string, searchData: Partial<ProductSearchData> = {}): Promise<ProductListResponse> {
    const searchParams = {
      query,
      ...searchData
    };
    
    return this.getAllProducts(searchParams);
  }
  
  static async getProductsByName(name: string): Promise<ProductResponse[]> {
    try {
      const products = await Product.findByName(name);
      return products.map(product => this.formatProductResponse(product));
      
    } catch (error) {
      throw new Error('Failed to search products by name');
    }
  }
  
  static async getFeaturedProducts(limit: number = 10): Promise<ProductResponse[]> {
    try {
      // For now, return recent in-stock products
      // This could be enhanced with a featured flag or ranking algorithm
      const searchResult = await Product.searchProducts('', {
        limit,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        inStockOnly: true
      });
      
      return searchResult.products.map(product => this.formatProductResponse(product));
      
    } catch (error) {
      throw new Error('Failed to get featured products');
    }
  }
  
  // ============================================================================
  // STOCK MANAGEMENT
  // ============================================================================
  
  static async getInStockProducts(): Promise<ProductResponse[]> {
    try {
      const products = await Product.findInStock();
      return products.map(product => this.formatProductResponse(product));
      
    } catch (error) {
      throw new Error('Failed to get in-stock products');
    }
  }
  
  static async getLowStockProducts(threshold: number = 10): Promise<ProductResponse[]> {
    try {
      const products = await Product.findLowStock(threshold);
      return products.map(product => this.formatProductResponse(product));
      
    } catch (error) {
      throw new Error('Failed to get low-stock products');
    }
  }
  
  static async updateStock(productId: string, newStock: number): Promise<ProductResponse> {
    // Validate input
    const validatedData = validate(StockUpdateSchema, { productId, newStock });
    
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      await product.updateStock(newStock);
      return this.formatProductResponse(product);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to update stock');
    }
  }
  
  static async decreaseStock(productId: string, quantity: number): Promise<ProductResponse> {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      await product.decreaseStock(quantity);
      return this.formatProductResponse(product);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to decrease stock');
    }
  }
  
  static async increaseStock(productId: string, quantity: number): Promise<ProductResponse> {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      await product.increaseStock(quantity);
      return this.formatProductResponse(product);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to increase stock');
    }
  }
  
  static async bulkUpdateStock(updates: BulkStockUpdateRequest): Promise<ProductResponse[]> {
    try {
      const updatedProducts: ProductResponse[] = [];
      
      // Process updates sequentially to avoid race conditions
      for (const update of updates.updates) {
        const updatedProduct = await this.updateStock(update.productId, update.newStock);
        updatedProducts.push(updatedProduct);
      }
      
      return updatedProducts;
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to bulk update stock');
    }
  }
  
  // ============================================================================
  // PRICING OPERATIONS
  // ============================================================================
  
  static async updatePricing(productId: string, priceCents: number): Promise<ProductResponse> {
    try {
      const product = await Product.updatePricing(productId, priceCents);
      return this.formatProductResponse(product);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to update pricing');
    }
  }
  
  static async bulkUpdatePricing(updates: Array<{ productId: string; priceCents: number }>): Promise<ProductResponse[]> {
    try {
      const updatedProducts: ProductResponse[] = [];
      
      for (const update of updates) {
        const updatedProduct = await this.updatePricing(update.productId, update.priceCents);
        updatedProducts.push(updatedProduct);
      }
      
      return updatedProducts;
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to bulk update pricing');
    }
  }
  
  // ============================================================================
  // ANALYTICS AND STATISTICS
  // ============================================================================
  
  static async getProductStatistics(): Promise<ProductStatistics> {
    try {
      const [allProducts, inStockProducts, lowStockProducts] = await Promise.all([
        Product.find({}),
        Product.findInStock(),
        Product.findLowStock(10)
      ]);
      
      const totalProducts = allProducts.length;
      const inStockCount = inStockProducts.length;
      const outOfStockCount = totalProducts - inStockCount;
      const lowStockCount = lowStockProducts.length;
      
      // Calculate average price and total inventory value
      let totalPriceCents = 0;
      let totalValue = 0;
      
      allProducts.forEach(product => {
        totalPriceCents += product.priceCents;
        totalValue += product.priceCents * product.stock;
      });
      
      const averagePrice = totalProducts > 0 ? (totalPriceCents / totalProducts) / 100 : 0;
      const totalInventoryValue = totalValue / 100;
      
      return {
        totalProducts,
        inStockProducts: inStockCount,
        outOfStockProducts: outOfStockCount,
        lowStockProducts: lowStockCount,
        averagePrice: Math.round(averagePrice * 100) / 100,
        totalValue: Math.round(totalInventoryValue * 100) / 100
      };
      
    } catch (error) {
      throw new Error('Failed to get product statistics');
    }
  }
  
  static async getTopSellingProducts(limit: number = 10): Promise<ProductResponse[]> {
    // This would require order/sales data analysis
    // For now, return popular products (most recently created)
    try {
      const searchResult = await Product.searchProducts('', {
        limit,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        inStockOnly: true
      });
      
      return searchResult.products.map(product => this.formatProductResponse(product));
      
    } catch (error) {
      throw new Error('Failed to get top selling products');
    }
  }
  
  static async getProductsByPriceRange(minPrice: number, maxPrice: number): Promise<ProductResponse[]> {
    try {
      const searchResult = await Product.searchProducts('', {
        minPrice,
        maxPrice,
        limit: 100 // Get all products in range
      });
      
      return searchResult.products.map(product => this.formatProductResponse(product));
      
    } catch (error) {
      throw new Error('Failed to get products by price range');
    }
  }
  
  // ============================================================================
  // STOCK VALIDATION
  // ============================================================================
  
  static async validateStockAvailability(productId: string, requestedQuantity: number): Promise<{ 
    isAvailable: boolean; 
    availableStock: number; 
    productExists: boolean;
  }> {
    try {
      const product = await Product.findById(productId);
      
      if (!product) {
        return {
          isAvailable: false,
          availableStock: 0,
          productExists: false
        };
      }
      
      return {
        isAvailable: product.stock >= requestedQuantity,
        availableStock: product.stock,
        productExists: true
      };
      
    } catch (error) {
      throw new Error('Failed to validate stock availability');
    }
  }
  
  static async validateMultipleStockAvailability(
    items: Array<{ productId: string; quantity: number }>
  ): Promise<{
    isValid: boolean;
    issues: Array<{
      productId: string;
      requestedQuantity: number;
      availableStock: number;
      issue: string;
    }>;
  }> {
    try {
      const issues: Array<{
        productId: string;
        requestedQuantity: number;
        availableStock: number;
        issue: string;
      }> = [];
      
      for (const item of items) {
        const validation = await this.validateStockAvailability(item.productId, item.quantity);
        
        if (!validation.productExists) {
          issues.push({
            productId: item.productId,
            requestedQuantity: item.quantity,
            availableStock: 0,
            issue: 'Product not found'
          });
        } else if (!validation.isAvailable) {
          issues.push({
            productId: item.productId,
            requestedQuantity: item.quantity,
            availableStock: validation.availableStock,
            issue: 'Insufficient stock'
          });
        }
      }
      
      return {
        isValid: issues.length === 0,
        issues
      };
      
    } catch (error) {
      throw new Error('Failed to validate multiple stock availability');
    }
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  private static formatProductResponse(product: IProduct): ProductResponse {
    return {
      id: product._id.toString(),
      name: product.name,
      description: product.description,
      price: product.priceCents / 100,
      priceCents: product.priceCents,
      imageUrl: product.imageUrl,
      stock: product.stock,
      isInStock: product.stock > 0,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };
  }
  
  static async getProductsForCart(productIds: string[]): Promise<Map<string, ProductResponse>> {
    try {
      const products = await Product.find({ _id: { $in: productIds } });
      const productMap = new Map<string, ProductResponse>();
      
      products.forEach(product => {
        productMap.set(product._id.toString(), this.formatProductResponse(product));
      });
      
      return productMap;
      
    } catch (error) {
      throw new Error('Failed to get products for cart');
    }
  }
  
  static async checkProductExists(productId: string): Promise<boolean> {
    try {
      const product = await Product.findById(productId);
      return !!product;
      
    } catch (error) {
      return false;
    }
  }
  
  // ============================================================================
  // ADMIN OPERATIONS
  // ============================================================================
  
  static async adminGetAllProducts(): Promise<ProductResponse[]> {
    try {
      const products = await Product.find({}).sort({ createdAt: -1 });
      return products.map(product => this.formatProductResponse(product));
      
    } catch (error) {
      throw new Error('Failed to get all products for admin');
    }
  }
  
  static async adminBulkDelete(productIds: string[]): Promise<number> {
    try {
      const result = await Product.deleteMany({ _id: { $in: productIds } });
      return result.deletedCount || 0;
      
    } catch (error) {
      throw new Error('Failed to bulk delete products');
    }
  }
}

export default ProductService;