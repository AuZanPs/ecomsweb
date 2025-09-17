import mongoose from 'mongoose';

// Global variables for connection caching in serverless environments
declare global {
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  } | undefined;
}

// Initialize the global mongoose cache object if it doesn't exist
if (!global.mongooseCache) {
  global.mongooseCache = { conn: null, promise: null };
}

export const connectMongo = async (): Promise<boolean> => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecommerce';
    
    // In serverless environments, reuse existing connection if available
    if (global.mongooseCache?.conn) {
      console.log('Using cached MongoDB connection');
      return true;
    }

    // If there's a connection promise in progress, wait for it
    if (global.mongooseCache?.promise) {
      console.log('Waiting for existing MongoDB connection promise');
      global.mongooseCache.conn = await global.mongooseCache.promise;
      return true;
    }

    // Create new connection
    console.log('Creating new MongoDB connection');
    const opts = {
      bufferCommands: false, // Disable mongoose buffering for serverless
    };

    if (!global.mongooseCache) {
      global.mongooseCache = { conn: null, promise: null };
    }

    global.mongooseCache.promise = mongoose.connect(uri, opts);
    global.mongooseCache.conn = await global.mongooseCache.promise;
    
    console.log('MongoDB connected successfully');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('MongoDB connection failed, running without database:', errorMessage);
    
    // Reset the promise on failure so we can retry later
    if (global.mongooseCache) {
      global.mongooseCache.promise = null;
    }
    return false;
  }
};
