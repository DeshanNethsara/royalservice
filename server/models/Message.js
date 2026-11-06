import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: String,
      required: true
    },

    senderName: {
      type: String,
      required: true
    },

    senderRole: {
      type: String,
      enum: ['customer', 'admin', 'staff', 'bot'],
      required: true
    },

    // Customer/Staff ID this conversation belongs to
    threadId: {
      type: String,
      required: true
    },

    text: {
      type: String,
      required: true
    },

    // 🚨 NEW: Track if the message has been read by the admin
    isRead: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

const Message = mongoose.model('Message', messageSchema);

export default Message;