import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

export default function AdminPanel() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('bookings');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Data States
  const [services, setServices] = useState([]);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);

  // Loading States
  const [loading, setLoading] = useState({
    bookings: true,
    services: true,
    users: true,
  });

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // 🚨 NEW: Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Form States
  const [newStaff, setNewStaff] = useState({ name: '', email: '', phone: '', password: '' });
  const [newService, setNewService] = useState({ name: '', price_car: '', price_suv: '', price_van: '', description: '' });
  const [editingServiceId, setEditingServiceId] = useState(null);

  // State for the Slip Modal
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [selectedSlipBooking, setSelectedSlipBooking] = useState(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchAllData();
  }, [user, navigate]);

  const fetchAllData = async () => {
    try {
      const [servicesRes, usersRes, bookingsRes] = await Promise.all([
        axiosClient.get('/services/all'),
        axiosClient.get('/users'),
        axiosClient.get('/bookings/all'),
      ]);

      setServices(servicesRes.data);
      setUsers(usersRes.data);
      
      const sortedBookings = bookingsRes.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setBookings(sortedBookings);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading({
        bookings: false,
        services: false,
        users: false,
      });
    }
  };

  const refreshBookings = useCallback(async () => {
    try {
      const res = await axiosClient.get('/bookings/all');
      const sortedBookings = res.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setBookings(sortedBookings);
    } catch (error) {
      console.error('Error refreshing bookings:', error);
    }
  }, []);

  const refreshServices = useCallback(async () => {
    try {
      const res = await axiosClient.get('/services/all');
      setServices(res.data);
    } catch (error) {
      console.error('Error refreshing services:', error);
    }
  }, []);

  const refreshUsers = useCallback(async () => {
    try {
      const res = await axiosClient.get('/users');
      setUsers(res.data);
    } catch (error) {
      console.error('Error refreshing users:', error);
    }
  }, []);

  // Booking Actions
  const handleAssignStaff = async (bookingId, staffId) => {
    try {
      await axiosClient.patch(`/bookings/${bookingId}/assign`, { staff_id: staffId });
      toast.success('Staff assigned successfully');
      refreshBookings();
    } catch (error) {
      toast.error('Error assigning staff');
    }
  };

  const handleDeleteBooking = async (id) => {
    if (!window.confirm('Delete this booking?')) return;
    try {
      await axiosClient.delete(`/bookings/${id}`);
      toast.success('Booking deleted');
      refreshBookings();
    } catch (error) {
      toast.error('Error deleting booking');
    }
  };

  // Open Modal
  const openSlipModal = (booking) => {
    setSelectedSlipBooking(booking);
    setSlipModalOpen(true);
  };

  // Approve Payment (from Modal)
  const handleApprovePayment = async (id) => {
    if (!window.confirm('Approve this payment slip and confirm the booking?')) return;
    try {
      await axiosClient.patch(`/bookings/${id}/approve-payment`);
      toast.success('Payment approved! Booking is now confirmed.');
      setSlipModalOpen(false);
      refreshBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error approving payment');
    }
  };

  const handleDownloadRecord = async (id, refNumber) => {
    try {
      const response = await axiosClient.get(`/bookings/${id}/record`, {
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
          toast.error(jsonData.message || 'Record not available');
        } catch {
          toast.error('Record not available');
        }
        return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Service_Record_${refNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Record downloaded');
    } catch (error) {
      console.error('Error downloading record:', error);
      toast.error('Record not available');
    }
  };

  // User Actions
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.post('/users/staff', newStaff);
      setNewStaff({ name: '', email: '', phone: '', password: '' });
      refreshUsers();
      toast.success('Staff account created');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creating staff');
    }
  };

  const handleToggleUserStatus = async (id, currentStatus) => {
    try {
      await axiosClient.patch(`/users/${id}/status`, {
        status: currentStatus === 1 ? 0 : 1,
      });
      toast.success('User status updated');
      refreshUsers();
    } catch (error) {
      toast.error('Error updating user status');
    }
  };

  // Service Actions
  const handleSubmitService = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: newService.name,
        price: {
          Car: Number(newService.price_car),
          SUV: Number(newService.price_suv),
          Van: Number(newService.price_van),
        },
        description: newService.description,
      };

      if (editingServiceId) {
        await axiosClient.put(`/services/${editingServiceId}`, payload);
        toast.success('Service updated');
      } else {
        await axiosClient.post('/services', payload);
        toast.success('Service created');
      }

      setEditingServiceId(null);
      setNewService({ name: '', price_car: '', price_suv: '', price_van: '', description: '' });
      refreshServices();
    } catch (error) {
      toast.error('Error saving service');
    }
  };

  const handleEditService = (svc) => {
    setEditingServiceId(svc._id);
    setNewService({
      name: svc.name,
      price_car: typeof svc.price === 'object' ? svc.price.Car : svc.price,
      price_suv: typeof svc.price === 'object' ? svc.price.SUV : svc.price,
      price_van: typeof svc.price === 'object' ? svc.price.Van : svc.price,
      description: svc.description || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleService = async (id, currentStatus) => {
    try {
      await axiosClient.put(`/services/${id}`, { is_active: !currentStatus });
      toast.success('Service status updated');
      refreshServices();
    } catch (error) {
      toast.error('Error updating service');
    }
  };

  const handleDeleteService = async (id) => {
    if (!window.confirm('Delete this service?')) return;
    try {
      await axiosClient.delete(`/services/${id}`);
      toast.success('Service deleted');
      refreshServices();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error deleting service');
    }
  };

  // Filtered data
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        b.booking_ref?.toLowerCase().includes(search) ||
        b.service_id?.name?.toLowerCase().includes(search) ||
        b.user_id?.name?.toLowerCase().includes(search) ||
        b.user_id?.phone?.toLowerCase().includes(search) ||
        b.userData?.name?.toLowerCase().includes(search) ||
        b.userData?.phone?.toLowerCase().includes(search);
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchTerm, statusFilter]);

  // 🚨 PAGINATION MATH
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredBookings.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);

  // 🚨 RESET PAGE ON FILTER CHANGE
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, activeTab]);

  const filteredServices = useMemo(() => {
    if (!searchTerm) return services;
    return services.filter((s) =>
      s.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [services, searchTerm]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const availableStaff = users.filter((u) => u.role === 'staff' && u.status === 1);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Pending':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
      case 'Confirmed':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'; // 🚨 Changed to Cyan
      case 'In Progress':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Completed':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Cancelled':
      case 'Rejected':
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/');
  };

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-50 flex flex-col md:flex-row relative">
      
      {/* SLIP VIEW MODAL */}
      {slipModalOpen && selectedSlipBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-950/50 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white">Payment Slip Verification</h3>
                <p className="text-xs text-zinc-400">Booking Ref: {selectedSlipBooking.booking_ref}</p>
              </div>
              <button onClick={() => setSlipModalOpen(false)} className="text-zinc-400 hover:text-red-500 p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 bg-zinc-950 flex justify-center items-center overflow-y-auto min-h-[400px]">
              {selectedSlipBooking.payment_slip?.toLowerCase().endsWith('.pdf') ? (
                <iframe src={selectedSlipBooking.payment_slip} className="w-full h-[60vh] rounded-lg bg-white" title="Payment Slip PDF" />
              ) : (
                <img src={selectedSlipBooking.payment_slip} alt="Payment Slip" className="max-h-[60vh] w-auto object-contain rounded-lg shadow-lg border border-zinc-800" />
              )}
            </div>
            <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex justify-between items-center shrink-0">
              <div className="text-sm">
                <span className="text-zinc-400">Amount: </span>
                <span className="font-bold text-white text-lg">LKR {selectedSlipBooking.total_price.toLocaleString()}</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSlipModalOpen(false)} className="px-4 py-2 rounded-lg font-bold text-sm text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors">Close</button>
                {selectedSlipBooking.status === 'Pending' && (
                  <button onClick={() => handleApprovePayment(selectedSlipBooking._id)} className="px-6 py-2 rounded-lg font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/20 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    Approve Payment
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden bg-zinc-900 p-4 flex items-center justify-between sticky top-0 z-30 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain rounded-lg shadow-lg" />
          <h2 className="text-lg font-black text-white uppercase tracking-widest">ADMIN</h2>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-zinc-400 hover:text-red-500 p-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isSidebarOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'flex' : 'hidden'} md:flex flex-col w-64 bg-zinc-900 border-r border-zinc-800 z-40 fixed md:sticky top-0 h-screen overflow-y-auto shrink-0 transition-transform duration-300`}>
        <div className="p-6 pb-4">
          <div className="hidden md:flex items-center gap-3 mb-6 border-b border-zinc-800 pb-6">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain rounded-lg shadow-lg" />
            <h2 className="text-lg font-black text-white uppercase tracking-widest">Admin Panel</h2>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => { setActiveTab('bookings'); setIsSidebarOpen(false); setSearchTerm(''); setStatusFilter('all'); }}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'bookings' ? 'bg-red-600 text-white shadow-lg shadow-red-600/25' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
            >
              📋 Bookings
            </button>
            <button
              onClick={() => { setActiveTab('services'); setIsSidebarOpen(false); setSearchTerm(''); }}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'services' ? 'bg-red-600 text-white shadow-lg shadow-red-600/25' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
            >
              🔧 Services
            </button>
            <button
              onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); setSearchTerm(''); }}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'users' ? 'bg-red-600 text-white shadow-lg shadow-red-600/25' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
            >
              👥 Users
            </button>
          </nav>
        </div>

        <div className="mt-auto p-6 pt-4 border-t border-zinc-800/50 space-y-2">
          <button onClick={() => navigate('/')} className="w-full text-left px-4 py-3 rounded-xl font-bold text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-2">
            ← Home
          </button>
          <button onClick={handleLogout} className="w-full border border-red-600/30 text-red-500 hover:bg-red-600 hover:text-white px-4 py-3 rounded-xl font-bold text-sm transition-all">
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto h-[calc(100vh-73px)] md:h-screen">
        {/* Search Bar */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={activeTab === 'bookings' ? 'Search by ref, name, phone, or service...' : `Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-white p-3 pl-10 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none placeholder:text-zinc-600"
            />
            <svg className="w-5 h-5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {activeTab === 'bookings' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl focus:border-red-600 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Rejected">Rejected</option>
            </select>
          )}
        </div>

        {/* BOOKINGS TAB */}
        {activeTab === 'bookings' && (
          <div>
            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Active Deployments</h3>
            <p className="text-zinc-400 mb-6">Manage customer appointments and assign staff.</p>

            {loading.bookings ? (
              <LoadingSpinner />
            ) : (
              <>
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead className="bg-zinc-950/60 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                        <tr>
                          <th className="p-4">Reference</th>
                          <th className="p-4">Customer</th>
                          <th className="p-4">Schedule</th>
                          <th className="p-4">Service</th>
                          <th className="p-4">Assign Staff</th>
                          <th className="p-4">Rating</th>
                          <th className="p-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {currentItems.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="p-10 text-center text-zinc-500">No bookings found</td>
                          </tr>
                        ) : (
                          currentItems.map((b) => (
                            <tr key={b._id} className="hover:bg-zinc-800/50 transition-colors">
                              <td className="p-4 border-b border-zinc-800">
                                <div className="font-bold text-white">{b.booking_ref}</div>
                                <span className={`text-[10px] px-2 py-1 rounded border font-bold uppercase tracking-wider ${getStatusStyle(b.status)}`}>
                                  {b.status}
                                </span>
                              </td>
                              <td className="p-4 border-b border-zinc-800">
                                <div className="font-bold text-white">{b.user_id?.name || b.userData?.name || 'N/A'}</div>
                                <div className="text-zinc-500 text-xs mt-0.5">{b.user_id?.phone || b.userData?.phone || 'No phone'}</div>
                              </td>
                              <td className="p-4 border-b border-zinc-800">
                                <div className="text-white">{b.booking_date}</div>
                                <div className="text-zinc-500 text-xs">{b.booking_time}</div>
                              </td>
                              <td className="p-4 border-b border-zinc-800">
                                <div className="text-white">{b.service_id?.name || 'N/A'}</div>
                                <div className="text-zinc-500 text-xs">{b.vehicleData?.reg_number}</div>
                              </td>
                              <td className="p-4 border-b border-zinc-800">
                                <select
                                  value={b.staff_id?._id || b.staff_id || ''}
                                  onChange={(e) => handleAssignStaff(b._id, e.target.value)}
                                  disabled={['Completed', 'Cancelled', 'Rejected'].includes(b.status)}
                                  className="bg-zinc-950 border border-zinc-800 text-zinc-300 p-2 rounded-lg text-xs focus:border-red-600 focus:outline-none disabled:opacity-50"
                                >
                                  <option value="">Unassigned</option>
                                  {availableStaff.map((staff) => (
                                    <option key={staff._id} value={staff._id}>{staff.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-4 border-b border-zinc-800">
                                {b.rating ? (
                                  <div>
                                    <div className="flex">
                                      {[...Array(5)].map((_, i) => (
                                        <svg key={i} className={`w-4 h-4 ${i < b.rating ? 'text-amber-400' : 'text-zinc-700'}`} fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                      ))}
                                    </div>
                                    {b.review_comment && (
                                      <div className="text-xs text-zinc-400 mt-1 max-w-[200px] truncate" title={b.review_comment}>
                                        "{b.review_comment}"
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-zinc-600 text-xs">Not rated</span>
                                )}
                              </td>
                              <td className="p-4 border-b border-zinc-800">
                                <div className="flex gap-2">
                                  {b.payment_slip && (
                                    <button onClick={() => openSlipModal(b)} className="text-xs px-3 py-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors font-bold">
                                      View Slip
                                    </button>
                                  )}
                                  {b.status === 'Completed' && (
                                    <button onClick={() => handleDownloadRecord(b._id, b.booking_ref)} className="text-xs px-3 py-1.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors font-bold">
                                      PDF
                                    </button>
                                  )}
                                  <button onClick={() => handleDeleteBooking(b._id)} className="text-xs px-3 py-1.5 rounded bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white transition-colors font-bold">
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 🚨 PAGINATION CONTROLS FOR BOOKINGS */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                    <span className="text-sm text-zinc-400">
                      Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredBookings.length)} of {filteredBookings.length} bookings
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* SERVICES TAB */}
        {activeTab === 'services' && (
          <div>
            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Service Catalog</h3>
            <p className="text-zinc-400 mb-6">Manage services and pricing.</p>

            <form onSubmit={handleSubmitService} className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 mb-6">
              <h4 className="text-sm font-bold text-zinc-500 uppercase mb-4 tracking-wider">
                {editingServiceId ? 'Edit Service' : 'Add New Service'}
              </h4>
              <div className="grid grid-cols-1 gap-4">
                <input type="text" placeholder="Service Name" required value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none placeholder:text-zinc-600" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input type="number" placeholder="Car Price" required value={newService.price_car} onChange={(e) => setNewService({ ...newService, price_car: e.target.value })} className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl focus:border-red-600 focus:outline-none placeholder:text-zinc-600" />
                  <input type="number" placeholder="SUV Price" required value={newService.price_suv} onChange={(e) => setNewService({ ...newService, price_suv: e.target.value })} className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl focus:border-red-600 focus:outline-none placeholder:text-zinc-600" />
                  <input type="number" placeholder="Van Price" required value={newService.price_van} onChange={(e) => setNewService({ ...newService, price_van: e.target.value })} className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl focus:border-red-600 focus:outline-none placeholder:text-zinc-600" />
                </div>
                <textarea placeholder="Description" required value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} rows="3" className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl focus:border-red-600 focus:outline-none resize-none placeholder:text-zinc-600" />
                <div className="flex gap-4">
                  {editingServiceId && (
                    <button type="button" onClick={() => { setEditingServiceId(null); setNewService({ name: '', price_car: '', price_suv: '', price_van: '', description: '' }); }} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl">
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-600/20">
                    {editingServiceId ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </form>

            {loading.services ? (
              <LoadingSpinner />
            ) : (
              <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-zinc-950/60 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-4">Name</th>
                        <th className="p-4">Prices</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredServices.map((svc) => (
                        <tr key={svc._id} className="hover:bg-zinc-800/50 transition-colors">
                          <td className="p-4 border-b border-zinc-800 font-bold text-white">{svc.name}</td>
                          <td className="p-4 border-b border-zinc-800">
                            {typeof svc.price === 'object' ? (
                              <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
                                <span>Car: {svc.price?.Car?.toLocaleString()}</span>
                                <span>SUV: {svc.price?.SUV?.toLocaleString()}</span>
                                <span>Van: {svc.price?.Van?.toLocaleString()}</span>
                              </div>
                            ) : (
                              <span className="text-zinc-300">{svc.price?.toLocaleString()}</span>
                            )}
                          </td>
                          <td className="p-4 border-b border-zinc-800">
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${svc.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                              {svc.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="p-4 border-b border-zinc-800">
                            <div className="flex gap-2">
                              <button onClick={() => handleEditService(svc)} className="text-xs px-3 py-1.5 rounded bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white transition-colors font-bold">Edit</button>
                              <button onClick={() => handleToggleService(svc._id, svc.is_active)} className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors font-bold">Toggle</button>
                              <button onClick={() => handleDeleteService(svc._id)} className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-500 hover:bg-red-600 hover:text-white transition-colors font-bold">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div>
            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">User Management</h3>
            <p className="text-zinc-400 mb-6">Manage accounts and staff.</p>

            <form onSubmit={handleCreateStaff} className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 mb-6">
              <h4 className="text-sm font-bold text-zinc-500 uppercase mb-4 tracking-wider">Create Staff Account</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Full Name" required value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl focus:border-red-600 focus:outline-none placeholder:text-zinc-600" />
                <input type="email" placeholder="Email" required value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl focus:border-red-600 focus:outline-none placeholder:text-zinc-600" />
                <input type="tel" placeholder="Phone" required value={newStaff.phone} onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })} className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl focus:border-red-600 focus:outline-none placeholder:text-zinc-600" />
                <input type="password" placeholder="Password" required value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl focus:border-red-600 focus:outline-none placeholder:text-zinc-600" />
                <button type="submit" className="col-span-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-600/20">Create Staff</button>
              </div>
            </form>

            {loading.users ? (
              <LoadingSpinner />
            ) : (
              <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-zinc-950/60 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-4">User</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredUsers.map((u) => (
                        <tr key={u._id} className="hover:bg-zinc-800/50 transition-colors">
                          <td className="p-4 border-b border-zinc-800">
                            <div className="font-bold text-white">{u.name}</div>
                            <div className="text-zinc-500 text-xs">{u.email}</div>
                          </td>
                          <td className="p-4 border-b border-zinc-800">
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : u.role === 'staff' ? 'bg-red-600/15 text-red-500' : 'bg-zinc-800 text-zinc-400'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-4 border-b border-zinc-800">
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${u.status === 1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                              {u.status === 1 ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td className="p-4 border-b border-zinc-800">
                            {u.role !== 'admin' && (
                              <button onClick={() => handleToggleUserStatus(u._id, u.status)} className={`text-xs px-3 py-1.5 rounded font-bold transition-colors ${u.status === 1 ? 'bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white'}`}>
                                {u.status === 1 ? 'Suspend' : 'Activate'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODERN FLOATING CHAT BUTTON */}
      <button onClick={() => navigate('/chat')} className="fixed bottom-6 right-6 z-40 group">
        <span className="absolute inset-0 rounded-full bg-red-600/30 animate-ping opacity-75"></span>
        <span className="absolute inset-0 rounded-full bg-red-600/20 animate-pulse"></span>
        <span className="relative flex items-center gap-2 bg-gradient-to-br from-red-500 via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 text-white pl-3 pr-4 py-3 rounded-full shadow-2xl shadow-red-600/40 hover:shadow-red-600/60 transition-all duration-300 hover:scale-105">
          <span className="relative w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3C6.477 3 2 6.94 2 11.79c0 2.7 1.44 5.11 3.72 6.74-.07.83-.33 2.25-1.05 3.15-.09.12-.01.3.14.31 1.18.08 2.87-.53 4.14-1.4.96.29 2 .45 3.05.45 5.523 0 10-3.94 10-8.79S17.523 3 12 3z" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-red-600"></span>
          </span>
          <span className="text-xs font-black tracking-widest uppercase whitespace-nowrap">Chat</span>
          <span className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></span>
        </span>
      </button>
    </div>
  );
}