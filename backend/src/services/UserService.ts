import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User, { IUser } from '../models/User';

// Load environment variables first
dotenv.config();

import { 
  UserRegistrationData, 
  UserLoginData, 
  UserUpdateData, 
  ChangePasswordData,
  validate,
  UserRegistrationSchema,
  UserLoginSchema,
  UserUpdateSchema,
  ChangePasswordSchema
} from '../utils/validation';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

// Debug logging for JWT configuration
if (process.env.NODE_ENV !== 'production') {
  console.log('JWT_SECRET loaded:', JWT_SECRET ? 'yes' : 'no');
  console.log('JWT_EXPIRES_IN:', JWT_EXPIRES_IN);
}

// Ensure types are correct for JWT
const JWT_SECRET_KEY = JWT_SECRET;
const JWT_EXPIRY = JWT_EXPIRES_IN;
const JWT_REFRESH_EXPIRY = JWT_REFRESH_EXPIRES_IN;

// Interfaces for service responses
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
  };
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthResponse {}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface TokenValidationResult {
  isValid: boolean;
  payload?: TokenPayload;
  error?: string;
}

// Service class for user-related operations
export class UserService {
  
  // ============================================================================
  // USER REGISTRATION
  // ============================================================================
  
  static async register(userData: UserRegistrationData): Promise<AuthResponse> {
    // Validate input data
    const validatedData = validate(UserRegistrationSchema, userData);
    
    const { email, name, password } = validatedData;
    
    try {
      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        throw new Error('A user with this email address already exists');
      }
      
      // Create new user using the model's static method
      const user = await User.createUser({ email, name, password });
      
      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user._id.toString(), user.email);
      
      return {
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          createdAt: user.createdAt
        },
        accessToken,
        refreshToken
      };
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to register user');
    }
  }
  
  // ============================================================================
  // USER AUTHENTICATION
  // ============================================================================
  
  static async authenticate(loginData: UserLoginData): Promise<LoginResponse> {
    // Validate input data
    const validatedData = validate(UserLoginSchema, loginData);
    
    const { email, password } = validatedData;
    
    try {
      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        throw new Error('Invalid email or password');
      }
      
      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }
      
      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user._id.toString(), user.email);
      
      return {
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          createdAt: user.createdAt
        },
        accessToken,
        refreshToken
      };
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Authentication failed');
    }
  }
  
  // ============================================================================
  // USER PROFILE MANAGEMENT
  // ============================================================================
  
  static async getProfile(userId: string): Promise<UserProfile> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      };
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get user profile');
    }
  }
  
  static async updateProfile(userId: string, updateData: UserUpdateData): Promise<UserProfile> {
    // Validate input data
    const validatedData = validate(UserUpdateSchema, updateData);
    
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Update allowed fields
      if (validatedData.name !== undefined) {
        user.name = validatedData.name;
      }
      
      if (validatedData.email !== undefined) {
        // Check if new email is already taken by another user
        const existingUser = await User.findByEmail(validatedData.email);
        if (existingUser && existingUser._id.toString() !== userId) {
          throw new Error('Email address is already in use');
        }
        user.email = validatedData.email;
      }
      
      await user.save();
      
      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      };
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to update user profile');
    }
  }
  
  static async changePassword(userId: string, passwordData: ChangePasswordData): Promise<void> {
    // Validate input data
    const validatedData = validate(ChangePasswordSchema, passwordData);
    
    const { currentPassword, newPassword } = validatedData;
    
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }
      
      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
      
      // Update password
      user.passwordHash = newPasswordHash;
      await user.save();
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to change password');
    }
  }
  
  // ============================================================================
  // TOKEN MANAGEMENT
  // ============================================================================
  
  static generateTokens(userId: string, email: string): { accessToken: string; refreshToken: string } {
    const accessTokenPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
      userId,
      email,
      type: 'access'
    };
    
    const refreshTokenPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
      userId,
      email,
      type: 'refresh'
    };
    
    const accessToken = jwt.sign(accessTokenPayload, JWT_SECRET_KEY as any, {
      expiresIn: JWT_EXPIRY as any
    });
    
    const refreshToken = jwt.sign(refreshTokenPayload, JWT_SECRET_KEY as any, {
      expiresIn: JWT_REFRESH_EXPIRY as any
    });
    
    return { accessToken, refreshToken };
  }
  
  static validateToken(token: string): TokenValidationResult {
    try {
      const decoded = jwt.verify(token, JWT_SECRET_KEY) as TokenPayload;
      
      return {
        isValid: true,
        payload: decoded
      };
      
    } catch (error) {
      let errorMessage = 'Invalid token';
      
      if (error instanceof jwt.TokenExpiredError) {
        errorMessage = 'Token has expired';
      } else if (error instanceof jwt.JsonWebTokenError) {
        errorMessage = 'Invalid token format';
      } else if (error instanceof jwt.NotBeforeError) {
        errorMessage = 'Token not active yet';
      }
      
      return {
        isValid: false,
        error: errorMessage
      };
    }
  }
  
  static async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const validation = this.validateToken(refreshToken);
    
    if (!validation.isValid || !validation.payload) {
      throw new Error(validation.error || 'Invalid refresh token');
    }
    
    if (validation.payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    try {
      // Verify user still exists
      const user = await User.findById(validation.payload.userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Generate new tokens
      return this.generateTokens(user._id.toString(), user.email);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to refresh token');
    }
  }
  
  // ============================================================================
  // USER LOOKUP & ADMIN FUNCTIONS
  // ============================================================================
  
  static async findUserByEmail(email: string): Promise<UserProfile | null> {
    try {
      const user = await User.findByEmail(email);
      if (!user) {
        return null;
      }
      
      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      };
      
    } catch (error) {
      throw new Error('Failed to find user by email');
    }
  }
  
  static async findUserById(userId: string): Promise<UserProfile | null> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return null;
      }
      
      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      };
      
    } catch (error) {
      throw new Error('Failed to find user by ID');
    }
  }
  
  static async deleteUser(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      await User.findByIdAndDelete(userId);
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to delete user');
    }
  }
  
  // ============================================================================
  // PASSWORD UTILITIES
  // ============================================================================
  
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }
  
  static async comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
  
  // ============================================================================
  // EMAIL VERIFICATION (for future implementation)
  // ============================================================================
  
  static generateVerificationToken(userId: string, email: string): string {
    const payload = {
      userId,
      email,
      type: 'email_verification',
      purpose: 'verify_email'
    };
    
    return jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: '24h' });
  }
  
  static validateVerificationToken(token: string): TokenValidationResult {
    try {
      const decoded = jwt.verify(token, JWT_SECRET_KEY) as any;
      
      if (decoded.type !== 'email_verification') {
        return {
          isValid: false,
          error: 'Invalid token type'
        };
      }
      
      return {
        isValid: true,
        payload: decoded
      };
      
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid verification token'
      };
    }
  }
  
  // ============================================================================
  // PASSWORD RESET (for future implementation)
  // ============================================================================
  
  static generatePasswordResetToken(userId: string, email: string): string {
    const payload = {
      userId,
      email,
      type: 'password_reset',
      purpose: 'reset_password'
    };
    
    return jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: '1h' });
  }
  
  static validatePasswordResetToken(token: string): TokenValidationResult {
    try {
      const decoded = jwt.verify(token, JWT_SECRET_KEY) as any;
      
      if (decoded.type !== 'password_reset') {
        return {
          isValid: false,
          error: 'Invalid token type'
        };
      }
      
      return {
        isValid: true,
        payload: decoded
      };
      
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid reset token'
      };
    }
  }
  
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const validation = this.validatePasswordResetToken(token);
    
    if (!validation.isValid || !validation.payload) {
      throw new Error(validation.error || 'Invalid reset token');
    }
    
    try {
      const user = await User.findById(validation.payload.userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Validate new password
      validate(
        UserRegistrationSchema.pick({ password: true }), 
        { password: newPassword }
      );
      
      // Hash and update password
      const newPasswordHash = await this.hashPassword(newPassword);
      user.passwordHash = newPasswordHash;
      await user.save();
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to reset password');
    }
  }
  
  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================
  
  static async createSession(userId: string): Promise<{ sessionId: string; expiresAt: Date }> {
    // For now, we'll use JWT tokens for session management
    // In the future, this could be enhanced with Redis or database-based sessions
    const sessionPayload = {
      userId,
      type: 'session',
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    const sessionToken = jwt.sign(sessionPayload, JWT_SECRET_KEY as any, { expiresIn: JWT_EXPIRY as any });
    const decoded = jwt.decode(sessionToken) as any;
    const expiresAt = new Date(decoded.exp * 1000);
    
    return {
      sessionId: sessionToken,
      expiresAt
    };
  }
  
  static async validateSession(sessionId: string): Promise<{ isValid: boolean; userId?: string }> {
    const validation = this.validateToken(sessionId);
    
    if (!validation.isValid || !validation.payload) {
      return { isValid: false };
    }
    
    // Verify user still exists
    try {
      const user = await User.findById(validation.payload.userId);
      if (!user) {
        return { isValid: false };
      }
      
      return {
        isValid: true,
        userId: user._id.toString()
      };
      
    } catch (error) {
      return { isValid: false };
    }
  }
  
  static async revokeSession(sessionId: string): Promise<void> {
    // For JWT-based sessions, we can't directly revoke them
    // In a production environment, you'd want to maintain a blacklist
    // or use a database/Redis-based session store
    console.log(`Session revoked: ${sessionId}`);
  }
}

export default UserService;