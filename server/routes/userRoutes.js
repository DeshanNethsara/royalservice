import express from 'express';
import {
  getAllUsers,
  getUserById,        // ← NEW
  updateUserStatus,
  createStaffAccount,
  updateUserProfile,
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Require authentication for ALL routes in this file
router.use(protect);

// ==========================================================
// SPECIFIC ROUTES (must come BEFORE /:id routes)
// ==========================================================

// Admin-Only Routes
router.get('/', authorize('admin'), getAllUsers);
router.post('/staff', authorize('admin'), createStaffAccount);

// ==========================================================
// :id-BASED ROUTES
// ==========================================================

// Update user status (admin only)
router.patch('/:id/status', authorize('admin'), updateUserStatus);

// Get single user by ID (own profile or admin) — NEW
router.get('/:id', getUserById);

// Update user profile (own profile or admin)
router.put('/:id', updateUserProfile);

export default router;