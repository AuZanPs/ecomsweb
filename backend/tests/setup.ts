import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../src/models/User';
import { TestTokenHelper } from './helpers/testTokens';

// Load test environment variables
dotenv.config({ path: '.env.test' });

let mongoServer: MongoMemoryServer;

// Global test data
export let testTokens: Record<string, string> = {};
export let testUsers: Record<string, any> = {};

// Setup test database connection
beforeAll(async () => {
  // Close any existing connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri, {
    maxPoolSize: 1, // Limit pool size for tests
    socketTimeoutMS: 0,
    connectTimeoutMS: 30000,
  });

  // Create test users and tokens
  const { users, tokens } = TestTokenHelper.getTestUserTokens();
  testUsers = users;
  testTokens = tokens;

  // Create actual users in database for authentication to work
  for (const [key, userData] of Object.entries(users)) {
    try {
      const user = new User({
        _id: userData.id,
        email: userData.email,
        name: userData.name,
        password: 'testPassword123!' // This will be hashed automatically
      });
      await user.save();
    } catch (error) {
      // User might already exist, ignore error
    }
  }
});

// Clean up after each test
afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      if (collection) {
        await collection.deleteMany({});
      }
    }
  }
});

// Close database connection after all tests
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Increase timeout for database operations
jest.setTimeout(60000);