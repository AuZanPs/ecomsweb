#!/usr/bin/env node

/**
 * Database Indexing Migration Script
 * 
 * This script ensures all required database indexes are created for optimal query performance.
 * Run this script after database setup or when deploying to production.
 * 
 * Usage:
 * npm run ensure-indexes
 * or
 * npx ts-node src/scripts/ensureIndexes.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import all models to register their schemas and indexes
import '../models/User';
import '../models/Product';
import '../models/Cart';
import '../models/Order';
import '../models/PaymentEvent';

interface IndexResult {
  collection: string;
  indexes: string[];
  success: boolean;
  error?: string;
}

/**
 * Connect to MongoDB
 */
async function connectToDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce-test';
  
  console.log('🔌 Connecting to MongoDB...');
  console.log(`📍 URI: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials
  
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

/**
 * Ensure indexes for a specific collection
 */
async function ensureIndexesForCollection(modelName: string): Promise<IndexResult> {
  try {
    const model = mongoose.model(modelName);
    const collection = model.collection;
    
    console.log(`\n📊 Processing collection: ${collection.collectionName}`);
    
    // Get existing indexes
    const existingIndexes = await collection.listIndexes().toArray();
    console.log(`   Current indexes: ${existingIndexes.length}`);
    
    // Ensure all schema-defined indexes are created
    await model.ensureIndexes();
    
    // Get updated indexes
    const updatedIndexes = await collection.listIndexes().toArray();
    const indexNames = updatedIndexes.map(idx => idx.name);
    
    console.log(`   ✅ Indexes ensured: ${updatedIndexes.length}`);
    console.log(`   📋 Index names: ${indexNames.join(', ')}`);
    
    return {
      collection: collection.collectionName,
      indexes: indexNames,
      success: true
    };
  } catch (error) {
    console.error(`   ❌ Error ensuring indexes for ${modelName}:`, error);
    return {
      collection: modelName,
      indexes: [],
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Create additional performance indexes not covered by schemas
 */
async function createAdditionalIndexes(): Promise<void> {
  console.log('\n🚀 Creating additional performance indexes...');
  
  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }
    
    // Additional compound indexes for common query patterns
    const additionalIndexes: Array<{
      collection: string;
      index: { [key: string]: 1 | -1 };
      options: { name: string; sparse?: boolean };
      description: string;
    }> = [
      {
        collection: 'orders',
        index: { userId: 1, orderNumber: 1 },
        options: { name: 'userId_orderNumber_compound' },
        description: 'User-specific order lookups by order number'
      },
      {
        collection: 'orders', 
        index: { paymentIntentId: 1 },
        options: { sparse: true, name: 'paymentIntentId_sparse' },
        description: 'Payment intent lookups for webhooks'
      },
      {
        collection: 'products',
        index: { stock: 1, priceCents: 1 },
        options: { name: 'stock_price_compound' },
        description: 'In-stock products with price filtering'
      },
      {
        collection: 'paymentevents',
        index: { orderId: 1, eventType: 1, createdAt: -1 },
        options: { name: 'order_event_chronological' },
        description: 'Order payment event history'
      }
    ];
    
    for (const indexSpec of additionalIndexes) {
      try {
        const collection = db.collection(indexSpec.collection);
        
        // Check if index already exists
        const existingIndexes = await collection.listIndexes().toArray();
        const indexExists = existingIndexes.some(idx => idx.name === indexSpec.options.name);
        
        if (indexExists) {
          console.log(`   ⏭️  Index '${indexSpec.options.name}' already exists on ${indexSpec.collection}`);
          continue;
        }
        
        await collection.createIndex(indexSpec.index, indexSpec.options);
        console.log(`   ✅ Created index '${indexSpec.options.name}' on ${indexSpec.collection}`);
        console.log(`      📝 Description: ${indexSpec.description}`);
      } catch (error) {
        console.warn(`   ⚠️  Warning: Could not create index '${indexSpec.options.name}':`, error instanceof Error ? error.message : error);
      }
    }
  } catch (error) {
    console.error('❌ Error creating additional indexes:', error);
  }
}

/**
 * Generate index performance report
 */
async function generateIndexReport(results: IndexResult[]): Promise<void> {
  console.log('\n📊 INDEX PERFORMANCE REPORT');
  console.log('='.repeat(60));
  
  let totalIndexes = 0;
  let successfulCollections = 0;
  
  for (const result of results) {
    if (result.success) {
      successfulCollections++;
      totalIndexes += result.indexes.length;
      console.log(`\n✅ ${result.collection.toUpperCase()}`);
      console.log(`   Indexes: ${result.indexes.length}`);
      console.log(`   Names: ${result.indexes.join(', ')}`);
    } else {
      console.log(`\n❌ ${result.collection.toUpperCase()}`);
      console.log(`   Error: ${result.error}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`📈 SUMMARY:`);
  console.log(`   Collections processed: ${results.length}`);
  console.log(`   Successful: ${successfulCollections}`);
  console.log(`   Total indexes: ${totalIndexes}`);
  console.log(`   Success rate: ${((successfulCollections / results.length) * 100).toFixed(1)}%`);
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    console.log('🏗️  E-Commerce Database Index Optimization');
    console.log('='.repeat(50));
    
    // Connect to database
    await connectToDatabase();
    
    // List of all models to process
    const models = ['User', 'Product', 'Cart', 'Order', 'PaymentEvent'];
    
    // Ensure indexes for all collections
    console.log('\n🔧 Ensuring schema-defined indexes...');
    const results: IndexResult[] = [];
    
    for (const modelName of models) {
      const result = await ensureIndexesForCollection(modelName);
      results.push(result);
    }
    
    // Create additional performance indexes
    await createAdditionalIndexes();
    
    // Generate report
    await generateIndexReport(results);
    
    console.log('\n🎉 Index optimization completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Index optimization failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the script if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main as ensureIndexes };