import Queue from 'bull';
import Video from '../models/Video.js';
import ffmpegService from '../utils/ffmpeg.js';
import enhancedSensitivity from '../services/sensitivity.service.enhanced.js';
import storageService from '../services/storage.service.js';
import socketService from '../socket/socket.js';
import logger from '../utils/logger.js';
import config from '../config/env.js';
import fs from 'fs';

const videoQueue = new Queue('video-processing', config.redisUrl);

// Set concurrency
const CONCURRENCY = config.processing.maxConcurrentJobs;

// Process video job with enhanced analysis
videoQueue.process(CONCURRENCY, async (job, done) => {
  const { videoId } = job.data;
  const startTime = Date.now();

  try {
    logger.info(`[Enhanced Worker] Processing video: ${videoId}`);

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
    emitProgress(video, 0, 'Initializing enhanced analysis...');

    // Get video file path
    const videoPath = storageService.getLocalPath(video.storageKey);

    if (!fs.existsSync(videoPath)) {
      throw new Error('Video file not found');
    }

    // Step 1: Extract comprehensive metadata (0% -> 15%)
    logger.info(`[Enhanced Worker] Extracting metadata: ${videoId}`);
    job.progress(5);
    
    const metadata = await ffmpegService.extractMetadata(videoPath);

    video.duration = metadata.duration;
    video.resolution = metadata.resolution;
    video.metadata = {
      codec: metadata.codec,
      bitrate: metadata.bitrate,
      frameRate: metadata.frameRate,
      audioCodec: metadata.audioCodec
    };
    video.processingProgress = 15;
    await video.save();

    emitProgress(video, 15, 'Metadata extracted');
    job.progress(15);

    // Step 2: Generate thumbnail (15% -> 30%)
    logger.info(`[Enhanced Worker] Generating thumbnail: ${videoId}`);
    try {
      const thumbnailPath = await ffmpegService.generateThumbnail(videoPath);
      const thumbnailUrl = await storageService.uploadFile(
        thumbnailPath,
        `thumbnails/${video._id}.jpg`
      );

      video.thumbnailUrl = thumbnailUrl;
      video.processingProgress = 30;
      await video.save();

      emitProgress(video, 30, 'Thumbnail generated');
      job.progress(30);
    } catch (thumbError) {
      logger.warn(`Thumbnail generation failed: ${thumbError.message}`);
      // Continue processing even if thumbnail fails
    }

    // Step 3: Enhanced sensitivity analysis (30% -> 85%)
    logger.info(`[Enhanced Worker] Running enhanced sensitivity analysis: ${videoId}`);
    emitProgress(video, 35, 'Analyzing video content...');
    job.progress(35);

    const sensitivityResult = await enhancedSensitivity.analyze(videoPath, video);

    // Store comprehensive analysis results
    video.sensitivityStatus = sensitivityResult.status;
    video.sensitivityScore = sensitivityResult.score;
    video.sensitivityDetails = {
      categories: sensitivityResult.categories,
      confidence: sensitivityResult.confidence,
      details: sensitivityResult.details,
      detectedAt: new Date(),
      analysisVersion: sensitivityResult.analysisVersion,
      processingTime: sensitivityResult.processingTime
    };
    video.processingProgress = 85;
    await video.save();

    emitProgress(video, 85, 'Content analysis completed');
    job.progress(85);

    // Generate analysis report
    const analysisReport = enhancedSensitivity.generateReport(sensitivityResult);
    logger.info(`[Enhanced Worker] Analysis report for ${videoId}:`, analysisReport);

    // Step 4: Post-processing optimizations (85% -> 95%)
    emitProgress(video, 90, 'Finalizing...');
    job.progress(90);

    // Additional processing could go here:
    // - Generate multiple quality versions
    // - Extract subtitles
    // - Create preview clips
    // - Optimize for streaming

    // Step 5: Finalize (95% -> 100%)
    video.status = 'completed';
    video.processingProgress = 100;
    await video.save();

    emitProgress(video, 100, 'Processing completed successfully');
    job.progress(100);

    // Emit completion event with detailed info
    if (socketService.io) {
      socketService.io.to(`org:${video.organizationId}`).emit('video:process:complete', {
        videoId: video._id.toString(),
        status: video.status,
        sensitivityStatus: video.sensitivityStatus,
        sensitivityScore: video.sensitivityScore,
        confidence: sensitivityResult.confidence,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        resolution: video.resolution,
        analysisReport: analysisReport.summary,
        processingTime: Date.now() - startTime
      });
    }

    const totalProcessingTime = Date.now() - startTime;
    logger.info(
      `[Enhanced Worker] Video processing completed: ${videoId} ` +
      `(${(totalProcessingTime / 1000).toFixed(2)}s)`
    );

    done(null, {
      videoId: video._id.toString(),
      status: 'completed',
      sensitivityStatus: video.sensitivityStatus,
      processingTime: totalProcessingTime,
      analysisReport
    });

  } catch (error) {
    logger.error(`[Enhanced Worker] Video processing failed: ${videoId}`, error);

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
          error: error.message,
          timestamp: new Date()
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
      status: video.status,
      timestamp: new Date()
    });
  }
};

// Event listeners
videoQueue.on('completed', (job, result) => {
  logger.info(`[Enhanced Worker] Job completed: ${job.id}`, result.analysisReport?.summary);
});

videoQueue.on('failed', (job, err) => {
  logger.error(`[Enhanced Worker] Job failed: ${job.id}`, err.message);
});

videoQueue.on('stalled', (job) => {
  logger.warn(`[Enhanced Worker] Job stalled: ${job.id}`);
});

videoQueue.on('error', (error) => {
  logger.error('[Enhanced Worker] Queue error:', error);
});

videoQueue.on('progress', (job, progress) => {
  logger.debug(`[Enhanced Worker] Job ${job.id} progress: ${progress}%`);
});

logger.info('✅ Enhanced video processor worker started');

export default videoQueue;

