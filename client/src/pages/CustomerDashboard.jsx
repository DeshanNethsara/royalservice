import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

export default function CustomerDashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Rating Modal States
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [selectedBookingForRating, setSelectedBookingForRating] = useState(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchBookings();
  }, [user, navigate]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await axiosClient.get('/bookings/my-bookings');
      // Sort latest first
      const sorted = response.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setBookings(sorted);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load your bookings.');
    } finally {
      setLoading(false);
    }
  };

  const canCancelBooking = (booking) => {
    if (!booking.booking_date || !booking.booking_time) return false;
    if (!['Pending', 'Confirmed'].includes(booking.status)) return false;

    const now = new Date();
    const [timeStr, period] = booking.booking_time.split(' ');
    const [hours, minutes] = timeStr.split(':').map(Number);
    let hour24 = hours;

    if (period === 'PM' && hours !== 12) hour24 += 12;
    if (period === 'AM' && hours === 12) hour24 = 0;

    const bookingDateTime = new Date(
      `${booking.booking_date}T${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
    );
    const timeDifference = (bookingDateTime - now) / (1000 * 60 * 60);
    return timeDifference > 2;
  };

  const getCancellationMessage = (booking) => {
    const now = new Date();
    const [timeStr, period] = booking.booking_time.split(' ');
    const [hours, minutes] = timeStr.split(':').map(Number);
    let hour24 = hours;

    if (period === 'PM' && hours !== 12) hour24 += 12;
    if (period === 'AM' && hours === 12) hour24 = 0;

    const bookingDateTime = new Date(
      `${booking.booking_date}T${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
    );
    const timeDifference = (bookingDateTime - now) / (1000 * 60 * 60);

    if (timeDifference <= 0) {
      return 'Booking time has passed';
    } else if (timeDifference <= 2) {
      return `Cannot cancel - less than 2 hours before appointment (${Math.floor(timeDifference)}h ${Math.floor((timeDifference % 1) * 60)}m remaining)`;
    }
    return '';
  };

  const handleCancel = async (booking) => {
    if (!canCancelBooking(booking)) {
      const message = getCancellationMessage(booking);
      toast.error(message || 'Cannot cancel this booking');
      return;
    }

    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    setCancellingId(booking._id);
    try {
      const response = await axiosClient.patch(`/bookings/${booking._id}/status`, {
        status: 'Cancelled',
      });

      if (response.data) {
        toast.success('Booking cancelled successfully.');
        await fetchBookings();
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      const errorMessage =
        error.response?.data?.message || 'Failed to cancel booking.';
      toast.error(errorMessage);
      fetchBookings();
    } finally {
      setCancellingId(null);
    }
  };

  const handleDownloadRecord = async (booking) => {
    setDownloadingId(booking._id);
    try {
      const response = await axiosClient.get(`/bookings/${booking._id}/record`, {
        responseType: 'blob',
      });

      const contentType =
        response.headers?.['content-type'] ||
        response.headers?.get?.('content-type') ||
        response.data?.type ||
        '';

      if (!contentType.includes('application/pdf')) {
        try {
          const text = await response.data.text();
          const jsonData = JSON.parse(text);
          toast.error(jsonData.message || 'Service record is not available yet.');
        } catch {
          toast.error('Service record is not available yet.');
        }
        return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `Service_Record_${booking.booking_ref}.pdf`
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Service record downloaded.');
    } catch (error) {
      console.error('Error downloading record:', error);
      toast.error('Service record is not available yet.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Rating Functions
  const openRatingModal = (booking) => {
    setSelectedBookingForRating(booking);
    setRatingValue(5);
    setReviewComment('');
    setIsRatingModalOpen(true);
  };

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (!selectedBookingForRating) return;

    setIsSubmittingRating(true);
    try {
      await axiosClient.post(`/bookings/${selectedBookingForRating._id}/rate`, {
        rating: ratingValue,
        review_comment: reviewComment
      });
      toast.success('Thank you for your feedback!');
      setIsRatingModalOpen(false);
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit rating');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleChatRedirect = () => {
    navigate('/chat');
  };

  const getStatusCount = (status) => {
    if (status === 'Upcoming') {
      return bookings.filter(
        (b) => b.status === 'Pending' || b.status === 'Confirmed'
      ).length;
    }
    return bookings.filter((b) => b.status === status).length;
  };

  const filteredBookings = useMemo(() => {
    let filtered = bookings;

    if (activeTab === 'Upcoming')
      filtered = filtered.filter((b) => b.status === 'Pending' || b.status === 'Confirmed');
    else if (activeTab === 'In Progress')
      filtered = filtered.filter((b) => b.status === 'In Progress');
    else if (activeTab === 'Completed')
      filtered = filtered.filter((b) => b.status === 'Completed');
    else if (activeTab === 'Cancelled')
      filtered = filtered.filter((b) => b.status === 'Cancelled' || b.status === 'Rejected');

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.booking_ref?.toLowerCase().includes(lowerSearch) ||
          b.vehicle_id?.reg_number?.toLowerCase().includes(lowerSearch) ||
          b.service_id?.name?.toLowerCase().includes(lowerSearch)
      );
    }

    return filtered;
  }, [bookings, activeTab, searchTerm]);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Pending': return 'text-amber-500';
      case 'Confirmed': return 'text-emerald-400';
      case 'In Progress': return 'text-blue-400';
      case 'Completed': return 'text-emerald-400';
      case 'Cancelled':
      case 'Rejected': return 'text-zinc-500';
      default: return 'text-zinc-400';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-50 selection:bg-red-600 selection:text-white">
      
      {/* RATING MODAL */}
      {isRatingModalOpen && selectedBookingForRating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6">
              <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tight text-center">
                Rate Your Service
              </h3>
              <p className="text-zinc-400 text-sm text-center mb-6">
                How was your experience with {selectedBookingForRating.service_id?.name}?
              </p>

              <form onSubmit={handleSubmitRating}>
                <div className="flex justify-center gap-2 mb-6">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingValue(star)}
                      className={`p-2 transition-transform hover:scale-110 ${
                        star <= ratingValue ? 'text-amber-400' : 'text-zinc-700'
                      }`}
                    >
                      <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  ))}
                </div>

                <div className="mb-6">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
                    Leave a comment (optional)
                  </label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Tell us what you liked or how we can improve..."
                    rows="3"
                    className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none placeholder:text-zinc-600 resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsRatingModalOpen(false)}
                    className="w-1/3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRating}
                    className="w-2/3 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-600/20 transition-colors disabled:opacity-50"
                  >
                    {isSubmittingRating ? 'Submitting...' : 'Submit Rating'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center shadow-lg shadow-red-600/20">
              <span className="text-white font-extrabold text-xl tracking-tighter">R</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-widest uppercase hidden md:block">
              Royal Service
            </h1>
          </Link>

          <nav className="flex items-center space-x-3 md:space-x-6">
            <Link
              to="/"
              className="text-zinc-400 hover:text-red-500 text-sm font-semibold tracking-wide transition-colors hidden sm:block"
            >
              HOME
            </Link>
            <Link
              to="/booking"
              className="text-red-500 hover:text-red-400 text-sm font-bold tracking-wide transition-colors flex items-center gap-2"
            >
              <span className="text-lg">+</span>
              <span className="hidden sm:inline">NEW BOOKING</span>
            </Link>
            <button
              onClick={() => {
                logout();
                toast.success('Logged out securely.');
                navigate('/login');
              }}
              className="bg-zinc-800 hover:bg-red-600 text-white px-4 md:px-5 py-2 rounded text-sm font-bold tracking-wide transition-all duration-300"
            >
              LOGOUT
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto mt-8 p-4 md:p-6 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[300px] bg-red-600/5 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="relative z-10">
          
          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Welcome back, {user?.name?.split(' ')[0] || 'Commander'}
            </h2>
            <p className="text-zinc-400 mt-2 text-sm md:text-base">
              Manage your vehicle deployments and service history.
            </p>
          </div>

          {/* Tabs */}
          <div className="border-b border-zinc-800 mb-6 flex overflow-x-auto hide-scrollbar">
            {['Upcoming', 'In Progress', 'Completed', 'Cancelled'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 px-6 text-sm font-bold tracking-wide transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === tab
                    ? 'border-red-600 text-red-500'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                {tab}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeTab === tab ? 'bg-red-600/20 text-red-400' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {getStatusCount(tab)}
                </span>
              </button>
            ))}
          </div>

          {/* Toolbar (Search Only) */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <div className="flex gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <svg className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by ref, vehicle or service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:border-red-600 focus:outline-none placeholder-zinc-600"
                />
              </div>
            </div>
          </div>

          {/* Content Area */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-zinc-900 h-20 rounded-xl border border-zinc-800 animate-pulse"></div>
              ))}
            </div>
          ) : filteredBookings.length === 0 ? (
            
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-32 h-32 mb-6 opacity-80 relative">
                <div className="absolute inset-0 bg-red-600/5 rounded-full blur-2xl"></div>
                <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                  <svg className="w-20 h-20 text-zinc-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="absolute top-0 right-0 w-8 h-8 bg-red-500 rounded-full opacity-20 blur-sm animate-pulse"></div>
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No results found</h3>
              <p className="text-zinc-500 text-sm mb-6 max-w-sm text-center">
                We couldn't find any {activeTab.toLowerCase()} bookings matching your criteria.
              </p>
              {activeTab === 'Upcoming' && !searchTerm && (
                <Link
                  to="/booking"
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg shadow-red-600/20"
                >
                  Book a Service
                </Link>
              )}
            </div>

          ) : (
            
            /* List View */
            <div className="space-y-3">
              {filteredBookings.map((booking) => {
                const canCancel = canCancelBooking(booking);
                const cancelMessage = getCancellationMessage(booking);
                const isCompleted = booking.status === 'Completed';

                return (
                  <div
                    key={booking._id}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                  >
                    {/* Left Side: Info */}
                    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      
                      {/* Ref & Status */}
                      <div>
                        <div className="font-bold text-white text-sm tracking-wider">{booking.booking_ref}</div>
                        <div className={`text-xs font-bold uppercase mt-1 ${getStatusStyle(booking.status)}`}>
                          {booking.status}
                        </div>
                      </div>

                      {/* Service */}
                      <div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">Service</p>
                        <p className="text-zinc-200 text-sm font-medium">{booking.service_id?.name || 'N/A'}</p>
                      </div>

                      {/* Vehicle */}
                      <div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">Vehicle</p>
                        <p className="text-zinc-200 text-sm font-medium">
                          {booking.vehicle_id?.reg_number?.toUpperCase() || 'N/A'}
                        </p>
                      </div>

                      {/* Date */}
                      <div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">Schedule</p>
                        <p className="text-zinc-200 text-sm font-medium">{booking.booking_date}</p>
                        <p className="text-zinc-500 text-xs">{booking.booking_time}</p>
                      </div>
                    </div>

                    {/* Right Side: Actions */}
                    <div className="flex items-center gap-3 w-full md:w-auto shrink-0 md:border-l border-zinc-800 md:pl-6">
                      
                      {activeTab === 'Upcoming' && (
                        <div className="flex flex-col items-end w-full md:w-auto">
                          <button
                            onClick={() => handleCancel(booking)}
                            disabled={!canCancel || cancellingId === booking._id}
                            className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wider transition-all w-full md:w-auto ${
                              canCancel
                                ? 'border border-red-600/40 text-red-500 hover:bg-red-600/10'
                                : 'border border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                            }`}
                          >
                            {cancellingId === booking._id ? 'CANCELLING...' : 'CANCEL'}
                          </button>
                          {!canCancel && (
                            <span className="text-[10px] text-amber-500 mt-1 max-w-[150px] text-right">
                              {cancelMessage}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {isCompleted && (
                        <>
                          {!booking.rating && (
                            <button
                              onClick={() => openRatingModal(booking)}
                              className="px-4 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500 hover:text-white rounded-lg text-xs font-bold tracking-wider transition-all"
                            >
                              RATE
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleDownloadRecord(booking)}
                            disabled={downloadingId === booking._id}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-wider text-zinc-300 bg-transparent border border-zinc-600 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
                          >
                            {downloadingId === booking._id ? (
                              'DOWNLOADING...'
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download Report
                              </>
                            )}
                          </button>

                          {booking.rating && (
                            <div className="flex items-center text-amber-400 ml-2">
                              {[...Array(5)].map((_, i) => (
                                <svg key={i} className={`w-3.5 h-3.5 ${i < booking.rating ? 'fill-current' : 'text-zinc-700'}`} viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* MODERN FLOATING CHAT BUTTON */}
      <button
        onClick={handleChatRedirect}
        className="fixed bottom-6 right-6 z-40 group"
        aria-label="Chat with support"
        title="Chat with support"
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

          <span className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></span>
        </span>

        <span className="hidden md:block absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-zinc-900 text-white text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-xl border border-zinc-800">
          Chat with Support
          <span className="absolute left-full top-1/2 -translate-y-1/2 border-8 border-transparent border-l-zinc-900"></span>
        </span>
      </button>

      {/* CSS to hide scrollbar for tabs */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}