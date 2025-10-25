import Queue from 'bull';
import config from '../config/env.js';
import logger from '../utils/logger.js';

let videoQueue = null;

// Initialize queue
const initQueue = () => {
  try {
    if (!videoQueue) {
      videoQueue = new Queue('video-processing', config.redisUrl, {
        settings: {
          maxStalledCount: 2,
          stalledInterval: 30000
        }
      });

      videoQueue.on('error', (error) => {
        logger.error('Queue error:', error);
      });

      videoQueue.on('failed', (job, err) => {
        logger.error(`Job ${job.id} failed:`, err.message);
      });

      logger.info('Video processing queue initialized');
    }
    return videoQueue;
  } catch (error) {
    logger.error('Failed to initialize queue:', error);
    return null;
  }
};

class ProcessingService {
  constructor() {
    this.queue = initQueue();
  }

  async processVideo(videoId) {
    try {
      if (!this.queue) {
        logger.warn('Queue not available, video will not be processed');
        return null;
      }

      const job = await this.queue.add(
        {
          videoId: videoId.toString(),
          timestamp: new Date()
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          },
          timeout: config.processing.timeout,
          removeOnComplete: 100,
          removeOnFail: 50
        }
      );

      logger.info(`Processing job created: ${job.id} for video ${videoId}`);
      return job;
    } catch (error) {
      logger.error('Failed to queue processing job:', error);
      throw error;
    }
  }

  async getJobStatus(jobId) {
    try {
      if (!this.queue) return null;

      const job = await this.queue.getJob(jobId);

      if (!job) {
        return null;
      }

      const state = await job.getState();

      return {
        id: job.id,
        progress: job.progress(),
        state,
        data: job.data,
        result: job.returnvalue,
        failedReason: job.failedReason
      };
    } catch (error) {
      logger.error('Get job status error:', error);
      return null;
    }
  }

  async getQueueStats() {
    try {
      if (!this.queue) return null;

      const [waiting, active, completed, failed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount()
      ]);

      return { waiting, active, completed, failed };
    } catch (error) {
      logger.error('Get queue stats error:', error);
      return null;
    }
  }
}

export default new ProcessingService();

