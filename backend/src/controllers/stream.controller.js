import Video from '../models/Video.js';
import storageService from '../services/storage.service.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

export const streamVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const range = req.headers.range;

    // Get video
    const video = await Video.findById(id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check organization access (if auth middleware ran)
    if (req.organizationId && video.organizationId.toString() !== req.organizationId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if video is ready
    if (video.status !== 'completed') {
      return res.status(400).json({
        error: 'Video not ready for streaming',
        status: video.status
      });
    }

    // Get file path
    const videoPath = storageService.getLocalPath(video.storageKey);

    if (!fs.existsSync(videoPath)) {
      logger.error(`Video file not found: ${videoPath}`);
      return res.status(404).json({ error: 'Video file not found' });
    }

    const videoSize = video.fileSize;
    const mimeType = getMimeType(video.format);

    // Handle range requests for video seeking
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
      const chunkSize = (end - start) + 1;

      const fileStream = fs.createReadStream(videoPath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${videoSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000'
      });

      fileStream.pipe(res);
    } else {
      // No range requested, send entire file
      res.writeHead(200, {
        'Content-Length': videoSize,
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000'
      });

      const fileStream = fs.createReadStream(videoPath);
      fileStream.pipe(res);
    }

    // Update view count asynchronously
    setImmediate(() => {
      Video.findByIdAndUpdate(id, {
        $inc: { viewCount: 1 },
        lastViewedAt: new Date()
      }).catch(err => logger.error('Failed to update view count:', err));
    });

  } catch (error) {
    logger.error('Stream error:', error);

    if (!res.headersSent) {
      res.status(500).json({ error: 'Streaming failed' });
    }
  }
};

export const getThumbnail = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findById(id).select('thumbnailUrl thumbnail organizationId');

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const thumbUrl = video.thumbnailUrl || video.thumbnail;

    if (!thumbUrl) {
      return res.status(404).json({ error: 'Thumbnail not available' });
    }

    // Check access (if auth middleware ran)
    if (req.organizationId && video.organizationId.toString() !== req.organizationId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If thumbnail is a URL, redirect
    if (thumbUrl.startsWith('http')) {
      return res.redirect(thumbUrl);
    }

    // If thumbnail is local path
    let thumbnailPath = thumbUrl;
    
    // Handle relative paths
    if (!path.isAbsolute(thumbnailPath)) {
      thumbnailPath = path.resolve(thumbnailPath);
    }

    if (!fs.existsSync(thumbnailPath)) {
      logger.warn(`Thumbnail file not found: ${thumbnailPath}`);
      return res.status(404).json({ error: 'Thumbnail file not found' });
    }

    res.sendFile(thumbnailPath);
  } catch (error) {
    logger.error('Thumbnail error:', error);
    res.status(500).json({ error: 'Failed to load thumbnail' });
  }
};

// Helper function to get MIME type
function getMimeType(format) {
  const mimeTypes = {
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'ogg': 'video/ogg',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'mkv': 'video/x-matroska'
  };

  return mimeTypes[format.toLowerCase()] || 'video/mp4';
}

export default {
  streamVideo,
  getThumbnail
};

