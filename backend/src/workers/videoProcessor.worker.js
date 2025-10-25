import Queue from 'bull';
import Video from '../models/Video.js';
import ffmpegService from '../utils/ffmpeg.js';
// Use enhanced sensitivity service for better analysis
import sensitivityService from '../services/sensitivity.service.enhanced.js';
import storageService from '../services/storage.service.js';
import socketService from '../socket/socket.js';
import logger from '../utils/logger.js';
import config from '../config/env.js';
import fs from 'fs';

const videoQueue = new Queue('video-processing', config.redisUrl);

// Set concurrency
const CONCURRENCY = config.processing.maxConcurrentJobs;

// Process video job
videoQueue.process(CONCURRENCY, async (job, done) => {
  const { videoId } = job.data;

  try {
    logger.info(`[Worker] Processing video: ${videoId}`);

    // Get video from database
    const video = await Video.findById(videoId);

    if (!video) {
      throw new Error('Video not found');
    }

    // Update status
    video.status = 'processing';
    video.processingProgress = 0;
    await video.save();

    // Emit start event
    emitProgress(video, 0, 'Starting processing...');

    // Get video file path
    const videoPath = storageService.getLocalPath(video.storageKey);

    if (!fs.existsSync(videoPath)) {
      throw new Error('Video file not found');
    }

    // Step 1: Extract metadata (0% -> 20%)
    logger.info(`[Worker] Extracting metadata for video: ${videoId}`);
    const metadata = await ffmpegService.extractMetadata(videoPath);

    video.duration = metadata.duration;
    video.resolution = metadata.resolution;
    video.metadata = {
      codec: metadata.codec,
      bitrate: metadata.bitrate,
      frameRate: metadata.frameRate,
      audioCodec: metadata.audioCodec,
      duration: metadata.duration,
      resolution: metadata.resolution,
      format: metadata.format || video.format
    };
    video.processingProgress = 20;
    await video.save();

    emitProgress(video, 20, 'Metadata extracted');

    // Step 2: Generate thumbnail (20% -> 40%)
    logger.info(`[Worker] Generating thumbnail for video: ${videoId}`);
    try {
      const thumbnailPath = await ffmpegService.generateThumbnail(videoPath);
      const thumbnailUrl = await storageService.uploadFile(
        thumbnailPath,
        `thumbnails/${video._id}.jpg`
      );

      video.thumbnailUrl = thumbnailUrl;
      video.thumbnail = thumbnailUrl; // For frontend compatibility
      video.processingProgress = 40;
      await video.save();

      emitProgress(video, 40, 'Thumbnail generated');
      
      // Clean up temporary thumbnail file
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
    } catch (thumbError) {
      logger.warn(`Thumbnail generation failed: ${thumbError.message}`);
      logger.error(thumbError);
      // Continue processing even if thumbnail fails
    }

    // Step 3: Sensitivity analysis (40% -> 80%)
    logger.info(`[Worker] Analyzing sensitivity for video: ${videoId}`);
    const sensitivityResult = await sensitivityService.analyze(videoPath, video);

    // Map status to level for frontend
    let sensitivityLevel = 'low';
    if (sensitivityResult.status === 'flagged') {
      sensitivityLevel = sensitivityResult.score > 0.7 ? 'high' : 'medium';
    } else if (sensitivityResult.score > 0.3) {
      sensitivityLevel = 'medium';
    }

    video.sensitivityStatus = sensitivityResult.status;
    video.sensitivityScore = sensitivityResult.score;
    video.sensitivityDetails = {
      categories: sensitivityResult.categories || [],
      detectedAt: new Date()
    };
    
    // Construct analysis object for frontend
    const analysis = {};
    if (sensitivityResult.categories && Array.isArray(sensitivityResult.categories)) {
      sensitivityResult.categories.forEach(category => {
        // Convert category string to analysis score (approximate based on detection)
        analysis[category.toLowerCase().replace(/ /g, '_')] = sensitivityResult.score;
      });
    }
    
    // For frontend compatibility
    video.sensitivity = {
      level: sensitivityLevel,
      score: sensitivityResult.score,
      analysis: analysis,
      analyzedAt: new Date()
    };
    
    video.processingProgress = 80;
    await video.save();

    emitProgress(video, 80, 'Sensitivity analysis completed');

    // Step 4: Final processing (80% -> 100%)
    // Additional processing could be added here:
    // - Video transcoding to different formats
    // - Multiple quality versions
    // - Subtitles extraction
    // - Audio analysis
    logger.info(`[Worker] Finalizing video: ${videoId}`);

    video.status = 'completed';
    video.processingProgress = 100;
    await video.save();

    emitProgress(video, 100, 'Processing completed');

    // Emit completion event
    if (socketService.io) {
      socketService.io.to(`org:${video.organizationId}`).emit('video:process:complete', {
        videoId: video._id.toString(),
        status: video.status,
        sensitivityStatus: video.sensitivityStatus,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        resolution: video.resolution
      });
    }

    logger.info(`[Worker] Video processing completed: ${videoId}`);

    done(null, { videoId: video._id.toString(), status: 'completed' });
  } catch (error) {
    logger.error(`[Worker] Video processing failed: ${videoId}`, error);

    // Update video status
    try {
      await Video.findByIdAndUpdate(videoId, {
        status: 'failed',
        processingProgress: 0
      });

      // Emit failure event
      const video = await Video.findById(videoId);
      if (video && socketService.io) {
        socketService.io.to(`org:${video.organizationId}`).emit('video:process:failed', {
          videoId: video._id.toString(),
          error: error.message
        });
      }
    } catch (updateError) {
      logger.error('Failed to update video status:', updateError);
    }

    done(error);
  }
});

// Helper function to emit progress
const emitProgress = (video, progress, message) => {
  if (socketService.io) {
    socketService.io.to(`org:${video.organizationId}`).emit('video:process:progress', {
      videoId: video._id.toString(),
      progress,
      message,
      status: video.status
    });
  }
};

// Event listeners
videoQueue.on('completed', (job, result) => {
  logger.info(`[Worker] Job completed: ${job.id}`, result);
});

videoQueue.on('failed', (job, err) => {
  logger.error(`[Worker] Job failed: ${job.id}`, err.message);
});

videoQueue.on('stalled', (job) => {
  logger.warn(`[Worker] Job stalled: ${job.id}`);
});

videoQueue.on('error', (error) => {
  logger.error('[Worker] Queue error:', error);
});

logger.info('✅ Video processor worker started');

export default videoQueue;

