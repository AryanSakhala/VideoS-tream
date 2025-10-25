import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import config from '../config/env.js';
import logger from './logger.js';

// Set FFmpeg paths (especially for Windows)
if (config.ffmpeg.path) {
  ffmpeg.setFfmpegPath(config.ffmpeg.path);
  logger.info(`FFmpeg path set to: ${config.ffmpeg.path}`);
}

if (config.ffmpeg.probePath) {
  ffmpeg.setFfprobePath(config.ffmpeg.probePath);
  logger.info(`FFprobe path set to: ${config.ffmpeg.probePath}`);
}

class FFmpegService {
  /**
   * Extract video metadata
   */
  async extractMetadata(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          logger.error('FFprobe error:', err);
          return reject(err);
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration,
          resolution: {
            width: videoStream?.width || 0,
            height: videoStream?.height || 0
          },
          codec: videoStream?.codec_name || 'unknown',
          bitrate: parseInt(metadata.format.bit_rate) || 0,
          frameRate: videoStream?.r_frame_rate ? eval(videoStream.r_frame_rate) : 0,
          audioCodec: audioStream?.codec_name || 'none'
        });
      });
    });
  }

  /**
   * Generate thumbnail
   */
  async generateThumbnail(videoPath, timestamp = '00:00:01') {
    const outputPath = path.join(
      path.dirname(videoPath),
      `thumb-${path.basename(videoPath, path.extname(videoPath))}.jpg`
    );

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '640x360'
        })
        .on('end', () => {
          logger.info('Thumbnail generated:', outputPath);
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Thumbnail generation error:', err);
          reject(err);
        });
    });
  }

  /**
   * Extract frames for analysis
   */
  async extractFrames(videoPath, count = 10) {
    const outputDir = path.join(
      path.dirname(videoPath),
      `frames-${Date.now()}`
    );

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get video duration first
    const metadata = await this.extractMetadata(videoPath);
    const interval = Math.max(1, Math.floor(metadata.duration / count));

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          `-vf fps=1/${interval}`,
          '-vframes', count.toString()
        ])
        .output(path.join(outputDir, 'frame-%03d.jpg'))
        .on('end', () => {
          const frames = fs.readdirSync(outputDir)
            .filter(f => f.endsWith('.jpg'))
            .map(f => path.join(outputDir, f));
          
          logger.info(`Extracted ${frames.length} frames`);
          resolve(frames);
        })
        .on('error', (err) => {
          logger.error('Frame extraction error:', err);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Transcode video
   */
  async transcodeVideo(inputPath, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      if (options.codec) {
        command = command.videoCodec(options.codec);
      }
      if (options.bitrate) {
        command = command.videoBitrate(options.bitrate);
      }
      if (options.size) {
        command = command.size(options.size);
      }

      command
        .output(outputPath)
        .on('end', () => {
          logger.info('Transcoding completed:', outputPath);
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Transcoding error:', err);
          reject(err);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            logger.debug(`Transcoding progress: ${progress.percent.toFixed(2)}%`);
          }
        })
        .run();
    });
  }
}

export default new FFmpegService();

