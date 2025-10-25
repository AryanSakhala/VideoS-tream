import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import config from './env.js';

export const connectDB = async () => {
  try {
    const options = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    const conn = await mongoose.connect(config.mongoUri, options);

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    logger.info(`   Database: ${conn.connection.name}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    logger.error('❌ MongoDB Connection Error:', error.message);
    logger.error('   Check your MONGODB_URI in .env file');
    process.exit(1);
  }
};

export default connectDB;

