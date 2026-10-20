import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import io from 'socket.io-client';
import toast from 'react-hot-toast';

// 🚨 FIX: Use environment variable for the socket URL, falling back to localhost
const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling']
});

export default function Chat() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [contextMenu, setContextMenu] = useState(null);

  const activeThreadRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const hasSentFirstMessageRef = useRef(false);

  const getUserId = useCallback(() => user?._id || user?.id, [user]);

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

  const getAutoReply = (question) => {
    const q = question.toLowerCase();

    // PRIORITY CHECK: Check for "cancel" FIRST before "book/booking"
    if (q.includes('cancel') || q.includes('cancellation')) {
      return `❌ How to Cancel a Booking:

1. Go to your Dashboard
2. Navigate to "Upcoming" bookings
3. Find the booking you want to cancel
4. Click the "CANCEL" button
5. Confirm your cancellation

⚠️ Important: Cancellations must be made at least 2 hours before your appointment time.`;
    }

    // Check for booking (using word boundaries so it doesn't accidentally trigger)
    if (/\b(book|booking|appointment|schedule)\b/.test(q)) {
      return `📅 How to Book an Appointment:

1. Click on "NEW BOOKING" button on the dashboard
2. Select your vehicle type (Car, SUV, or Van)
3. Choose the service you need
4. Enter your vehicle details (Registration number, Make, Model, Year, Mileage)
5. Select a convenient date and time slot
6. Review your booking and confirm

✅ Your booking will be confirmed instantly with a reference number.

Note: You can book up to 7 days in advance. Cancellations must be made at least 2 hours before the appointment.`;
    }

    if (q.includes('contact') || q.includes('phone') || q.includes('number') || q.includes('call')) {
      return `📞 Our Contact Information:

Phone: 074 365 8500
Email: support@royalservice.lk
Emergency: +94 74 365 8500

Our support team is available during operating hours to assist you with any inquiries.`;
    }

    if (q.includes('service') || q.includes('offer') || q.includes('provide')) {
      return `🔧 Our Services:

1. Full Service - Comprehensive vehicle maintenance
2. Oil Change - Engine oil and filter replacement
3. Brake Service - Brake pad replacement and repair
4. AC Service - Air conditioning maintenance
5. Tire Service - Rotation, balancing, and replacement
6. Engine Diagnostics - Computer-based fault detection
7. Battery Service - Testing and replacement
8. Wash & Detailing - Professional cleaning

Prices vary based on vehicle type. Please check the booking page for exact pricing.`;
    }

    if (q.includes('hour') || q.includes('open') || q.includes('time') || q.includes('close')) {
      return `🕒 Operating Hours:

Monday - Friday: 8:00 AM - 6:00 PM
Saturday: 9:00 AM - 4:00 PM
Sunday: Closed

Last booking slot is at 3:30 PM. We recommend booking at least 1 day in advance.`;
    }

    if (q.includes('location') || q.includes('where') || q.includes('address')) {
      return `📍 Our Location:

Royal Service Center
123 Galle Road,
Colombo 03,
Sri Lanka

We are located near the main junction, with easy access and parking facilities.`;
    }

    if (q.includes('price') || q.includes('cost') || q.includes('pricing') || q.includes('fee')) {
      return `💰 Pricing Information:

Our prices vary based on:
- Vehicle type (Car, SUV, Van)
- Service type
- Parts required

Starting Prices:
- Oil Change: LKR 5,000
- Full Service: LKR 15,000
- Brake Service: LKR 8,000
- AC Service: LKR 6,500

For exact pricing, please visit the booking page and select your vehicle type.`;
    }

    if (q.includes('status') || q.includes('track') || q.includes('check')) {
      return `📊 Checking Your Booking Status:

1. Log in to your account
2. Go to your Dashboard
3. Your bookings are categorized as:
   - Upcoming - Pending or Confirmed
   - In Progress - Currently being serviced
   - Completed - Service done
   - Cancelled - Cancelled or Rejected

You can download your service record once the booking is completed.`;
    }

    if (q.includes('thank') || q.includes('thanks')) {
      return `You're welcome! 😊 Is there anything else I can help you with?`;
    }

    if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
      return `Hello! 👋 Welcome to Royal Service Center. How can I assist you today? You can ask me about bookings, services, pricing, or use the quick commands below.`;
    }

    return `Thank you for your message! I'll help you with that.

You can also use these quick commands:
- Ask about booking appointments
- Inquire about our services
- Get our contact number
- Check operating hours

For immediate assistance, call us at 074 365 8500.`;
  };

  const addMessageIfNew = useCallback((newMessage) => {
    setMessages((prev) => {
      const exists = prev.some(msg => {
        if (newMessage._id && msg._id) {
          return msg._id === newMessage._id;
        }

        return (
          msg.senderId === newMessage.senderId &&
          msg.threadId === newMessage.threadId &&
          msg.text === newMessage.text &&
          Math.abs(
            new Date(msg.createdAt || msg.timestamp) -
            new Date(newMessage.createdAt || newMessage.timestamp)
          ) < 1000
        );
      });

      if (exists) {
        return prev;
      }

      const newMessages = [...prev, newMessage];

      return newMessages.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.timestamp).getTime();
        const timeB = new Date(b.createdAt || b.timestamp).getTime();
        return timeA - timeB;
      });
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
      console.log('Socket connected');

      socket.emit('user_connected', {
        userId,
        role: user.role
      });

      if (user.role === 'admin') {
        socket.emit('fetch_contacts');
      } else {
        const myThread = {
          _id: userId,
          name: 'Command Center (Admin)',
          role: 'admin'
        };

        setActiveContact(myThread);
      }
    });

    const handleContactsList = (list) => {
      console.log('Received contacts:', list);
      setContacts(list);
    };

    const handleUserOnline = (newUser) => {
      console.log('User online:', newUser);

      setContacts(prevContacts => {
        const existingIndex = prevContacts.findIndex(
          c => c._id === newUser._id
        );

        if (existingIndex >= 0) {
          const updatedContacts = [...prevContacts];

          updatedContacts[existingIndex] = {
            ...updatedContacts[existingIndex],
            ...newUser,
            isOnline: true
          };

          return updatedContacts;
        } else {
          return [...prevContacts, { ...newUser, isOnline: true }];
        }
      });
    };

    const handleUserOffline = ({ userId }) => {
      console.log('User offline:', userId);

      setContacts(prevContacts =>
        prevContacts.map(contact =>
          String(contact._id) === String(userId)
            ? { ...contact, isOnline: false }
            : contact
        )
      );
    };

    const handleContactUpdated = ({ threadId, lastMessageAt }) => {
      console.log('Contact updated:', { threadId, lastMessageAt });

      setContacts(prevContacts => {
        const updatedContacts = prevContacts.map(contact =>
          String(contact._id) === String(threadId)
            ? { ...contact, lastMessageAt: lastMessageAt }
            : contact
        );

        return updatedContacts.sort((a, b) => {
          if (a.lastMessageAt && b.lastMessageAt) {
            return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
          }

          if (a.lastMessageAt) return -1;
          if (b.lastMessageAt) return 1;

          if (a.isOnline && !b.isOnline) return -1;
          if (!a.isOnline && b.isOnline) return 1;

          return a.name.localeCompare(b.name);
        });
      });
    };

    const handleChatHistory = (history) => {
      console.log('Received history:', history);
      setMessages(history || []);

      if (user.role !== 'admin') {
        const hasUserMessage = (history || []).some(
          (msg) =>
            String(msg.senderId) === String(userId) &&
            msg.senderRole !== 'bot' &&
            msg.senderRole !== 'system'
        );

        hasSentFirstMessageRef.current = hasUserMessage;
      }
    };

    const handleReceiveMessage = (newMessage) => {
      console.log('Received message:', newMessage);

      if (
        user.role !== 'admin' &&
        String(newMessage.threadId) !== String(userId)
      ) {
        return;
      }

      if (
        String(newMessage.threadId) ===
        String(activeThreadRef.current)
      ) {
        addMessageIfNew(newMessage);

        socket.emit('mark_read', {
          threadId: newMessage.threadId,
          userId
        });
      } else if (user.role === 'admin') {
        toast.success(`New message from ${newMessage.senderName}`);

        setUnreadCounts((prev) => ({
          ...prev,
          [newMessage.threadId]:
            (prev[newMessage.threadId] || 0) + 1
        }));
      }
    };

    const handleChatCleared = ({ threadId }) => {
      console.log('Chat cleared:', threadId);

      if (
        String(threadId) ===
        String(activeThreadRef.current)
      ) {
        setMessages([]);

        if (user.role !== 'admin') {
          hasSentFirstMessageRef.current = false;
        }

        toast.success('Chat cleared');
      }
    };

    const handleChatDeleted = ({ threadId }) => {
      console.log('Chat deleted:', threadId);

      setContacts(prevContacts =>
        prevContacts.filter(
          contact => String(contact._id) !== String(threadId)
        )
      );

      if (
        String(threadId) ===
        String(activeThreadRef.current)
      ) {
        setMessages([]);
        setActiveContact(null);
        toast.success('Chat deleted successfully');
      }
    };

    const handleTyping = ({ threadId, userName }) => {
      if (
        String(threadId) ===
        String(activeThreadRef.current)
      ) {
        setIsTyping(true);
        setTypingUser(userName);
      }
    };

    const handleStopTyping = ({ threadId }) => {
      if (
        String(threadId) ===
        String(activeThreadRef.current)
      ) {
        setIsTyping(false);
        setTypingUser('');
      }
    };

    socket.on('contacts_list', handleContactsList);
    socket.on('user_online', handleUserOnline);
    socket.on('user_offline', handleUserOffline);
    socket.on('contact_updated', handleContactUpdated);
    socket.on('chat_history', handleChatHistory);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('chat_cleared', handleChatCleared);
    socket.on('chat_deleted', handleChatDeleted);
    socket.on('typing', handleTyping);
    socket.on('stop_typing', handleStopTyping);

    return () => {
      socket.off('contacts_list', handleContactsList);
      socket.off('user_online', handleUserOnline);
      socket.off('user_offline', handleUserOffline);
      socket.off('contact_updated', handleContactUpdated);
      socket.off('chat_history', handleChatHistory);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('chat_cleared', handleChatCleared);
      socket.off('chat_deleted', handleChatDeleted);
      socket.off('typing', handleTyping);
      socket.off('stop_typing', handleStopTyping);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      socket.disconnect();
    };
  }, [user, navigate, getUserId, addMessageIfNew]);

  useEffect(() => {
    if (!activeContact || !user) return;

    const userId = getUserId();

    activeThreadRef.current = activeContact._id;

    console.log('Fetching history for:', activeContact._id);

    socket.emit('fetch_history', activeContact._id);

    socket.emit('mark_read', {
      threadId: activeContact._id,
      userId
    });

    setUnreadCounts((prev) => {
      const updated = { ...prev };
      delete updated[activeContact._id];
      return updated;
    });
  }, [activeContact, user, getUserId]);

  // FIX:
  // Scroll only the messages container instead of using scrollIntoView(),
  // which can scroll the entire page and hide the customer list.
  useEffect(() => {
    const container = messagesContainerRef.current;

    if (!container) return;

    container.scrollTop = container.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);

    document.addEventListener('click', handleClick);

    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!message.trim() || !activeContact || !user) return;

    const userId = getUserId();
    const currentMessage = message.trim();

    const messageData = {
      senderId: userId,
      senderName: user.name,
      senderRole: user.role,
      threadId: activeContact._id,
      text: currentMessage
    };

    console.log('Sending message:', messageData);

    socket.emit('send_message', messageData);
    setMessage('');

    socket.emit('stop_typing', {
      threadId: activeContact._id,
      userId
    });

    if (
      user.role !== 'admin' &&
      !hasSentFirstMessageRef.current
    ) {
      hasSentFirstMessageRef.current = true;

      setTimeout(() => {
        const autoReply = {
          senderId: 'bot',
          senderName: 'Royal Service Bot',
          senderRole: 'bot',
          threadId: userId,
          text: `Thank you for your message! I'll help you with that.

You can also use these quick commands:
- Ask about booking appointments
- Inquire about our services
- Get our contact number
- Check operating hours

For immediate assistance, call us at 074 365 8500.`
        };

        console.log('Sending auto-reply:', autoReply);

        socket.emit('send_message', autoReply);
      }, 1000);
    }
  };

  const handleQuickCommand = (command) => {
    if (user?.role === 'admin' || !activeContact || !user) {
      return;
    }

    const userId = getUserId();

    const userMsg = {
      senderId: userId,
      senderName: user.name,
      senderRole: user.role,
      threadId: userId,
      text: command.question
    };

    console.log('Sending quick command:', userMsg);

    socket.emit('send_message', userMsg);

    setTimeout(() => {
      const autoReply = {
        senderId: 'bot',
        senderName: 'Royal Service Bot',
        senderRole: 'bot',
        threadId: userId,
        text: getAutoReply(command.question)
      };

      console.log('Sending bot reply:', autoReply);

      socket.emit('send_message', autoReply);
    }, 800);
  };

  const handleClearChat = () => {
    if (!activeContact || !user) return;

    const confirmed = window.confirm(
      'Clear all messages in this chat?'
    );

    if (!confirmed) return;

    socket.emit('clear_chat', {
      threadId: activeContact._id,
      userId: getUserId(),
      role: user.role
    });
  };

  const handleContextMenu = (e, contact) => {
    e.preventDefault();

    if (user?.role === 'admin') {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        contact: contact
      });
    }
  };

  const handleDeleteChat = (contact) => {
    const confirmed = window.confirm(
      `Delete entire chat with ${contact.name}? This will remove all messages and remove the customer from the list.`
    );

    if (!confirmed) return;

    socket.emit('delete_chat', {
      threadId: contact._id,
      userId: getUserId(),
      role: user.role
    });

    setContextMenu(null);
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);

    if (!activeContact || !user) return;

    socket.emit('typing', {
      threadId: activeContact._id,
      userId: getUserId(),
      userName: user.name
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', {
        threadId: activeContact._id,
        userId: getUserId()
      });
    }, 1000);
  };

  const isMe = (senderId) =>
    String(senderId) === String(getUserId());

  const formatTime = (timestamp) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);

    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-screen bg-zinc-950 flex flex-col font-sans text-zinc-50 selection:bg-red-600 selection:text-white relative overflow-hidden">

      {/* Ambient red glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-[400px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-2 min-w-[200px]"
          style={{
            top: contextMenu.y,
            left: contextMenu.x
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 border-b border-zinc-800">
            <p className="text-sm font-bold text-white">
              {contextMenu.contact.name}
            </p>

            <p className="text-xs text-zinc-500">
              {contextMenu.contact.role}
            </p>
          </div>

          <button
            onClick={() =>
              handleDeleteChat(contextMenu.contact)
            }
            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-600/10 transition-colors flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>

            Delete Chat Completely
          </button>
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800 py-3 px-4 md:px-6 flex items-center justify-between shadow-2xl shrink-0">
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-zinc-500 hover:text-red-500 transition-colors p-1"
            aria-label="Go back"
          >
            <svg
              className="w-5 h-5 md:w-6 md:h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 19l-7-7m0 0l7-7m7 7H3"
              />
            </svg>
          </button>

          <div className="flex flex-col">
            <h2 className="text-base md:text-lg font-black tracking-widest uppercase text-white">
              Direct Comm-Link
            </h2>

            <span className="text-[9px] md:text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Live Sync Active
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center">
            <span className="text-xs font-bold text-red-500">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>

          <span className="hidden sm:block text-sm text-zinc-400 font-semibold">
            {user?.name?.split(' ')[0]}
          </span>
        </div>
      </header>

      {/* Main layout */}
      <main className="flex-1 relative z-10 max-w-6xl mx-auto w-full p-3 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6 min-h-0 overflow-hidden">

        {/* ADMIN SIDEBAR */}
        {user?.role === 'admin' && (
          <aside className="w-full md:w-72 lg:w-80 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shrink-0 shadow-2xl min-h-0">

            <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 shrink-0">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                Active Personnel
              </h3>
            </div>

            {/* Customer list scrolls independently */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
              {contacts.length === 0 ? (
                <div className="text-center py-8 text-zinc-600 text-sm">
                  No contacts online
                </div>
              ) : (
                contacts.map((contact) => (
                  <div
                    key={contact._id}
                    onClick={() => setActiveContact(contact)}
                    onContextMenu={(e) =>
                      handleContextMenu(e, contact)
                    }
                    className={`p-3 rounded-xl cursor-pointer transition-all border relative ${
                      activeContact?._id === contact._id
                        ? 'bg-red-600/10 border-red-600/40'
                        : 'bg-zinc-950/60 border-zinc-800 hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-zinc-400">
                            {contact.name
                              ?.charAt(0)
                              ?.toUpperCase()}
                          </span>
                        </div>

                        {contact.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-zinc-900"></span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-white truncate">
                          {contact.name}
                        </p>

                        <span
                          className={`text-[9px] font-black uppercase tracking-widest mt-1 inline-block px-2 py-0.5 rounded border ${
                            contact.role === 'staff'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                        >
                          {contact.role}
                        </span>
                      </div>

                      {unreadCounts[contact._id] > 0 && (
                        <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {unreadCounts[contact._id]}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        {/* Messaging Area */}
        <section className="flex-1 min-w-0 min-h-0 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">

          {/* Chat Header */}
          {activeContact && (
            <div className="p-3 md:p-4 border-b border-zinc-800 bg-zinc-950/50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-red-500">
                    {activeContact.name
                      ?.charAt(0)
                      ?.toUpperCase() || 'B'}
                  </span>
                </div>

                <div>
                  <span className="font-bold text-white text-sm">
                    {user?.role === 'admin'
                      ? activeContact.name
                      : 'Royal Service Bot'}
                  </span>

                  <p className="text-[10px] text-zinc-500">
                    {isTyping
                      ? `${typingUser} is typing...`
                      : 'online'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearChat}
                className="px-3 py-2 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wider text-red-500 bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 transition-all"
                title="Clear all messages"
              >
                🗑 Clear Chat
              </button>
            </div>
          )}

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto space-y-4 md:space-y-6"
          >
            {!activeContact ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm font-medium">
                {user?.role === 'admin'
                  ? 'Select personnel from the roster to begin transmission.'
                  : 'Connecting to Command Center...'}
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm font-medium">
                No active communications found. Start the conversation!
              </div>
            ) : (
              messages.map((msg, index) => {
                const isMyMessage = isMe(msg.senderId);
                const isBot = msg.senderRole === 'bot';

                return (
                  <div
                    key={
                      msg._id ||
                      `${msg.createdAt}-${index}`
                    }
                    className={`flex flex-col ${
                      isMyMessage
                        ? 'items-end'
                        : 'items-start'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        {isMyMessage
                          ? 'You'
                          : isBot
                          ? '🤖 Bot'
                          : msg.senderName}
                      </span>

                      {msg.createdAt && (
                        <span className="text-[9px] text-zinc-600">
                          {formatTime(msg.createdAt)}
                        </span>
                      )}
                    </div>

                    <div
                      className={`max-w-[85%] md:max-w-[70%] p-3 md:p-4 rounded-2xl ${
                        isMyMessage
                          ? 'bg-red-600 text-white rounded-tr-sm shadow-[0_5px_15px_rgba(220,38,38,0.25)]'
                          : isBot
                          ? 'bg-purple-600/20 border border-purple-500/30 text-purple-100 rounded-tl-sm'
                          : msg.senderRole === 'admin'
                          ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-100 rounded-tl-sm'
                          : 'bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-tl-sm'
                      }`}
                    >
                      <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                        {msg.text}
                      </p>
                    </div>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Commands - Only for non-admin */}
          {user?.role !== 'admin' && (
            <div className="px-3 md:px-4 pb-2 bg-zinc-950/40 shrink-0">
              <div className="flex gap-2 overflow-x-auto py-2">
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

          {/* Message Input */}
          <div className="p-3 md:p-4 bg-zinc-950/50 border-t border-zinc-800 backdrop-blur-xl shrink-0">
            <form
              onSubmit={handleSendMessage}
              className="flex gap-2 md:gap-3"
            >
              <input
                type="text"
                value={message}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                disabled={!activeContact}
                placeholder={
                  activeContact
                    ? 'Type your question...'
                    : 'Awaiting target selection...'
                }
                className="flex-1 bg-zinc-900 border border-zinc-800 text-white px-4 md:px-5 py-3 md:py-3.5 rounded-xl focus:border-red-600 focus:outline-none transition-colors disabled:opacity-50 text-sm md:text-base placeholder:text-zinc-600"
              />

              <button
                type="submit"
                disabled={
                  !message.trim() || !activeContact
                }
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 md:px-6 rounded-xl font-black tracking-widest transition-all text-sm md:text-base flex items-center gap-2 shadow-lg shadow-red-600/20"
              >
                <span className="hidden sm:inline">
                  SEND
                </span>

                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 19l9 2-9-18-9 18-9-2 9-18 9 18-9-2z"
                  />
                </svg>
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}