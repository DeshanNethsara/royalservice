import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ['Card', 'Bank Transfer', 'Cash'], default: 'Card' },
  status: { type: String, enum: ['Pending', 'Paid', 'Refunded'], default: 'Pending' },
  transaction_id: { type: String },
  paid_at: { type: Date }
}, { 
  timestamps: { createdAt: "created_at", updatedAt: false } 
});

export default mongoose.model('Payment', PaymentSchema);