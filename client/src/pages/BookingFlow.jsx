import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

const POPULAR_MAKES = [
  'Toyota', 'Suzuki', 'Honda', 'Nissan', 'Mitsubishi', 'Tata', 'Bajaj', 'TVS', 
  'Isuzu', 'Mahindra', 'Mazda', 'Hero', 'Micro', 'Daihatsu', 'Hyundai', 
  'Hero-Honda', 'DFSK', 'Mercedes-Benz'
];

export default function BookingFlow() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { state } = useLocation();

  const [step, setStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);

  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [loadingServices, setLoadingServices] = useState(true);
  const [existingBookings, setExistingBookings] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [vehicleType, setVehicleType] = useState('Car');
  const vehicleCategories = ['Car', 'SUV', 'Van'];
  const [vehicle, setVehicle] = useState({
    reg_number: '',
    make: '',
    model: '',
    manufacture_year: new Date().getFullYear(),
    mileage: '',
  });
  
  const [issueDescription, setIssueDescription] = useState('');
  const [slot, setSlot] = useState({ date: '', time: '' });

  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentSlip, setPaymentSlip] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successRef, setSuccessRef] = useState(null);
  const [errors, setErrors] = useState({});
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  const [makeOption, setMakeOption] = useState('');
  const [customMake, setCustomMake] = useState('');

  const timeSlots = ['09:00 AM', '10:30 AM', '01:00 PM', '03:30 PM'];
  const MAX_BOOKINGS_PER_SLOT = 3;

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getAvailableDates = useMemo(() => {
    const dates = [];
    const now = new Date();
    const startFromTomorrow = now.getHours() >= 18;
    const startDate = new Date(now);
    if (startFromTomorrow) startDate.setDate(startDate.getDate() + 1);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      const displayDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const isToday = dateString === now.toISOString().split('T')[0];
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = dateString === tomorrow.toISOString().split('T')[0];

      dates.push({
        value: dateString,
        label: isToday ? 'Today' : isTomorrow ? 'Tomorrow' : displayDate,
      });
    }
    return dates;
  }, [currentDateTime]);

  useEffect(() => {
    if (!user) {
      toast.error('Please login to book a service');
      navigate('/login', { state: { from: '/booking' } });
      return;
    }
    const fetchServices = async () => {
      try {
        setLoadingServices(true);
        const res = await axiosClient.get('/services');
        setServices(res.data);
        if (state?.selectedServiceId) {
          const preSelected = res.data.find((s) => s._id === state.selectedServiceId);
          if (preSelected) setSelectedService(preSelected);
        }
      } catch (error) {
        toast.error('Failed to load services');
      } finally {
        setLoadingServices(false);
      }
    };
    fetchServices();
  }, [user, navigate, state]);

  const fetchBookingsForDate = async (date) => {
    if (!date) return;
    try {
      setLoadingSlots(true);
      const res = await axiosClient.get(`/bookings/date/${date}`);
      if (res.data?.timeSlots) {
        const formattedBookings = [];
        res.data.timeSlots.forEach((slot) => {
          for (let i = 0; i < (slot.bookedCount || slot.currentBookings || 0); i++) {
            formattedBookings.push({ booking_date: date, booking_time: slot.time });
          }
        });
        setExistingBookings(formattedBookings);
      } else if (Array.isArray(res.data)) {
        setExistingBookings(res.data);
      } else {
        setExistingBookings([]);
      }
    } catch (error) {
      setExistingBookings([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateChange = (e) => {
    const selectedDate = e.target.value;
    setSlot({ date: selectedDate, time: '' });
    if (errors.date) setErrors({ ...errors, date: null });
    if (selectedDate) fetchBookingsForDate(selectedDate);
  };

  const handleMakeChange = (e) => {
    const value = e.target.value;
    setMakeOption(value);
    if (value === 'Other') setVehicle({ ...vehicle, make: customMake });
    else {
      setVehicle({ ...vehicle, make: value });
      setCustomMake('');
    }
    if (errors.make) setErrors({ ...errors, make: null });
  };

  const handleCustomMakeChange = (e) => {
    const value = e.target.value;
    setCustomMake(value);
    setVehicle({ ...vehicle, make: value });
    if (errors.make) setErrors({ ...errors, make: null });
  };

  const handleSlipChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return toast.error('File is too large. Max 5MB.');
      setPaymentSlip(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setSlipPreview(reader.result);
        reader.readAsDataURL(file);
      } else setSlipPreview(null);
    }
  };

  const isTimeSlotInPast = (date, time) => {
    if (!date) return false;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (date > today) return false;
    if (date < today) return true;
    const [timeStr, period] = time.split(' ');
    const [hours, minutes] = timeStr.split(':').map(Number);
    let hour24 = hours;
    if (period === 'PM' && hours !== 12) hour24 += 12;
    if (period === 'AM' && hours === 12) hour24 = 0;
    const slotDateTime = new Date();
    slotDateTime.setHours(hour24, minutes, 0, 0);
    return slotDateTime < now;
  };

  const getBookingCount = (date, time) => existingBookings.filter((b) => b.booking_date === date && b.booking_time === time).length;
  const isSlotAvailable = (date, time) => !isTimeSlotInPast(date, time) && getBookingCount(date, time) < MAX_BOOKINGS_PER_SLOT;
  const getRemainingSlots = (date, time) => Math.max(0, MAX_BOOKINGS_PER_SLOT - getBookingCount(date, time));

  const availableServices = useMemo(() => services.filter((svc) => svc.price && (typeof svc.price === 'number' || svc.price[vehicleType] !== undefined)), [services, vehicleType]);
  const getPrice = (service, type = vehicleType) => {
    if (!service?.price) return 0;
    if (typeof service.price === 'number') return service.price;
    return service.price[type] || 0;
  };

  const validateVehicle = () => {
    const newErrors = {};
    if (!vehicle.reg_number.trim()) newErrors.reg_number = 'Required';
    else if (!/^[A-Za-z0-9]{1,4}-\d{3,5}$/.test(vehicle.reg_number.trim())) newErrors.reg_number = 'Format: AB-4575';
    if (!vehicle.make.trim()) newErrors.make = 'Required';
    if (!vehicle.model.trim()) newErrors.model = 'Required';
    if (!vehicle.manufacture_year || vehicle.manufacture_year < 1950 || vehicle.manufacture_year > new Date().getFullYear() + 1) newErrors.manufacture_year = 'Invalid year';
    if (!vehicle.mileage || vehicle.mileage < 0 || vehicle.mileage > 1000000) newErrors.mileage = 'Invalid mileage';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSlot = () => {
    const newErrors = {};
    if (!slot.date) newErrors.date = 'Required';
    if (!slot.time) newErrors.time = 'Required';
    else if (!isSlotAvailable(slot.date, slot.time)) newErrors.time = 'Slot full or passed';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePayment = () => {
    if (paymentMethod === 'Bank Transfer' && !paymentSlip) return toast.error('Please upload slip'), false;
    return true;
  };

  const goToNextStep = () => {
    if (step === 1 && !selectedService) return toast.error('Select a service');
    if (step === 2 && !validateVehicle()) return toast.error('Fix highlighted fields');
    if (step === 3 && !validateSlot()) return toast.error('Select available time');
    if (step === 4 && !validatePayment()) return;
    setStep(step + 1);
    setMaxStepReached(Math.max(maxStepReached, step + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitBooking = async () => {
    if (!isSlotAvailable(slot.date, slot.time)) {
      toast.error('Slot filled. Choose another.');
      setStep(3);
      return;
    }
    if (!validatePayment()) return;

    setIsSubmitting(true);
    try {
      const finalPrice = getPrice(selectedService);
      const formData = new FormData();
      formData.append('vehicleData', JSON.stringify({
        reg_number: vehicle.reg_number.toUpperCase(),
        make: vehicle.make, model: vehicle.model,
        manufacture_year: Number(vehicle.manufacture_year), mileage: Number(vehicle.mileage),
      }));
      formData.append('service_id', selectedService._id);
      formData.append('booking_date', slot.date);
      formData.append('booking_time', slot.time);
      formData.append('total_price', finalPrice);
      formData.append('payment_method', paymentMethod);
      formData.append('issue_description', issueDescription);
      if (paymentMethod === 'Bank Transfer' && paymentSlip) formData.append('payment_slip', paymentSlip);

      const res = await axiosClient.post('/bookings', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccessRef(res.data.booking_ref);
      setStep(5);
      setMaxStepReached(5);
      toast.success('Booking confirmed!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      // 🚨 The rate limit error from the backend will be displayed here
      toast.error(err.response?.data?.message || 'Error creating booking');
      if (err.response?.status === 409) { fetchBookingsForDate(slot.date); setStep(3); }
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { number: 1, label: 'Service' },
    { number: 2, label: 'Vehicle' },
    { number: 3, label: 'Schedule' },
    { number: 4, label: 'Payment' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 p-3 md:p-6 font-sans text-zinc-900">
      <div className="max-w-3xl mx-auto bg-white p-4 md:p-12 rounded-2xl border border-zinc-200 shadow-xl mt-4 md:mt-10 relative overflow-hidden">
        
        {/* Top Accent */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-700"></div>

        <div className="relative z-10 mb-6 md:mb-8">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h2 className="text-xl md:text-3xl font-black text-zinc-900 tracking-tight uppercase">
              Schedule Service
            </h2>
            {step < 5 && (
              <button onClick={() => navigate('/')} className="text-zinc-400 hover:text-red-600 p-1">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {/* Progress Bar - Mobile Responsive */}
          {step < 5 && (
            <div className="flex items-center gap-1 md:gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
              {steps.map((s, index) => (
                <React.Fragment key={s.number}>
                  <button
                    onClick={() => goToStep(s.number)}
                    disabled={s.number > maxStepReached}
                    className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${
                      step === s.number ? 'bg-red-600 text-white shadow-md' 
                      : s.number <= maxStepReached ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200' 
                      : 'bg-zinc-50 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    <span className={`w-4 h-4 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-xs font-black ${
                      step === s.number ? 'bg-white text-red-600' : s.number <= maxStepReached ? 'bg-zinc-300 text-zinc-700' : 'bg-zinc-200 text-zinc-400'
                    }`}>
                      {s.number}
                    </span>
                    <span>{s.label}</span>
                  </button>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 min-w-[10px] h-1 rounded ${s.number < step ? 'bg-red-600' : 'bg-zinc-200'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        <div className="relative z-10">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="animate-[fadeIn_0.4s_ease-out]">
              <h3 className="text-base md:text-lg font-bold mb-4 md:mb-6 text-zinc-800">Step 1: Select Vehicle & Service</h3>

              <div className="flex gap-2 md:gap-3 mb-6 md:mb-8 bg-zinc-100 p-1.5 md:p-2 rounded-xl border border-zinc-200">
                {vehicleCategories.map((type) => (
                  <button
                    key={type}
                    onClick={() => { setVehicleType(type); setSelectedService(null); }}
                    className={`flex-1 py-2 md:py-3 rounded-lg text-sm md:text-base font-bold tracking-wide transition-all ${
                      vehicleType === type ? 'bg-red-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900 hover:bg-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {loadingServices ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-4 md:p-6 rounded-xl border border-zinc-200 bg-white animate-pulse h-32 md:h-auto"></div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  {availableServices.length > 0 ? availableServices.map((svc) => {
                    const displayPrice = getPrice(svc);
                    const isSelected = selectedService?._id === svc._id;
                    return (
                      <div
                        key={svc._id}
                        onClick={() => setSelectedService(svc)}
                        className={`p-4 md:p-6 rounded-xl cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected ? 'border-2 border-red-600 bg-red-50 shadow-md' : 'border border-zinc-200 bg-white hover:border-red-600/50 hover:shadow-md'
                        }`}
                      >
                        <div>
                          <div className={`font-extrabold text-base md:text-lg mb-1 md:mb-2 uppercase ${isSelected ? 'text-red-700' : 'text-zinc-900'}`}>{svc.name}</div>
                          <div className="text-xs md:text-sm text-zinc-500 mb-3 md:mb-4 line-clamp-2">{svc.description}</div>
                        </div>
                        <div className="flex items-center justify-between mt-auto">
                          <div className={`font-black text-sm md:text-base ${isSelected ? 'text-red-600' : 'text-zinc-900'}`}>
                            LKR {displayPrice.toLocaleString()}
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 md:w-7 md:h-7 rounded-full bg-red-600 flex items-center justify-center text-white">
                              <svg className="w-3 h-3 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="col-span-full py-8 text-center text-zinc-500 border border-dashed border-zinc-300 rounded-xl">No pricing available.</div>
                  )}
                </div>
              )}

              <button
                disabled={!selectedService}
                onClick={goToNextStep}
                className="mt-6 md:mt-8 w-full bg-red-600 hover:bg-red-700 text-white py-3 md:py-4 rounded-xl font-bold text-sm md:text-base tracking-wider disabled:opacity-50 transition-all shadow-md"
              >
                NEXT: VEHICLE DETAILS →
              </button>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="animate-[fadeIn_0.4s_ease-out]">
              <h3 className="text-base md:text-lg font-bold mb-4 md:mb-6 text-zinc-800">Step 2: Vehicle Details</h3>
              <div className="space-y-4 md:space-y-5">
                <div>
                  <label className="block text-xs md:text-sm font-bold text-zinc-600 mb-1.5 md:mb-2 uppercase">Registration Number</label>
                  <input
                    type="text" placeholder="CAB-1234" value={vehicle.reg_number}
                    onChange={(e) => { setVehicle({ ...vehicle, reg_number: e.target.value.toUpperCase() }); if (errors.reg_number) setErrors({ ...errors, reg_number: null }); }}
                    className={`w-full bg-white border text-zinc-900 p-3 md:p-4 rounded-xl focus:outline-none uppercase placeholder:normal-case text-sm md:text-base ${errors.reg_number ? 'border-red-500' : 'border-zinc-200 focus:border-red-600'}`}
                    maxLength={10}
                  />
                  {errors.reg_number && <p className="text-red-600 text-[10px] md:text-xs mt-1">{errors.reg_number}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  <div>
                    <label className="block text-xs md:text-sm font-bold text-zinc-600 mb-1.5 md:mb-2 uppercase">Make / Brand</label>
                    <select
                      value={makeOption} onChange={handleMakeChange}
                      className={`w-full bg-white border text-zinc-900 p-3 md:p-4 rounded-xl focus:outline-none appearance-none text-sm md:text-base ${errors.make ? 'border-red-500' : 'border-zinc-200 focus:border-red-600'}`}
                      style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.25em' }}
                    >
                      <option value="">Select Brand...</option>
                      {POPULAR_MAKES.map((make) => <option key={make} value={make}>{make}</option>)}
                      <option value="Other">➕ Other</option>
                    </select>
                    {errors.make && <p className="text-red-600 text-[10px] md:text-xs mt-1">{errors.make}</p>}
                    {makeOption === 'Other' && (
                      <input type="text" placeholder="Enter brand" value={customMake} onChange={handleCustomMakeChange} className="mt-2 md:mt-3 w-full bg-white border border-zinc-200 text-zinc-900 p-3 md:p-4 rounded-xl text-sm md:text-base" autoFocus />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-bold text-zinc-600 mb-1.5 md:mb-2 uppercase">Model</label>
                    <input
                      type="text" placeholder="Corolla" value={vehicle.model}
                      onChange={(e) => { setVehicle({ ...vehicle, model: e.target.value }); if (errors.model) setErrors({ ...errors, model: null }); }}
                      className={`w-full bg-white border text-zinc-900 p-3 md:p-4 rounded-xl focus:outline-none text-sm md:text-base ${errors.model ? 'border-red-500' : 'border-zinc-200 focus:border-red-600'}`}
                    />
                    {errors.model && <p className="text-red-600 text-[10px] md:text-xs mt-1">{errors.model}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 md:gap-5">
                  <div>
                    {/* 🚨 UPDATED LABEL: Manufacture Year */}
                    <label className="block text-xs md:text-sm font-bold text-zinc-600 mb-1.5 md:mb-2 uppercase">Manufacture Year</label>
                    <input
                      type="number" placeholder="2020" value={vehicle.manufacture_year}
                      onChange={(e) => { setVehicle({ ...vehicle, manufacture_year: e.target.value }); if (errors.manufacture_year) setErrors({ ...errors, manufacture_year: null }); }}
                      className={`w-full bg-white border text-zinc-900 p-3 md:p-4 rounded-xl focus:outline-none text-sm md:text-base ${errors.manufacture_year ? 'border-red-500' : 'border-zinc-200 focus:border-red-600'}`}
                      min="1950" max={new Date().getFullYear() + 1}
                    />
                    {errors.manufacture_year && <p className="text-red-600 text-[10px] md:text-xs mt-1">{errors.manufacture_year}</p>}
                  </div>
                  <div>
                    {/* 🚨 UPDATED LABEL: Current Mileage */}
                    <label className="block text-xs md:text-sm font-bold text-zinc-600 mb-1.5 md:mb-2 uppercase">Current Mileage (km)</label>
                    <input
                      type="number" placeholder="85000" value={vehicle.mileage}
                      onChange={(e) => { setVehicle({ ...vehicle, mileage: e.target.value }); if (errors.mileage) setErrors({ ...errors, mileage: null }); }}
                      className={`w-full bg-white border text-zinc-900 p-3 md:p-4 rounded-xl focus:outline-none text-sm md:text-base ${errors.mileage ? 'border-red-500' : 'border-zinc-200 focus:border-red-600'}`}
                      min="0" max="1000000"
                    />
                    {errors.mileage && <p className="text-red-600 text-[10px] md:text-xs mt-1">{errors.mileage}</p>}
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs md:text-sm font-bold text-zinc-600 mb-1.5 md:mb-2 uppercase flex items-center gap-2">Notes / Issues <span className="text-zinc-400 font-normal lowercase text-[10px]">(optional)</span></label>
                  <textarea
                    value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder="E.g., Engine noise, AC not cooling..."
                    rows="2"
                    className="w-full bg-white border border-zinc-200 text-zinc-900 p-3 md:p-4 rounded-xl focus:border-red-600 focus:outline-none resize-none text-sm md:text-base"
                  />
                </div>
              </div>

              <div className="flex gap-3 md:gap-4 mt-6 md:mt-10">
                <button onClick={() => setStep(step - 1)} className="w-1/3 border border-zinc-300 py-3 md:py-4 rounded-xl font-bold text-zinc-600 text-sm md:text-base hover:bg-zinc-50">BACK</button>
                <button onClick={goToNextStep} className="w-2/3 bg-red-600 hover:bg-red-700 text-white py-3 md:py-4 rounded-xl font-bold text-sm md:text-base tracking-wider shadow-md">NEXT: DATE & TIME →</button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="animate-[fadeIn_0.4s_ease-out]">
              <h3 className="text-base md:text-lg font-bold mb-4 md:mb-6 text-zinc-800">Step 3: Date & Time</h3>
              <div className="space-y-5 md:space-y-6">
                <div>
                  <label className="block text-xs md:text-sm font-bold text-zinc-600 mb-1.5 md:mb-2 uppercase">Select Date</label>
                  <select
                    value={slot.date} onChange={handleDateChange}
                    className={`w-full bg-white border text-zinc-900 p-3 md:p-4 rounded-xl focus:outline-none appearance-none text-sm md:text-base ${errors.date ? 'border-red-500' : 'border-zinc-200 focus:border-red-600'}`}
                  >
                    <option value="">Select a date...</option>
                    {getAvailableDates.map((date) => <option key={date.value} value={date.value}>{date.label}</option>)}
                  </select>
                  {errors.date && <p className="text-red-600 text-[10px] md:text-xs mt-1">{errors.date}</p>}
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-bold text-zinc-600 mb-1.5 md:mb-2 uppercase">Select Time</label>
                  {!slot.date ? (
                    <div className="text-zinc-500 text-xs md:text-sm text-center py-6 border border-dashed border-zinc-300 rounded-xl bg-white">Please select a date first.</div>
                  ) : loadingSlots ? (
                    <div className="text-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600 mx-auto"></div></div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                      {timeSlots.map((time) => {
                        const available = isSlotAvailable(slot.date, time);
                        const remaining = getRemainingSlots(slot.date, time);
                        const isPast = isTimeSlotInPast(slot.date, time);
                        return (
                          <button
                            key={time} disabled={!available} onClick={() => { setSlot({ ...slot, time }); if (errors.time) setErrors({ ...errors, time: null }); }}
                            className={`py-3 md:py-4 rounded-lg text-xs md:text-sm font-bold transition-all border ${
                              slot.time === time && available ? 'bg-red-600 text-white border-red-600 shadow-md' 
                              : available ? 'bg-white border-zinc-200 text-zinc-800 hover:border-red-600 hover:text-red-600' 
                              : 'bg-zinc-50 border-zinc-200 text-zinc-400 cursor-not-allowed opacity-60'
                            }`}
                          >
                            <div>{time}</div>
                            {available && <div className="text-[10px] md:text-xs font-normal mt-1 opacity-90">{remaining} left</div>}
                            {isPast && <div className="text-[10px] md:text-xs font-normal mt-1">Passed</div>}
                            {!isPast && !available && remaining === 0 && <div className="text-[10px] md:text-xs font-normal mt-1 text-red-400">Full</div>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {errors.time && <p className="text-red-600 text-[10px] md:text-xs mt-1">{errors.time}</p>}
                </div>
              </div>

              <div className="flex gap-3 md:gap-4 mt-6 md:mt-10">
                <button onClick={() => setStep(step - 1)} className="w-1/3 border border-zinc-300 py-3 md:py-4 rounded-xl font-bold text-zinc-600 text-sm md:text-base hover:bg-zinc-50">BACK</button>
                <button onClick={goToNextStep} className="w-2/3 bg-red-600 hover:bg-red-700 text-white py-3 md:py-4 rounded-xl font-bold text-sm md:text-base tracking-wider shadow-md">NEXT: PAYMENT →</button>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="animate-[fadeIn_0.4s_ease-out]">
              <h3 className="text-base md:text-lg font-bold mb-4 md:mb-6 text-zinc-800">Step 4: Payment & Review</h3>

              <div className="mb-6 md:mb-8">
                <label className="block text-xs md:text-sm font-bold text-zinc-600 mb-2 md:mb-3 uppercase">Payment Method</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div
                    onClick={() => setPaymentMethod('Cash')}
                    className={`p-4 md:p-5 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center text-center ${paymentMethod === 'Cash' ? 'border-red-600 bg-red-50' : 'border-zinc-200 hover:border-red-300'}`}
                  >
                    <svg className={`w-6 h-6 md:w-8 md:h-8 mb-2 ${paymentMethod === 'Cash' ? 'text-red-600' : 'text-zinc-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    <span className={`font-bold text-sm md:text-base ${paymentMethod === 'Cash' ? 'text-red-700' : 'text-zinc-700'}`}>Pay at Center</span>
                  </div>
                  <div
                    onClick={() => setPaymentMethod('Bank Transfer')}
                    className={`p-4 md:p-5 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center text-center ${paymentMethod === 'Bank Transfer' ? 'border-red-600 bg-red-50' : 'border-zinc-200 hover:border-red-300'}`}
                  >
                    <svg className={`w-6 h-6 md:w-8 md:h-8 mb-2 ${paymentMethod === 'Bank Transfer' ? 'text-red-600' : 'text-zinc-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    <span className={`font-bold text-sm md:text-base ${paymentMethod === 'Bank Transfer' ? 'text-red-700' : 'text-zinc-700'}`}>Bank Transfer</span>
                  </div>
                </div>

                {paymentMethod === 'Bank Transfer' && (
                  <div className="mt-3 md:mt-4 p-4 md:p-5 bg-zinc-50 border border-zinc-200 rounded-xl">
                    <p className="text-xs md:text-sm font-bold text-zinc-800 mb-2">Bank: Commercial Bank</p>
                    <p className="text-xs md:text-sm text-zinc-600 mb-1">Acc Name: Royal Service Center</p>
                    <p className="text-xs md:text-sm text-zinc-600 mb-3">Acc No: 1234567890</p>
                    
                    <label className="block text-xs md:text-sm font-bold text-zinc-800 mb-2">Upload Slip</label>
                    <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-24 md:h-32 border-2 border-zinc-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-zinc-50">
                      <div className="flex flex-col items-center justify-center pt-3 pb-4">
                        <svg className="w-6 h-6 md:w-8 md:h-8 mb-2 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        <p className="text-[10px] md:text-xs text-zinc-500 font-semibold">{paymentSlip ? paymentSlip.name : 'Click to upload'}</p>
                      </div>
                      <input id="dropzone-file" type="file" className="hidden" accept="image/*,application/pdf" onChange={handleSlipChange} />
                    </label>
                    {slipPreview && <img src={slipPreview} alt="Preview" className="mt-3 max-h-24 md:max-h-40 rounded-lg border border-zinc-200 object-contain mx-auto" />}
                  </div>
                )}
              </div>

              <div className="bg-zinc-50 p-4 md:p-8 rounded-2xl border border-zinc-200 mb-6 md:mb-8">
                <div className="space-y-3 md:space-y-4 text-sm md:text-base">
                  <div className="flex justify-between border-b border-zinc-200 pb-2 md:pb-4">
                    <span className="text-zinc-500 font-bold uppercase text-[10px] md:text-xs">Service</span>
                    <div className="text-right">
                      <div className="font-bold text-zinc-900 uppercase">{selectedService?.name}</div>
                      <span className="text-red-600 text-[10px] md:text-xs font-bold uppercase">{vehicleType}</span>
                    </div>
                  </div>
                  <div className="flex justify-between border-b border-zinc-200 pb-2 md:pb-4">
                    <span className="text-zinc-500 font-bold uppercase text-[10px] md:text-xs">Price</span>
                    <span className="text-red-600 font-black">LKR {getPrice(selectedService).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-200 pb-2 md:pb-4">
                    <span className="text-zinc-500 font-bold uppercase text-[10px] md:text-xs">Vehicle</span>
                    <div className="text-right">
                      <div className="font-bold text-zinc-900">{vehicle.reg_number}</div>
                      <div className="text-[10px] md:text-xs text-zinc-500">{vehicle.make} {vehicle.model}</div>
                    </div>
                  </div>
                  <div className="flex justify-between border-b border-zinc-200 pb-2 md:pb-4">
                    <span className="text-zinc-500 font-bold uppercase text-[10px] md:text-xs">Date</span>
                    <div className="text-right">
                      <div className="font-bold text-zinc-900">{slot.date}</div>
                      <div className="text-[10px] md:text-xs text-zinc-500">at {slot.time}</div>
                    </div>
                  </div>
                  {issueDescription && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500 font-bold uppercase text-[10px] md:text-xs">Notes</span>
                      <p className="text-[10px] md:text-xs text-zinc-700 bg-white p-2 rounded border text-left max-w-[200px] md:max-w-xs">{issueDescription}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 md:gap-4">
                <button onClick={() => setStep(step - 1)} disabled={isSubmitting} className="w-1/3 border border-zinc-300 py-3 md:py-4 rounded-xl font-bold text-zinc-600 text-sm md:text-base hover:bg-zinc-50">BACK</button>
                <button
                  disabled={isSubmitting} onClick={handleSubmitBooking}
                  className="w-2/3 bg-red-600 hover:bg-red-700 text-white py-3 md:py-4 rounded-xl font-black text-sm md:text-base tracking-widest shadow-md flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'PROCESSING...' : 'CONFIRM'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <div className="text-center py-8 md:py-12">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-red-50 border-2 border-red-600 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
                <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-xl md:text-3xl font-black text-zinc-900 uppercase">Confirmed!</h3>
              <p className="text-zinc-600 mt-2 text-sm md:text-lg">Your reference number is</p>
              <div className="inline-block bg-zinc-50 border-2 border-red-600/30 rounded-xl px-4 md:px-8 py-2 md:py-4 mt-3 md:mt-4">
                <strong className="text-xl md:text-3xl text-zinc-900 tracking-widest font-black">{successRef}</strong>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center mt-6 md:mt-10">
                <button onClick={() => navigate('/dashboard')} className="bg-red-600 text-white px-6 md:px-8 py-3 rounded-xl font-bold text-sm md:text-base shadow-md">DASHBOARD</button>
                <button onClick={() => navigate('/')} className="bg-zinc-900 text-white px-6 md:px-8 py-3 rounded-xl font-bold text-sm md:text-base">HOME</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}