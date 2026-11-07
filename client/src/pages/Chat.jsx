import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import io from 'socket.io-client';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling']
});

export default function Chat() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [message, setMessage] = useState('');
  const [isInputUnlocked, setIsInputUnlocked] = useState(false);
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [contextMenu, setContextMenu] = useState(null);
  
  const [firstUnreadId, setFirstUnreadId] = useState(null);

  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  const activeThreadRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const hasSentFirstMessageRef = useRef(false);
  const firstUnreadRef = useRef(null); 
  const markReadTimeoutRef = useRef(null); 

  const getUserId = useCallback(() => user?._id || user?.id, [user]);
  
  const isAdminOrStaff = ['admin', 'staff'].includes(user?.role);

  // 🚨 BULLETPROOF SCROLLING
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }, []);

  const quickCommands = [
    { id: 'booking', label: '📅 How to Book', question: 'How do I book an appointment?' },
    { id: 'contact', label: '📞 Contact Number', question: 'What is your contact number?' },
    { id: 'services', label: '🔧 Services Offered', question: 'What services do you offer?' },
    { id: 'hours', label: '🕒 Operating Hours', question: 'What are your operating hours?' },
    { id: 'location', label: '📍 Location', question: 'Where are you located?' },
    { id: 'pricing', label: '💰 Pricing', question: 'How much do services cost?' },
    { id: 'cancel', label: '❌ Cancel Booking', question: 'How do I cancel my booking?' },
    { id: 'status', label: '📊 Booking Status', question: 'How can I check my booking status?' }
  ];

  const fetchRealBookingStatus = async () => {
    try {
      const response = await axiosClient.get('/bookings/my-bookings');
      const bookings = response.data;
      if (!bookings || bookings.length === 0) return "You don't have any bookings yet. Click the 'New Booking' button on the dashboard to schedule a service!";
      const recentBookings = bookings.slice(0, 3).map(b => {
        const date = new Date(b.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `• ${b.service_id?.name || 'Service'} (${date}) - Status: ${b.status}`;
      }).join('\n');
      return `Here are your recent bookings:\n\n${recentBookings}\n\nFor full details, please visit your Dashboard.`;
    } catch (error) {
      return "I'm having trouble accessing your booking data right now. Please try again later or check your Dashboard.";
    }
  };

  const fetchRealPricing = async () => {
    try {
      const response = await axiosClient.get('/services');
      const services = response.data;
      if (!services || services.length === 0) return "We are currently updating our service prices. Please check back shortly or visit the booking page!";
      const priceList = services.slice(0, 6).map(s => {
        let priceStr = typeof s.price === 'number' ? `LKR ${s.price.toLocaleString()}` : s.price?.Car ? `From LKR ${s.price.Car.toLocaleString()}` : 'Contact for price';
        return `• ${s.name}: ${priceStr}`;
      }).join('\n');
      return `💰 Our Current Service Prices:\n\n${priceList}\n\n*Prices vary based on vehicle type (Car, SUV, Van). For exact pricing, please visit the Booking page!*`;
    } catch (error) {
      return "I'm having trouble accessing our pricing right now. Please try again later or visit the booking page.";
    }
  };

  const getAutoReply = async (question) => {
    const q = question.toLowerCase();
    if (q.includes('status') || q.includes('track') || q.includes('check')) return await fetchRealBookingStatus();
    if (q.includes('price') || q.includes('cost') || q.includes('pricing') || q.includes('fee')) return await fetchRealPricing();
    if (q.includes('cancel') || q.includes('cancellation')) return `❌ How to Cancel a Booking:\n\nGo to your Dashboard\n2. Navigate to "Upcoming" bookings\n3. Find the booking you want to cancel\n4. Click the "CANCEL" button\n5. Confirm your cancellation\n\n⚠️ Important: Cancellations must be made at least 2 hours before your appointment time.`;
    if (/\b(book|booking|appointment|schedule)\b/.test(q)) return `📅 How to Book an Appointment:\n\nClick on "NEW BOOKING" button on the dashboard\n2. Select your vehicle type (Car, SUV, or Van)\n3. Choose the service you need\n4. Enter your vehicle details (Registration number, Make, Model, Year, Mileage)\n5. Select a convenient date and time slot\n6. Review your booking and confirm\n\n✅ Your booking will be confirmed instantly with a reference number.\n\nNote: You can book up to 7 days in advance.`;
    if (q.includes('contact') || q.includes('phone') || q.includes('number') || q.includes('call')) return `📞 Our Contact Information:\n\nPhone: +94 74 365 8500\nEmail: admin@royalservice.tech\n\nOur support team is available during operating hours.`;
    if (q.includes('service') || q.includes('offer') || q.includes('provide')) return `🔧 Our Services:\n\nFull Service\n2. Oil Change\n3. Brake Service\n4. AC Service\n5. Tire Service\n6. Engine Diagnostics\n7. Battery Service\n8. Wash & Detailing\n\nPrices vary based on vehicle type.`;
    if (q.includes('hour') || q.includes('open') || q.includes('time') || q.includes('close')) return `🕒 Operating Hours:\n\nMonday - Friday: 8:00 AM - 6:00 PM\nSaturday: 9:00 AM - 4:00 PM\nSunday: Closed\n\nLast booking slot is at 3:30 PM.`;
    if (q.includes('location') || q.includes('where') || q.includes('address')) return `📍 Our Location:\n\nRoyal Service Center\n13/5 Service Road,\nColombo 05,\nSri Lanka`;
    if (q.includes('thank') || q.includes('thanks')) return `You're welcome! 😊 Is there anything else I can help you with?`;
    if (q.includes('hello') || q.includes('hi') || q.includes('hey')) return `Hello! 👋 Welcome to Royal Service Center. How can I assist you today?`;
    return `Thank you for your message! I'll help you with that.\n\nFor immediate assistance, call us at +94 74 365 8500 or email admin@royalservice.tech.`;
  };

  const addMessageIfNew = useCallback((newMessage) => {
    setMessages((prev) => {
      const exists = prev.some(msg => {
        if (newMessage._id && msg._id) return msg._id === newMessage._id;
        return (
          msg.senderId === newMessage.senderId &&
          msg.threadId === newMessage.threadId &&
          msg.text === newMessage.text &&
          Math.abs(new Date(msg.createdAt || msg.timestamp) - new Date(newMessage.createdAt || newMessage.timestamp)) < 1000
        );
      });
      if (exists) return prev;
      return [...prev, newMessage].sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp));
    });
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const userId = getUserId();
    socket.connect();

    socket.on('connect', () => {
      socket.emit('user_connected', { userId, role: user.role });
      
      if (isAdminOrStaff) {
        socket.emit('fetch_contacts');
      } else {
        setActiveContact({ _id: userId, name: 'Command Center (Admin)', role: 'admin' });
      }
    });

    const handleContactsList = (list) => {
      setContacts(list);
      const initialCounts = {};
      list.forEach(contact => {
        if (contact.unreadCount > 0) {
          initialCounts[contact._id] = contact.unreadCount;
        }
      });
      setUnreadCounts(initialCounts);
    };
    
    const handleUserOnline = (newUser) => {
      setContacts(prev => {
        const idx = prev.findIndex(c => c._id === newUser._id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...newUser, isOnline: true };
          return updated;
        }
        return [...prev, { ...newUser, isOnline: true }];
      });
      
      setActiveContact(prev => 
        prev && String(prev._id) === String(newUser._id) ? { ...prev, isOnline: true } : prev
      );
    };

    const handleUserOffline = ({ userId }) => {
      setContacts(prev => prev.map(c => String(c._id) === String(userId) ? { ...c, isOnline: false } : c));
      setActiveContact(prev => 
        prev && String(prev._id) === String(userId) ? { ...prev, isOnline: false } : prev
      );
    };

    const handleContactUpdated = ({ threadId, lastMessageAt }) => {
      setContacts(prev => {
        const updated = prev.map(c => String(c._id) === String(threadId) ? { ...c, lastMessageAt } : c);
        return updated.sort((a, b) => {
          if (a.lastMessageAt && b.lastMessageAt) return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
          if (a.lastMessageAt) return -1;
          if (b.lastMessageAt) return 1;
          if (a.isOnline && !b.isOnline) return -1;
          if (!a.isOnline && b.isOnline) return 1;
          return a.name.localeCompare(b.name);
        });
      });
    };
    
    const handleChatHistory = (history) => {
      const sortedHistory = history || [];
      setMessages(sortedHistory);
      
      if (!isAdminOrStaff) {
        hasSentFirstMessageRef.current = sortedHistory.some(m => String(m.senderId) === String(userId) && m.senderRole !== 'bot');
      }

      const firstUnread = sortedHistory.find(m => String(m.senderId) !== String(userId) && !m.isRead);
      if (firstUnread) {
        setFirstUnreadId(firstUnread._id);
        setTimeout(() => {
          firstUnreadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        setFirstUnreadId(null);
        setTimeout(() => scrollToBottom(false), 100);
      }
    };
    
    const handleIncomingMessage = (newMessage) => {
      if (!isAdminOrStaff && String(newMessage.threadId) !== String(userId)) return;
      
      if (isAdminOrStaff) {
        setContacts(prev => {
          const updated = prev.map(c => 
            String(c._id) === String(newMessage.threadId) 
              ? { ...c, lastMessageText: newMessage.text, lastMessageAt: newMessage.createdAt } 
              : c
          );
          return updated.sort((a, b) => {
            if (a.lastMessageAt && b.lastMessageAt) return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
            if (a.lastMessageAt) return -1;
            if (b.lastMessageAt) return 1;
            return a.name.localeCompare(b.name);
          });
        });
      }

      if (String(newMessage.threadId) === String(activeThreadRef.current)) {
        addMessageIfNew(newMessage);
        
        setTimeout(() => scrollToBottom(true), 150);

        if (markReadTimeoutRef.current) clearTimeout(markReadTimeoutRef.current);
        markReadTimeoutRef.current = setTimeout(() => {
          socket.emit('mark_read', { threadId: newMessage.threadId, userId });
          setFirstUnreadId(null); 
        }, 3000); 
        
      } else if (isAdminOrStaff) {
        toast.success(`New message from ${newMessage.senderName}`);
        setUnreadCounts(prev => ({ ...prev, [newMessage.threadId]: (prev[newMessage.threadId] || 0) + 1 }));
      }
    };

    const handleChatCleared = ({ threadId }) => {
      if (String(threadId) === String(activeThreadRef.current)) {
        setMessages([]);
        if (!isAdminOrStaff) hasSentFirstMessageRef.current = false;
        toast.success('Chat cleared');
      }
    };
    
    const handleChatDeleted = ({ threadId }) => {
      setContacts(prev => prev.filter(c => String(c._id) !== String(threadId)));
      if (String(threadId) === String(activeThreadRef.current)) {
        setMessages([]);
        setActiveContact(null);
        setIsMobileChatOpen(false);
        toast.success('Chat deleted successfully');
      }
    };
    
    const handleTyping = ({ threadId, userName }) => {
      if (String(threadId) === String(activeThreadRef.current)) {
        setIsTyping(true);
        setTypingUser(userName);
      }
    };
    
    const handleStopTyping = ({ threadId }) => {
      if (String(threadId) === String(activeThreadRef.current)) {
        setIsTyping(false);
        setTypingUser('');
      }
    };

    const handleAllChatsCleared = () => {
      setMessages([]);
      setContacts(prev => prev.map(c => ({ ...c, lastMessageText: null, lastMessageAt: null })));
      setUnreadCounts({}); 
      toast.success('All chats have been cleared');
    };

    const handleChatRead = ({ threadId }) => {
      setUnreadCounts(prev => {
        const updated = { ...prev };
        delete updated[threadId];
        return updated;
      });
    };

    socket.on('contacts_list', handleContactsList);
    socket.on('user_online', handleUserOnline);
    socket.on('user_offline', handleUserOffline);
    socket.on('contact_updated', handleContactUpdated);
    socket.on('chat_history', handleChatHistory);
    socket.on('receive_message', handleIncomingMessage);
    socket.on('newMessage', handleIncomingMessage); 
    socket.on('chat_cleared', handleChatCleared);
    socket.on('chat_deleted', handleChatDeleted);
    socket.on('typing', handleTyping);
    socket.on('stop_typing', handleStopTyping);
    socket.on('all_chats_cleared', handleAllChatsCleared);
    socket.on('chat_read', handleChatRead); 

    return () => {
      socket.off('contacts_list', handleContactsList);
      socket.off('user_online', handleUserOnline);
      socket.off('user_offline', handleUserOffline);
      socket.off('contact_updated', handleContactUpdated);
      socket.off('chat_history', handleChatHistory);
      socket.off('receive_message', handleIncomingMessage);
      socket.off('newMessage', handleIncomingMessage);
      socket.off('chat_cleared', handleChatCleared);
      socket.off('chat_deleted', handleChatDeleted);
      socket.off('typing', handleTyping);
      socket.off('stop_typing', handleStopTyping);
      socket.off('all_chats_cleared', handleAllChatsCleared);
      socket.off('chat_read', handleChatRead); 
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (markReadTimeoutRef.current) clearTimeout(markReadTimeoutRef.current);
      socket.disconnect();
    };
  }, [user, navigate, getUserId, addMessageIfNew, isAdminOrStaff, scrollToBottom]);

  const handleOpenChat = (contact) => {
    setActiveContact(contact);
    activeThreadRef.current = contact._id;
    
    if (markReadTimeoutRef.current) clearTimeout(markReadTimeoutRef.current);
    
    socket.emit('fetch_history', contact._id);
    
    if (unreadCounts[contact._id] > 0) {
      markReadTimeoutRef.current = setTimeout(() => {
        socket.emit('mark_read', { threadId: contact._id, userId: getUserId() });
        setUnreadCounts(prev => {
          const updated = { ...prev };
          delete updated[contact._id];
          return updated;
        });
        setFirstUnreadId(null); 
      }, 5000); 
    }

    setIsMobileChatOpen(true);
  };

  useEffect(() => {
    if (activeContact && !firstUnreadId) {
      setTimeout(() => scrollToBottom(true), 150);
    }
  }, [messages, isTyping, activeContact, firstUnreadId, scrollToBottom]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    if (!message.trim() || !activeContact || !user) return;

    const userId = getUserId();
    const messageText = message.trim();

    const outgoingMsg = {
      _id: Date.now().toString(),
      senderId: userId,
      senderName: user.name,
      senderRole: user.role,
      threadId: activeContact._id,
      text: messageText,
      createdAt: new Date().toISOString()
    };
    
    addMessageIfNew(outgoingMsg);
    setTimeout(() => scrollToBottom(true), 50);

    const messageData = {
      senderId: userId,
      senderName: user.name,
      senderRole: user.role,
      threadId: activeContact._id,
      text: messageText
    };

    socket.emit('send_message', messageData);

    if (isAdminOrStaff) {
      setContacts(prev => {
        const updated = prev.map(c => 
          String(c._id) === String(activeContact._id) 
            ? { ...c, lastMessageText: messageText, lastMessageAt: new Date().toISOString() } 
            : c
        );
        return updated.sort((a, b) => {
          if (a.lastMessageAt && b.lastMessageAt) return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
          if (a.lastMessageAt) return -1;
          if (b.lastMessageAt) return 1;
          return a.name.localeCompare(b.name);
        });
      });
    }

    setMessage('');
    socket.emit('stop_typing', { threadId: activeContact._id, userId });

    if (!isAdminOrStaff && !hasSentFirstMessageRef.current) {
      hasSentFirstMessageRef.current = true;
      setTimeout(() => {
        socket.emit('send_message', {
          senderId: 'bot', senderName: 'Royal Service Center', senderRole: 'bot', threadId: userId,
          text: `Thank you for your message! I'll help you with that.\n\nYou can also use these quick commands:\nAsk about booking appointments\nInquire about our services\nGet our contact number\nCheck operating hours\n\nFor immediate assistance, call us at +94 74 365 8500 or email admin@royalservice.tech.`
        });
      }, 1000);
    }
  };

  const handleQuickCommand = async (command) => {
    if (isAdminOrStaff || !activeContact || !user) return;
    const userId = getUserId();
    
    const outgoingMsg = {
      _id: Date.now().toString(),
      senderId: userId,
      senderName: user.name,
      senderRole: user.role,
      threadId: userId,
      text: command.question,
      createdAt: new Date().toISOString()
    };
    
    addMessageIfNew(outgoingMsg);
    setTimeout(() => scrollToBottom(true), 50);

    socket.emit('send_message', { senderId: userId, senderName: user.name, senderRole: user.role, threadId: userId, text: command.question });
    
    setTimeout(async () => {
      const replyText = await getAutoReply(command.question);
      socket.emit('send_message', { senderId: 'bot', senderName: 'Royal Service Center', senderRole: 'bot', threadId: userId, text: replyText });
    }, 800);
  };

  const handleClearChat = () => {
    if (!activeContact || !user || !window.confirm('Clear all messages in this chat?')) return;
    socket.emit('clear_chat', { threadId: activeContact._id, userId: getUserId(), role: user.role });
  };

  const handleContextMenu = (e, contact) => {
    e.preventDefault();
    if (user?.role === 'admin') setContextMenu({ x: e.clientX, y: e.clientY, contact });
  };

  const handleDeleteChat = (contact) => {
    if (!window.confirm(`Delete entire chat with ${contact.name}? This will remove all messages and remove the customer from the list.`)) return;
    socket.emit('delete_chat', { threadId: contact._id, userId: getUserId(), role: user.role });
    setContextMenu(null);
  };

  const handleClearAllChats = () => {
    if (!window.confirm('WARNING: This will permanently delete ALL chats for ALL customers. Are you sure?')) return;
    
    const password = window.prompt('Please enter your Admin password to confirm:');
    
    if (password) {
      socket.emit('clear_all_chats', { userId: user._id, password });
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    if (!activeContact || !user) return;
    socket.emit('typing', { threadId: activeContact._id, userId: getUserId(), userName: user.name });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { threadId: activeContact._id, userId: getUserId() });
    }, 1000);
  };

  const isMe = (senderId) => String(senderId) === String(getUserId());

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-[100dvh] bg-zinc-950 flex flex-col font-sans text-zinc-50 selection:bg-red-600 selection:text-white relative overflow-hidden">
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-[400px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none"></div>

      {contextMenu && (
        <div
          className="fixed z-50 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-2 min-w-[200px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 border-b border-zinc-800">
            <p className="text-sm font-bold text-white">{contextMenu.contact.name}</p>
            <p className="text-xs text-zinc-500">{contextMenu.contact.role}</p>
          </div>
          <button
            onClick={() => handleDeleteChat(contextMenu.contact)}
            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-600/10 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Chat Completely
          </button>
        </div>
      )}

      <header className="relative z-10 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800 py-3 px-4 md:px-6 flex items-center justify-between shadow-2xl shrink-0">
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-zinc-500 hover:text-red-500 transition-colors p-1"
            aria-label="Go back"
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m7 7H3" />
            </svg>
          </button>
          <div className="flex flex-col">
            <h2 className="text-base md:text-lg font-black tracking-widest uppercase text-white">Support Center</h2>
            <span className="text-[9px] md:text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> 
              {isAdminOrStaff ? 'Live Chat' : "We're online"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center">
            <span className="text-xs font-bold text-red-500">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
          </div>
          <span className="hidden sm:block text-sm text-zinc-400 font-semibold">{user?.name?.split(' ')[0]}</span>
        </div>
      </header>

      <main className="flex-1 relative z-10 max-w-6xl mx-auto w-full p-2 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6 min-h-0 h-full overflow-hidden">

        {isAdminOrStaff && (
          <aside className={`w-full md:w-72 lg:w-80 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col shrink-0 shadow-2xl overflow-hidden h-full ${isMobileChatOpen ? 'hidden md:flex' : 'flex'}`}>
            
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 shrink-0 flex justify-between items-center">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Active Personnel</h3>
              {user?.role === 'admin' && (
                <button 
                  onClick={handleClearAllChats}
                  className="text-[10px] font-bold uppercase tracking-wider text-red-500 hover:text-white bg-red-600/10 hover:bg-red-600 px-3 py-1.5 rounded transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
              {contacts.length === 0 ? (
                <div className="text-center py-8 text-zinc-600 text-sm">No contacts online</div>
              ) : (
                contacts.map((contact) => {
                  const hasUnread = unreadCounts[contact._id] > 0;
                  
                  return (
                    <div
                      key={contact._id}
                      onClick={() => handleOpenChat(contact)} 
                      onContextMenu={(e) => handleContextMenu(e, contact)}
                      className={`p-3 rounded-xl cursor-pointer transition-all border relative ${
                        activeContact?._id === contact._id ? 'bg-red-600/10 border-red-600/40' : 'bg-zinc-950/60 border-zinc-800 hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-zinc-400">{contact.name?.charAt(0)?.toUpperCase()}</span>
                          </div>
                          {contact.isOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-zinc-900"></span>}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`font-bold text-sm truncate ${hasUnread ? 'text-white' : 'text-zinc-300'}`}>
                              {contact.name}
                            </p>
                            <span className={`text-[8px] shrink-0 font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${contact.role === 'staff' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                              {contact.role}
                            </span>
                          </div>
                          
                          {contact.lastMessageText && (
                            <p className={`text-[11px] mt-0.5 truncate max-w-[160px] ${hasUnread ? 'text-red-400 font-medium' : 'text-zinc-500'}`}>
                              {contact.lastMessageText}
                            </p>
                          )}
                        </div>
                        
                        {hasUnread && (
                          <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                            {unreadCounts[contact._id]}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

        <section className={`flex-1 min-w-0 min-h-0 bg-zinc-900 border border-zinc-800 rounded-2xl flex-col overflow-hidden shadow-2xl relative ${isAdminOrStaff && !isMobileChatOpen ? 'hidden md:flex' : 'flex'}`}>

          {activeContact && (
            <div className="p-3 md:p-4 border-b border-zinc-800 bg-zinc-950/50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                
                {isAdminOrStaff && (
                  <button
                    onClick={() => {
                      setIsMobileChatOpen(false);
                      setActiveContact(null);
                      activeThreadRef.current = null;
                      if (markReadTimeoutRef.current) clearTimeout(markReadTimeoutRef.current);
                    }}
                    className="md:hidden text-zinc-400 hover:text-white p-1 mr-1"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}

                <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-red-500">{activeContact.name?.charAt(0)?.toUpperCase() || 'B'}</span>
                </div>
                
                <div>
                  <span className="font-bold text-white text-sm">{isAdminOrStaff ? activeContact.name : 'Royal Service Center'}</span>
                  <p className="text-[10px] text-zinc-500">
                    {isTyping 
                      ? `${typingUser} is typing...` 
                      : (isAdminOrStaff ? (activeContact.isOnline ? 'online' : 'offline') : 'online')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isAdminOrStaff && activeContact.phone && (
                  <span className="text-xs text-zinc-400 font-medium hidden sm:block">
                    {activeContact.phone}
                  </span>
                )}
                
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="px-3 py-2 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wider text-red-500 bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 transition-all"
                  title="Clear all messages"
                >
                  🗑 Clear
                </button>
              </div>
            </div>
          )}

          <div ref={messagesContainerRef} className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto space-y-4 md:space-y-6">
            {!activeContact ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm font-medium text-center px-4">
                {isAdminOrStaff ? 'Select a contact to begin transmission.' : 'Connecting to Command Center...'}
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm font-medium text-center px-4">
                No active communications found. Start the conversation!
              </div>
            ) : (
              messages.map((msg, index) => {
                const isMyMessage = isMe(msg.senderId);
                const isBot = msg.senderRole === 'bot';
                const isFirstUnread = msg._id === firstUnreadId;

                return (
                  <React.Fragment key={msg._id || `${msg.createdAt}-${index}`}>
                    {/* 🚨 WHATSAPP FIX 3: Render visual separator for unread messages */}
                    {isFirstUnread && (
                      <div ref={firstUnreadRef} className="flex items-center justify-center my-6">
                        <div className="h-px bg-zinc-800 flex-1"></div>
                        <span className="px-3 py-1 bg-red-600/10 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-red-600/20">
                          Unread Messages
                        </span>
                        <div className="h-px bg-zinc-800 flex-1"></div>
                      </div>
                    )}

                    <div className={`flex flex-col ${isMyMessage ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                          {isMyMessage ? 'You' : isBot ? '🏢 Royal Service Center' : msg.senderName}
                        </span>
                        {msg.createdAt && <span className="text-[9px] text-zinc-600">{formatTime(msg.createdAt)}</span>}
                      </div>
                      <div className={`max-w-[85%] md:max-w-[70%] p-3 md:p-4 rounded-2xl ${
                        isMyMessage ? 'bg-red-600 text-white rounded-tr-sm shadow-[0_5px_15px_rgba(220,38,38,0.25)]'
                        : isBot ? 'bg-purple-600/20 border border-purple-500/30 text-purple-100 rounded-tl-sm'
                        : msg.senderRole === 'admin' ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-100 rounded-tl-sm'
                        : 'bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-tl-sm'
                      }`}>
                        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} className="h-2 w-full shrink-0" />
          </div>

          {!isAdminOrStaff && (
            <div className="px-3 md:px-4 pb-2 bg-zinc-950/40 shrink-0">
              <div className="flex gap-2 overflow-x-auto py-2 hide-scrollbar">
                {quickCommands.map((cmd) => (
                  <button
                    key={cmd.id}
                    onClick={() => handleQuickCommand(cmd)}
                    className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold bg-zinc-800 hover:bg-red-600 hover:text-white text-zinc-300 transition-all border border-zinc-700 hover:border-red-600"
                  >
                    {cmd.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 md:p-4 bg-zinc-950/50 border-t border-zinc-800 backdrop-blur-xl shrink-0">
            <div className="flex gap-2 md:gap-3">
              <input
                type="search"
                inputMode="text"
                enterKeyHint="send"
                readOnly={!isInputUnlocked}
                onTouchStart={() => setIsInputUnlocked(true)}
                onFocus={() => setIsInputUnlocked(true)}
                name="rsc_admin_search_box"
                id="rsc_admin_search_box"
                autoComplete="off"
                autoCorrect="on"
                spellCheck="true"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                value={message}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                disabled={!activeContact}
                placeholder={activeContact ? 'Type your message...' : 'Awaiting selection...'}
                className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 text-white px-4 md:px-5 py-3 md:py-3.5 rounded-xl focus:border-red-600 focus:outline-none transition-colors disabled:opacity-50 text-sm md:text-base placeholder:text-zinc-600 [&::-webkit-search-cancel-button]:hidden"
              />
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!message.trim() || !activeContact}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 md:px-6 rounded-xl font-black tracking-widest transition-all text-sm md:text-base flex items-center justify-center shadow-lg shadow-red-600/20 shrink-0"
              >
                <span className="hidden sm:inline mr-2">SEND</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </section>
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}