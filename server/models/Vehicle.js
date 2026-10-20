import mongoose from 'mongoose';

const VehicleSchema = new mongoose.Schema({
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  reg_number: { 
    type: String, 
    required: true, 
    uppercase: true,
    trim: true
  },
  
  make: { 
    type: String, 
    required: true 
  },
  
  model: { 
    type: String, 
    required: true 
  },
  
  year: { 
    type: Number, 
    required: false,
    default: null
  },
  
  manufacture_year: { 
    type: Number,
    required: false,
    default: null
  },
  
  mileage: { 
    type: Number,
    default: 0
  },
  
  color: { 
    type: String,
    default: null
  },
  
  vehicle_type: {
    type: String,
    enum: ['Car', 'SUV', 'Van', 'Other'],
    default: 'Car'
  }
}, { 
  timestamps: { 
    createdAt: "created_at", 
    updatedAt: false 
  } 
});

// Indexes only - NO MIDDLEWARE
VehicleSchema.index({ user_id: 1 });
VehicleSchema.index({ reg_number: 1 });

const Vehicle = mongoose.model('Vehicle', VehicleSchema);

export default Vehicle;