import express from 'express';
import authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validate, schemas } from '../middleware/validator.js';

const router = express.Router();

// Public routes
router.post('/register', 
  authLimiter,
  validate(schemas.register),
  authController.register
);

router.post('/login', 
  authLimiter,
  validate(schemas.login),
  authController.login
);

router.post('/refresh', 
  authController.refreshToken
);

// Protected routes
router.post('/logout', 
  authenticate,
  authController.logout
);

router.get('/me', 
  authenticate,
  authController.getMe
);

router.put('/profile', 
  authenticate,
  validate(schemas.updateProfile),
  authController.updateProfile
);

export default router;

