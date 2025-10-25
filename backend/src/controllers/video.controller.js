import Video from '../models/Video.js';
import processingService from '../services/processing.service.js';
import storageService from '../services/storage.service.js';
import logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs';

export const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, description, visibility } = req.body;

    // Create video record
    const video = await Video.create({
      title: title || req.file.originalname,
      description: description || '',
      filename: req.file.filename,
      originalFilename: req.file.originalname,
      fileSize: req.file.size,
      format: path.extname(req.file.originalname).substring(1).toLowerCase(),
      storageProvider: process.env.STORAGE_PROVIDER || 'local',
      storageKey: req.file.filename,
      organizationId: req.organizationId,
      uploadedBy: req.userId,
      visibility: visibility || 'organization',
      status: 'processing'
    });

    // Trigger background processing
    await processingService.processVideo(video._id);

    logger.info(`Video uploaded: ${video._id} by user ${req.userId}`);

    res.status(201).json({
      message: 'Video uploaded successfully and processing started',
      video: {
        id: video._id,
        title: video.title,
        status: video.status,
        filename: video.filename,
        fileSize: video.fileSize,
        format: video.format
      }
    });
  } catch (error) {
    logger.error('Upload error:', error);

    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ error: 'Upload failed' });
  }
};

export const getVideos = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      sensitivityStatus,
      sortBy = 'createdAt',
      order = 'desc',
      search
    } = req.query;

    // Build query with organization filter
    const query = { organizationId: req.organizationId };

    // Apply filters
    if (status) query.status = status;
    if (sensitivityStatus) query.sensitivityStatus = sensitivityStatus;
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Role-based access control
    if (req.userRole !== 'admin') {
      query.$or = [
        { uploadedBy: req.userId },
        { visibility: 'organization' },
        { visibility: 'public' },
        { allowedUsers: req.userId }
      ];
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const videos = await Video.find(query)
      .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('uploadedBy', 'name email')
      .select('-__v')
      .lean();

    const total = await Video.countDocuments(query);

    res.json({
      videos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
};

export const getVideo = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findById(id)
      .populate('uploadedBy', 'name email role')
      .populate('sensitivityDetails.reviewedBy', 'name email');

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check organization access
    if (video.organizationId.toString() !== req.organizationId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check visibility permissions
    if (video.visibility === 'private' &&
        video.uploadedBy._id.toString() !== req.userId.toString() &&
        req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied to private video' });
    }

    res.json({ video });
  } catch (error) {
    logger.error('Get video error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
};

export const updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, visibility } = req.validatedData || req.body;

    const video = await Video.findById(id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check permissions
    if (video.uploadedBy.toString() !== req.userId.toString() && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Update fields
    if (title !== undefined) video.title = title;
    if (description !== undefined) video.description = description;
    if (visibility !== undefined) video.visibility = visibility;

    await video.save();

    logger.info(`Video updated: ${id}`);

    res.json({
      message: 'Video updated successfully',
      video
    });
  } catch (error) {
    logger.error('Update video error:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
};

export const deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findById(id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check permissions
    if (video.uploadedBy.toString() !== req.userId.toString() && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Delete file from storage
    try {
      await storageService.deleteFile(video.storageKey);
      
      // Delete thumbnail if exists
      if (video.thumbnailUrl) {
        await storageService.deleteFile(video.thumbnailUrl);
      }
    } catch (storageError) {
      logger.warn(`Failed to delete video file: ${storageError.message}`);
    }

    // Delete from database
    await video.deleteOne();

    logger.info(`Video deleted: ${id}`);

    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    logger.error('Delete video error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
};

export const getVideoStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findById(id)
      .select('status processingProgress sensitivityStatus');

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({
      status: video.status,
      progress: video.processingProgress,
      sensitivityStatus: video.sensitivityStatus
    });
  } catch (error) {
    logger.error('Get status error:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
};

export default {
  uploadVideo,
  getVideos,
  getVideo,
  updateVideo,
  deleteVideo,
  getVideoStatus
};

