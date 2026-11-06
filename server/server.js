import "dotenv/config";
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from '@exortek/express-mongo-sanitize';

import connectDB from './configs/db.js';
import Message from './models/Message.js';
import User from './models/User.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';

const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);

const allowedOrigins = [
  'http://localhost:5173',
  'https://royalservice.tech',
  'https://www.royalservice.tech',
  process.env.CLIENT_URL
].filter(Boolean); 

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

await connectDB();

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Content-Length', 'Content-Disposition'],
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(mongoSanitize());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);

const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log(`User connected to Comms-Link: ${socket.id}`);

  // 🚨 FIX 1: Handle the 'joinRoom' event from the frontend
  socket.on('joinRoom', (userId) => {
    socket.join(userId);
    console.log(`Socket ${socket.id} joined room ${userId}`);
  });

  socket.on('user_connected', async ({ userId, role }) => {
    if (userId) {
      onlineUsers.set(userId, socket.id);
      socket.userId = userId;
      socket.userRole = role;
      
      // Make sure they are in their own room
      socket.join(userId);

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
      }).select('name email role').sort({ role: 1, name: 1 });

      const contactsWithLastMessage = await Promise.all(
        contacts.map(async (contact) => {
          const lastMessage = await Message.findOne({ threadId: String(contact._id) })
            .sort({ createdAt: -1 }).select('createdAt');

          return {
            ...contact.toObject(),
            isOnline: onlineUsers.has(contact._id.toString()),
            lastMessageAt: lastMessage ? lastMessage.createdAt : null
          };
        })
      );

      contactsWithLastMessage.sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
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
      const history = await Message.find({ threadId: String(threadId) }).sort({ createdAt: 1 });
      socket.emit('chat_history', history);
    } catch (err) {
      console.error('Error fetching history:', err);
      socket.emit('chat_history', []);
    }
  });

  socket.on('send_message', async (data) => {
    try {
      if (!data || !data.senderId || !data.text) return;

      const messageData = {
        senderId: String(data.senderId),
        senderName: data.senderName,
        senderRole: data.senderRole,
        threadId: String(data.threadId),
        text: data.text.trim()
      };

      const newMsg = await Message.create(messageData);

      console.log(`Message saved: ${newMsg.senderName} - ${newMsg.senderRole}`);

      // 🚨 FIX 2: Emit as 'newMessage' to match the frontend listener
      io.emit('newMessage', newMsg); 
      
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
      io.emit('chat_cleared', { threadId: String(threadId) });
      io.emit('contact_updated', { threadId: String(threadId), lastMessageAt: null });
    } catch (err) {
      console.error('Error clearing chat:', err);
    }
  });

  socket.on('delete_chat', async ({ threadId, userId, role }) => {
    try {
      if (!threadId || role !== 'admin') return;
      await Message.deleteMany({ threadId: String(threadId) });
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
        io.emit('user_offline', { userId });
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});