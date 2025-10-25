import express from 'express';
import authRoutes from './auth.routes.js';
import videoRoutes from './video.routes.js';
import streamRoutes from './stream.routes.js';
import adminRoutes from './admin.routes.js';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0'
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/videos', videoRoutes);
router.use('/stream', streamRoutes);
router.use('/admin', adminRoutes);

export default router;
