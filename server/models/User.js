import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      trim: true 
    },
    email: { 
      type: String, 
      required: true, 
      unique: true,
      lowercase: true,
      trim: true 
    },
    phone: { 
      type: String, 
      required: true,
      trim: true 
    },
    password: { 
      type: String, 
      required: true 
    },
    role: { 
      type: String, 
      enum: ["customer", "staff", "admin"], 
      default: "customer" 
    },
    status: { 
      type: Number, 
      default: 1 // 1 = Active, 0 = Suspended
    },
    avatar: { 
      type: String, 
      default: "" 
    },

    // 🚨 NEW FIELDS FOR PASSWORD RESET
    resetPasswordToken: { 
      type: String,
      default: null 
    },
    resetPasswordExpire: { 
      type: Date,
      default: null 
    },

    // 🚨 NEW FIELDS FOR EXPONENTIAL BACKOFF
    resetPasswordLastSent: { 
      type: Date,
      default: null 
    },
    resetPasswordAttempts: { 
      type: Number,
      default: 0 
    }
  },
  { 
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" } 
  }
);

const User = mongoose.model("User", userSchema);

export default User;