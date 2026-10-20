import express from 'express';
import { 
  register, 
  login, 
  forgotPassword, // 🚨 NEW
  resetPassword   // 🚨 NEW
} from '../controllers/authController.js';

const router = express.Router();

// Existing routes
router.post('/register', register);
router.post('/login', login);

// 🚨 NEW: Password Reset Routes
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

export default router;