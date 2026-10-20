import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema({
  booking_ref: { 
    type: String, 
    required: true, 
    unique: true 
  },
  
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  vehicle_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Vehicle', 
    required: true 
  },
  
  service_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Service', 
    required: true 
  },
  
  staff_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null 
  },
  
  booking_date: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{2}-\d{2}$/.test(v);
      },
      message: props => `${props.value} is not a valid date format! Use YYYY-MM-DD`
    }
  },
  
  booking_time: { 
    type: String, 
    required: true,
    enum: ['09:00 AM', '10:30 AM', '01:00 PM', '03:30 PM']
  },
  
  total_price: { 
    type: Number, 
    required: true,
    min: [0, 'Price cannot be negative']
  },
  
  payment_method: {
    type: String,
    enum: ['Cash', 'Card', 'Online', 'Bank Transfer'],
    default: 'Cash'
  },
  
  payment_status: {
    type: String,
    enum: ['Pending', 'Paid', 'Refunded'],
    default: 'Pending'
  },

  // Uploaded receipt image/PDF path
  payment_slip: {
    type: String,
    default: null
  },
  
  status: { 
    type: String, 
    enum: ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled', 'Rejected'], 
    default: 'Confirmed' 
  },
  
  rejection_reason: { 
    type: String,
    default: null
  },

  // 🚨 NEW: The issue described by the customer
  issue_description: {
    type: String,
    default: 'No specific issue described.'
  },
  
  // Technician log (written by staff)
  notes: {
    type: String,
    default: ''
  },

  // Rating and Review fields
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  review_comment: {
    type: String,
    default: null
  },
  
  completed_at: {
    type: Date,
    default: null
  },
  
  cancelled_at: {
    type: Date,
    default: null
  }
  
}, {
  timestamps: { 
    createdAt: "created_at", 
    updatedAt: "updated_at" 
  }
});

// Compound index for checking slot availability
BookingSchema.index({ 
  booking_date: 1, 
  booking_time: 1, 
  status: 1 
});

// Index for fetching user's bookings
BookingSchema.index({ 
  user_id: 1, 
  created_at: -1 
});

// Index for fetching staff's assigned bookings
BookingSchema.index({ 
  staff_id: 1, 
  booking_date: 1 
});

// Index for fetching all bookings by date (admin panel)
BookingSchema.index({ 
  booking_date: 1, 
  created_at: -1 
});

// Static method to check slot availability
BookingSchema.statics.checkSlotAvailability = async function(date, time, excludeBookingId = null) {
  const MAX_BOOKINGS_PER_SLOT = 3;
  
  const query = {
    booking_date: date,
    booking_time: time,
    status: { $nin: ['Cancelled', 'Rejected'] }
  };
  
  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }
  
  const bookingCount = await this.countDocuments(query);
  
  return {
    available: bookingCount < MAX_BOOKINGS_PER_SLOT,
    remainingSlots: Math.max(0, MAX_BOOKINGS_PER_SLOT - bookingCount),
    currentBookings: bookingCount
  };
};

// Static method to get bookings for a specific date
BookingSchema.statics.getBookingsByDate = async function(date) {
  return this.find({
    booking_date: date,
    status: { $nin: ['Cancelled', 'Rejected'] }
  })
  .select('booking_time booking_date status')
  .lean();
};

// Static method to generate unique booking reference
BookingSchema.statics.generateBookingRef = async function() {
  const prefix = 'RSC';
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  const datePrefix = `${prefix}-${year}${month}${day}`;
  const lastBooking = await this.findOne({
    booking_ref: { $regex: `^${datePrefix}` }
  })
  .sort({ booking_ref: -1 })
  .limit(1);
  
  let sequence = 1;
  if (lastBooking) {
    const lastSequence = parseInt(lastBooking.booking_ref.split('-')[2]);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }
  
  return `${datePrefix}-${String(sequence).padStart(4, '0')}`;
};

// Method to check if booking can be cancelled
BookingSchema.methods.canBeCancelled = function() {
  return ['Pending', 'Confirmed'].includes(this.status);
};

// Method to check if booking can be completed
BookingSchema.methods.canBeCompleted = function() {
  return this.status === 'In Progress';
};

// Method to check if booking can be started
BookingSchema.methods.canStart = function() {
  return this.status === 'Confirmed';
};

const Booking = mongoose.model('Booking', BookingSchema);

export default Booking;