import React, { useEffect, useState, useContext, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';

// ==========================================================
// SERVICE IMAGE MAP — Pexels
// ==========================================================
const SERVICE_IMAGES = {
  oil: 'https://images.pexels.com/photos/3846252/pexels-photo-3846252.jpeg?auto=compress&cs=tinysrgb&w=1200',
  oilFilter: 'https://images.pexels.com/photos/4489706/pexels-photo-4489706.jpeg?auto=compress&cs=tinysrgb&w=1200',
  full: 'https://images.pexels.com/photos/3806288/pexels-photo-3806288.jpeg?auto=compress&cs=tinysrgb&w=1200',
  brake: 'https://images.pexels.com/photos/3807277/pexels-photo-3807277.jpeg?auto=compress&cs=tinysrgb&w=1200',
  ac: 'https://images.pexels.com/photos/4489730/pexels-photo-4489730.jpeg?auto=compress&cs=tinysrgb&w=1200',
  tire: 'https://images.pexels.com/photos/3806249/pexels-photo-3806249.jpeg?auto=compress&cs=tinysrgb&w=1200',
  engine: 'https://images.pexels.com/photos/13065690/pexels-photo-13065690.jpeg?auto=compress&cs=tinysrgb&w=1200',
  transmission: 'https://images.pexels.com/photos/3846205/pexels-photo-3846205.jpeg?auto=compress&cs=tinysrgb&w=1200',
  battery: 'https://images.pexels.com/photos/4489733/pexels-photo-4489733.jpeg?auto=compress&cs=tinysrgb&w=1200',
  wash: 'https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&cs=tinysrgb&w=1200',
  detailing: 'https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&cs=tinysrgb&w=1200',
  diagnostic: 'https://images.pexels.com/photos/4489749/pexels-photo-4489749.jpeg?auto=compress&cs=tinysrgb&w=1200',
  suspension: 'https://images.pexels.com/photos/3807386/pexels-photo-3807386.jpeg?auto=compress&cs=tinysrgb&w=1200',
  paint: 'https://images.pexels.com/photos/3806252/pexels-photo-3806252.jpeg?auto=compress&cs=tinysrgb&w=1200',
  default: 'https://images.pexels.com/photos/3806288/pexels-photo-3806288.jpeg?auto=compress&cs=tinysrgb&w=1200',
};

const getServiceImage = (serviceName = '') => {
  const name = serviceName.toLowerCase();
  if (name.includes('oil') && name.includes('filter')) return SERVICE_IMAGES.oilFilter;
  if (name.includes('transmission') || name.includes('gear')) return SERVICE_IMAGES.transmission;
  if (name.includes('engine') || name.includes('tune')) return SERVICE_IMAGES.engine;
  if (name.includes('oil') || name.includes('lubricant') || name.includes('lube')) return SERVICE_IMAGES.oil;
  if (name.includes('full') || name.includes('complete') || name.includes('major')) return SERVICE_IMAGES.full;
  if (name.includes('brake')) return SERVICE_IMAGES.brake;
  if (name.includes('ac') || name.includes('air') || name.includes('cool')) return SERVICE_IMAGES.ac;
  if (name.includes('tire') || name.includes('tyre') || name.includes('wheel') || name.includes('align')) return SERVICE_IMAGES.tire;
  if (name.includes('battery')) return SERVICE_IMAGES.battery;
  if (name.includes('wash')) return SERVICE_IMAGES.wash;
  if (name.includes('detail') || name.includes('polish')) return SERVICE_IMAGES.detailing;
  if (name.includes('diagnos') || name.includes('scan') || name.includes('check')) return SERVICE_IMAGES.diagnostic;
  if (name.includes('suspension') || name.includes('shock')) return SERVICE_IMAGES.suspension;
  if (name.includes('paint') || name.includes('body')) return SERVICE_IMAGES.paint;
  return SERVICE_IMAGES.default;
};

export default function Homepage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [countersVisible, setCountersVisible] = useState(false);
  const dropdownRef = useRef(null);
  const servicesRef = useRef(null);
  const aboutRef = useRef(null);
  const contactRef = useRef(null);
  const countersRef = useRef(null);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const heroSlides = [
    {
      title: 'PREMIUM DETAILING',
      subtitle: "It's time for your car to shine",
      cta: 'Get Started',
      image: 'https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&cs=tinysrgb&w=2940',
      overlay: 'from-zinc-950/95 via-zinc-900/80 to-zinc-950/60',
    },
    {
      title: 'EXPERT REPAIRS',
      subtitle: 'Precision engineering for your vehicle',
      cta: 'Book Now',
      image: 'https://images.pexels.com/photos/4489704/pexels-photo-4489704.jpeg?auto=compress&cs=tinysrgb&w=2832',
      overlay: 'from-blue-950/95 via-zinc-900/80 to-zinc-950/60',
    },
    {
      title: 'WASH & GROOMING',
      subtitle: 'Professional care for that showroom finish',
      cta: 'Schedule Service',
      image: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=2940&auto=format&fit=crop',
      overlay: 'from-zinc-950/95 via-zinc-900/80 to-zinc-950/60',
    },
  ];

  const stats = [
    { value: 15, suffix: '+', label: 'Years Experience', description: 'Since 2009' },
    { value: 25, suffix: '+', label: 'Service Centres', description: 'Island Wide' },
    { value: 100, suffix: '%', label: 'Satisfaction', description: 'Guaranteed' },
    { value: 50000, suffix: '+', label: 'Vehicles Serviced', description: 'And Counting' },
  ];

  const aboutFeatures = [
    {
      title: 'Certified Technicians',
      description: 'Manufacturer-trained experts for all vehicle types',
    },
    {
      title: 'Genuine Parts Only',
      description: 'We use only authentic OEM parts for every repair',
    },
    {
      title: 'State-of-the-Art Facilities',
      description: 'Latest diagnostic and repair equipment',
    },
    {
      title: 'Warranty Guaranteed',
      description: 'All services backed by our comprehensive warranty',
    },
  ];

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await axiosClient.get('/services');
        setServices(response.data);
      } catch (error) {
        console.error('Error fetching services:', error);
        setError('Failed to load services. Please try again.');
        toast.error('Unable to fetch services');
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [heroSlides.length]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (servicesRef.current) {
      observer.observe(servicesRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCountersVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (countersRef.current) {
      observer.observe(countersRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const handleDashboardRedirect = () => {
    if (user?.role === 'admin') navigate('/admin');
    else if (user?.role === 'staff') navigate('/staff');
    else navigate('/dashboard');
  };

  const handleBookNow = (serviceId = null) => {
    if (user) {
      navigate('/booking', { state: { selectedServiceId: serviceId } });
    } else {
      toast('Please sign in to book a service', {
        icon: '🔒',
        style: {
          background: '#18181b',
          color: '#fff',
          border: '1px solid #3f3f46',
        },
      });
      // Pass the serviceId so after login, they go straight to booking
      navigate('/login', { state: { from: '/booking', serviceId } });
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out securely.');
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
  };

  // 🚨 FIXED: Scroll to top for Home button
  const scrollToTop = () => {
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (ref) => {
    setIsMobileMenuOpen(false);
    setTimeout(() => {
      if (ref.current) {
        ref.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, 100);
  };

  const scrollToServices = () => scrollToSection(servicesRef);
  const scrollToAbout = () => scrollToSection(aboutRef);
  const scrollToContact = () => scrollToSection(contactRef);

  const handleChatRedirect = () => {
    if (!user) {
      toast('Please sign in to chat with us', {
        icon: '🔒',
        style: {
          background: '#18181b',
          color: '#fff',
          border: '1px solid #3f3f46',
        },
      });
      navigate('/login', { state: { from: '/chat' } });
      return;
    }
    navigate('/chat');
  };

  const getPrice = (service) => {
    if (service.price?.Car) return service.price.Car;
    if (typeof service.price === 'number') return service.price;
    return 0;
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  };

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900">
      {/* Top Bar */}
      <div className="bg-zinc-900 text-white text-xs md:text-sm py-2">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              +94 11 760 0800
            </span>
            <span className="hidden md:flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Mon - Sat: 8:00 AM - 6:00 PM
            </span>
          </div>
          <div className="text-[10px] md:text-xs tracking-widest uppercase text-zinc-400">
            Premium Auto Care
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-zinc-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex justify-between items-center">
          
          <div
            className="flex items-center gap-2 md:gap-3 cursor-pointer"
            onClick={scrollToTop}
            role="button"
            aria-label="Go to homepage"
          >
            <img 
              src="/logo.png" 
              alt="Royal Service Center Logo" 
              className="w-9 h-9 md:w-12 md:h-12 object-contain rounded-lg" 
            />
            <div className="block">
              <h1 className="text-lg md:text-xl font-black text-zinc-900 tracking-tight leading-none">
                ROYAL
              </h1>
              <span className="text-[10px] md:text-xs font-bold text-red-600 tracking-widest">
                SERVICE CENTER
              </span>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center space-x-8">
            <button onClick={scrollToTop} className="text-zinc-900 font-semibold text-sm tracking-wide hover:text-red-600 transition-colors relative group">
              HOME
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-red-600 group-hover:w-full transition-all duration-300"></span>
            </button>
            <button onClick={scrollToAbout} className="text-zinc-600 font-semibold text-sm tracking-wide hover:text-red-600 transition-colors relative group">
              ABOUT US
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-red-600 group-hover:w-full transition-all duration-300"></span>
            </button>
            <button onClick={scrollToServices} className="text-zinc-600 font-semibold text-sm tracking-wide hover:text-red-600 transition-colors relative group">
              OUR SERVICES
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-red-600 group-hover:w-full transition-all duration-300"></span>
            </button>
            <button onClick={scrollToContact} className="text-zinc-600 font-semibold text-sm tracking-wide hover:text-red-600 transition-colors relative group">
              CONTACT
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-red-600 group-hover:w-full transition-all duration-300"></span>
            </button>
            {user && user.role !== 'customer' && (
              <button onClick={handleDashboardRedirect} className="text-zinc-600 font-semibold text-sm tracking-wide hover:text-red-600 transition-colors relative group">
                DASHBOARD
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-red-600 group-hover:w-full transition-all duration-300"></span>
              </button>
            )}
          </nav>

          {/* Desktop Right Buttons */}
          <div className="hidden lg:flex items-center gap-4">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-10 h-10 rounded-full bg-zinc-100 border-2 border-zinc-200 flex items-center justify-center text-zinc-600 hover:border-red-600 transition-all overflow-hidden"
                >
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 top-full pt-3 w-56 z-50">
                    <div className="bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
                        <p className="text-sm font-bold text-zinc-900 truncate">{user.name}</p>
                        <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                      </div>
                      <div className="py-2">
                        <button onClick={() => { setIsDropdownOpen(false); navigate('/profile'); }} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-zinc-700 hover:text-red-600 hover:bg-zinc-50">Edit Profile</button>
                        {/* 🚨 Customers see "My Appointments", Staff/Admin see "Dashboard" */}
                        {user.role === 'customer' ? (
                          <button onClick={() => { setIsDropdownOpen(false); navigate('/dashboard'); }} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-zinc-700 hover:text-red-600 hover:bg-zinc-50">My Appointments</button>
                        ) : (
                          <button onClick={() => { setIsDropdownOpen(false); handleDashboardRedirect(); }} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-zinc-700 hover:text-red-600 hover:bg-zinc-50">Dashboard</button>
                        )}
                        <div className="border-t border-zinc-100 my-1"></div>
                        <button onClick={handleLogout} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">Logout</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className="text-zinc-600 hover:text-red-600 text-sm font-bold tracking-wide transition-colors">
                  LOGIN
                </Link>
                <button onClick={() => handleBookNow()} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-xl flex items-center gap-2">
                  BOOK NOW
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </button>
              </>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden text-zinc-900 p-2 focus:outline-none"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-white border-b border-zinc-200 shadow-xl overflow-y-auto max-h-[85vh]">
            <div className="px-4 py-4 space-y-1">
              <button onClick={scrollToTop} className="block w-full text-left px-4 py-3 text-zinc-700 hover:text-red-600 hover:bg-zinc-50 rounded-lg font-medium">Home</button>
              <button onClick={scrollToAbout} className="block w-full text-left px-4 py-3 text-zinc-700 hover:text-red-600 hover:bg-zinc-50 rounded-lg font-medium">About Us</button>
              <button onClick={scrollToServices} className="block w-full text-left px-4 py-3 text-zinc-700 hover:text-red-600 hover:bg-zinc-50 rounded-lg font-medium">Our Services</button>
              <button onClick={scrollToContact} className="block w-full text-left px-4 py-3 text-zinc-700 hover:text-red-600 hover:bg-zinc-50 rounded-lg font-medium">Contact</button>

              <div className="border-t border-zinc-100 my-2"></div>

              {user ? (
                <>
                  {user.role === 'customer' ? (
                    <button onClick={() => { setIsMobileMenuOpen(false); navigate('/dashboard'); }} className="block w-full text-left px-4 py-3 text-zinc-700 hover:text-red-600 hover:bg-zinc-50 rounded-lg font-medium">My Appointments</button>
                  ) : (
                    <button onClick={() => { setIsMobileMenuOpen(false); handleDashboardRedirect(); }} className="block w-full text-left px-4 py-3 text-zinc-700 hover:text-red-600 hover:bg-zinc-50 rounded-lg font-medium">Dashboard</button>
                  )}
                  <button onClick={() => { setIsMobileMenuOpen(false); navigate('/profile'); }} className="block w-full text-left px-4 py-3 text-zinc-700 hover:text-red-600 hover:bg-zinc-50 rounded-lg font-medium">Profile</button>
                  <button onClick={handleLogout} className="block w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg font-medium">Logout</button>
                </>
              ) : (
                <div className="pt-2 pb-2 space-y-3">
                  <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-center px-4 py-3 text-zinc-700 border border-zinc-300 rounded-lg font-bold hover:bg-zinc-50">
                    LOGIN
                  </Link>
                  <button onClick={() => { setIsMobileMenuOpen(false); handleBookNow(); }} className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-bold flex justify-center items-center gap-2 shadow-lg">
                    BOOK NOW
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Carousel */}
      <section className="relative h-[75vh] md:h-[85vh] min-h-[500px] md:min-h-[600px] overflow-hidden">
        {heroSlides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url('${slide.image}')` }}
              aria-hidden="true"
            />
            <div className={`absolute inset-0 bg-gradient-to-r ${slide.overlay}`} />

            <div className="relative z-10 h-full flex items-center">
              <div className="max-w-7xl mx-auto px-4 md:px-6 w-full">
                <div className="max-w-2xl">
                  <div
                    className={`transition-all duration-700 delay-300 ${
                      index === currentSlide
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-8'
                    }`}
                  >
                    <div className="w-16 md:w-20 h-1 bg-red-600 mb-4 md:mb-6"></div>
                    <h2 className="text-4xl md:text-7xl font-black text-white mb-3 md:mb-4 leading-tight tracking-tight uppercase">
                      {slide.title}
                    </h2>
                    <p className="text-lg md:text-2xl text-zinc-300 mb-6 md:mb-8 font-light">
                      {slide.subtitle}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                      <button
                        onClick={() => handleBookNow()}
                        className="group inline-flex justify-center items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-6 md:px-8 py-3 md:py-4 font-bold text-xs md:text-sm tracking-widest uppercase transition-all duration-300 shadow-xl"
                      >
                        {slide.cta}
                        <svg className="w-4 h-4 md:w-5 md:h-5 transition-transform duration-300 group-hover:translate-x-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>

                      <button
                        onClick={scrollToServices}
                        className="inline-flex justify-center items-center gap-3 border-2 border-white/70 hover:border-white hover:bg-white/10 text-white px-6 md:px-8 py-3 md:py-4 font-bold text-xs md:text-sm tracking-widest uppercase transition-all duration-300 backdrop-blur-sm"
                      >
                        VIEW SERVICES
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2 md:gap-3">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-1 transition-all duration-500 ${
                index === currentSlide ? 'w-10 md:w-12 bg-red-600' : 'w-5 md:w-6 bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section ref={countersRef} className="py-16 md:py-20 bg-zinc-900 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-5xl font-black text-white mb-1 md:mb-2">
                  <Counter end={stat.value} suffix={stat.suffix} visible={countersVisible} delay={index * 200} />
                </div>
                <div className="text-red-500 font-bold text-[10px] md:text-sm tracking-widest uppercase mb-1">
                  {stat.label}
                </div>
                <div className="text-zinc-500 text-[10px] md:text-xs">{stat.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section ref={aboutRef} className="py-16 md:py-24 bg-white scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <div className="w-16 md:w-20 h-1 bg-red-600 mb-4 md:mb-6"></div>
              <h3 className="text-3xl md:text-5xl font-black text-zinc-900 mb-4 md:mb-6 tracking-tight uppercase">
                About Royal Service
              </h3>
              <p className="text-zinc-600 text-base md:text-lg mb-4 md:mb-6 leading-relaxed">
                With over a decade of excellence in automotive care, we've built our reputation on trust, quality, and an unwavering commitment to our customers. From routine maintenance to complex repairs, our certified team treats every vehicle like a masterpiece.
              </p>
              <p className="text-zinc-600 text-base md:text-lg mb-8 md:mb-10 leading-relaxed">
                Sri Lanka's premier automotive service provider — delivering excellence since 2009.
              </p>

              <div className="space-y-4 md:space-y-6">
                {aboutFeatures.map((item, index) => (
                  <div key={index} className="flex gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 md:w-6 md:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm md:text-base text-zinc-900 mb-1">{item.title}</h4>
                      <p className="text-zinc-600 text-xs md:text-sm">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mt-8 lg:mt-0">
              <div className="aspect-square rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.pexels.com/photos/3846228/pexels-photo-3846228.jpeg?auto=compress&cs=tinysrgb&w=1200"
                  alt="Expert Sri Lankan mechanic"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -left-4 md:-bottom-8 md:-left-8 bg-red-600 text-white p-4 md:p-8 rounded-xl shadow-2xl max-w-[200px] md:max-w-xs">
                <div className="text-4xl md:text-5xl font-black mb-1 md:mb-2">15+</div>
                <div className="text-xs md:text-sm font-bold tracking-widest uppercase opacity-90">Years of Excellence</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section ref={servicesRef} className="py-16 md:py-24 bg-zinc-50 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className={`flex flex-col md:flex-row justify-between items-end mb-10 md:mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div>
              <div className="w-16 md:w-20 h-1 bg-red-600 mb-4 md:mb-6"></div>
              <h3 className="text-3xl md:text-5xl font-black text-zinc-900 mb-2 md:mb-4 tracking-tight uppercase">Our Services</h3>
              <p className="text-zinc-600 max-w-xl text-sm md:text-lg">Transparent pricing. Uncompromising quality. Select your required service below.</p>
            </div>
            {!loading && !error && (
              <span className="text-xs md:text-sm text-zinc-500 font-semibold mt-4 md:mt-0">{services.length} SERVICES AVAILABLE</span>
            )}
          </div>

          {error && (
            <div className="text-center py-20">
              <div className="inline-flex items-center gap-2 text-red-600 mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="font-bold">ERROR</span>
              </div>
              <p className="text-zinc-600 mb-6">{error}</p>
              <button onClick={() => window.location.reload()} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors">RETRY</button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="bg-white rounded-xl border border-zinc-200 overflow-hidden animate-pulse h-80"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service, index) => (
                <div
                  key={service._id}
                  className={`group bg-white rounded-xl border border-zinc-200 hover:border-red-600 hover:shadow-2xl transition-all duration-500 overflow-hidden cursor-pointer flex flex-col h-full ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                  onClick={() => handleBookNow(service._id)}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBookNow(service._id); } }}
                >
                  <div className="relative h-48 md:h-52 overflow-hidden bg-zinc-200">
                    <img
                      src={getServiceImage(service.name)}
                      alt={service.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      loading="lazy"
                      onError={(e) => { e.target.onerror = null; e.target.src = SERVICE_IMAGES.default; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 via-zinc-900/20 to-transparent"></div>
                    <div className="absolute top-3 left-3 md:top-4 md:left-4">
                      <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-[9px] md:text-[10px] font-black tracking-widest uppercase px-2 md:px-3 py-1 md:py-1.5 rounded shadow-lg">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg> Premium
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 md:bottom-4 md:left-4 md:right-4">
                      <h4 className="font-black text-lg md:text-xl text-white tracking-wide uppercase drop-shadow-lg">{service.name}</h4>
                    </div>
                  </div>
                  <div className="p-5 md:p-6 flex-1 flex flex-col">
                    <p className="text-zinc-600 mb-4 md:mb-6 leading-relaxed text-xs md:text-sm line-clamp-3 flex-1">{service.description}</p>
                    <div className="pt-4 md:pt-5 border-t border-zinc-100 flex items-center justify-between">
                      <div>
                        <span className="text-xl md:text-2xl font-black text-zinc-900 group-hover:text-red-600 transition-colors duration-300">
                          LKR {getPrice(service).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                        </span>
                        <span className="block text-[10px] md:text-xs text-zinc-500 mt-1">Starting price</span>
                      </div>
                      <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 group-hover:bg-red-600 group-hover:text-white transition-all duration-300">
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Contact Section */}
      <section ref={contactRef} className="py-16 md:py-24 bg-zinc-900 scroll-mt-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
          <div className="text-center mb-10 md:mb-16">
            <div className="w-16 md:w-20 h-1 bg-red-600 mx-auto mb-4 md:mb-6"></div>
            <h3 className="text-3xl md:text-5xl font-black text-white mb-2 md:mb-4 tracking-tight uppercase">Get in Touch</h3>
            <p className="text-zinc-400 max-w-2xl mx-auto text-sm md:text-lg">Have a question or need assistance? Reach out to our team — we're here to help.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-10 md:mb-16">
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6 md:p-8 text-center hover:border-red-600/50 transition-all duration-300">
              <div className="w-12 h-12 md:w-14 md:h-14 mx-auto mb-4 md:mb-5 rounded-full bg-red-600/10 flex items-center justify-center text-red-500">
                <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <h4 className="text-white font-bold mb-2 tracking-wide text-sm uppercase">Visit Us</h4>
              <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">123 Service Road,<br />Colombo 05, Sri Lanka</p>
            </div>

            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6 md:p-8 text-center hover:border-red-600/50 transition-all duration-300">
              <div className="w-12 h-12 md:w-14 md:h-14 mx-auto mb-4 md:mb-5 rounded-full bg-red-600/10 flex items-center justify-center text-red-500">
                <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              </div>
              <h4 className="text-white font-bold mb-2 tracking-wide text-sm uppercase">Call Us</h4>
              <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">+94 11 760 0800<br />Mon - Sat: 8AM - 6PM</p>
            </div>

            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6 md:p-8 text-center hover:border-red-600/50 transition-all duration-300">
              <div className="w-12 h-12 md:w-14 md:h-14 mx-auto mb-4 md:mb-5 rounded-full bg-red-600/10 flex items-center justify-center text-red-500">
                <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <h4 className="text-white font-bold mb-2 tracking-wide text-sm uppercase">Chat With Us</h4>
              <p className="text-zinc-400 text-xs md:text-sm leading-relaxed mb-4">Instant support from our team</p>
              <button onClick={handleChatRedirect} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 md:px-5 py-2 md:py-2.5 rounded font-bold text-[10px] md:text-xs tracking-widest uppercase transition-colors">Start Chat</button>
            </div>
          </div>

          {/* 🚨 Added Email Here */}
          <div className="text-center mb-10">
            <p className="text-zinc-400 text-xs md:text-sm">
              Or email us directly at: <a href="mailto:admin@royalservice.tech" className="text-red-500 font-bold hover:underline">admin@royalservice.tech</a>
            </p>
          </div>

          <div className="text-center">
            <button onClick={() => handleBookNow()} className="w-full md:w-auto bg-white text-red-600 px-8 md:px-10 py-3 md:py-4 rounded font-black text-sm md:text-base tracking-widest uppercase hover:bg-zinc-100 transition-all duration-300 shadow-xl">
              Book an Appointment
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-950 pt-12 md:pt-16 pb-6 md:pb-8 border-t border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-8 md:mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4 md:mb-6">
                <img src="/logo.png" alt="Logo" className="w-10 h-10 md:w-12 md:h-12 object-contain rounded-lg" />
                <div>
                  <h4 className="text-base md:text-lg font-black text-white tracking-tight leading-none">ROYAL</h4>
                  <span className="text-[10px] md:text-xs font-bold text-red-500 tracking-widest">SERVICE CENTER</span>
                </div>
              </div>
              <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">Sri Lanka's premier automotive service provider, delivering excellence since 2009.</p>
            </div>

            <div>
              <h5 className="text-white font-bold mb-4 md:mb-6 tracking-widest text-sm uppercase">Quick Links</h5>
              <ul className="space-y-2 md:space-y-3">
                <li><button onClick={scrollToAbout} className="text-zinc-400 hover:text-red-500 transition-colors text-xs md:text-sm">About Us</button></li>
                <li><button onClick={scrollToServices} className="text-zinc-400 hover:text-red-500 transition-colors text-xs md:text-sm">Our Services</button></li>
                <li><button onClick={scrollToContact} className="text-zinc-400 hover:text-red-500 transition-colors text-xs md:text-sm">Contact</button></li>
                <li><button onClick={() => handleBookNow()} className="text-zinc-400 hover:text-red-500 transition-colors text-xs md:text-sm">Book a Service</button></li>
              </ul>
            </div>

            <div>
              <h5 className="text-white font-bold mb-4 md:mb-6 tracking-widest text-sm uppercase">Contact</h5>
              <ul className="space-y-3 md:space-y-4">
                <li className="flex gap-2 md:gap-3">
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span className="text-zinc-400 text-xs md:text-sm">123 Service Road, Colombo 05, Sri Lanka</span>
                </li>
                <li className="flex gap-2 md:gap-3">
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  <span className="text-zinc-400 text-xs md:text-sm">+94 11 760 0800</span>
                </li>
                <li className="flex gap-2 md:gap-3">
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <span className="text-zinc-400 text-xs md:text-sm">admin@royalservice.tech</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-6 md:pt-8 text-center text-xs md:text-sm text-zinc-500">
            <p>© {new Date().getFullYear()} Royal Service Center. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Floating Chat Button */}
      <button
        onClick={handleChatRedirect}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 group"
        aria-label="Chat with our support team"
      >
        <span className="absolute inset-0 rounded-full bg-red-600/30 animate-ping opacity-75"></span>
        <span className="absolute inset-0 rounded-full bg-red-600/20 animate-pulse"></span>

        <span className="relative flex items-center gap-2 bg-gradient-to-br from-red-500 via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 text-white pl-2 pr-3 md:pl-3 md:pr-4 py-2 md:py-3 rounded-full shadow-2xl shadow-red-600/40 hover:shadow-red-600/60 transition-all duration-300 hover:scale-105">
          <span className="relative w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 md:w-4 md:h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3C6.477 3 2 6.94 2 11.79c0 2.7 1.44 5.11 3.72 6.74-.07.83-.33 2.25-1.05 3.15-.09.12-.01.3.14.31 1.18.08 2.87-.53 4.14-1.4.96.29 2 .45 3.05.45 5.523 0 10-3.94 10-8.79S17.523 3 12 3z" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-emerald-400 border md:border-2 border-red-600"></span>
          </span>
          <span className="text-[10px] md:text-xs font-black tracking-widest uppercase whitespace-nowrap">Chat</span>
        </span>

        <span className="hidden md:block absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-zinc-900 text-white text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-xl">
          Chat with Support
          <span className="absolute left-full top-1/2 -translate-y-1/2 border-8 border-transparent border-l-zinc-900"></span>
        </span>
      </button>
    </div>
  );
}

// Counter Component
function Counter({ end, suffix, visible, delay }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!visible) return;

    let startTime;
    const duration = 2000;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    const timeout = setTimeout(() => {
      requestAnimationFrame(animate);
    }, delay);

    return () => clearTimeout(timeout);
  }, [visible, end, delay]);

  return (
    <span>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}