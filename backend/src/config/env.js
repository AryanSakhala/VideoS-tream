import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Debug: Log environment info
console.log('🔍 Environment Debug:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   Available env vars:', Object.keys(process.env).filter(key => 
  key.includes('MONGODB') || key.includes('JWT') || key.includes('REDIS')
).join(', '));

// Load environment variables from .env file (only in development)
// In production (Railway), environment variables are injected directly
if (process.env.NODE_ENV !== 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  dotenv.config({ path: join(__dirname, '../../.env') });
  console.log('   Loaded .env file');
} else {
  console.log('   Skipping .env file (production mode)');
}

// Validate required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
  console.error('\n💡 Copy .env.example to .env and fill in the values');
  process.exit(1);
}

export default {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Database
  mongoUri: process.env.MONGODB_URI,

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expire: process.env.JWT_EXPIRE || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '7d'
  },

  // File Upload
  upload: {
    maxSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10),
    allowedFormats: (process.env.ALLOWED_VIDEO_FORMATS || 'mp4,avi,mov,mkv,webm').split(','),
    uploadDir: process.env.UPLOAD_DIR || './uploads'
  },

  // Storage
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      bucket: process.env.AWS_S3_BUCKET
    },
    cloudflare: {
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucket: process.env.R2_BUCKET,
      publicUrl: process.env.R2_PUBLIC_URL
    }
  },

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // FFmpeg
  ffmpeg: {
    path: process.env.FFMPEG_PATH || null,
    probePath: process.env.FFPROBE_PATH || null
  },

  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
  },

  // Processing
  processing: {
    timeout: parseInt(process.env.VIDEO_PROCESSING_TIMEOUT || '300000', 10),
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '3', 10)
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info'
};

