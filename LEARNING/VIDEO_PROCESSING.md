# Video Processing - FFmpeg & Sensitivity Analysis 🎬

## Understanding Automated Video Processing Pipeline

---

## Q1: What happens after a video is uploaded?

**A:** Videos go through a **5-stage processing pipeline** to extract metadata, generate thumbnails, and analyze content!

### **Processing Pipeline:**

```
1. UPLOAD COMPLETE → Video saved to disk
    ↓
2. ADD TO QUEUE → Job added to Bull Queue (Redis)
    ↓
3. WORKER PICKS UP → Background processing starts
    ↓
4. METADATA EXTRACTION → Duration, resolution, codec (FFmpeg)
    ↓
5. THUMBNAIL GENERATION → Screenshot at 1-second mark (FFmpeg)
    ↓
6. SENSITIVITY ANALYSIS → Safe/Flagged classification (Custom algorithm)
    ↓
7. DATABASE UPDATE → Save all results
    ↓
8. NOTIFY FRONTEND → Socket.IO real-time update
```

---

## Q2: What is FFmpeg and why is it used?

**A:** FFmpeg is a **powerful command-line tool** for processing video and audio files!

### **What FFmpeg Can Do:**

- ✅ Extract video metadata (duration, resolution, bitrate)
- ✅ Generate thumbnails (screenshots)
- ✅ Convert video formats (MP4, WebM, AVI, etc.)
- ✅ Compress videos
- ✅ Extract audio
- ✅ Add watermarks
- ✅ Much more!

### **How It Works:**

```bash
# Extract metadata
ffprobe -v quiet -print_format json -show_format video.mp4

# Generate thumbnail at 1-second mark
ffmpeg -i video.mp4 -ss 00:00:01 -vframes 1 thumbnail.jpg
```

### **💡 Real Code - FFmpeg Integration:**

```javascript
// backend/src/utils/ffmpeg.js
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import path from 'path';
import fs from 'fs';
import config from '../config/env.js';

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

export const getMetadata = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(err);
      }

      const videoStream = metadata.streams.find(
        stream => stream.codec_type === 'video'
      );

      const audioStream = metadata.streams.find(
        stream => stream.codec_type === 'audio'
      );

      resolve({
        duration: Math.floor(metadata.format.duration),  // Seconds
        fileSize: parseInt(metadata.format.size),        // Bytes
        format: metadata.format.format_name,             // "mov,mp4,m4a,3gp,3g2,mj2"
        bitrate: parseInt(metadata.format.bit_rate),     // Bits per second
        
        // Video info
        resolution: videoStream ? {
          width: videoStream.width,
          height: videoStream.height
        } : null,
        codec: videoStream?.codec_name,                  // "h264"
        fps: videoStream ? eval(videoStream.r_frame_rate) : null,  // 30 fps
        
        // Audio info
        audioCodec: audioStream?.codec_name,             // "aac"
        audioChannels: audioStream?.channels,            // 2 (stereo)
        audioSampleRate: audioStream?.sample_rate        // 48000 Hz
      });
    });
  });
};

export const generateThumbnail = (filePath, outputDir = config.uploadDir) => {
  return new Promise((resolve, reject) => {
    const filename = path.basename(filePath, path.extname(filePath));
    const thumbnailPath = path.join(outputDir, `${filename}-thumb.jpg`);

    ffmpeg(filePath)
      .screenshots({
        timestamps: ['1'],      // At 1 second
        filename: `${filename}-thumb.jpg`,
        folder: outputDir,
        size: '1280x720'        // HD thumbnail
      })
      .on('end', () => {
        resolve(thumbnailPath);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
};

export const getVideoDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(Math.floor(metadata.format.duration));
    });
  });
};

export const extractAudioWaveform = (filePath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .output(outputPath)
      .audioFilters('showwavespic=s=1280x120')
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
};
```

---

## Q3: How does the video processing worker operate?

**A:** The worker runs in the **background**, picks jobs from the queue, processes videos, and updates the database!

### **💡 Real Code - Video Processor Worker:**

```javascript
// backend/src/workers/videoProcessor.worker.js
import { videoQueue } from '../services/processing.service.js';
import Video from '../models/Video.js';
import * as ffmpeg from '../utils/ffmpeg.js';
import { analyzeSensitivity } from '../services/sensitivity.service.js';
import { getIO } from '../socket/socket.js';
import logger from '../utils/logger.js';

videoQueue.process(async (job) => {
  const { videoId } = job.data;
  const io = getIO();

  try {
    logger.info(`Processing video: ${videoId}`);

    const video = await Video.findById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    const filePath = video.filePath;

    job.progress(10);
    io.to(video.organizationId.toString()).emit('video:progress', {
      videoId: video._id,
      progress: 10,
      stage: 'metadata'
    });

    const metadata = await ffmpeg.getMetadata(filePath);
    logger.info(`Metadata extracted: ${JSON.stringify(metadata)}`);

    video.metadata = {
      duration: metadata.duration,
      resolution: metadata.resolution,
      format: metadata.format,
      codec: metadata.codec,
      bitrate: metadata.bitrate,
      fps: metadata.fps,
      audioCodec: metadata.audioCodec
    };

    job.progress(40);
    io.to(video.organizationId.toString()).emit('video:progress', {
      videoId: video._id,
      progress: 40,
      stage: 'thumbnail'
    });

    const thumbnailPath = await ffmpeg.generateThumbnail(filePath);
    logger.info(`Thumbnail generated: ${thumbnailPath}`);
    video.thumbnail = thumbnailPath;

    job.progress(70);
    io.to(video.organizationId.toString()).emit('video:progress', {
      videoId: video._id,
      progress: 70,
      stage: 'sensitivity'
    });

    const sensitivityResult = await analyzeSensitivity(filePath);
    logger.info(`Sensitivity analysis: ${JSON.stringify(sensitivityResult)}`);

    video.sensitivity = {
      level: sensitivityResult.status,
      score: sensitivityResult.score,
      analysis: sensitivityResult.analysis,
      analyzedAt: new Date()
    };

    video.status = 'completed';
    video.processedAt = new Date();
    await video.save();

    job.progress(100);

    io.to(video.organizationId.toString()).emit('video:processed', {
      videoId: video._id,
      status: 'completed',
      metadata: video.metadata,
      thumbnail: video.thumbnail,
      sensitivity: video.sensitivity
    });

    logger.info(`✅ Video processed successfully: ${videoId}`);

    return { success: true, videoId };

  } catch (error) {
    logger.error(`❌ Video processing failed: ${videoId}`, error);

    const video = await Video.findById(videoId);
    if (video) {
      video.status = 'failed';
      video.error = error.message;
      await video.save();

      io.to(video.organizationId.toString()).emit('video:failed', {
        videoId: video._id,
        error: error.message
      });
    }

    throw error;
  }
});

videoQueue.on('completed', (job, result) => {
  logger.info(`Job ${job.id} completed:`, result);
});

videoQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed:`, err);
});

logger.info('✅ Video processor worker started');
```

---

## Q4: What is sensitivity analysis and how does it work?

**A:** Sensitivity analysis determines if video content is **safe** or **flagged** using a scoring algorithm!

### **Analysis Algorithm:**

The system analyzes videos based on:
1. **File Size Analysis** - Unusually small/large files
2. **Metadata Validation** - Missing or suspicious metadata
3. **Filename Pattern Matching** - Known risky keywords
4. **Duration Check** - Very short or very long videos
5. **Format Validation** - Expected video formats

### **Scoring System:**

```
Safety Score: 0-100
├─ 0-30:  ❌ HIGH RISK (Flagged)
├─ 31-60: ⚠️ MEDIUM RISK (Review)
└─ 61-100: ✅ SAFE (Passed)
```

### **💡 Real Code - Enhanced Sensitivity Service:**

```javascript
// backend/src/services/sensitivity.service.enhanced.js
import path from 'path';
import fs from 'fs';
import * as ffmpeg from '../utils/ffmpeg.js';

const FLAGGED_KEYWORDS = [
  'nsfw', 'explicit', 'adult', 'xxx', 'porn',
  'violence', 'gore', 'weapon', 'gun', 'knife'
];

const analyzeFilename = (filename) => {
  const lowerFilename = filename.toLowerCase();
  let riskScore = 0;
  const detectedKeywords = [];

  FLAGGED_KEYWORDS.forEach(keyword => {
    if (lowerFilename.includes(keyword)) {
      riskScore += 15;
      detectedKeywords.push(keyword);
    }
  });

  return {
    score: Math.min(riskScore, 50),
    keywords: detectedKeywords
  };
};

const analyzeFileSize = (fileSize) => {
  const fileSizeMB = fileSize / (1024 * 1024);
  
  if (fileSizeMB < 0.5) {
    return { score: 10, reason: 'File too small (< 0.5MB)' };
  }
  
  if (fileSizeMB > 2000) {
    return { score: 10, reason: 'File too large (> 2GB)' };
  }
  
  return { score: 0, reason: 'File size acceptable' };
};

const analyzeMetadata = async (filePath) => {
  try {
    const metadata = await ffmpeg.getMetadata(filePath);
    let riskScore = 0;
    const issues = [];

    if (!metadata.resolution) {
      riskScore += 15;
      issues.push('No video stream detected');
    }

    if (metadata.duration < 1) {
      riskScore += 10;
      issues.push('Video too short (< 1 second)');
    }

    if (metadata.duration > 7200) {
      riskScore += 5;
      issues.push('Video very long (> 2 hours)');
    }

    const validFormats = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    const hasValidFormat = validFormats.some(
      fmt => metadata.format?.includes(fmt)
    );
    
    if (!hasValidFormat) {
      riskScore += 15;
      issues.push('Unusual video format');
    }

    return {
      score: Math.min(riskScore, 40),
      issues,
      metadata
    };

  } catch (error) {
    return {
      score: 30,
      issues: ['Failed to extract metadata'],
      error: error.message
    };
  }
};

export const analyzeSensitivity = async (filePath) => {
  try {
    const filename = path.basename(filePath);
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    const filenameAnalysis = analyzeFilename(filename);
    const fileSizeAnalysis = analyzeFileSize(fileSize);
    const metadataAnalysis = await analyzeMetadata(filePath);

    const totalRiskScore = 
      filenameAnalysis.score +
      fileSizeAnalysis.score +
      metadataAnalysis.score;

    const safetyScore = Math.max(0, 100 - totalRiskScore);

    let status;
    let level;
    
    if (safetyScore >= 70) {
      status = 'safe';
      level = 'low';
    } else if (safetyScore >= 40) {
      status = 'review';
      level = 'medium';
    } else {
      status = 'flagged';
      level = 'high';
    }

    return {
      status,
      score: safetyScore,
      analysis: {
        level,
        filename: {
          score: filenameAnalysis.score,
          keywords: filenameAnalysis.keywords
        },
        fileSize: {
          score: fileSizeAnalysis.score,
          reason: fileSizeAnalysis.reason
        },
        metadata: {
          score: metadataAnalysis.score,
          issues: metadataAnalysis.issues
        },
        totalRiskScore,
        recommendation: safetyScore >= 70 
          ? 'Video appears safe for general viewing'
          : safetyScore >= 40
          ? 'Video requires manual review before publishing'
          : 'Video flagged for potential policy violations'
      }
    };

  } catch (error) {
    return {
      status: 'error',
      score: 0,
      analysis: {
        level: 'unknown',
        error: error.message
      }
    };
  }
};
```

---

## Q5: How is the processing queue managed?

**A:** Bull Queue (powered by Redis) manages job queues with retry logic and concurrency control!

### **💡 Real Code - Processing Service:**

```javascript
// backend/src/services/processing.service.js
import Queue from 'bull';
import config from '../config/env.js';

export const videoQueue = new Queue('video-processing', {
  redis: config.redisUrl,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 100,
    removeOnFail: 100
  }
});

export const addToQueue = async (videoId, priority = 5) => {
  try {
    const job = await videoQueue.add(
      { videoId },
      {
        priority,
        jobId: `video-${videoId}`
      }
    );

    console.log(`Added video ${videoId} to queue with job ID: ${job.id}`);
    return job;

  } catch (error) {
    console.error('Failed to add job to queue:', error);
    throw error;
  }
};

export const getJobStatus = async (jobId) => {
  const job = await videoQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress();

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    failedReason: job.failedReason,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn
  };
};

export const getQueueStats = async () => {
  const [
    waiting,
    active,
    completed,
    failed,
    delayed
  ] = await Promise.all([
    videoQueue.getWaitingCount(),
    videoQueue.getActiveCount(),
    videoQueue.getCompletedCount(),
    videoQueue.getFailedCount(),
    videoQueue.getDelayedCount()
  ]);

  return { waiting, active, completed, failed, delayed };
};
```

---

## Q6: What happens if processing fails?

**A:** Bull Queue automatically **retries** failed jobs with exponential backoff!

### **Retry Strategy:**

```
Processing fails
    ↓
Wait 5 seconds
    ↓
Retry attempt #1
    ↓ Still failing
Wait 10 seconds (exponential backoff)
    ↓
Retry attempt #2
    ↓ Still failing
Wait 20 seconds
    ↓
Retry attempt #3
    ↓ Still failing
Mark as FAILED permanently
    ↓
Update video status = 'failed'
    ↓
Notify frontend via Socket.IO
```

### **💡 Configuration:**

```javascript
videoQueue.add(
  { videoId },
  {
    attempts: 3,               // Try 3 times total
    backoff: {
      type: 'exponential',     // Wait longer each time
      delay: 5000              // Start with 5 seconds
    }
  }
);
```

---

## Q7: How do you monitor processing progress?

**A:** Use **job.progress()** to track completion percentage and emit Socket.IO events!

### **💡 Progress Tracking:**

```javascript
// In worker
videoQueue.process(async (job) => {
  job.progress(10);   // 10% - Starting
  await extractMetadata();
  
  job.progress(40);   // 40% - Metadata done
  await generateThumbnail();
  
  job.progress(70);   // 70% - Thumbnail done
  await analyzeSensitivity();
  
  job.progress(100);  // 100% - Complete
});

// Frontend listens
websocketService.on('video:progress', (data) => {
  console.log(`Progress: ${data.progress}% - ${data.stage}`);
  updateProgressBar(data.progress);
});
```

---

## Q8: Can you process multiple videos simultaneously?

**A:** Yes! Bull Queue supports **concurrency** - process multiple videos at once!

### **💡 Configuration:**

```javascript
// Process up to 5 videos simultaneously
videoQueue.process(5, async (job) => {
  // Processing logic
});
```

**Considerations:**
- ✅ More concurrency = faster overall processing
- ❌ Each video uses CPU/memory
- ❌ Too many concurrent jobs = server overload
- 💡 Adjust based on server resources

---

## ✅ Key Takeaways

1. **FFmpeg extracts metadata** and generates thumbnails
2. **Bull Queue manages background jobs** with Redis
3. **Sensitivity analysis** scores videos based on multiple factors
4. **Automatic retry** handles temporary failures
5. **Socket.IO provides real-time progress** updates
6. **Concurrent processing** improves throughput

---

## 🚀 Try This Exercise!

**Debug Challenge:**
1. Upload a video
2. Open Redis CLI: `redis-cli`
3. Run: `KEYS *` to see queue keys
4. Run: `LRANGE bull:video-processing:wait 0 -1` to see waiting jobs
5. Watch the job move from `wait` to `active` to `completed`

**Build Challenge:**
1. Add video compression during processing
2. Generate multiple thumbnail sizes (small, medium, large)
3. Extract video captions/subtitles if present
4. Create a progress bar showing each processing stage

---

**Next:** Read `NODEJS_ARCHITECTURE.md` to understand Node.js internals!

