import express from 'express';
import {
  getActiveServices,
  getAllServices,
  createService,
  updateService,
  deleteService,
} from '../controllers/serviceController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// ==========================================================
// PUBLIC ROUTES
// ==========================================================

// Customer route: view active services (homepage, booking flow)
router.get('/', getActiveServices);

// ==========================================================
// ADMIN ROUTES (Protected + Authorized)
// ==========================================================

router.use(protect);
router.use(authorize('admin'));

router.get('/all', getAllServices);
router.post('/', createService);
router.put('/:id', updateService);
router.delete('/:id', deleteService);   // ← NEW: Delete route

export default router;