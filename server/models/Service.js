import mongoose from 'mongoose';

const ServiceSchema = new mongoose.Schema({
  staff_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  price: { type: mongoose.Schema.Types.Mixed, required: true }, 
  description: { type: String },
  is_active: { type: Boolean, default: true }
}, {
  timestamps: { createdAt: "created_at", updatedAt: false }
});

const Service = mongoose.model('Service', ServiceSchema);

export default Service;