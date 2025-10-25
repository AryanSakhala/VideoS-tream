import express from 'express';
import streamController from '../controllers/stream.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Stream video - use optional auth to support query param token
router.get('/:id',
  optionalAuth,
  streamController.streamVideo
);

// Get video thumbnail - use optional auth
router.get('/:id/thumbnail',
  optionalAuth,
  streamController.getThumbnail
);

export default router;

