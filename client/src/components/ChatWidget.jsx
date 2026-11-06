import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling']
});

export default function ChatWidget() {
  const { user } = useContext(AuthContext);
  
  // Widget specific state
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Chat state
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  
  const activeThreadRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const hasSentFirstMessageRef = useRef(false);

  const getUserId = useCallback(() => user?._id || user?.id, [user]);

  // Only block Admins. Allow both customers and staff.
  if (!user || user.role === 'admin') return null;

  const quickCommands = [
    { id: 'booking', label: '📅 How to Book', question: 'How do I book an appointment?' },
    { id: 'contact', label: '📞 Contact Number', question: 'What is your contact number?' },
    { id: 'services', label: '🔧 Services Offered', question: 'What services do you offer?' },
    { id: 'hours', label: '🕒 Operating Hours', question: 'What are your operating hours?' },
    { id: 'status', label: '📊 Booking Status', question: 'How can I check my booking status?' }
  ];

  const fetchRealBookingStatus = async () => {
    try {
      const response = await axiosClient.get('/bookings/my-bookings');
      const bookings = response.data;
      if (!bookings || bookings.length === 0) return "You don't have any bookings yet. Click 'New Booking' on the dashboard!";
      const recentBookings = bookings.slice(0, 3).map(b => `• ${b.service_id?.name || 'Service'} - Status: ${b.status}`).join('\n');
      return `Here are your recent bookings:\n\n${recentBookings}`;
    } catch (error) {
      return "I'm having trouble accessing your booking data.";
    }
  };

  const getAutoReply = async (question) => {
    const q = question.toLowerCase();
    if (q.includes('status') || q.includes('track') || q.includes('check')) return await fetchRealBookingStatus();
    if (q.includes('book') || q.includes('appointment')) return `📅 To book:\n1. Click "NEW BOOKING" on the dashboard.\n2. Select your vehicle and service.\n3. Choose a date and time.\n4. Confirm your booking!`;
    if (q.includes('contact') || q.includes('phone')) return `📞 Phone: +94 74 365 8500\nEmail: admin@royalservice.tech`;
    if (q.includes('service') || q.includes('offer')) return `🔧 We offer: Full Service, Oil Change, Brake Service, AC Service, Tires, and more!`;
    if (q.includes('hour') || q.includes('open')) return `🕒 Hours:\nMon-Fri: 8AM - 6PM\nSat: 9AM - 4PM\nSun: Closed`;
    return `Thank you for your message! A representative will be with you shortly. For immediate assistance, call +94 74 365 8500.`;
  };

  const addMessageIfNew = useCallback((newMessage) => {
    setMessages((prev) => {
      const exists = prev.some(msg => msg._id === newMessage._id || (msg.text === newMessage.text && Math.abs(new Date(msg.createdAt) - new Date(newMessage.createdAt)) < 1000));
      if (exists) return prev;
      return [...prev, newMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    });
  }, []);

  useEffect(() => {
    const userId = getUserId();
    socket.connect();

    socket.on('connect', () => {
      socket.emit('user_connected', { userId, role: user.role });
      setActiveContact({ _id: userId, name: 'Royal Support', role: 'admin' });
    });

    const handleChatHistory = (history) => {
      setMessages(history || []);
      hasSentFirstMessageRef.current = (history || []).some(m => String(m.senderId) === String(userId) && m.senderRole !== 'bot');
    };

    const handleIncomingMessage = (newMessage) => {
      if (String(newMessage.threadId) !== String(userId)) return;
      
      // If the widget is closed and message is from Admin/Bot, show notification
      if (!isOpen && String(newMessage.senderId) !== String(userId)) {
        setUnreadCount(prev => prev + 1);
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {});
      }

      addMessageIfNew(newMessage);
      socket.emit('mark_read', { threadId: newMessage.threadId, userId });
    };

    const handleTyping = ({ threadId, userName }) => {
      if (String(threadId) === String(userId)) {
        setIsTyping(true);
        setTypingUser(userName);
      }
    };

    const handleStopTyping = ({ threadId }) => {
      if (String(threadId) === String(userId)) {
        setIsTyping(false);
        setTypingUser('');
      }
    };

    socket.on('chat_history', handleChatHistory);
    socket.on('newMessage', handleIncomingMessage);
    socket.on('receive_message', handleIncomingMessage);
    socket.on('typing', handleTyping);
    socket.on('stop_typing', handleStopTyping);

    return () => {
      socket.off('chat_history', handleChatHistory);
      socket.off('newMessage', handleIncomingMessage);
      socket.off('receive_message', handleIncomingMessage);
      socket.off('typing', handleTyping);
      socket.off('stop_typing', handleStopTyping);
      socket.disconnect();
    };
  }, [user, isOpen, getUserId, addMessageIfNew]);

  // Fetch history when opening
  useEffect(() => {
    if (isOpen && activeContact) {
      activeThreadRef.current = activeContact._id;
      socket.emit('fetch_history', activeContact._id);
      setUnreadCount(0);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [isOpen, activeContact]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isTyping]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !activeContact) return;

    const userId = getUserId();
    socket.emit('send_message', {
      senderId: userId,
      senderName: user.name,
      senderRole: user.role,
      threadId: activeContact._id,
      text: message.trim()
    });

    setMessage('');
    socket.emit('stop_typing', { threadId: activeContact._id, userId });

    // Auto-reply for first message
    if (!hasSentFirstMessageRef.current) {
      hasSentFirstMessageRef.current = true;
      setTimeout(() => {
        socket.emit('send_message', {
          senderId: 'bot', senderName: 'Royal Service Center', senderRole: 'bot', threadId: userId,
          text: `Thank you for your message! Our team will reply shortly.\n\nYou can also use the quick commands below.`
        });
      }, 1000);
    }
  };

  const handleQuickCommand = async (cmd) => {
    if (!activeContact) return;
    const userId = getUserId();
    
    socket.emit('send_message', { senderId: userId, senderName: user.name, senderRole: user.role, threadId: userId, text: cmd.question });
    
    setTimeout(async () => {
      const reply = await getAutoReply(cmd.question);
      socket.emit('send_message', { senderId: 'bot', senderName: 'Royal Service Center', senderRole: 'bot', threadId: userId, text: reply });
    }, 800);
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    if (!activeContact) return;
    socket.emit('typing', { threadId: activeContact._id, userId: getUserId(), userName: user.name });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { threadId: activeContact._id, userId: getUserId() });
    }, 1000);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] font-sans flex flex-col items-end pointer-events-none">
      
      {/* Chat Window */}
      <div 
        className={`bg-white rounded-2xl shadow-2xl border border-zinc-200 w-[350px] md:w-[380px] overflow-hidden transition-all duration-300 transform origin-bottom-right flex flex-col pointer-events-auto mb-4 ${
          isOpen ? 'scale-100 opacity-100 h-[500px]' : 'scale-0 opacity-0 h-0 w-0 absolute bottom-16 right-0'
        }`}
      >
        {/* Header */}
        <div className="bg-[#18181b] p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
              R
            </div>
            <div>
              <h3 className="text-white font-bold text-sm leading-tight">Royal Support</h3>
              <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> 
                {isTyping ? `${typingUser} is typing...` : 'Online'}
              </p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Messages Area */}
        <div ref={messagesContainerRef} className="flex-1 bg-zinc-50 p-4 overflow-y-auto space-y-4">
          
          <div className="flex flex-col items-start">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Royal Support</span>
            <div className="bg-white border border-zinc-200 text-zinc-700 p-3 rounded-2xl rounded-tl-sm text-sm shadow-sm">
              Welcome to Royal Service Center! 👋<br/><br/>How can we assist you today?
            </div>
          </div>

          {messages.map((msg, index) => {
            const isMe = String(msg.senderId) === String(getUserId());
            const isBot = msg.senderRole === 'bot';
            return (
              <div key={msg._id || index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">
                  {isMe ? 'You' : isBot ? 'Bot' : msg.senderName}
                </span>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  isMe ? 'bg-red-600 text-white rounded-tr-sm shadow-md' 
                  : isBot ? 'bg-purple-100 border border-purple-200 text-purple-900 rounded-tl-sm'
                  : 'bg-white border border-zinc-200 text-zinc-700 rounded-tl-sm shadow-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Commands - UPDATED TO WRAP */}
        <div className="px-3 py-2 bg-white border-t border-zinc-100 shrink-0">
          <div className="flex flex-wrap gap-2 max-h-[80px] overflow-y-auto hide-scrollbar">
            {quickCommands.map((cmd) => (
              <button
                key={cmd.id}
                onClick={() => handleQuickCommand(cmd)}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-zinc-100 hover:bg-red-100 hover:text-red-600 text-zinc-600 transition-all border border-zinc-200"
              >
                {cmd.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white border-t border-zinc-100 shrink-0">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={handleInputChange}
              placeholder="Type your message..."
              className="flex-1 bg-zinc-100 border border-zinc-200 text-zinc-800 px-4 py-2.5 rounded-xl focus:border-red-500 focus:outline-none text-sm placeholder:text-zinc-500"
            />
            <button 
              type="submit"
              disabled={!message.trim()}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-md shrink-0"
            >
              {/* 🚨 FIXED: Clean Paper Plane Send Icon */}
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative flex items-center gap-2 bg-gradient-to-br from-red-500 via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 text-white pl-3 pr-5 py-3 rounded-full shadow-2xl pointer-events-auto transition-all duration-300 hover:scale-105"
        >
          <span className="relative w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3C6.477 3 2 6.94 2 11.79c0 2.7 1.44 5.11 3.72 6.74-.07.83-.33 2.25-1.05 3.15-.09.12-.01.3.14.31 1.18.08 2.87-.53 4.14-1.4.96.29 2 .45 3.05.45 5.523 0 10-3.94 10-8.79S17.523 3 12 3z" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white text-red-600 text-[10px] font-black border-2 border-red-600 shadow-md px-1 z-10 animate-bounce">
                {unreadCount}
              </span>
            )}
          </span>
          <span className="text-xs font-black tracking-widest uppercase whitespace-nowrap drop-shadow-sm">Chat</span>
        </button>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}