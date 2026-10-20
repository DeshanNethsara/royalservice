import "dotenv/config";
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

import connectDB from './configs/db.js';

import Message from './models/Message.js';
import User from './models/User.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';

const app = express();
const httpServer = createServer(app);

// =========================
// CORS CONFIGURATION
// =========================
// Allow localhost for dev, and the live domain for production
const allowedOrigins = [
  'http://localhost:5173',
  'https://royalservice.tech',
  'https://www.royalservice.tech',
  process.env.CLIENT_URL // Pulls from your Render environment variable
].filter(Boolean); 

// =========================
// SOCKET.IO
// =========================

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// =========================
// DATABASE
// =========================

await connectDB();

// =========================
// EXPRESS CORS
// =========================

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Content-Length', 'Content-Disposition'],
};

app.use(cors(corsOptions));

// =========================
// MIDDLEWARE
// =========================

app.use(
  express.json({
    limit: '10mb'
  })
);

app.use(
  express.urlencoded({
    limit: '10mb',
    extended: true
  })
);

// =========================
// API ROUTES
// =========================

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);

// =========================
// SOCKET CONNECTION
// =========================

const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log(`User connected to Comms-Link: ${socket.id}`);

  socket.on('user_connected', async ({ userId, role }) => {
    if (userId) {
      onlineUsers.set(userId, socket.id);
      socket.userId = userId;
      socket.userRole = role;
      console.log(`User ${userId} (${role}) is online`);

      if (role === 'admin') {
        socket.emit('fetch_contacts');
      }

      if (role !== 'admin') {
        try {
          const user = await User.findById(userId).select('name email role');
          if (user) {
            io.emit('user_online', {
              _id: user._id,
              name: user.name,
              email: user.email,
              role: user.role
            });
          }
        } catch (err) {
          console.error('Error fetching user details:', err);
        }
      }
    }
  });

  socket.on('fetch_contacts', async () => {
    try {
      const contacts = await User.find({
        role: { $in: ['customer', 'staff'] }
      })
        .select('name email role')
        .sort({ role: 1, name: 1 });

      const contactsWithLastMessage = await Promise.all(
        contacts.map(async (contact) => {
          const lastMessage = await Message.findOne({
            threadId: String(contact._id)
          })
            .sort({ createdAt: -1 })
            .select('createdAt');

          return {
            ...contact.toObject(),
            isOnline: onlineUsers.has(contact._id.toString()),
            lastMessageAt: lastMessage ? lastMessage.createdAt : null
          };
        })
      );

      contactsWithLastMessage.sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) {
          return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
        }
        if (a.lastMessageAt) return -1;
        if (b.lastMessageAt) return 1;
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return a.name.localeCompare(b.name);
      });

      socket.emit('contacts_list', contactsWithLastMessage);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  });

  socket.on('fetch_history', async (threadId) => {
    try {
      const history = await Message.find({
        threadId: String(threadId)
      }).sort({ createdAt: 1 });

      socket.emit('chat_history', history);
    } catch (err) {
      console.error('Error fetching history:', err);
      socket.emit('chat_history', []);
    }
  });

  socket.on('send_message', async (data) => {
    try {
      if (!data) return;
      if (!data.senderId) { console.error('Missing senderId'); return; }
      if (!data.senderName) { console.error('Missing senderName'); return; }
      if (!data.senderRole) { console.error('Missing senderRole'); return; }
      if (!data.threadId) { console.error('Missing threadId'); return; }
      if (!data.text || !data.text.trim()) { console.error('Missing message text'); return; }

      const messageData = {
        senderId: String(data.senderId),
        senderName: data.senderName,
        senderRole: data.senderRole,
        threadId: String(data.threadId),
        text: data.text.trim()
      };

      const newMsg = await Message.create(messageData);

      console.log(`Message saved: ${newMsg.senderName} - ${newMsg.senderRole}`);

      io.emit('receive_message', newMsg);
      io.emit('contact_updated', {
        threadId: String(data.threadId),
        lastMessageAt: newMsg.createdAt
      });
    } catch (err) {
      console.error('ERROR SAVING MESSAGE:', err);
    }
  });

  socket.on('typing', ({ threadId, userId, userName }) => {
    socket.broadcast.emit('typing', { threadId, userId, userName });
  });

  socket.on('stop_typing', ({ threadId, userId }) => {
    socket.broadcast.emit('stop_typing', { threadId, userId });
  });

  socket.on('clear_chat', async ({ threadId }) => {
    try {
      if (!threadId) return;
      await Message.deleteMany({ threadId: String(threadId) });
      console.log(`Chat cleared: ${threadId}`);
      io.emit('chat_cleared', { threadId: String(threadId) });
      io.emit('contact_updated', { threadId: String(threadId), lastMessageAt: null });
    } catch (err) {
      console.error('Error clearing chat:', err);
    }
  });

  socket.on('delete_chat', async ({ threadId, userId, role }) => {
    try {
      if (!threadId) return;
      if (role !== 'admin') {
        console.log(`User ${userId} attempted to delete chat without admin rights`);
        return;
      }
      await Message.deleteMany({ threadId: String(threadId) });
      console.log(`Chat deleted completely: ${threadId}`);
      io.emit('chat_deleted', { threadId: String(threadId) });
    } catch (err) {
      console.error('Error deleting chat:', err);
    }
  });

  socket.on('mark_read', ({ threadId, userId }) => {
    console.log(`Messages marked as read - Thread: ${threadId}, User: ${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        console.log(`User ${userId} is offline`);
        io.emit('user_offline', { userId });
        break;
      }
    }
  });
});

// =========================
// START SERVER
// =========================

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});