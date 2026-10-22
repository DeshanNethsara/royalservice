import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  checkAvailability,
  getDateAvailability,
  createBooking,
  getCustomerBookings,
  getAllBookings,
  updateBookingStatus,
  generateServiceRecordPDF,
  generateMonthlyReportPDF, // 🚨 NEW: Import the report function
  assignStaff,
  deleteBooking,
  approvePayment,
  rateBooking,
  upload
} from '../controllers/bookingController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// ==========================================================
// 🚨 RATE LIMITER FOR BOOKINGS
// ==========================================================
const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // Limit each IP to 3 bookings per 10 minutes
  message: 'Too many booking attempts. Please wait 10 minutes before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
});

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

// Create booking with file upload (Apply the limiter here)
router.post('/', bookingLimiter, upload.single('payment_slip'), createBooking);

// 🚨 NEW: Monthly Report Route (Admin only)
// Must be placed BEFORE '/:id' routes so it isn't caught as an ID
router.get('/report/monthly', authorize('admin'), generateMonthlyReportPDF);

router.get('/:id/record', generateServiceRecordPDF);
router.patch('/:id/assign', authorize('admin'), assignStaff);
router.patch('/:id/status', updateBookingStatus);

// Admin route to approve the payment slip
router.patch('/:id/approve-payment', authorize('admin'), approvePayment);

// Customer route to submit a rating
router.post('/:id/rate', rateBooking);

router.delete('/:id', authorize('admin'), deleteBooking);

export default router;