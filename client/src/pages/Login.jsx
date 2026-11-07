import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

// 🚨 Password strength validator (mirrors backend logic)
const validatePassword = (password) => {
  const regex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
  return regex.test(password);
};

// 🚨 Live password requirements checklist
function PasswordRequirements({ password, show }) {
  if (!show) return null;

  const rules = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'At least one uppercase letter (A–Z)', met: /[A-Z]/.test(password) },
    { label: 'At least one number (0–9)', met: /\d/.test(password) },
  ];

  return (
    <ul className="space-y-1.5 mt-2 pl-1 animate-[fadeIn_0.2s_ease-out]">
      {rules.map((rule, i) => (
        <li key={i} className="flex items-center gap-2 text-xs">
          <span
            className={`w-4 h-4 flex items-center justify-center rounded-full border transition-colors ${
              rule.met
                ? 'bg-green-600/20 border-green-500 text-green-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-600'
            }`}
          >
            {rule.met ? '✓' : ''}
          </span>
          <span className={rule.met ? 'text-green-400' : 'text-zinc-500'}>
            {rule.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  
  // State for password reset flow
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetToken, setResetToken] = useState(null);
  const [isSendingReset, setIsSendingReset] = useState(false);

  // State for show/hide password
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 🚨 NEW: Track whether user has interacted with password field
  const [passwordTouched, setPasswordTouched] = useState(false);

  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    password: '', 
    confirmPassword: '' 
  });
  
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if the URL contains a reset token (e.g., /login?resetToken=abc123)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('resetToken');
    if (token) {
      setResetToken(token);
      setIsRegister(false);
      setIsForgotPassword(false);
    }
  }, [location]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 🚨 Validate password strength on register or reset
    if ((isRegister || resetToken) && !validatePassword(formData.password)) {
      toast.error(
        "Password must be at least 8 characters, include one uppercase letter, and one number."
      );
      return;
    }

    // Check if passwords match (only if registering or resetting)
    if ((isRegister || resetToken) && formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }
    
    // 1. Handle Password Reset
    if (resetToken) {
      const loadingToast = toast.loading('Resetting password...');
      try {
        await axiosClient.put(`/auth/reset-password/${resetToken}`, { password: formData.password });
        toast.dismiss(loadingToast);
        toast.success('Password reset successfully! You can now log in.');
        setResetToken(null);
        setFormData({ ...formData, password: '', confirmPassword: '' });
        setPasswordTouched(false);
      } catch (err) {
        toast.dismiss(loadingToast);
        toast.error(err.response?.data?.message || 'Invalid or expired token');
      }
      return;
    }

    // 2. Handle Forgot Password Request
    if (isForgotPassword) {
      setIsSendingReset(true);
      const loadingToast = toast.loading('Sending reset link...');
      try {
        await axiosClient.post('/auth/forgot-password', { email: formData.email });
        toast.dismiss(loadingToast);
        toast.success('Reset link sent! Check your email.');
        setIsForgotPassword(false);
        setFormData({ ...formData, email: '' });
      } catch (err) {
        toast.dismiss(loadingToast);
        toast.error(err.response?.data?.message || 'Error sending email');
      } finally {
        setIsSendingReset(false);
      }
      return;
    }

    // 3. Handle Login / Register
    const loadingToast = toast.loading(isRegister ? 'Creating your account...' : 'Signing you in...');
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      // Do not send confirmPassword to the backend
      const payload = isRegister 
        ? { name: formData.name, email: formData.email, phone: formData.phone, password: formData.password } 
        : { email: formData.email, password: formData.password };
      
      const { data } = await axiosClient.post(endpoint, payload);

      const user = data.user || data; 
      const token = data.token;
      const userRole = (user.role || data.role || 'customer').toLowerCase();

      login(user, token);
      
      toast.dismiss(loadingToast);
      toast.success(isRegister ? 'Account created successfully!' : `Welcome back, ${user.name?.split(' ')[0] || 'there'}!`);

      const fromBooking = location.state?.from === '/booking';
      const serviceId = location.state?.serviceId;

      setTimeout(() => {
        if (fromBooking) {
          navigate('/booking', { state: { selectedServiceId: serviceId } });
        } else if (userRole === 'admin') {
          navigate('/admin');
        } else if (userRole === 'staff') {
          navigate('/staff');
        } else if (isRegister) {
          navigate('/dashboard');
        } else {
          navigate(location.state?.from || '/');
        }
      }, 100);

    } catch (err) {
      toast.dismiss(loadingToast);
      const errMsg = err.response?.data?.message || 'Authentication failed. Please check your credentials.';
      toast.error(errMsg);
    }
  };

  // Helper to toggle between views
  const toggleMode = (mode) => {
    setIsRegister(mode === 'register');
    setIsForgotPassword(mode === 'forgot');
    setResetToken(null);
    setFormData({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPasswordTouched(false); // 🚨 Reset touched state
  };

  // Determine titles based on current state
  let title = 'WELCOME BACK';
  let subtitle = 'Sign in to your account to continue';
  
  if (isRegister) {
    title = 'CREATE ACCOUNT';
    subtitle = 'Join Royal Service Center today';
  } else if (isForgotPassword) {
    title = 'RESET PASSWORD';
    subtitle = 'Enter your email to receive a reset link';
  } else if (resetToken) {
    title = 'NEW PASSWORD';
    subtitle = 'Enter your new secure password';
  }

  // UI SVGs for Eye Icons
  const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  const EyeSlashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4 md:p-6 font-sans text-zinc-50 selection:bg-red-600 selection:text-white relative overflow-hidden">

      {/* Ambient red glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-[400px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 animate-[fadeInUp_0.4s_ease-out]">

        <div className="flex justify-center mb-6 md:mb-8">
          <Link to="/" className="flex items-center gap-3 group cursor-pointer">
            <img 
              src="/logo.png" 
              alt="Royal Service Center Logo" 
              className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-2xl group-hover:scale-105 transition-transform duration-300" 
            />
          </Link>
        </div>

        <div className="bg-zinc-900 p-6 md:p-10 rounded-2xl border border-zinc-800 shadow-2xl">

          <h2 className="text-2xl md:text-3xl font-black text-center mb-2 text-white tracking-tight uppercase">
            {title}
          </h2>
          <p className="text-zinc-500 text-center mb-6 md:mb-8 text-xs md:text-sm tracking-wide font-medium">
            {subtitle}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
            
            {/* Registration Fields */}
            {isRegister && (
              <div className="space-y-4 md:space-y-5 animate-[fadeIn_0.3s_ease-out]">
                <input
                  type="text"
                  name="name"
                  placeholder="Full Name"
                  required
                  onChange={handleChange}
                  className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 md:p-4 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none placeholder:text-zinc-600 transition-colors text-sm md:text-base"
                />
                <input
                  type="tel"
                  name="phone"
                  placeholder="Phone Number"
                  required
                  onChange={handleChange}
                  className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 md:p-4 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none placeholder:text-zinc-600 transition-colors text-sm md:text-base"
                />
              </div>
            )}

            {/* Email Field (Hidden during password reset) */}
            {!resetToken && (
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                required
                onChange={handleChange}
                value={formData.email}
                className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 md:p-4 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none placeholder:text-zinc-600 transition-colors text-sm md:text-base"
              />
            )}

            {/* Password Field (Hidden during forgot password) */}
            {!isForgotPassword && (
              <>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder={resetToken ? "New Password" : "Password"}
                    required
                    onChange={handleChange}
                    onBlur={() => setPasswordTouched(true)}
                    value={formData.password}
                    pattern={(isRegister || resetToken) ? "(?=.*[A-Z])(?=.*\\d).{8,}" : undefined}
                    title={(isRegister || resetToken) ? "Min 8 characters, at least one uppercase letter and one number." : undefined}
                    className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 md:p-4 pr-12 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none placeholder:text-zinc-600 transition-colors text-sm md:text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                  </button>
                </div>

                {/* 🚨 Live password requirements checklist */}
                {(isRegister || resetToken) && (
                  <PasswordRequirements
                    password={formData.password}
                    show={passwordTouched || formData.password.length > 0}
                  />
                )}
              </>
            )}

            {/* Confirm Password Field (Only during Registration or Reset) */}
            {(isRegister || resetToken) && (
              <div className="relative animate-[fadeIn_0.3s_ease-out]">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  required
                  onChange={handleChange}
                  value={formData.confirmPassword}
                  className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 md:p-4 pr-12 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none placeholder:text-zinc-600 transition-colors text-sm md:text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isSendingReset}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 md:py-4 rounded-xl font-bold tracking-wider transition-all duration-300 mt-2 md:mt-4 shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:-translate-y-0.5 text-sm md:text-base disabled:opacity-50 disabled:hover:-translate-y-0"
            >
              {isSendingReset ? 'Sending...' : resetToken ? 'Reset Password' : isForgotPassword ? 'Send Reset Link' : isRegister ? 'Sign Up' : 'Sign In'}
            </button>
          </form>

          {/* Bottom Links */}
          <div className="mt-6 md:mt-8 text-center text-xs md:text-sm font-medium text-zinc-500 flex flex-col gap-3">
            
            {/* Forgot Password Link */}
            {!isRegister && !isForgotPassword && !resetToken && (
              <button
                type="button"
                onClick={() => toggleMode('forgot')}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                Forgot your password?
              </button>
            )}

            {/* Back to Login from Forgot/Reset */}
            {(isForgotPassword || resetToken) && (
              <button
                type="button"
                onClick={() => toggleMode('login')}
                className="text-zinc-400 hover:text-white transition-colors font-bold"
              >
                ← Back to Sign In
              </button>
            )}

            {/* Login/Register Toggle */}
            {!isForgotPassword && !resetToken && (
              <div className="mt-2 text-zinc-400">
                {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                <button
                  type="button"
                  onClick={() => toggleMode(isRegister ? 'login' : 'register')}
                  className="text-red-500 font-bold hover:text-red-400 transition-colors ml-1 hover:underline"
                >
                  {isRegister ? 'Sign In' : 'Sign Up'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-6 md:mt-8">
          <Link
            to="/"
            className="text-zinc-600 hover:text-red-500 text-[10px] md:text-xs font-bold uppercase tracking-widest transition-colors"
          >
            ← Return to Homepage
          </Link>
        </div>

      </div>
    </div>
  );
}