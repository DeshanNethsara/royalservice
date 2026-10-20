import express from 'express';
import {
  checkAvailability,
  getDateAvailability,
  createBooking,
  getCustomerBookings,
  getAllBookings,
  updateBookingStatus,
  generateServiceRecordPDF,
  assignStaff,
  deleteBooking,
  approvePayment,
  rateBooking, // 👈 Import the new rateBooking function
  upload
} from '../controllers/bookingController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// ==========================================================
// PUBLIC ROUTES
// ==========================================================
router.get('/availability', checkAvailability);

// ==========================================================
// PROTECTED ROUTES
// ==========================================================
router.use(protect); // Apply auth to everything below

router.get('/my-bookings', getCustomerBookings);
router.get('/all', authorize('admin', 'staff'), getAllBookings);
router.get('/date/:date', getDateAvailability);

// Create booking with file upload
router.post('/', upload.single('payment_slip'), createBooking);

router.get('/:id/record', generateServiceRecordPDF);
router.patch('/:id/assign', authorize('admin'), assignStaff);
router.patch('/:id/status', updateBookingStatus);

// Admin route to approve the payment slip
router.patch('/:id/approve-payment', authorize('admin'), approvePayment);

// 🚨 NEW: Customer route to submit a rating
router.post('/:id/rate', rateBooking);

router.delete('/:id', authorize('admin'), deleteBooking);

export default router;