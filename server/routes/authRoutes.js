import express from 'express';
import rateLimit from 'express-rate-limit'; // 🚨 NEW: Import rateLimit
import { 
  register, 
  login, 
  forgotPassword, 
  resetPassword   
} from '../controllers/authController.js';

const router = express.Router();

// ==========================================================
// 🚨 RATE LIMITER FOR REGISTRATION
// ==========================================================
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 registrations per hour
  message: 'Too many accounts created from this IP. Please try again after an hour.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Existing routes
// Apply the limiter to the register route
router.post('/register', registerLimiter, register);
router.post('/login', login);

// Password Reset Routes
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

export default router;