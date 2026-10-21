import Booking from '../models/Booking.js';
import Vehicle from '../models/Vehicle.js';
import Payment from '../models/Payment.js';
import Report from '../models/Report.js';
import PDFDocument from 'pdfkit';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
// 🚨 UPDATED: Using the v2 compatible storage engine
import { CloudinaryStorage } from 'multer-storage-cloudinary-v2';
import sendEmail from '../utils/sendEmail.js';

// Imports for finding the logo file path
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================================
// CLOUDINARY CONFIGURATION
// ==========================================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  // 🚨 UPDATED: v2 requires params to be a function that returns the config
  params: async (req, file) => {
    return {
      folder: 'royal_service_slips',
      allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'],
    };
  },
});

export const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// ==========================================================
// HELPERS
// ==========================================================
const SLOT_CAPACITY = 3;
const TIME_SLOTS = ['09:00 AM', '10:30 AM', '01:00 PM', '03:30 PM'];

const isTimeSlotInPast = (date, time) => {
  const now = new Date();
  const [timeStr, period] = time.split(' ');
  const [hours, minutes] = timeStr.split(':').map(Number);
  let hour24 = hours;

  if (period === 'PM' && hours !== 12) hour24 += 12;
  if (period === 'AM' && hours === 12) hour24 = 0;

  const slotDateTime = new Date(
    `${date}T${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
  );
  return slotDateTime < now;
};

// Generates the PDF and returns a Buffer
const buildServiceRecordPDF = (booking, report, payment) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const M = 40;
    const BRAND_RED = '#dc2626';
    const BRAND_DARK = '#18181b';
    const GRAY_TEXT = '#52525b';
    const LIGHT_GRAY = '#f4f4f5';
    const BORDER_GRAY = '#e4e4e7';

    const vehicle = booking.vehicle_id;
    const customer = booking.user_id;
    const service = booking.service_id;
    const technician = booking.staff_id?.name || 'Not Assigned';
    const authorizedBy = report.generated_by?.name || 'Staff';

    const formatDate = (date) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    };

    const formatLKR = (amount) => {
      if (!amount) return 'LKR 0.00';
      return `LKR ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Calculate Next Service Mileage
    const currentMileage = Number(vehicle?.mileage) || 0;
    const nextServiceMileage = currentMileage + 5000;
    const formattedCurrentMileage = currentMileage.toLocaleString('en-US');
    const formattedNextMileage = nextServiceMileage.toLocaleString('en-US');

    doc.rect(0, 0, PAGE_W, 110).fill(BRAND_DARK);
    doc.rect(0, 110, PAGE_W, 4).fill(BRAND_RED);
    
    // Logo Image
    const logoPath = path.join(__dirname, 'logo.png');
    doc.image(logoPath, M, 30, { width: 50, height: 50 });
    
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('ROYAL SERVICE CENTER', M + 65, 32);
    doc.fillColor('#a1a1aa').fontSize(9).font('Helvetica').text('PREMIUM AUTOMOTIVE CARE', M + 65, 62, { characterSpacing: 1.5 });
    doc.fillColor('#a1a1aa').fontSize(8).font('Helvetica').text('OFFICIAL DOCUMENT', PAGE_W - M - 180, 32, { width: 180, align: 'right' });
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text(`#${booking.booking_ref}`, PAGE_W - M - 180, 48, { width: 180, align: 'right' });
    doc.fillColor('#a1a1aa').fontSize(8).font('Helvetica').text(`Issued: ${formatDate(report.created_at)}`, PAGE_W - M - 180, 68, { width: 180, align: 'right' });

    let y = 145;
    doc.fillColor(BRAND_DARK).fontSize(26).font('Helvetica-Bold').text('SERVICE RECORD', M, y);
    doc.fillColor(BRAND_RED).fontSize(10).font('Helvetica-Bold').text('COMPLETION CERTIFICATE', M, y + 34, { characterSpacing: 2 });
    y += 70;
    doc.moveTo(M, y).lineTo(PAGE_W - M, y).strokeColor(BORDER_GRAY).lineWidth(1).stroke();
    y += 25;

    const cardW = (PAGE_W - M * 2 - 20) / 2;
    const cardH = 90;
    const drawInfoCard = (x, yPos, title, lines) => {
      doc.rect(x, yPos, cardW, cardH).fill(LIGHT_GRAY);
      doc.rect(x, yPos, 4, cardH).fill(BRAND_RED);
      doc.fillColor(BRAND_RED).fontSize(8).font('Helvetica-Bold').text(title, x + 15, yPos + 12, { characterSpacing: 1.2 });
      let lineY = yPos + 30;
      lines.forEach((line, i) => {
        if (i === 0) doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND_DARK);
        else doc.font('Helvetica').fontSize(9).fillColor(GRAY_TEXT);
        doc.text(line, x + 15, lineY, { width: cardW - 25 });
        lineY += i === 0 ? 18 : 13;
      });
    };

    drawInfoCard(M, y, 'CUSTOMER', [customer?.name || 'N/A', customer?.email || 'N/A', customer?.phone || 'N/A']);
    
    // Vehicle Card
    drawInfoCard(M + cardW + 20, y, 'VEHICLE', [
      vehicle?.reg_number?.toUpperCase() || 'N/A',
      `${vehicle?.make || 'N/A'} ${vehicle?.model || ''}`.trim(),
      `Year: ${vehicle?.manufacture_year || vehicle?.year || 'N/A'}`,
      `Mileage: ${formattedCurrentMileage} km → Next: ${formattedNextMileage} km`,
    ]);
    
    y += cardH + 15;
    drawInfoCard(M, y, 'SERVICE PERFORMED', [service?.name || 'N/A', service?.description ? service.description.slice(0, 90) + '...' : 'General service', `Duration: ${service?.duration_minutes ? service.duration_minutes + ' min' : 'N/A'}`]);
    drawInfoCard(M + cardW + 20, y, 'SCHEDULE', [formatDate(booking.booking_date), `Time Slot: ${booking.booking_time || 'N/A'}`, `Completed: ${formatDate(booking.completed_at || report.created_at)}`]);
    y += cardH + 30;

    const halfW = (PAGE_W - M * 2 - 20) / 2;
    const sectionH = 100;
    doc.rect(M, y, halfW, sectionH).fillColor('#ffffff').fill();
    doc.rect(M, y, halfW, sectionH).strokeColor(BORDER_GRAY).lineWidth(1).stroke();
    doc.fillColor(BRAND_DARK).fontSize(9).font('Helvetica-Bold').text('TECHNICAL TEAM', M + 15, y + 15, { characterSpacing: 1.2 });
    doc.moveTo(M + 15, y + 30).lineTo(M + halfW - 15, y + 30).strokeColor(BORDER_GRAY).stroke();
    doc.fillColor(GRAY_TEXT).fontSize(8).font('Helvetica').text('Assigned Technician', M + 15, y + 40);
    doc.fillColor(BRAND_DARK).fontSize(11).font('Helvetica-Bold').text(technician, M + 15, y + 52);
    doc.fillColor(GRAY_TEXT).fontSize(8).font('Helvetica').text('Authorized By', M + 15, y + 72);
    doc.fillColor(BRAND_DARK).fontSize(10).font('Helvetica-Bold').text(authorizedBy, M + 15, y + 84);

    const payX = M + halfW + 20;
    doc.rect(payX, y, halfW, sectionH).fill(BRAND_DARK);
    doc.fillColor('#a1a1aa').fontSize(9).font('Helvetica-Bold').text('PAYMENT SUMMARY', payX + 15, y + 15, { characterSpacing: 1.2 });
    doc.moveTo(payX + 15, y + 30).lineTo(payX + halfW - 15, y + 30).strokeColor('#3f3f46').stroke();
    doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text(formatLKR(booking.total_price), payX + 15, y + 42);
    doc.fillColor('#a1a1aa').fontSize(8).font('Helvetica').text(`Method: ${payment?.method || booking.payment_method || 'Cash'}   •   Status: ${payment?.status || booking.payment_status || 'Paid'}`, payX + 15, y + 72);
    y += sectionH + 25;

    doc.fillColor(BRAND_DARK).fontSize(11).font('Helvetica-Bold').text('TECHNICIAN NOTES', M, y, { characterSpacing: 1.2 });
    doc.moveTo(M, y + 16).lineTo(M + 40, y + 16).strokeColor(BRAND_RED).lineWidth(3).stroke();
    doc.moveTo(M + 40, y + 16).lineTo(PAGE_W - M, y + 16).strokeColor(BORDER_GRAY).lineWidth(1).stroke();
    y += 30;
    doc.fillColor(GRAY_TEXT).fontSize(10).font('Helvetica').text(report.notes || 'Routine service completed successfully.', M, y, { width: PAGE_W - M * 2, align: 'justify', lineGap: 3 });
    
    // Grab dynamic Y position after notes
    y = doc.y + 20;

    // NEXT SERVICE RECOMMENDATION BANNER
    const recH = 70;
    doc.rect(M, y, PAGE_W - M * 2, recH).fill('#fef2f2');
    doc.rect(M, y, 4, recH).fill(BRAND_RED);
    doc.fillColor(BRAND_RED).fontSize(9).font('Helvetica-Bold').text('NEXT SERVICE RECOMMENDATION', M + 15, y + 12, { characterSpacing: 1.2 });
    doc.fillColor(BRAND_DARK).fontSize(14).font('Helvetica-Bold').text(`Due at ${formattedNextMileage} km`, M + 15, y + 28);
    doc.fillColor(GRAY_TEXT).fontSize(8.5).font('Helvetica').text(`Schedule your next service after ${formattedNextMileage} km (current: ${formattedCurrentMileage} km). Timely maintenance ensures optimal performance and longevity of your vehicle.`, M + 15, y + 48, { width: PAGE_W - M * 2 - 30, lineGap: 2 });
    
    // Update Y dynamically based on the bottom of the banner
    y = y + recH + 20;

    // CERTIFICATION BOX
    const certH = 70;
    doc.rect(M, y, PAGE_W - M * 2, certH).fill(LIGHT_GRAY);
    doc.rect(M, y, 4, certH).fill(BRAND_RED);
    doc.fillColor(BRAND_DARK).fontSize(9).font('Helvetica-Bold').text('CERTIFICATION', M + 15, y + 12, { characterSpacing: 1.2 });
    doc.fillColor(GRAY_TEXT).fontSize(8.5).font('Helvetica').text('This document certifies that the above-mentioned service was performed on the stated vehicle by Royal Service Center.', M + 15, y + 28, { width: PAGE_W - M * 2 - 30, lineGap: 2 });

    // FOOTER
    const footerY = PAGE_H - 70;
    
    // Only draw footer if it doesn't overlap the content
    if (y + certH < footerY - 10) {
      doc.moveTo(M, footerY).lineTo(PAGE_W - M, footerY).strokeColor(BORDER_GRAY).lineWidth(1).stroke();
      doc.fillColor(BRAND_DARK).fontSize(9).font('Helvetica-Bold').text('ROYAL SERVICE CENTER', M, footerY + 12);
      doc.fillColor(GRAY_TEXT).fontSize(8).font('Helvetica').text('123 Service Road, Colombo 05, Sri Lanka', M, footerY + 26);
      doc.fillColor(GRAY_TEXT).fontSize(8).font('Helvetica').text('+94 11 760 0800  •  support@royalservice.lk', M, footerY + 38);
      doc.fillColor(GRAY_TEXT).fontSize(7.5).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, PAGE_W - M - 200, footerY + 26, { width: 200, align: 'right' });
      doc.fillColor(BRAND_RED).fontSize(7.5).font('Helvetica-Bold').text('OFFICIAL DOCUMENT', PAGE_W - M - 200, footerY + 38, { width: 200, align: 'right', characterSpacing: 1 });
    }

    doc.end();
  });
};

// ==========================================================
// CONTROLLERS
// ==========================================================

export const checkAvailability = async (req, res) => {
  const { date, time } = req.query;
  try {
    if (!date || !time) return res.status(400).json({ message: 'Date and time are required' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    const today = new Date().toISOString().split('T')[0];
    if (date < today) return res.status(400).json({ message: 'Cannot check availability for past dates', available: false, remainingSlots: 0 });
    if (isTimeSlotInPast(date, time)) return res.status(400).json({ message: 'This time slot has already passed', available: false, remainingSlots: 0 });
    const count = await Booking.countDocuments({ booking_date: date, booking_time: time, status: { $nin: ['Cancelled', 'Rejected'] } });
    const remainingSlots = Math.max(0, SLOT_CAPACITY - count);
    res.json({ date, time, available: remainingSlots > 0, remainingSlots, totalCapacity: SLOT_CAPACITY, currentBookings: count });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const getDateAvailability = async (req, res) => {
  const { date } = req.params;
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    const today = new Date().toISOString().split('T')[0];
    if (date < today) return res.status(400).json({ message: 'Cannot check availability for past dates' });
    const availability = await Promise.all(TIME_SLOTS.map(async (time) => {
      const isPast = isTimeSlotInPast(date, time);
      if (isPast) return { time, available: false, remainingSlots: 0, isPast: true, currentBookings: 0 };
      const count = await Booking.countDocuments({ booking_date: date, booking_time: time, status: { $nin: ['Cancelled', 'Rejected'] } });
      return { time, available: count < SLOT_CAPACITY, remainingSlots: Math.max(0, SLOT_CAPACITY - count), isPast: false, currentBookings: count };
    }));
    res.json({ date, timeSlots: availability, totalCapacity: SLOT_CAPACITY });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const createBooking = async (req, res) => {
  try {
    console.log('=== CREATE BOOKING ===');
    let vehicleData = req.body.vehicleData;
    if (typeof vehicleData === 'string') {
      try { vehicleData = JSON.parse(vehicleData); } catch (e) { return res.status(400).json({ message: 'Invalid vehicle data format' }); }
    }
    
    const { service_id, booking_date, booking_time, total_price, payment_method, issue_description } = req.body;
    const payment_slip = req.file ? req.file.path : null;

    if (!vehicleData || !service_id || !booking_date || !booking_time || !total_price) return res.status(400).json({ message: 'Missing required fields' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    const today = new Date().toISOString().split('T')[0];
    if (booking_date < today) return res.status(400).json({ message: 'Cannot book for past dates' });
    if (isTimeSlotInPast(booking_date, booking_time)) return res.status(400).json({ message: 'This time slot has already passed' });

    const activeBookings = await Booking.countDocuments({ booking_date, booking_time, status: { $nin: ['Cancelled', 'Rejected'] } });
    if (activeBookings >= SLOT_CAPACITY) return res.status(409).json({ message: 'Selected time slot is fully booked. Please select another time.', available: false });

    let vehicle;
    try {
      if (vehicleData._id) {
        vehicle = await Vehicle.findById(vehicleData._id);
        if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
        if (vehicleData.mileage !== undefined && vehicleData.mileage !== null && vehicleData.mileage !== '') {
          vehicle.mileage = Number(vehicleData.mileage);
          await vehicle.save();
        }
      } else {
        const regNumber = String(vehicleData.reg_number || '').toUpperCase();
        vehicle = await Vehicle.findOne({ reg_number: regNumber, user_id: req.user._id });
        if (!vehicle) {
          const yearValue = Number(vehicleData.manufacture_year || vehicleData.year || new Date().getFullYear());
          vehicle = await Vehicle.create({
            user_id: req.user._id,
            reg_number: regNumber,
            make: vehicleData.make || 'Unknown',
            model: vehicleData.model || 'Unknown',
            year: yearValue,
            manufacture_year: yearValue,
            mileage: Number(vehicleData.mileage) || 0,
            color: vehicleData.color || null,
            vehicle_type: vehicleData.vehicle_type || 'Car'
          });
        } else {
          if (vehicleData.mileage !== undefined && vehicleData.mileage !== null && vehicleData.mileage !== '') {
            vehicle.mileage = Number(vehicleData.mileage);
            await vehicle.save();
          }
        }
      }
    } catch (vehicleError) { return res.status(400).json({ message: 'Error creating vehicle: ' + vehicleError.message }); }

    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const booking_ref = `BK-${timestamp}-${random}`;
    const initialStatus = payment_method === 'Bank Transfer' ? 'Pending' : 'Confirmed';
    const initialPaymentStatus = payment_method === 'Bank Transfer' ? 'Pending' : 'Paid';

    const booking = await Booking.create({ 
      booking_ref, 
      user_id: req.user._id, 
      vehicle_id: vehicle._id, 
      service_id, 
      booking_date, 
      booking_time, 
      total_price: Number(total_price), 
      status: initialStatus, 
      payment_method: payment_method || 'Cash', 
      payment_slip: payment_slip, 
      payment_status: initialPaymentStatus,
      issue_description: issue_description || 'No specific issue described.'
    });

    try {
      await Payment.create({ booking_id: booking._id, amount: Number(total_price), method: payment_method || 'Cash', status: initialPaymentStatus, transaction_id: `TX-${Date.now().toString().slice(-8)}`, paid_at: payment_method === 'Cash' ? new Date() : null });
    } catch (paymentError) { console.error('Payment creation error:', paymentError.message); }

    const populatedBooking = await Booking.findById(booking._id).populate('service_id').populate('vehicle_id').populate('user_id', 'name email phone');

    if (payment_method !== 'Bank Transfer' && populatedBooking.user_id?.email) {
      try {
        await sendEmail({
          email: populatedBooking.user_id.email,
          subject: `Booking Confirmed - Pay at Service Center: ${populatedBooking.booking_ref}`,
          html: `<h2>Booking Confirmed!</h2><p>Hi ${populatedBooking.user_id.name},</p><p>Your appointment for <strong>${populatedBooking.service_id?.name || 'Service'}</strong> is confirmed.</p><div style="background-color: #f4f4f5; padding: 15px; border-radius: 8px; margin: 20px 0;"><h3 style="margin-top: 0; color: #18181b;">Payment Details</h3><p><strong>Amount to Pay:</strong> LKR ${Number(populatedBooking.total_price).toLocaleString()}</p><p><strong>Method:</strong> Pay at Service Center (Cash/Card)</p><p><em>Please pay this amount when you arrive for your appointment.</em></p></div><p><strong>Date:</strong> ${populatedBooking.booking_date}</p><p><strong>Time:</strong> ${populatedBooking.booking_time}</p><p><strong>Reference:</strong> ${populatedBooking.booking_ref}</p><br><p>Thank you,<br>Royal Service Center</p>`,
        });
      } catch (emailError) { console.error('Failed to send instant confirmation email:', emailError); }
    }

    res.status(201).json({ message: 'Booking created successfully', booking_ref: booking.booking_ref, booking: populatedBooking });
  } catch (error) { res.status(500).json({ message: 'Error creating booking: ' + error.message }); }
};

export const approvePayment = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.payment_status === 'Paid') return res.status(400).json({ message: 'Payment is already approved' });
    booking.status = 'Confirmed'; booking.payment_status = 'Paid'; await booking.save();
    await Payment.findOneAndUpdate({ booking_id: booking._id }, { status: 'Paid', paid_at: new Date() });

    const populatedBooking = await Booking.findById(booking._id).populate('user_id', 'name email').populate('service_id', 'name');
    if (populatedBooking.user_id?.email) {
      try {
        await sendEmail({ email: populatedBooking.user_id.email, subject: `Appointment Confirmed: ${populatedBooking.booking_ref}`, html: `<h2>Appointment Confirmed!</h2><p>Hi ${populatedBooking.user_id.name},</p><p>Your payment has been approved and your appointment for <strong>${populatedBooking.service_id?.name || 'Service'}</strong> is confirmed.</p><p><strong>Date:</strong> ${populatedBooking.booking_date}</p><p><strong>Time:</strong> ${populatedBooking.booking_time}</p><p><strong>Reference:</strong> ${populatedBooking.booking_ref}</p><br><p>Thank you,<br>Royal Service Center</p>` });
      } catch (emailError) { console.error('Failed to send confirmation email:', emailError); }
    }
    res.json({ message: 'Payment approved and booking confirmed', booking });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const getCustomerBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user_id: req.user._id }).populate('service_id').populate('vehicle_id').populate('staff_id', 'name email').sort({ created_at: -1 });
    res.json(bookings);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find().populate('user_id', 'name email phone').populate('service_id').populate('vehicle_id').populate('staff_id', 'name email').sort({ booking_date: -1, booking_time: 1 }).lean();
    const formattedBookings = bookings.map((b) => ({ ...b, vehicleData: b.vehicle_id, userData: b.user_id }));
    res.json(formattedBookings);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const assignStaff = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, { staff_id: req.body.staff_id || null }, { new: true }).populate('staff_id', 'name email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ message: 'Staff assigned successfully', booking });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    await Payment.findOneAndDelete({ booking_id: req.params.id });
    await Report.findOneAndDelete({ booking_id: req.params.id });
    res.json({ message: 'Booking deleted successfully' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const updateBookingStatus = async (req, res) => {
  const { status, notes, rejection_reason, assigned_technician } = req.body;

  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const isAdmin = req.user.role === 'admin';
    const isStaff = req.user.role === 'staff';
    const isOwner = booking.user_id.toString() === req.user._id.toString();

    if (status === 'Cancelled') {
      if (!isOwner && !isAdmin) return res.status(403).json({ message: 'You can only cancel your own bookings' });
      if (!['Pending', 'Confirmed'].includes(booking.status)) return res.status(400).json({ message: `Cannot cancel booking with status: ${booking.status}` });
      if (!isAdmin) {
        const now = new Date();
        const [timeStr, period] = booking.booking_time.split(' ');
        const [hours, minutes] = timeStr.split(':').map(Number);
        let hour24 = hours;
        if (period === 'PM' && hours !== 12) hour24 += 12;
        if (period === 'AM' && hours === 12) hour24 = 0;
        const bookingDateTime = new Date(`${booking.booking_date}T${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
        if ((bookingDateTime - now) / (1000 * 60 * 60) <= 2) return res.status(400).json({ message: 'Cannot cancel less than 2 hours before appointment' });
      }
      booking.status = 'Cancelled';
      booking.cancelled_at = new Date();
    } else if (['Completed', 'In Progress', 'Rejected', 'Confirmed', 'Pending'].includes(status)) {
      if (!isAdmin && !isStaff) return res.status(403).json({ message: 'Not authorized' });
      booking.status = status;
      if (status === 'Completed') {
        booking.completed_at = new Date();
        if (booking.payment_status === 'Pending') {
          booking.payment_status = 'Paid';
          await Payment.findOneAndUpdate({ booking_id: booking._id }, { status: 'Paid', paid_at: new Date() });
        }
      }
    } else {
      return res.status(400).json({ message: 'Invalid status update' });
    }

    if (rejection_reason) booking.rejection_reason = rejection_reason;
    if (assigned_technician) booking.assigned_technician = assigned_technician;
    await booking.save();

    if (status === 'Confirmed') {
      const populated = await Booking.findById(booking._id).populate('user_id', 'name email').populate('service_id', 'name');
      if (populated.user_id?.email) {
        try {
          await sendEmail({ email: populated.user_id.email, subject: `Appointment Confirmed: ${populated.booking_ref}`, html: `<h2>Appointment Confirmed!</h2><p>Hi ${populated.user_id.name},</p><p>Your appointment for <strong>${populated.service_id?.name || 'Service'}</strong> is confirmed.</p><p><strong>Date:</strong> ${populated.booking_date}</p><p><strong>Time:</strong> ${populated.booking_time}</p><p><strong>Reference:</strong> ${populated.booking_ref}</p><br><p>Thank you,<br>Royal Service Center</p>` });
        } catch (err) { console.error('Confirmation email failed:', err); }
      }
    }

    if (status === 'Completed') {
      const payment = await Payment.findOne({ booking_id: booking._id });
      let existingReport = await Report.findOne({ booking_id: booking._id });

      if (!existingReport) {
        existingReport = await Report.create({ booking_id: booking._id, payment_id: payment ? payment._id : null, notes: notes || 'Service completed successfully.', generated_by: req.user._id });
      }

      try {
        const populated = await Booking.findById(booking._id).populate('user_id', 'name email').populate('vehicle_id').populate('service_id').populate('staff_id', 'name');
        const fullReport = await Report.findById(existingReport._id).populate('generated_by');

        if (populated.user_id?.email) {
          const pdfBuffer = await buildServiceRecordPDF(populated, fullReport, payment);

          await sendEmail({
            email: populated.user_id.email,
            subject: `Service Completed - Your Record is Attached: ${populated.booking_ref}`,
            html: `<h2>Your Service is Complete! 🎉</h2><p>Hi ${populated.user_id.name},</p><p>Great news! Your vehicle (<strong>${populated.vehicle_id?.reg_number || 'N/A'}</strong>) has been serviced and is ready for pickup.</p><p>Thank you for choosing Royal Service Center. We have attached your official Service Record PDF to this email for your records.</p><br><p>Cheers,<br>Royal Service Center Team</p>`,
            attachments: [{ filename: `Service_Record_${populated.booking_ref}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
          });
          console.log('✅ Completion email with PDF sent to:', populated.user_id.email);
        }
      } catch (emailErr) { console.error('❌ Failed to send completion email with PDF:', emailErr); }
    }

    res.json({ message: 'Booking status updated successfully', booking });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ message: error.message });
  }
};

export const rateBooking = async (req, res) => {
  const { rating, review_comment } = req.body;
  try {
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Please provide a valid rating (1-5)' });
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user_id.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'You can only rate your own bookings' });
    if (booking.status !== 'Completed') return res.status(400).json({ message: 'You can only rate completed services' });
    booking.rating = Number(rating);
    booking.review_comment = review_comment || '';
    await booking.save();
    res.json({ message: 'Thank you for your feedback!', booking });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const generateServiceRecordPDF = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('user_id').populate('vehicle_id').populate('service_id').populate('staff_id', 'name');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'Completed') return res.status(400).json({ message: 'Record only for completed bookings' });

    const report = await Report.findOne({ booking_id: booking._id }).populate('generated_by');
    if (!report) return res.status(404).json({ message: 'Record not yet generated' });

    const payment = await Payment.findOne({ booking_id: booking._id });
    const pdfBuffer = await buildServiceRecordPDF(booking, report, payment);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Service_Record_${booking.booking_ref}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    if (!res.headersSent) res.status(500).json({ message: error.message || 'Failed to generate PDF' });
  }
};