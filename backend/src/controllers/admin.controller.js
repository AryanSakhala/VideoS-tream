import User from '../models/User.js';
import Video from '../models/Video.js';
import Organization from '../models/Organization.js';
import processingService from '../services/processing.service.js';
import enhancedSensitivity from '../services/sensitivity.service.enhanced.js';
import logger from '../utils/logger.js';

/**
 * Admin Controller - Admin-only operations
 */

// Get system statistics
export const getSystemStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalOrganizations,
      totalVideos,
      processingVideos,
      completedVideos,
      flaggedVideos,
      queueStats
    ] = await Promise.all([
      User.countDocuments(),
      Organization.countDocuments(),
      Video.countDocuments(),
      Video.countDocuments({ status: 'processing' }),
      Video.countDocuments({ status: 'completed' }),
      Video.countDocuments({ sensitivityStatus: 'flagged' }),
      processingService.getQueueStats()
    ]);

    // Calculate storage used
    const storageAgg = await Video.aggregate([
      { $group: { _id: null, total: { $sum: '$fileSize' } } }
    ]);
    const storageUsed = storageAgg[0]?.total || 0;

    res.json({
      users: {
        total: totalUsers,
        byRole: await User.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } }
        ])
      },
      organizations: {
        total: totalOrganizations
      },
      videos: {
        total: totalVideos,
        processing: processingVideos,
        completed: completedVideos,
        flagged: flaggedVideos,
        storageUsedGB: (storageUsed / (1024 ** 3)).toFixed(2)
      },
      queue: queueStats || { waiting: 0, active: 0, completed: 0, failed: 0 }
    });
  } catch (error) {
    logger.error('Get system stats error:', error);
    res.status(500).json({ error: 'Failed to fetch system statistics' });
  }
};

// Get all users (admin only)
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;

    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password -refreshToken')
      .populate('organizationId', 'name slug')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Update user role
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['viewer', 'editor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true }
    ).select('-password -refreshToken');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`User role updated: ${id} -> ${role} by admin ${req.userId}`);

    res.json({
      message: 'User role updated successfully',
      user
    });
  } catch (error) {
    logger.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
};

// Deactivate/Activate user
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deactivating self
    if (user._id.toString() === req.userId.toString()) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    user.isActive = !user.isActive;
    await user.save();

    logger.info(
      `User ${user.isActive ? 'activated' : 'deactivated'}: ${id} by admin ${req.userId}`
    );

    res.json({
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: user._id,
        email: user.email,
        isActive: user.isActive
      }
    });
  } catch (error) {
    logger.error('Toggle user status error:', error);
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
};

// Get flagged videos
export const getFlaggedVideos = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const videos = await Video.find({ sensitivityStatus: 'flagged' })
      .populate('uploadedBy', 'name email')
      .populate('organizationId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Video.countDocuments({ sensitivityStatus: 'flagged' });

    res.json({
      videos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get flagged videos error:', error);
    res.status(500).json({ error: 'Failed to fetch flagged videos' });
  }
};

// Review video (approve/reject)
export const reviewVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['safe', 'flagged'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const video = await Video.findById(id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    video.sensitivityStatus = status;
    video.sensitivityDetails = {
      ...video.sensitivityDetails,
      reviewedBy: req.userId,
      reviewNotes: notes || '',
      reviewedAt: new Date()
    };

    await video.save();

    logger.info(`Video reviewed: ${id} -> ${status} by admin ${req.userId}`);

    res.json({
      message: 'Video review completed',
      video
    });
  } catch (error) {
    logger.error('Review video error:', error);
    res.status(500).json({ error: 'Failed to review video' });
  }
};

// Get sensitivity analysis configuration
export const getSensitivityConfig = async (req, res) => {
  try {
    const config = enhancedSensitivity.getConfiguration();
    res.json(config);
  } catch (error) {
    logger.error('Get sensitivity config error:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
};

// Update sensitivity thresholds
export const updateSensitivityThresholds = async (req, res) => {
  try {
    const { thresholds } = req.body;

    enhancedSensitivity.updateThresholds(thresholds);

    logger.info(`Sensitivity thresholds updated by admin ${req.userId}`);

    res.json({
      message: 'Sensitivity thresholds updated',
      config: enhancedSensitivity.getConfiguration()
    });
  } catch (error) {
    logger.error('Update sensitivity thresholds error:', error);
    res.status(500).json({ error: 'Failed to update thresholds' });
  }
};

// Get detailed video analysis report
export const getVideoAnalysisReport = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findById(id)
      .populate('uploadedBy', 'name email')
      .populate('sensitivityDetails.reviewedBy', 'name email');

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Generate detailed report if analysis data exists
    const report = {
      video: {
        id: video._id,
        title: video.title,
        status: video.status,
        sensitivityStatus: video.sensitivityStatus,
        sensitivityScore: video.sensitivityScore
      },
      analysis: video.sensitivityDetails,
      uploader: video.uploadedBy,
      metadata: {
        duration: video.duration,
        resolution: video.resolution,
        fileSize: video.fileSize,
        format: video.format,
        codec: video.metadata?.codec,
        bitrate: video.metadata?.bitrate
      },
      timestamps: {
        uploaded: video.createdAt,
        lastProcessed: video.updatedAt
      }
    };

    res.json(report);
  } catch (error) {
    logger.error('Get video analysis report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

// Delete user (admin only)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting self
    if (id === req.userId.toString()) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user's videos (optional - or reassign)
    const deleteVideos = req.query.deleteVideos === 'true';
    
    if (deleteVideos) {
      await Video.deleteMany({ uploadedBy: id });
      logger.info(`Deleted all videos for user ${id}`);
    }

    await user.deleteOne();

    logger.info(`User deleted: ${id} by admin ${req.userId}`);

    res.json({
      message: 'User deleted successfully',
      deletedVideos: deleteVideos
    });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

export default {
  getSystemStats,
  getAllUsers,
  updateUserRole,
  toggleUserStatus,
  getFlaggedVideos,
  reviewVideo,
  getSensitivityConfig,
  updateSensitivityThresholds,
  getVideoAnalysisReport,
  deleteUser
};

