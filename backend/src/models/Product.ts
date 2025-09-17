import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface for Product document
export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Virtual getters
  price: number; // Price in dollars (priceCents / 100)
  isInStock: boolean;
  
  // Instance methods
  updateStock(newStock: number): Promise<IProduct>;
  decreaseStock(quantity: number): Promise<IProduct>;
  increaseStock(quantity: number): Promise<IProduct>;
  toJSON(): Partial<IProduct>;
}

// Interface for Product model (static methods)
export interface IProductModel extends Model<IProduct> {
  findByName(name: string): Promise<IProduct[]>;
  searchProducts(query: string, options?: SearchOptions): Promise<SearchResult>;
  findInStock(): Promise<IProduct[]>;
  findLowStock(threshold?: number): Promise<IProduct[]>;
  createProduct(productData: CreateProductData): Promise<IProduct>;
  updatePricing(productId: string, priceCents: number): Promise<IProduct>;
}

// Helper interfaces
export interface SearchOptions {
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'price' | 'createdAt' | 'stock';
  sortOrder?: 'asc' | 'desc';
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
}

export interface SearchResult {
  products: IProduct[];
  totalCount: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface CreateProductData {
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  stock: number;
}

// Product schema definition
const productSchema = new Schema<IProduct>({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    minlength: [2, 'Product name must be at least 2 characters long'],
    maxlength: [200, 'Product name cannot exceed 200 characters'],
    index: true // For search queries
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true,
    minlength: [10, 'Product description must be at least 10 characters long'],
    maxlength: [2000, 'Product description cannot exceed 2000 characters']
  },
  priceCents: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [1, 'Product price must be greater than 0'],
    max: [100000000, 'Product price cannot exceed $1,000,000'], // 100 million cents
    validate: {
      validator: function(price: number) {
        return Number.isInteger(price) && price > 0;
      },
      message: 'Price must be a positive integer representing cents'
    }
  },
  imageUrl: {
    type: String,
    required: [true, 'Product image URL is required'],
    trim: true,
    validate: {
      validator: function(url: string) {
        // Basic URL validation
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Please provide a valid image URL'
    }
  },
  stock: {
    type: Number,
    required: [true, 'Product stock is required'],
    min: [0, 'Stock cannot be negative'],
    max: [1000000, 'Stock cannot exceed 1,000,000 units'],
    validate: {
      validator: function(stock: number) {
        return Number.isInteger(stock) && stock >= 0;
      },
      message: 'Stock must be a non-negative integer'
    },
    index: true // For stock level queries
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true // For recent product queries
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: false, // Using custom createdAt/updatedAt
  collection: 'products',
  minimize: false,
  toJSON: {
    transform: function(doc, ret) {
      // Add computed fields and clean up response
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      
      // Add virtual price in dollars
      ret.price = ret.priceCents / 100;
      ret.isInStock = ret.stock > 0;
      
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for efficient queries
productSchema.index({ name: 'text', description: 'text' }); // Full-text search
productSchema.index({ name: 1 }); // Name-based search
productSchema.index({ createdAt: -1 }); // Recent products
productSchema.index({ priceCents: 1 }); // Price-based filtering
productSchema.index({ stock: 1 }); // Stock level queries
productSchema.index({ createdAt: -1, priceCents: 1 }); // Compound index for sorting

// Virtual for price in dollars
productSchema.virtual('price').get(function() {
  return this.priceCents / 100;
});

// Virtual for stock status
productSchema.virtual('isInStock').get(function() {
  return this.stock > 0;
});

// Instance methods
productSchema.methods.updateStock = async function(newStock: number): Promise<IProduct> {
  if (!Number.isInteger(newStock) || newStock < 0) {
    throw new Error('Stock must be a non-negative integer');
  }
  
  this.stock = newStock;
  this.updatedAt = new Date();
  return await this.save();
};

productSchema.methods.decreaseStock = async function(quantity: number): Promise<IProduct> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive integer');
  }
  
  if (this.stock < quantity) {
    throw new Error(`Insufficient stock. Available: ${this.stock}, Requested: ${quantity}`);
  }
  
  this.stock -= quantity;
  this.updatedAt = new Date();
  return await this.save();
};

productSchema.methods.increaseStock = async function(quantity: number): Promise<IProduct> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive integer');
  }
  
  this.stock += quantity;
  this.updatedAt = new Date();
  return await this.save();
};

// Static methods
productSchema.statics.findByName = function(name: string): Promise<IProduct[]> {
  return this.find({ 
    name: { $regex: name, $options: 'i' } 
  }).sort({ createdAt: -1 });
};

productSchema.statics.searchProducts = async function(
  query: string, 
  options: SearchOptions = {}
): Promise<SearchResult> {
  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    minPrice,
    maxPrice,
    inStockOnly = false
  } = options;
  
  // Build search criteria
  const searchCriteria: any = {};
  
  // Text search
  if (query && query.trim()) {
    searchCriteria.$text = { $search: query.trim() };
  }
  
  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    searchCriteria.priceCents = {};
    if (minPrice !== undefined) {
      searchCriteria.priceCents.$gte = Math.round(minPrice * 100);
    }
    if (maxPrice !== undefined) {
      searchCriteria.priceCents.$lte = Math.round(maxPrice * 100);
    }
  }
  
  // Stock filter
  if (inStockOnly) {
    searchCriteria.stock = { $gt: 0 };
  }
  
  // Build sort criteria
  const sortCriteria: any = {};
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  
  switch (sortBy) {
    case 'name':
      sortCriteria.name = sortDirection;
      break;
    case 'price':
      sortCriteria.priceCents = sortDirection;
      break;
    case 'stock':
      sortCriteria.stock = sortDirection;
      break;
    case 'createdAt':
    default:
      sortCriteria.createdAt = sortDirection;
      break;
  }
  
  // Add text score sorting if text search is used
  if (query && query.trim()) {
    sortCriteria.score = { $meta: 'textScore' };
  }
  
  // Calculate pagination
  const skip = (page - 1) * limit;
  
  // Execute queries
  const [products, totalCount] = await Promise.all([
    this.find(searchCriteria)
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit),
    this.countDocuments(searchCriteria)
  ]);
  
  const totalPages = Math.ceil(totalCount / limit);
  
  return {
    products,
    totalCount,
    page,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
};

productSchema.statics.findInStock = function(): Promise<IProduct[]> {
  return this.find({ stock: { $gt: 0 } }).sort({ createdAt: -1 });
};

productSchema.statics.findLowStock = function(threshold: number = 10): Promise<IProduct[]> {
  return this.find({ 
    stock: { $gt: 0, $lte: threshold } 
  }).sort({ stock: 1 });
};

productSchema.statics.createProduct = async function(productData: CreateProductData): Promise<IProduct> {
  const { name, description, priceCents, imageUrl, stock } = productData;
  
  // Validate input
  if (!name || !description || !imageUrl) {
    throw new Error('Name, description, and image URL are required');
  }
  
  if (!Number.isInteger(priceCents) || priceCents <= 0) {
    throw new Error('Price must be a positive integer in cents');
  }
  
  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error('Stock must be a non-negative integer');
  }
  
  // Check for duplicate name
  const existingProduct = await this.findOne({ 
    name: { $regex: `^${name.trim()}$`, $options: 'i' } 
  });
  
  if (existingProduct) {
    throw new Error('A product with this name already exists');
  }
  
  // Create and save product
  const product = new this({
    name: name.trim(),
    description: description.trim(),
    priceCents,
    imageUrl: imageUrl.trim(),
    stock
  });
  
  return await product.save();
};

productSchema.statics.updatePricing = async function(
  productId: string, 
  priceCents: number
): Promise<IProduct> {
  if (!Number.isInteger(priceCents) || priceCents <= 0) {
    throw new Error('Price must be a positive integer in cents');
  }
  
  const product = await this.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }
  
  product.priceCents = priceCents;
  product.updatedAt = new Date();
  
  return await product.save();
};

// Pre-save middleware
productSchema.pre('save', function(next) {
  // Update the updatedAt timestamp
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  
  // Ensure string fields are trimmed
  if (this.isModified('name')) {
    this.name = this.name.trim();
  }
  if (this.isModified('description')) {
    this.description = this.description.trim();
  }
  if (this.isModified('imageUrl')) {
    this.imageUrl = this.imageUrl.trim();
  }
  
  next();
});

// Post-save middleware for logging
productSchema.post('save', function(doc) {
  if (this.isNew) {
    console.log(`Product created: ${doc.name} at ${doc.createdAt}`);
  } else {
    console.log(`Product updated: ${doc.name} at ${doc.updatedAt}`);
  }
});

// Validation utilities
export const validateProductName = (name: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!name || typeof name !== 'string') {
    errors.push('Product name is required');
    return { isValid: false, errors };
  }
  
  const trimmedName = name.trim();
  
  if (trimmedName.length < 2) {
    errors.push('Product name must be at least 2 characters long');
  }
  
  if (trimmedName.length > 200) {
    errors.push('Product name cannot exceed 200 characters');
  }
  
  return { isValid: errors.length === 0, errors };
};

export const validateProductPrice = (priceCents: number): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (typeof priceCents !== 'number') {
    errors.push('Price must be a number');
    return { isValid: false, errors };
  }
  
  if (!Number.isInteger(priceCents)) {
    errors.push('Price must be an integer (in cents)');
  }
  
  if (priceCents <= 0) {
    errors.push('Price must be greater than 0');
  }
  
  if (priceCents > 100000000) {
    errors.push('Price cannot exceed $1,000,000');
  }
  
  return { isValid: errors.length === 0, errors };
};

export const validateProductStock = (stock: number): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (typeof stock !== 'number') {
    errors.push('Stock must be a number');
    return { isValid: false, errors };
  }
  
  if (!Number.isInteger(stock)) {
    errors.push('Stock must be an integer');
  }
  
  if (stock < 0) {
    errors.push('Stock cannot be negative');
  }
  
  if (stock > 1000000) {
    errors.push('Stock cannot exceed 1,000,000 units');
  }
  
  return { isValid: errors.length === 0, errors };
};

// Create and export the model
const Product = mongoose.model<IProduct, IProductModel>('Product', productSchema);

export default Product;