import express from 'express';
import adminController from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

// System statistics
router.get('/stats', adminController.getSystemStats);

// User management
router.get('/users', adminController.getAllUsers);
router.put('/users/:id/role', adminController.updateUserRole);
router.put('/users/:id/toggle-status', adminController.toggleUserStatus);
router.delete('/users/:id', adminController.deleteUser);

// Video management
router.get('/videos/flagged', adminController.getFlaggedVideos);
router.put('/videos/:id/review', adminController.reviewVideo);
router.get('/videos/:id/analysis', adminController.getVideoAnalysisReport);

// Sensitivity configuration
router.get('/sensitivity/config', adminController.getSensitivityConfig);
router.put('/sensitivity/config', adminController.updateSensitivityThresholds);

export default router;

