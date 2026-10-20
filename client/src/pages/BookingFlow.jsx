import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

// Most Popular Makes (Brands)
const POPULAR_MAKES = [
  'Toyota', 'Suzuki', 'Honda', 'Nissan', 'Mitsubishi', 'Tata', 'Bajaj', 'TVS', 
  'Isuzu', 'Mahindra', 'Mazda', 'Hero', 'Micro', 'Daihatsu', 'Hyundai', 
  'Hero-Honda', 'DFSK', 'Mercedes-Benz'
];

export default function BookingFlow() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { state } = useLocation();

  // Step State
  const [step, setStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);

  // Data States
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [loadingServices, setLoadingServices] = useState(true);
  const [existingBookings, setExistingBookings] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Form States
  const [vehicleType, setVehicleType] = useState('Car');
  const vehicleCategories = ['Car', 'SUV', 'Van'];
  const [vehicle, setVehicle] = useState({
    reg_number: '',
    make: '',
    model: '',
    manufacture_year: new Date().getFullYear(),
    mileage: '',
  });
  
  // Special Notes / Issues
  const [issueDescription, setIssueDescription] = useState('');

  const [slot, setSlot] = useState({
    date: '',
    time: '',
  });

  // Payment States
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentSlip, setPaymentSlip] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successRef, setSuccessRef] = useState(null);
  const [errors, setErrors] = useState({});
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // Make dropdown state
  const [makeOption, setMakeOption] = useState('');
  const [customMake, setCustomMake] = useState('');

  // Time slots
  const timeSlots = ['09:00 AM', '10:30 AM', '01:00 PM', '03:30 PM'];
  const MAX_BOOKINGS_PER_SLOT = 3;

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Generate available dates for next 7 days
  const getAvailableDates = useMemo(() => {
    const dates = [];
    const now = new Date();
    const currentHour = now.getHours();

    const startFromTomorrow = currentHour >= 18;

    const startDate = new Date(now);
    if (startFromTomorrow) {
      startDate.setDate(startDate.getDate() + 1);
    }

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      const dateString = `${year}-${month}-${day}`;

      const displayDate = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const isToday = dateString === now.toISOString().split('T')[0];

      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = dateString === tomorrow.toISOString().split('T')[0];

      dates.push({
        value: dateString,
        label: isToday ? 'Today' : isTomorrow ? 'Tomorrow' : displayDate,
        isToday,
        isTomorrow,
      });
    }

    return dates;
  }, [currentDateTime]);

  // Fetch services on mount
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
          if (preSelected) {
            setSelectedService(preSelected);
          }
        }
      } catch (error) {
        console.error('Error fetching services:', error);
        toast.error('Failed to load services');
      } finally {
        setLoadingServices(false);
      }
    };

    fetchServices();
  }, [user, navigate, state]);

  // Fetch existing bookings when date changes
  const fetchBookingsForDate = async (date) => {
    if (!date) return;

    try {
      setLoadingSlots(true);
      const res = await axiosClient.get(`/bookings/date/${date}`);

      if (res.data?.timeSlots) {
        const formattedBookings = [];
        res.data.timeSlots.forEach((slot) => {
          for (let i = 0; i < (slot.bookedCount || slot.currentBookings || 0); i++) {
            formattedBookings.push({
              booking_date: date,
              booking_time: slot.time,
            });
          }
        });
        setExistingBookings(formattedBookings);
      } else if (Array.isArray(res.data)) {
        setExistingBookings(res.data);
      } else if (res.data?.bookings) {
        setExistingBookings(res.data.bookings);
      } else {
        setExistingBookings([]);
      }
    } catch (error) {
      console.error('Error fetching bookings for date:', error);
      setExistingBookings([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateChange = (e) => {
    const selectedDate = e.target.value;
    setSlot({ date: selectedDate, time: '' });
    if (errors.date) setErrors({ ...errors, date: null });

    if (selectedDate) {
      fetchBookingsForDate(selectedDate);
    }
  };

  // Handle Make dropdown change
  const handleMakeChange = (e) => {
    const value = e.target.value;
    setMakeOption(value);

    if (value === 'Other') {
      setVehicle({ ...vehicle, make: customMake });
    } else {
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

  // Handle Payment Slip Upload
  const handleSlipChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File is too large. Max 5MB.');
        return;
      }
      setPaymentSlip(file);
      
      // Preview image if it's an image
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setSlipPreview(reader.result);
        reader.readAsDataURL(file);
      } else {
        setSlipPreview(null);
      }
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

  const getBookingCount = (date, time) => {
    if (!date || !time) return 0;

    return existingBookings.filter(
      (b) => b.booking_date === date && b.booking_time === time
    ).length;
  };

  const isSlotAvailable = (date, time) => {
    if (!date || !time) return false;
    if (isTimeSlotInPast(date, time)) return false;
    return getBookingCount(date, time) < MAX_BOOKINGS_PER_SLOT;
  };

  const getRemainingSlots = (date, time) => {
    const bookingCount = getBookingCount(date, time);
    return Math.max(0, MAX_BOOKINGS_PER_SLOT - bookingCount);
  };

  const availableServices = useMemo(() => {
    return services.filter((svc) => {
      if (!svc.price) return false;
      if (typeof svc.price === 'number') return true;
      return svc.price[vehicleType] !== undefined;
    });
  }, [services, vehicleType]);

  const getPrice = (service, type = vehicleType) => {
    if (!service?.price) return 0;
    if (typeof service.price === 'number') return service.price;
    return service.price[type] || 0;
  };

  const validateVehicle = () => {
    const newErrors = {};

    if (!vehicle.reg_number.trim()) {
      newErrors.reg_number = 'Registration number is required';
    } else if (!/^[A-Za-z0-9]{1,4}-\d{3,5}$/.test(vehicle.reg_number.trim())) {
      newErrors.reg_number = 'Format should be like AB-4575, 44-1548, or 3-5878';
    }

    if (!vehicle.make.trim()) newErrors.make = 'Make/Brand is required';
    if (!vehicle.model.trim()) newErrors.model = 'Model is required';

    if (
      !vehicle.manufacture_year ||
      vehicle.manufacture_year < 1950 ||
      vehicle.manufacture_year > new Date().getFullYear() + 1
    ) {
      newErrors.manufacture_year = 'Please enter a valid manufacture year';
    }

    if (!vehicle.mileage || vehicle.mileage === '') {
      newErrors.mileage = 'Current mileage is required';
    } else if (vehicle.mileage < 0 || vehicle.mileage > 1000000) {
      newErrors.mileage = 'Please enter a valid mileage (0-1,000,000 km)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSlot = () => {
    const newErrors = {};

    if (!slot.date) newErrors.date = 'Please select a date';

    if (!slot.time) {
      newErrors.time = 'Please select a time slot';
    } else if (!isSlotAvailable(slot.date, slot.time)) {
      newErrors.time = 'This slot is no longer available. Please select another time.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePayment = () => {
    if (paymentMethod === 'Bank Transfer' && !paymentSlip) {
      toast.error('Please upload your payment slip');
      return false;
    }
    return true;
  };

  const goToNextStep = () => {
    if (step === 1 && !selectedService) {
      toast.error('Please select a service');
      return;
    }
    if (step === 2 && !validateVehicle()) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    if (step === 3 && !validateSlot()) {
      toast.error('Please select an available date and time');
      return;
    }
    if (step === 4 && !validatePayment()) {
      return;
    }

    setStep(step + 1);
    setMaxStepReached(Math.max(maxStepReached, step + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToPrevStep = () => {
    setStep(step - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToStep = (targetStep) => {
    if (targetStep <= maxStepReached) {
      setStep(targetStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmitBooking = async () => {
    if (!isSlotAvailable(slot.date, slot.time)) {
      toast.error('This slot has been filled. Please select another time.');
      setStep(3);
      return;
    }

    if (!validatePayment()) return;

    setIsSubmitting(true);
    try {
      const finalPrice = getPrice(selectedService);

      // Use FormData to handle file upload
      const formData = new FormData();
      formData.append('vehicleData', JSON.stringify({
        reg_number: vehicle.reg_number.toUpperCase(),
        make: vehicle.make,
        model: vehicle.model,
        manufacture_year: Number(vehicle.manufacture_year),
        mileage: Number(vehicle.mileage),
      }));
      formData.append('service_id', selectedService._id);
      formData.append('booking_date', slot.date);
      formData.append('booking_time', slot.time);
      formData.append('total_price', finalPrice);
      formData.append('payment_method', paymentMethod);
      
      // Append the special notes/issues
      formData.append('issue_description', issueDescription);
      
      if (paymentMethod === 'Bank Transfer' && paymentSlip) {
        formData.append('payment_slip', paymentSlip);
      }

      const res = await axiosClient.post('/bookings', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccessRef(res.data.booking_ref);
      setStep(5);
      setMaxStepReached(5);
      toast.success('Booking confirmed successfully!');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      fetchBookingsForDate(slot.date);
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || 'Error creating booking. Please try again.';
      toast.error(errorMessage);

      if (err.response?.status === 409) {
        fetchBookingsForDate(slot.date);
        setStep(3);
      }

      console.error('Booking error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { number: 1, label: 'Service' },
    { number: 2, label: 'Vehicle' },
    { number: 3, label: 'Schedule' },
    { number: 4, label: 'Payment & Review' },
  ];

  const isPastSixPM = currentDateTime.getHours() >= 18;

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-6 font-sans text-zinc-900">
      <div className="max-w-3xl mx-auto bg-white p-6 md:p-12 rounded-2xl border border-zinc-200 shadow-xl mt-6 md:mt-10 relative overflow-hidden">
        {/* Red top accent line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-700"></div>

        <div className="relative z-10 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight uppercase">
              Schedule Your Service
            </h2>
            {step < 5 && (
              <button
                onClick={() => navigate('/')}
                className="text-zinc-400 hover:text-red-600 transition-colors"
                aria-label="Close booking"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="text-sm text-zinc-500 mb-4">
            Current time: {currentDateTime.toLocaleString()}
          </div>

          {/* Progress Bar */}
          {step < 5 && (
            <div className="flex items-center gap-2 mb-6">
              {steps.map((s, index) => (
                <React.Fragment key={s.number}>
                  <button
                    onClick={() => goToStep(s.number)}
                    disabled={s.number > maxStepReached}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      step === s.number
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                        : s.number <= maxStepReached
                        ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        : 'bg-zinc-50 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                        step === s.number
                          ? 'bg-white text-red-600'
                          : s.number <= maxStepReached
                          ? 'bg-zinc-300 text-zinc-700'
                          : 'bg-zinc-200 text-zinc-400'
                      }`}
                    >
                      {s.number}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 rounded ${
                        s.number < step ? 'bg-red-600' : 'bg-zinc-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        <div className="relative z-10">
          {/* STEP 1: Select Service */}
          {step === 1 && (
            <div className="animate-[fadeIn_0.4s_ease-out]">
              <h3 className="text-lg md:text-xl font-bold mb-6 text-zinc-800">
                Step 1: Select Vehicle Type & Service
              </h3>

              <div className="flex gap-3 mb-8 bg-zinc-100 p-2 rounded-xl border border-zinc-200">
                {vehicleCategories.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setVehicleType(type);
                      setSelectedService(null);
                    }}
                    className={`flex-1 py-3 rounded-lg font-bold tracking-wide transition-all duration-300 ${
                      vehicleType === type
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                        : 'bg-transparent text-zinc-500 hover:text-zinc-900 hover:bg-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {loadingServices ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-6 rounded-xl border border-zinc-200 bg-white animate-pulse">
                      <div className="h-6 bg-zinc-200 rounded mb-3 w-3/4"></div>
                      <div className="h-4 bg-zinc-200 rounded mb-2 w-full"></div>
                      <div className="h-4 bg-zinc-200 rounded mb-4 w-2/3"></div>
                      <div className="h-6 bg-zinc-200 rounded w-24"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {availableServices.length > 0 ? (
                    availableServices.map((svc) => {
                      const displayPrice = getPrice(svc);
                      const isSelected = selectedService?._id === svc._id;

                      return (
                        <div
                          key={svc._id}
                          onClick={() => setSelectedService(svc)}
                          className={`p-6 rounded-xl cursor-pointer transition-all duration-300 flex flex-col justify-between ${
                            isSelected
                              ? 'border-2 border-red-600 bg-red-50 shadow-lg shadow-red-600/10'
                              : 'border border-zinc-200 bg-white hover:border-red-600/50 hover:shadow-md'
                          }`}
                        >
                          <div>
                            <div className={`font-extrabold text-lg mb-2 uppercase tracking-wide ${isSelected ? 'text-red-700' : 'text-zinc-900'}`}>
                              {svc.name}
                            </div>
                            <div className="text-sm text-zinc-500 mb-4 line-clamp-2 leading-relaxed">
                              {svc.description}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-auto">
                            <div className={`font-black tracking-wide ${isSelected ? 'text-red-600' : 'text-zinc-900'}`}>
                              LKR {displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            {isSelected && (
                              <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-white">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-full py-10 text-center text-zinc-500 border border-dashed border-zinc-300 rounded-xl bg-white">
                      No pricing available for {vehicleType}s yet.
                    </div>
                  )}
                </div>
              )}

              <button
                disabled={!selectedService}
                onClick={goToNextStep}
                className="mt-8 w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-bold tracking-wider disabled:opacity-30 disabled:hover:bg-red-600 transition-all duration-300 shadow-lg shadow-red-600/20"
              >
                NEXT: VEHICLE DETAILS →
              </button>
            </div>
          )}

          {/* STEP 2: Vehicle Details */}
          {step === 2 && (
            <div className="animate-[fadeIn_0.4s_ease-out]">
              <h3 className="text-lg md:text-xl font-bold mb-6 text-zinc-800">
                Step 2: Vehicle Details & Issue
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-zinc-600 mb-2 uppercase tracking-wide">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    placeholder="CAB-1234"
                    value={vehicle.reg_number}
                    onChange={(e) => {
                      setVehicle({ ...vehicle, reg_number: e.target.value.toUpperCase() });
                      if (errors.reg_number) setErrors({ ...errors, reg_number: null });
                    }}
                    className={`w-full bg-white border text-zinc-900 p-4 rounded-xl focus:outline-none transition-colors uppercase placeholder:normal-case ${
                      errors.reg_number ? 'border-red-500 focus:border-red-500' : 'border-zinc-200 focus:border-red-600'
                    }`}
                    maxLength={10}
                  />
                  {errors.reg_number && <p className="text-red-600 text-xs mt-2">{errors.reg_number}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-zinc-600 mb-2 uppercase tracking-wide">
                      Make / Brand
                    </label>
                    <select
                      value={makeOption}
                      onChange={handleMakeChange}
                      className={`w-full bg-white border text-zinc-900 p-4 rounded-xl focus:outline-none transition-colors appearance-none cursor-pointer ${
                        errors.make ? 'border-red-500 focus:border-red-500' : 'border-zinc-200 focus:border-red-600'
                      }`}
                      style={{
                        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 1rem center',
                        backgroundSize: '1.25em',
                      }}
                    >
                      <option value="">Select Brand...</option>
                      {POPULAR_MAKES.map((make) => (
                        <option key={make} value={make}>{make}</option>
                      ))}
                      <option value="Other">➕ Other (Type manually)</option>
                    </select>
                    {errors.make && <p className="text-red-600 text-xs mt-2">{errors.make}</p>}

                    {makeOption === 'Other' && (
                      <input
                        type="text"
                        placeholder="Enter make/brand name"
                        value={customMake}
                        onChange={handleCustomMakeChange}
                        className={`mt-3 w-full bg-white border text-zinc-900 p-4 rounded-xl focus:outline-none transition-colors ${
                          errors.make ? 'border-red-500 focus:border-red-500' : 'border-zinc-200 focus:border-red-600'
                        }`}
                        autoFocus
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-zinc-600 mb-2 uppercase tracking-wide">
                      Model
                    </label>
                    <input
                      type="text"
                      placeholder="Corolla"
                      value={vehicle.model}
                      onChange={(e) => {
                        setVehicle({ ...vehicle, model: e.target.value });
                        if (errors.model) setErrors({ ...errors, model: null });
                      }}
                      className={`w-full bg-white border text-zinc-900 p-4 rounded-xl focus:outline-none transition-colors ${
                        errors.model ? 'border-red-500 focus:border-red-500' : 'border-zinc-200 focus:border-red-600'
                      }`}
                    />
                    {errors.model && <p className="text-red-600 text-xs mt-2">{errors.model}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-zinc-600 mb-2 uppercase tracking-wide">
                      Manufacture Year
                    </label>
                    <input
                      type="number"
                      placeholder="2020"
                      value={vehicle.manufacture_year}
                      onChange={(e) => {
                        setVehicle({ ...vehicle, manufacture_year: e.target.value });
                        if (errors.manufacture_year) setErrors({ ...errors, manufacture_year: null });
                      }}
                      className={`w-full bg-white border text-zinc-900 p-4 rounded-xl focus:outline-none transition-colors ${
                        errors.manufacture_year ? 'border-red-500 focus:border-red-500' : 'border-zinc-200 focus:border-red-600'
                      }`}
                      min="1950"
                      max={new Date().getFullYear() + 1}
                    />
                    {errors.manufacture_year && <p className="text-red-600 text-xs mt-2">{errors.manufacture_year}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-600 mb-2 uppercase tracking-wide">
                      Current Mileage (km)
                    </label>
                    <input
                      type="number"
                      placeholder="85000"
                      value={vehicle.mileage}
                      onChange={(e) => {
                        setVehicle({ ...vehicle, mileage: e.target.value });
                        if (errors.mileage) setErrors({ ...errors, mileage: null });
                      }}
                      className={`w-full bg-white border text-zinc-900 p-4 rounded-xl focus:outline-none transition-colors ${
                        errors.mileage ? 'border-red-500 focus:border-red-500' : 'border-zinc-200 focus:border-red-600'
                      }`}
                      min="0"
                      max="1000000"
                    />
                    {errors.mileage && <p className="text-red-600 text-xs mt-2">{errors.mileage}</p>}
                  </div>
                </div>

                {/* Special Notes / Issues (Optional) */}
                <div className="pt-2">
                  <label className="block text-sm font-bold text-zinc-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                    Special Notes / Issues 
                    <span className="text-zinc-400 font-normal text-xs lowercase">(optional)</span>
                  </label>
                  <textarea
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder="E.g., Engine making a ticking noise, AC not cooling, Brakes squeaking..."
                    rows="3"
                    className="w-full bg-white border border-zinc-200 text-zinc-900 p-4 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none transition-colors placeholder:text-zinc-400 resize-none"
                  />
                  <p className="text-xs text-zinc-500 mt-2">
                    Letting our technicians know the issue beforehand helps us prepare.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 mt-10">
                <button
                  onClick={goToPrevStep}
                  className="w-1/3 border border-zinc-300 py-4 rounded-xl font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
                >
                  BACK
                </button>
                <button
                  onClick={goToNextStep}
                  className="w-2/3 bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-bold tracking-wider transition-all duration-300 shadow-lg shadow-red-600/20"
                >
                  NEXT: DATE & TIME →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Date & Time */}
          {step === 3 && (
            <div className="animate-[fadeIn_0.4s_ease-out]">
              <h3 className="text-lg md:text-xl font-bold mb-6 text-zinc-800">
                Step 3: Select Date & Time
              </h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-zinc-600 mb-2 uppercase tracking-wide">
                    Select Date (Next 7 Days)
                  </label>

                  <select
                    value={slot.date}
                    onChange={handleDateChange}
                    className={`w-full bg-white border text-zinc-900 p-4 rounded-xl focus:outline-none transition-colors appearance-none ${
                      errors.date ? 'border-red-500 focus:border-red-500' : 'border-zinc-200 focus:border-red-600'
                    }`}
                  >
                    <option value="">Select a date...</option>
                    {getAvailableDates.map((date) => (
                      <option key={date.value} value={date.value}>{date.label}</option>
                    ))}
                  </select>

                  {errors.date && <p className="text-red-600 text-xs mt-2">{errors.date}</p>}

                  {isPastSixPM ? (
                    <p className="text-amber-600 text-xs mt-2">Today is no longer available (past 6 PM). Showing from tomorrow.</p>
                  ) : (
                    <p className="text-zinc-400 text-xs mt-2">Today is available for booking until 6 PM.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-zinc-600 mb-2 uppercase tracking-wide">
                    Select Time Slot
                  </label>

                  {!slot.date ? (
                    <div className="text-zinc-500 text-center py-8 border border-dashed border-zinc-300 rounded-xl bg-white">
                      Please select a date first to see available time slots
                    </div>
                  ) : loadingSlots ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600 mx-auto"></div>
                      <p className="text-zinc-500 mt-4">Checking availability...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {timeSlots.map((time) => {
                        const available = isSlotAvailable(slot.date, time);
                        const remaining = getRemainingSlots(slot.date, time);
                        const isPast = isTimeSlotInPast(slot.date, time);

                        return (
                          <button
                            key={time}
                            disabled={!available}
                            onClick={() => {
                              setSlot({ ...slot, time });
                              if (errors.time) setErrors({ ...errors, time: null });
                            }}
                            className={`py-4 rounded-lg font-bold text-sm transition-all relative border ${
                              slot.time === time && available
                                ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-600/20'
                                : available
                                ? 'bg-white border-zinc-200 text-zinc-800 hover:border-red-600 hover:text-red-600'
                                : 'bg-zinc-50 border-zinc-200 text-zinc-400 cursor-not-allowed opacity-60'
                            }`}
                          >
                            <div>{time}</div>
                            {available && <div className="text-xs font-normal mt-1 opacity-90">{remaining} slot{remaining !== 1 ? 's' : ''} left</div>}
                            {isPast && <div className="text-xs font-normal mt-1">Time passed</div>}
                            {!isPast && !available && remaining === 0 && <div className="text-xs font-normal mt-1 text-red-400">Full</div>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {errors.time && <p className="text-red-600 text-xs mt-2">{errors.time}</p>}
                </div>
              </div>

              <div className="flex gap-4 mt-10">
                <button
                  onClick={goToPrevStep}
                  className="w-1/3 border border-zinc-300 py-4 rounded-xl font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
                >
                  BACK
                </button>
                <button
                  onClick={goToNextStep}
                  className="w-2/3 bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-bold tracking-wider transition-all duration-300 shadow-lg shadow-red-600/20"
                >
                  NEXT: PAYMENT & REVIEW →
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Payment & Review */}
          {step === 4 && (
            <div className="animate-[fadeIn_0.4s_ease-out]">
              <h3 className="text-lg md:text-xl font-bold mb-6 text-zinc-800">
                Step 4: Payment & Review
              </h3>

              {/* Payment Selection */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-zinc-600 mb-3 uppercase tracking-wide">
                  How would you like to pay?
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pay at Center */}
                  <div
                    onClick={() => setPaymentMethod('Cash')}
                    className={`p-5 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center text-center ${
                      paymentMethod === 'Cash' 
                        ? 'border-red-600 bg-red-50' 
                        : 'border-zinc-200 bg-white hover:border-red-300'
                    }`}
                  >
                    <svg className={`w-8 h-8 mb-2 ${paymentMethod === 'Cash' ? 'text-red-600' : 'text-zinc-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className={`font-bold ${paymentMethod === 'Cash' ? 'text-red-700' : 'text-zinc-700'}`}>Pay at Service Center</span>
                    <span className="text-xs text-zinc-500 mt-1">Pay with cash or card on arrival</span>
                  </div>

                  {/* Bank Transfer */}
                  <div
                    onClick={() => setPaymentMethod('Bank Transfer')}
                    className={`p-5 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center text-center ${
                      paymentMethod === 'Bank Transfer' 
                        ? 'border-red-600 bg-red-50' 
                        : 'border-zinc-200 bg-white hover:border-red-300'
                    }`}
                  >
                    <svg className={`w-8 h-8 mb-2 ${paymentMethod === 'Bank Transfer' ? 'text-red-600' : 'text-zinc-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <span className={`font-bold ${paymentMethod === 'Bank Transfer' ? 'text-red-700' : 'text-zinc-700'}`}>Bank Transfer / Online</span>
                    <span className="text-xs text-zinc-500 mt-1">Upload your payment slip below</span>
                  </div>
                </div>

                {/* Bank Details & Upload Area (Only if Bank Transfer selected) */}
                {paymentMethod === 'Bank Transfer' && (
                  <div className="mt-4 p-5 bg-zinc-50 border border-zinc-200 rounded-xl animate-[fadeIn_0.3s_ease-out]">
                    <p className="text-sm font-bold text-zinc-800 mb-2">Bank Details</p>
                    <div className="text-sm text-zinc-600 mb-4 space-y-1">
                      <p>Bank: <span className="font-semibold text-zinc-900">Commercial Bank</span></p>
                      <p>Account Name: <span className="font-semibold text-zinc-900">Royal Service Center</span></p>
                      <p>Account No: <span className="font-semibold text-zinc-900">1234567890</span></p>
                    </div>
                    
                    <label className="block text-sm font-bold text-zinc-800 mb-2 mt-4">Upload Payment Slip</label>
                    <div className="flex items-center justify-center w-full">
                      <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-zinc-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-zinc-50 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <svg className="w-8 h-8 mb-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="mb-1 text-sm text-zinc-500 font-semibold">
                            {paymentSlip ? paymentSlip.name : 'Click to upload or drag & drop'}
                          </p>
                          <p className="text-xs text-zinc-400">JPG, PNG or PDF (MAX. 5MB)</p>
                        </div>
                        <input id="dropzone-file" type="file" className="hidden" accept="image/*,application/pdf" onChange={handleSlipChange} />
                      </label>
                    </div>
                    
                    {/* Image Preview */}
                    {slipPreview && (
                      <div className="mt-4 flex justify-center">
                        <img src={slipPreview} alt="Slip Preview" className="max-h-40 rounded-lg border border-zinc-200 object-contain" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Review Summary */}
              <div className="bg-zinc-50 p-6 md:p-8 rounded-2xl border border-zinc-200 mb-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-start border-b border-zinc-200 pb-4">
                    <span className="text-zinc-500 font-bold uppercase text-xs tracking-wider">Service</span>
                    <div className="text-right">
                      <div className="font-bold text-zinc-900 uppercase">{selectedService?.name}</div>
                      <span className="text-red-600 text-xs font-bold uppercase tracking-wider">{vehicleType}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-start border-b border-zinc-200 pb-4">
                    <span className="text-zinc-500 font-bold uppercase text-xs tracking-wider">Price</span>
                    <span className="text-red-600 font-black text-lg">
                      LKR {getPrice(selectedService).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between items-start border-b border-zinc-200 pb-4">
                    <span className="text-zinc-500 font-bold uppercase text-xs tracking-wider">Vehicle</span>
                    <div className="text-right">
                      <div className="font-bold text-zinc-900">{vehicle.reg_number}</div>
                      <div className="text-sm text-zinc-500">{vehicle.make} {vehicle.model} ({vehicle.manufacture_year})</div>
                    </div>
                  </div>

                  <div className="flex justify-between items-start border-b border-zinc-200 pb-4">
                    <span className="text-zinc-500 font-bold uppercase text-xs tracking-wider">Schedule</span>
                    <div className="text-right">
                      <div className="font-bold text-zinc-900">
                        {new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="text-sm text-zinc-500">at {slot.time}</div>
                    </div>
                  </div>

                  {/* Show Special Notes in Review */}
                  {issueDescription.trim() && (
                    <div className="flex justify-between items-start">
                      <span className="text-zinc-500 font-bold uppercase text-xs tracking-wider">Special Notes</span>
                      <div className="text-right max-w-[200px] md:max-w-xs">
                        <p className="text-sm text-zinc-700 bg-white p-3 rounded-lg border border-zinc-200 text-left whitespace-pre-wrap">
                          {issueDescription}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={goToPrevStep}
                  disabled={isSubmitting}
                  className="w-1/3 border border-zinc-300 py-4 rounded-xl font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  BACK
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={handleSubmitBooking}
                  className="w-2/3 bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-black tracking-widest transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      PROCESSING...
                    </>
                  ) : (
                    'CONFIRM BOOKING'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Success */}
          {step === 5 && (
            <div className="text-center py-12 animate-[fadeInUp_0.5s_ease-out]">
              <div className="w-20 h-20 bg-red-50 border-2 border-red-600 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-600/20">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h3 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight uppercase">
                Booking Confirmed!
              </h3>

              <p className="text-zinc-600 mt-4 text-lg">
                Your reference number is
              </p>

              <div className="inline-block bg-zinc-50 border-2 border-red-600/30 rounded-xl px-8 py-4 mt-4">
                <strong className="text-2xl md:text-3xl text-zinc-900 tracking-widest font-black">
                  {successRef}
                </strong>
              </div>

              <p className="text-sm text-zinc-400 mt-6 mb-10 uppercase tracking-widest">
                Please save this reference for your records
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl font-bold tracking-widest transition-all shadow-lg shadow-red-600/20"
                >
                  VIEW DASHBOARD
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white px-8 py-4 rounded-xl font-bold tracking-widest transition-all"
                >
                  BACK TO HOME
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}