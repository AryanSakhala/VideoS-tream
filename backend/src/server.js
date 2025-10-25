import { createServer } from 'http';
import app from './app.js';
import config from './config/env.js';
import logger from './utils/logger.js';
import { connectDB } from './config/database.js';
import { connectRedis } from './config/redis.js';
import socketService from './socket/socket.js';

// Import worker to start processing
import './workers/videoProcessor.worker.js';

const PORT = config.port;

// Create HTTP server
const server = createServer(app);

// Initialize Socket.io
socketService.initialize(server);

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Connect to Redis (optional, for job queue)
    await connectRedis();

    // Start server
    server.listen(PORT, () => {
      logger.info('================================================');
      logger.info(`🚀 Server running in ${config.nodeEnv} mode`);
      logger.info(`📡 API: http://localhost:${PORT}`);
      logger.info(`🔌 Socket.io ready for connections`);
      logger.info(`💾 MongoDB: Connected`);
      logger.info(`📦 Storage: ${config.storage.provider}`);
      logger.info('================================================');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();

