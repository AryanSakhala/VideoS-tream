import { createClient } from 'redis';
import logger from '../utils/logger.js';
import config from './env.js';

let redisClient = null;

export const connectRedis = async () => {
  try {
    redisClient = createClient({
      url: config.redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis: Too many reconnection attempts');
            return new Error('Too many reconnection attempts');
          }
          return retries * 500; // Exponential backoff
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis Connected');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    await redisClient.connect();

    return redisClient;
  } catch (error) {
    logger.error('❌ Redis Connection Error:', error.message);
    logger.warn('   Video processing queue will not work without Redis');
    logger.warn('   Install Redis or use Upstash Redis (cloud)');
    return null;
  }
};

export const getRedisClient = () => redisClient;

export default { connectRedis, getRedisClient };

