import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';
import io from 'socket.io-client';

// Use environment variable for the socket URL
const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export default function StaffDashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [notes, setNotes] = useState('');
  
  // 🚨 Mobile View State
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
      navigate('/login');
      return;
    }

    fetchBookings();

    // 🚨 LIVE UPDATE: Connect to Socket.io
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('Staff Dashboard connected to live updates');
    });

    // Listen for any booking updates (new booking, assigned staff, status change)
    socketRef.current.on('contact_updated', () => {
      fetchBookings(); 
    });

    // If the admin makes changes, we can also listen to a generic update if you add one later.
    // For now, polling every 30 seconds as a fallback + the socket listener covers it.

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [user, navigate]);

  const fetchBookings = async () => {
    try {
      const response = await axiosClient.get('/bookings/all');
      const myTasks = response.data.filter(
        (b) => b.staff_id?._id === user._id || b.staff_id === user._id
      );

      // 🚨 SORT: Latest jobs on top based on created_at or updated_at
      myTasks.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
      
      setBookings(myTasks);

      // Update the selected booking if it exists in the new data
      if (selectedBooking) {
        const updatedSelected = myTasks.find((b) => b._id === selectedBooking._id);
        setSelectedBooking(updatedSelected || null);
      }
    } catch (error) {
      toast.error('Error fetching your assigned tasks.');
    }
  };

  const handleStatusUpdate = async (status) => {
    try {
      const payload = { status };
      
      if (status === 'Completed' || status === 'In Progress') {
        payload.notes = notes;
      }

      await axiosClient.patch(`/bookings/${selectedBooking._id}/status`, payload);
      toast.success(`Deployment updated to: ${status}`);

      setNotes('');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to update task status.');
    }
  };

  const handleChatRedirect = () => {
    navigate('/chat');
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Pending':
      case 'Confirmed':
        return 'bg-red-600/10 text-red-500 border-red-600/30';
      case 'In Progress':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Completed':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Cancelled':
      case 'Rejected':
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-50 selection:bg-red-600 selection:text-white flex flex-col md:flex-row overflow-hidden">

      {/* Sidebar / Job List */}
      <div className={`w-full md:w-1/3 lg:w-1/4 bg-zinc-900 border-r border-zinc-800 h-[100dvh] flex-col z-20 shadow-2xl relative ${isMobileDetailOpen ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-zinc-800 bg-zinc-950/40 shrink-0">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-black text-white tracking-widest uppercase">
                Engineer Hub
              </h2>
              <p className="text-xs text-red-500 font-bold uppercase tracking-wider mt-1">
                {user?.name}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Link
              to="/"
              className="flex-1 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-2 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home
            </Link>
            <button
              onClick={() => {
                logout();
                toast.success('Logged out securely.');
              }}
              className="flex-1 text-xs font-bold uppercase tracking-widest text-red-500 hover:text-white bg-red-600/10 hover:bg-red-600 border border-red-600/30 px-3 py-2 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {bookings.length === 0 ? (
            <div className="text-center p-8 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/60">
              <p className="text-zinc-500 text-sm tracking-wide">
                No tasks assigned to you right now.
              </p>
            </div>
          ) : (
            bookings.map((b) => {
              const vehicle = b.vehicle_id || b.vehicleData;
              return (
                <div
                  key={b._id}
                  onClick={() => {
                    setSelectedBooking(b);
                    setNotes(b.notes || '');
                    setIsMobileDetailOpen(true);
                  }}
                  className={`p-5 rounded-xl cursor-pointer transition-all duration-300 border ${
                    selectedBooking?._id === b._id
                      ? 'border-red-600 bg-red-600/10 shadow-[0_0_15px_rgba(220,38,38,0.25)]'
                      : 'border-zinc-800 bg-zinc-950/60 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-black text-white tracking-widest">
                      {b.booking_ref}
                    </span>
                    <span className={`text-[10px] px-2 py-1 rounded border font-black uppercase tracking-widest ${getStatusStyle(b.status)}`}>
                      {b.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                    <p className="text-sm text-zinc-300 font-bold">
                      {vehicle?.reg_number}{' '}
                      <span className="text-zinc-500 font-normal">
                        ({vehicle?.make})
                      </span>
                    </p>
                    <span className="text-zinc-600 text-xs">•</span>
                    <span className="text-red-400 text-xs font-bold uppercase tracking-wider">
                      {b.service_id?.name || "Service"}
                    </span>
                  </div>

                  <div className="flex justify-between items-end mt-2">
                    <p className="text-xs text-zinc-500 font-medium">
                      {b.booking_date} at {b.booking_time}
                    </p>
                    
                    {b.issue_description && b.issue_description !== 'No specific issue described.' && (
                      <span className="text-[10px] text-amber-500 font-bold max-w-[100px] truncate" title={b.issue_description}>
                        ⚠️ Issue
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Panel / Job Details */}
      <div className={`flex-1 p-4 md:p-10 h-[100dvh] overflow-y-auto relative ${!isMobileDetailOpen ? 'hidden md:block' : 'block'}`}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[300px] bg-red-600/5 blur-[100px] rounded-full pointer-events-none"></div>

        {selectedBooking ? (
          <div className="relative z-10 max-w-3xl mx-auto animate-[fadeInUp_0.3s_ease-out]">
            
            {/* Mobile Back Button */}
            <button
              onClick={() => setIsMobileDetailOpen(false)}
              className="md:hidden flex items-center gap-2 text-zinc-400 hover:text-white mb-4 font-bold text-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to List
            </button>

            <div className="bg-zinc-900 p-6 md:p-10 rounded-2xl border border-zinc-800 shadow-2xl">
              <div className="mb-8 border-b border-zinc-800 pb-6">
                <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                  Deployment: {selectedBooking.booking_ref}
                </h3>
                <p className="text-zinc-400 mt-2 text-sm">
                  Review details and update operational status.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 text-sm">
                <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-800">
                  <strong className="block text-xs text-zinc-500 uppercase tracking-widest mb-1">
                    Customer Profile
                  </strong>
                  <span className="font-bold text-white text-base">
                    {selectedBooking.user_id?.name}
                  </span>
                  <div className="text-zinc-400 mt-1">
                    {selectedBooking.user_id?.phone}
                  </div>
                </div>

                <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-800">
                  <strong className="block text-xs text-zinc-500 uppercase tracking-widest mb-1">
                    Vehicle Specs
                  </strong>
                  <span className="font-bold text-white text-base">
                    {(selectedBooking.vehicle_id?.reg_number || selectedBooking.vehicleData?.reg_number)?.toUpperCase()}
                  </span>
                  <div className="text-zinc-400 mt-1">
                    {selectedBooking.vehicle_id?.make || selectedBooking.vehicleData?.make}
                  </div>
                </div>
              </div>

              {/* Service Requested */}
              <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-800 mb-6 animate-[fadeIn_0.3s_ease-out]">
                <strong className="block text-xs text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Service Requested
                </strong>
                <p className="text-white font-bold text-lg">
                  {selectedBooking.service_id?.name || "General Service"}
                </p>
              </div>

              {/* Vehicle Issue / Customer Notes */}
              <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-xl mb-10 animate-[fadeIn_0.3s_ease-out]">
                <strong className="block text-xs text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Vehicle Issue / Customer Notes
                </strong>
                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedBooking.issue_description || "No specific issue described by the customer."}
                </p>
              </div>

              {/* Only show textarea when status is 'In Progress' */}
              {selectedBooking.status === 'In Progress' && (
                <div className="space-y-4 mb-10 animate-[fadeIn_0.3s_ease-out]">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">
                    Technician Log
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Document diagnostics, parts replaced..."
                    className="w-full bg-zinc-950 border border-zinc-800 text-white p-5 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none min-h-[140px] placeholder:text-zinc-600"
                  />
                </div>
              )}

              {/* If Completed, show the notes that were saved */}
              {selectedBooking.status === 'Completed' && selectedBooking.notes && (
                <div className="space-y-2 mb-10">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">
                    Saved Technician Log
                  </label>
                  <div className="w-full bg-zinc-950/50 border border-zinc-800 text-zinc-300 p-5 rounded-xl text-sm whitespace-pre-wrap">
                    {selectedBooking.notes}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4 pt-6 border-t border-zinc-800">
                {selectedBooking.status === 'Confirmed' && (
                  <button
                    onClick={() => handleStatusUpdate('In Progress')}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white py-4 px-6 rounded-xl font-black tracking-widest transition-colors shadow-lg shadow-amber-600/20"
                  >
                    START JOB
                  </button>
                )}
                {selectedBooking.status === 'In Progress' && (
                  <button
                    onClick={() => handleStatusUpdate('Completed')}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 px-6 rounded-xl font-black tracking-widest transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    COMPLETE & FINALIZE RECORD
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 opacity-50">
            <p className="text-lg font-medium text-center px-4">
              Select a deployment from the roster to begin.
            </p>
          </div>
        )}
      </div>

      {/* Floating Chat Button (Hidden on Mobile if detail is open) */}
      <button
        onClick={handleChatRedirect}
        className={`fixed bottom-6 right-6 z-40 group ${isMobileDetailOpen ? 'hidden md:block' : 'block'}`}
        aria-label="Chat with support"
      >
        <span className="absolute inset-0 rounded-full bg-red-600/30 animate-ping opacity-75"></span>
        <span className="absolute inset-0 rounded-full bg-red-600/20 animate-pulse"></span>

        <span className="relative flex items-center gap-2 bg-gradient-to-br from-red-500 via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 text-white pl-3 pr-4 py-3 rounded-full shadow-2xl shadow-red-600/40 hover:shadow-red-600/60 transition-all duration-300 hover:scale-105">
          <span className="relative w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3C6.477 3 2 6.94 2 11.79c0 2.7 1.44 5.11 3.72 6.74-.07.83-.33 2.25-1.05 3.15-.09.12-.01.3.14.31 1.18.08 2.87-.53 4.14-1.4.96.29 2 .45 3.05.45 5.523 0 10-3.94 10-8.79S17.523 3 12 3z" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-red-600"></span>
          </span>
          <span className="text-xs font-black tracking-widest uppercase whitespace-nowrap">
            Chat
          </span>
        </span>
      </button>

    </div>
  );
}