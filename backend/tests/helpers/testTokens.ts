import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

interface TestUser {
  _id: string;
  email: string;
  name: string;
}

export class TestTokenHelper {
  private static JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

  static generateValidToken(userId: string, email: string): string {
    const payload = {
      userId,
      email,
      type: 'access'
    };
    
    return jwt.sign(payload, this.JWT_SECRET, { expiresIn: '1h' });
  }

  static generateExpiredToken(userId: string, email: string): string {
    const payload = {
      userId,
      email,
      type: 'access'
    };
    
    return jwt.sign(payload, this.JWT_SECRET, { expiresIn: '-1h' });
  }

  static generateInvalidToken(): string {
    return 'invalid.jwt.token';
  }

  // Common test users
  static getTestUserTokens() {
    const testUsers = {
      'valid-user': {
        id: new ObjectId().toString(),
        email: 'valid@example.com',
        name: 'Valid User'
      },
      'admin-user': {
        id: new ObjectId().toString(),
        email: 'admin@example.com',
        name: 'Admin User'
      },
      'user-with-cart': {
        id: new ObjectId().toString(),
        email: 'cart-user@example.com',
        name: 'Cart User'
      },
      'user-with-orders': {
        id: new ObjectId().toString(),
        email: 'orders-user@example.com',
        name: 'Orders User'
      },
      'order-owner': {
        id: new ObjectId().toString(),
        email: 'owner@example.com',
        name: 'Order Owner'
      },
      'different-user': {
        id: new ObjectId().toString(),
        email: 'different@example.com',
        name: 'Different User'
      },
      'user-with-out-of-stock-cart': {
        id: new ObjectId().toString(),
        email: 'outofstock@example.com',
        name: 'Out of Stock User'
      }
    };

    const tokens: Record<string, string> = {};
    
    Object.entries(testUsers).forEach(([key, user]) => {
      tokens[`${key}-token`] = this.generateValidToken(user.id, user.email);
    });

    return { users: testUsers, tokens };
  }
}