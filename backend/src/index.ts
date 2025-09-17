import dotenv from 'dotenv';
import app from './app';
import { connectMongo } from './api/bootstrap/mongo';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

// Initialize database and start server
async function startServer() {
  try {
    // Try to connect to MongoDB, but don't fail if it's not available
    const mongoConnected = await connectMongo();
    if (!mongoConnected) {
      console.log('Running in development mode without MongoDB');
    }
    
    // Only start server if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
}

// Only start server if this file is run directly
if (require.main === module) {
  startServer();
}

export default app;