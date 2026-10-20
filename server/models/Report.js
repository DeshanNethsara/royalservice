import mongoose from 'mongoose';

const ReportSchema = new mongoose.Schema({
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  payment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  notes: { type: String },
  generated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { 
  timestamps: { createdAt: "created_at", updatedAt: false } 
});

export default mongoose.model('Report', ReportSchema);