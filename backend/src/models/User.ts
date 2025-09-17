import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcrypt';

// Interface for User document
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
  
  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  toJSON(): Partial<IUser>; // Override to exclude sensitive data
}

// Interface for User model (static methods)
export interface IUserModel extends Model<IUser> {
  findByEmail(email: string): Promise<IUser | null>;
  createUser(userData: { email: string; name: string; password: string }): Promise<IUser>;
}

// User schema definition
const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email: string) {
        // Basic email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      },
      message: 'Please provide a valid email address'
    },
    index: true // For efficient auth lookups
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required'],
    minlength: [60, 'Password hash must be a valid bcrypt hash'] // bcrypt hashes are 60 chars
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: false, // Using custom createdAt field
  collection: 'users',
  // Optimize for common queries
  minimize: false,
  // Ensure virtual fields are included in JSON
  toJSON: {
    transform: function(doc, ret) {
      // Remove sensitive fields from JSON output
      delete ret.passwordHash;
      delete ret.__v;
      // Convert _id to id string for frontend compatibility
      ret.id = ret._id.toString();
      delete ret._id;
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      delete ret.passwordHash;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for efficient queries
userSchema.index({ email: 1 }, { unique: true }); // Auth lookup
userSchema.index({ createdAt: -1 }); // Admin user management

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
  } catch (error) {
    throw new Error('Error comparing passwords');
  }
};

// Static methods
userSchema.statics.findByEmail = function(email: string): Promise<IUser | null> {
  return this.findOne({ email: email.toLowerCase().trim() });
};

userSchema.statics.createUser = async function(userData: { 
  email: string; 
  name: string; 
  password: string 
}): Promise<IUser> {
  const { email, name, password } = userData;
  
  // Validate input
  if (!email || !name || !password) {
    throw new Error('Email, name, and password are required');
  }
  
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  
  // Check if user already exists
  const existingUser = await (this as IUserModel).findByEmail(email);
  if (existingUser) {
    throw new Error('User with this email already exists');
  }
  
  // Hash password
  const saltRounds = 12; // Secure default
  const passwordHash = await bcrypt.hash(password, saltRounds);
  
  // Create and save user
  const user = new this({
    email: email.toLowerCase().trim(),
    name: name.trim(),
    passwordHash
  });
  
  return await user.save();
};

// Pre-save middleware for additional validation
userSchema.pre('save', async function(next) {
  // Only hash password if it's been modified and is not already hashed
  if (this.isModified('passwordHash') && !this.passwordHash.startsWith('$2b$')) {
    // This means a raw password was set instead of a hash
    throw new Error('Password must be hashed before saving. Use createUser static method.');
  }
  
  // Ensure email is lowercase and trimmed
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase().trim();
  }
  
  // Ensure name is trimmed
  if (this.isModified('name')) {
    this.name = this.name.trim();
  }
  
  next();
});

// Post-save middleware for logging (optional)
userSchema.post('save', function(doc) {
  console.log(`User created: ${doc.email} at ${doc.createdAt}`);
});

// Handle unique constraint errors with more user-friendly messages
userSchema.post('save', function(error: any, doc: any, next: any) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    if (error.keyPattern?.email) {
      next(new Error('A user with this email address already exists'));
    } else {
      next(new Error('Duplicate key error'));
    }
  } else {
    next(error);
  }
});

// Validation for password strength (used in createUser)
export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { isValid: false, errors };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password cannot exceed 128 characters');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return { isValid: errors.length === 0, errors };
};

// Email validation utility
export const validateEmail = (email: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
    return { isValid: false, errors };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Please provide a valid email address');
  }
  
  if (email.length > 254) {
    errors.push('Email address is too long');
  }
  
  return { isValid: errors.length === 0, errors };
};

// Name validation utility
export const validateName = (name: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!name || typeof name !== 'string') {
    errors.push('Name is required');
    return { isValid: false, errors };
  }
  
  const trimmedName = name.trim();
  
  if (trimmedName.length < 2) {
    errors.push('Name must be at least 2 characters long');
  }
  
  if (trimmedName.length > 100) {
    errors.push('Name cannot exceed 100 characters');
  }
  
  // Check for valid characters (letters, spaces, hyphens, apostrophes)
  if (!/^[a-zA-Z\s'-]+$/.test(trimmedName)) {
    errors.push('Name can only contain letters, spaces, hyphens, and apostrophes');
  }
  
  return { isValid: errors.length === 0, errors };
};

// Create and export the model
const User = mongoose.model<IUser, IUserModel>('User', userSchema);

export default User;