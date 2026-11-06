import cron from 'node-cron';
import Booking from '../models/Booking.js';
import sendEmail from './sendEmail.js'; 

export const startReminderService = () => {
  // Runs every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('⏰ Running booking reminder check...');

    try {
      const now = new Date();
      
      // 🚨 CHANGED TO 5 HOURS: Calculate the target time window (Exactly 5 hours from now, up to 5h 5m from now)
      const fiveHoursFromNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
      const fiveMinutesAfterTarget = new Date(fiveHoursFromNow.getTime() + 5 * 60 * 1000);

      // Format date to YYYY-MM-DD
      const targetDateStr = fiveHoursFromNow.toISOString().split('T')[0];

      // Find active bookings for that date that haven't had a reminder sent yet
      const bookings = await Booking.find({
        booking_date: targetDateStr,
        status: { $in: ['Pending', 'Confirmed'] }, 
        reminder_sent: { $ne: true }
      })
      .populate('user_id', 'name email')
      .populate('service_id', 'name')
      .populate('vehicle_id', 'reg_number');

      for (const booking of bookings) {
        // Convert "10:30 AM" into a comparable Date object
        const [timeStr, period] = booking.booking_time.split(' ');
        const [hours, minutes] = timeStr.split(':').map(Number);
        let hour24 = hours;
        if (period === 'PM' && hours !== 12) hour24 += 12;
        if (period === 'AM' && hours === 12) hour24 = 0;

        const bookingDateTime = new Date(
          `${booking.booking_date}T${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
        );

        // Check if this booking is happening in exactly 5 hours
        if (bookingDateTime >= fiveHoursFromNow && bookingDateTime <= fiveMinutesAfterTarget) {
          const customer = booking.user_id;
          
          if (customer && customer.email) {
            try {
              await sendEmail({
                email: customer.email,
                // 🚨 UPDATED SUBJECT TO 5 HOURS
                subject: `⏰ Reminder: Your Appointment is in 5 Hours`,
                html: `
                  <h2>Appointment Reminder</h2>
                  <p>Hi ${customer.name},</p>
                  <p>This is a friendly reminder that your appointment for <strong>${booking.service_id?.name || 'Service'}</strong> is scheduled in 5 hours.</p>
                  
                  <div style="background-color: #f4f4f5; padding: 15px; border-radius: 8px; margin: 20px 0; color: #18181b;">
                    <h3 style="margin-top: 0; color: #18181b;">Appointment Details</h3>
                    <p><strong>Date:</strong> ${booking.booking_date}</p>
                    <p><strong>Time:</strong> ${booking.booking_time}</p>
                    <p><strong>Vehicle:</strong> ${booking.vehicle_id?.reg_number || 'N/A'}</p>
                    <p><strong>Reference:</strong> ${booking.booking_ref}</p>
                  </div>
                  
                  <p>Please ensure you arrive on time. If you need to cancel, please do so via your dashboard immediately.</p>
                  <br>
                  <p>Thank you,<br>Royal Service Center</p>
                `
              });

              // Mark as sent so the user doesn't get multiple emails
              booking.reminder_sent = true;
              await booking.save();
              console.log(`✅ 5-Hour Reminder sent to ${customer.email} for booking ${booking.booking_ref}`);
            } catch (emailError) {
              console.error(`❌ Failed to send reminder to ${customer.email}:`, emailError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error running reminder cron job:', error);
    }
  });

  console.log('✅ Booking reminder service started (Checking every 5 minutes for bookings 5 hours away).');
};