import express from 'express';
import videoController from '../controllers/video.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { upload, handleMulterError } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { validate, schemas } from '../middleware/validator.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Upload video (editor and admin only)
router.post('/',
  authorize('editor', 'admin'),
  uploadLimiter,
  upload.single('video'),
  handleMulterError,
  videoController.uploadVideo
);

// Get all videos
router.get('/',
  videoController.getVideos
);

// Get specific video
router.get('/:id',
  videoController.getVideo
);

// Update video metadata
router.put('/:id',
  validate(schemas.updateVideo),
  videoController.updateVideo
);

// Delete video
router.delete('/:id',
  videoController.deleteVideo
);

// Get video processing status
router.get('/:id/status',
  videoController.getVideoStatus
);

export default router;

