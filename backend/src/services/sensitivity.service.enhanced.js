import ffmpegService from '../utils/ffmpeg.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

class EnhancedSensitivityService {
  constructor() {
    this.thresholds = {
      duration: {
        veryLong: 7200,
        suspicious: 10800
      },
      bitrate: {
        veryHigh: 15000000,
        veryLow: 100000
      },
      resolution: {
        minWidth: 320,
        maxWidth: 7680,
        minHeight: 240,
        maxHeight: 4320
      },
      frameRate: {
        min: 15,
        max: 120
      },
      audioAnalysis: {
        enabled: true
      }
    };

    this.categoryWeights = {
      'long_duration': 0.1,
      'unusual_resolution': 0.15,
      'high_bitrate': 0.1,
      'low_bitrate': 0.15,
      'no_audio': 0.05,
      'no_video_stream': 0.3,
      'corrupt_metadata': 0.25,
      'unusual_framerate': 0.1,
      'suspicious_aspect_ratio': 0.1,
      'black_frames': 0.2,
      'audio_issues': 0.15
    };
  }

  async analyze(videoPath, video) {
    try {
      logger.info(`[Enhanced] Analyzing video: ${video._id}`);

      const startTime = Date.now();
      let totalScore = 0;
      const detectedIssues = [];
      const analysisDetails = {};

      const metadata = await this.extractDetailedMetadata(videoPath);
      analysisDetails.metadata = metadata;

      const integrityCheck = await this.checkVideoIntegrity(metadata, video);
      if (integrityCheck.issues.length > 0) {
        totalScore += integrityCheck.score;
        detectedIssues.push(...integrityCheck.issues);
      }

      const videoAnalysis = this.analyzeVideoCharacteristics(metadata);
      totalScore += videoAnalysis.score;
      detectedIssues.push(...videoAnalysis.issues);
      analysisDetails.videoAnalysis = videoAnalysis;

      const audioAnalysis = this.analyzeAudioCharacteristics(metadata);
      totalScore += audioAnalysis.score;
      detectedIssues.push(...audioAnalysis.issues);
      analysisDetails.audioAnalysis = audioAnalysis;

      const fileAnalysis = this.analyzeFileConsistency(metadata, video);
      totalScore += fileAnalysis.score;
      detectedIssues.push(...fileAnalysis.issues);

      if (process.env.ENABLE_FRAME_ANALYSIS === 'true') {
        try {
          const frameAnalysis = await this.analyzeFrames(videoPath);
          totalScore += frameAnalysis.score;
          detectedIssues.push(...frameAnalysis.issues);
          analysisDetails.frameAnalysis = frameAnalysis;
        } catch (error) {
          logger.warn('Frame analysis failed:', error.message);
        }
      }

      totalScore = Math.min(1, totalScore);

      let status = 'safe';
      let confidence = 1 - totalScore;

      if (totalScore > 0.7) {
        status = 'flagged';
      } else if (totalScore > 0.4) {
        status = 'review_needed';
        detectedIssues.push('manual_review_recommended');
      }

      const processingTime = Date.now() - startTime;

      logger.info(
        `[Enhanced] Analysis complete for ${video._id}: ` +
        `Score=${totalScore.toFixed(2)}, Status=${status}, ` +
        `Issues=${detectedIssues.length}, Time=${processingTime}ms`
      );

      return {
        status: status === 'review_needed' ? 'flagged' : status,
        score: totalScore,
        confidence,
        categories: detectedIssues,
        details: analysisDetails,
        processingTime,
        analysisVersion: '2.0'
      };

    } catch (error) {
      logger.error('[Enhanced] Sensitivity analysis error:', error);

      return {
        status: 'safe',
        score: 0,
        confidence: 0,
        categories: ['analysis_error', error.message],
        details: { error: error.message },
        processingTime: 0,
        analysisVersion: '2.0'
      };
    }
  }

  async extractDetailedMetadata(videoPath) {
    const metadata = await ffmpegService.extractMetadata(videoPath);

    return {
      ...metadata,
      aspectRatio: this.calculateAspectRatio(
        metadata.resolution.width,
        metadata.resolution.height
      ),
      estimatedSize: fs.statSync(videoPath).size,
      fileExtension: path.extname(videoPath).toLowerCase()
    };
  }

  async checkVideoIntegrity(metadata, video) {
    const issues = [];
    let score = 0;

    if (!metadata.duration || metadata.duration === 0) {
      issues.push('no_duration');
      score += this.categoryWeights['corrupt_metadata'];
    }

    if (metadata.resolution.width === 0 || metadata.resolution.height === 0) {
      issues.push('no_video_stream');
      score += this.categoryWeights['no_video_stream'];
    }

    if (!metadata.codec || metadata.codec === 'unknown') {
      issues.push('unknown_codec');
      score += 0.1;
    }

    const expectedMinSize = metadata.duration * 100000;
    if (video.fileSize < expectedMinSize) {
      issues.push('suspiciously_small_file');
      score += 0.15;
    }

    return { issues, score };
  }

  analyzeVideoCharacteristics(metadata) {
    const issues = [];
    let score = 0;

    if (metadata.duration > this.thresholds.duration.suspicious) {
      issues.push('extremely_long_duration');
      score += this.categoryWeights['long_duration'] * 1.5;
    } else if (metadata.duration > this.thresholds.duration.veryLong) {
      issues.push('long_duration');
      score += this.categoryWeights['long_duration'];
    }

    const { width, height } = metadata.resolution;
    
    if (width > this.thresholds.resolution.maxWidth || 
        height > this.thresholds.resolution.maxHeight) {
      issues.push('extremely_high_resolution');
      score += this.categoryWeights['unusual_resolution'];
    }

    if (width < this.thresholds.resolution.minWidth || 
        height < this.thresholds.resolution.minHeight) {
      issues.push('very_low_resolution');
      score += this.categoryWeights['unusual_resolution'];
    }

    const aspectRatio = metadata.aspectRatio;
    if (!this.isCommonAspectRatio(aspectRatio)) {
      issues.push('unusual_aspect_ratio');
      score += this.categoryWeights['suspicious_aspect_ratio'];
    }

    if (metadata.bitrate > this.thresholds.bitrate.veryHigh) {
      issues.push('extremely_high_bitrate');
      score += this.categoryWeights['high_bitrate'];
    }

    if (metadata.bitrate < this.thresholds.bitrate.veryLow && metadata.duration > 60) {
      issues.push('very_low_bitrate');
      score += this.categoryWeights['low_bitrate'];
    }

    if (metadata.frameRate > this.thresholds.frameRate.max) {
      issues.push('unusually_high_framerate');
      score += this.categoryWeights['unusual_framerate'];
    }

    if (metadata.frameRate < this.thresholds.frameRate.min && metadata.frameRate > 0) {
      issues.push('very_low_framerate');
      score += this.categoryWeights['unusual_framerate'];
    }

    return { issues, score, details: { aspectRatio, ...metadata } };
  }

  analyzeAudioCharacteristics(metadata) {
    const issues = [];
    let score = 0;

    if (metadata.audioCodec === 'none' || !metadata.audioCodec) {
      if (metadata.duration > 60) {
        issues.push('no_audio_long_video');
        score += this.categoryWeights['no_audio'];
      }
    }

    if (metadata.audioCodec && !this.isCommonAudioCodec(metadata.audioCodec)) {
      issues.push('unusual_audio_codec');
      score += 0.05;
    }

    return { issues, score };
  }

  analyzeFileConsistency(metadata, video) {
    const issues = [];
    let score = 0;

    const bytesPerSecond = video.fileSize / metadata.duration;
    
    if (bytesPerSecond > 10000000) {
      issues.push('high_data_rate');
      score += 0.1;
    }

    if (bytesPerSecond < 50000 && metadata.duration > 60) {
      issues.push('low_data_rate');
      score += 0.15;
    }

    const expectedFormats = ['mp4', 'avi', 'mov', 'mkv', 'webm'];
    if (!expectedFormats.includes(video.format.toLowerCase())) {
      issues.push('unusual_format');
      score += 0.05;
    }

    return { issues, score };
  }

  async analyzeFrames(videoPath, sampleCount = 5) {
    try {
      const frames = await ffmpegService.extractFrames(videoPath, sampleCount);
      const issues = [];
      let score = 0;

      let blackFrames = 0;
      
      for (const framePath of frames) {
        const stats = fs.statSync(framePath);
        
        if (stats.size < 5000) {
          blackFrames++;
        }
      }

      frames.forEach(f => {
        if (fs.existsSync(f)) fs.unlinkSync(f);
        const frameDir = path.dirname(f);
        if (fs.existsSync(frameDir)) {
          try {
            fs.rmdirSync(frameDir);
          } catch (e) {
          }
        }
      });

      if (blackFrames > sampleCount * 0.5) {
        issues.push('many_black_frames');
        score += this.categoryWeights['black_frames'];
      }

      return { issues, score, blackFrames, totalFrames: sampleCount };
    } catch (error) {
      logger.warn('Frame analysis failed:', error.message);
      return { issues: [], score: 0 };
    }
  }

  calculateAspectRatio(width, height) {
    if (!width || !height) return 0;
    
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    
    return {
      ratio: width / height,
      formatted: `${width / divisor}:${height / divisor}`,
      width,
      height
    };
  }

  isCommonAspectRatio(aspectRatio) {
    if (!aspectRatio || !aspectRatio.ratio) return false;

    const commonRatios = [
      { name: '16:9', value: 16/9, tolerance: 0.05 },
      { name: '4:3', value: 4/3, tolerance: 0.05 },
      { name: '21:9', value: 21/9, tolerance: 0.05 },
      { name: '1:1', value: 1, tolerance: 0.05 },
      { name: '9:16', value: 9/16, tolerance: 0.05 },
    ];

    return commonRatios.some(
      ratio => Math.abs(aspectRatio.ratio - ratio.value) < ratio.tolerance
    );
  }

  isCommonAudioCodec(codec) {
    const commonCodecs = ['aac', 'mp3', 'opus', 'vorbis', 'ac3', 'pcm'];
    return commonCodecs.includes(codec.toLowerCase());
  }

  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('Sensitivity thresholds updated', this.thresholds);
  }

  getConfiguration() {
    return {
      thresholds: this.thresholds,
      categoryWeights: this.categoryWeights,
      version: '2.0'
    };
  }

  generateReport(analysisResult) {
    return {
      summary: {
        status: analysisResult.status,
        score: analysisResult.score.toFixed(2),
        confidence: (analysisResult.confidence * 100).toFixed(1) + '%',
        issuesFound: analysisResult.categories.length
      },
      issues: analysisResult.categories.map(cat => ({
        category: cat,
        severity: this.getIssueSeverity(cat),
        weight: this.categoryWeights[cat] || 0
      })),
      recommendations: this.generateRecommendations(analysisResult.categories),
      processingTime: analysisResult.processingTime + 'ms',
      analysisVersion: analysisResult.analysisVersion
    };
  }

  getIssueSeverity(category) {
    const highSeverity = ['no_video_stream', 'corrupt_metadata', 'many_black_frames'];
    const mediumSeverity = ['unusual_resolution', 'low_bitrate', 'audio_issues'];
    
    if (highSeverity.includes(category)) return 'high';
    if (mediumSeverity.includes(category)) return 'medium';
    return 'low';
  }

  generateRecommendations(categories) {
    const recommendations = [];

    if (categories.includes('no_video_stream')) {
      recommendations.push('Video file may be corrupted. Re-encode or re-upload.');
    }
    if (categories.includes('low_bitrate')) {
      recommendations.push('Consider increasing video bitrate for better quality.');
    }
    if (categories.includes('no_audio_long_video')) {
      recommendations.push('Add audio track or confirm if silent video is intentional.');
    }
    if (categories.includes('unusual_resolution')) {
      recommendations.push('Use standard video resolutions (720p, 1080p, 4K).');
    }
    if (categories.includes('manual_review_recommended')) {
      recommendations.push('Manual review recommended before publishing.');
    }

    return recommendations.length > 0 ? recommendations : ['No issues detected.'];
  }
}

export default new EnhancedSensitivityService();
