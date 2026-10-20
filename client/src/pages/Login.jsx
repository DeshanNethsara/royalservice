import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  
  // 🚨 State for password reset flow
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetToken, setResetToken] = useState(null);

  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' });
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
    
    // 1. Handle Password Reset
    if (resetToken) {
      const loadingToast = toast.loading('Resetting password...');
      try {
        await axiosClient.put(`/auth/reset-password/${resetToken}`, { password: formData.password });
        toast.dismiss(loadingToast);
        toast.success('Password reset successfully! You can now log in.');
        setResetToken(null);
        setFormData({ ...formData, password: '' });
      } catch (err) {
        toast.dismiss(loadingToast);
        toast.error(err.response?.data?.message || 'Invalid or expired token');
      }
      return;
    }

    // 2. Handle Forgot Password Request
    if (isForgotPassword) {
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
      }
      return;
    }

    // 3. Handle Login / Register
    const loadingToast = toast.loading(isRegister ? 'Creating your account...' : 'Authenticating credentials...');
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const payload = isRegister ? formData : { email: formData.email, password: formData.password };
      const { data } = await axiosClient.post(endpoint, payload);

      const user = data.user || data;
      const token = data.token;
      const userRole = (user.role || data.role || 'customer').toLowerCase();

      login(user, token);
      toast.dismiss(loadingToast);
      toast.success(isRegister ? 'Account registered successfully!' : `Welcome back, ${user.name || 'Commander'}!`);

      if (userRole === 'admin') navigate('/admin');
      else if (userRole === 'staff') navigate('/staff');
      else navigate('/dashboard');
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
    setFormData({ name: '', email: '', phone: '', password: '' });
  };

  // Determine titles based on current state
  let title = 'SECURE LOGIN';
  let subtitle = 'Enter your credentials to continue';
  
  if (isRegister) {
    title = 'INITIATE ACCESS';
    subtitle = 'Create your Royal Service account';
  } else if (isForgotPassword) {
    title = 'RESET ACCESS';
    subtitle = 'Enter your email to receive a reset link';
  } else if (resetToken) {
    title = 'NEW PASSWORD';
    subtitle = 'Enter your new secure password';
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-6 font-sans text-zinc-50 selection:bg-red-600 selection:text-white relative overflow-hidden">

      {/* Ambient red glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-[400px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 animate-[fadeInUp_0.4s_ease-out]">

        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-3 group cursor-pointer">
            <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/20 group-hover:shadow-red-600/40 transition-all duration-300 group-hover:-translate-y-1">
              <span className="text-white font-extrabold text-2xl tracking-tighter">R</span>
            </div>
          </Link>
        </div>

        <div className="bg-zinc-900 p-8 md:p-10 rounded-2xl border border-zinc-800 shadow-2xl">

          <h2 className="text-3xl font-black text-center mb-2 text-white tracking-tight uppercase">
            {title}
          </h2>
          <p className="text-zinc-500 text-center mb-8 text-sm uppercase tracking-widest font-semibold">
            {subtitle}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Registration Fields */}
            {isRegister && (
              <div className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                <input
                  type="text"
                  name="name"
                  placeholder="Full Name"
                  required
                  onChange={handleChange}
                  className="w-full bg-zinc-950 border border-zinc-800 text-white p-4 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none placeholder:text-zinc-600 transition-colors"
                />
                <input
                  type="tel"
                  name="phone"
                  placeholder="Phone Number"
                  required
                  onChange={handleChange}
                  className="w-full bg-zinc-950 border border-zinc-800 text-white p-4 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none placeholder:text-zinc-600 transition-colors"
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
                className="w-full bg-zinc-950 border border-zinc-800 text-white p-4 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none placeholder:text-zinc-600 transition-colors"
              />
            )}

            {/* Password Field (Hidden during forgot password) */}
            {!isForgotPassword && (
              <input
                type="password"
                name="password"
                placeholder={resetToken ? "New Password" : "Password"}
                required
                onChange={handleChange}
                value={formData.password}
                className="w-full bg-zinc-950 border border-zinc-800 text-white p-4 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none placeholder:text-zinc-600 transition-colors"
              />
            )}

            <button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-bold tracking-widest transition-all duration-300 mt-4 shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:-translate-y-0.5"
            >
              {resetToken ? 'RESET PASSWORD' : isForgotPassword ? 'SEND RESET LINK' : isRegister ? 'REGISTER NOW' : 'SIGN IN'}
            </button>
          </form>

          {/* Bottom Links */}
          <div className="mt-8 text-center text-sm font-medium text-zinc-500 flex flex-col gap-3">
            
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
                className="text-zinc-400 hover:text-white transition-colors"
              >
                ← Back to Login
              </button>
            )}

            {/* Login/Register Toggle */}
            {!isForgotPassword && !resetToken && (
              <div>
                {isRegister ? 'ALREADY AUTHORIZED? ' : 'REQUIRE ACCESS? '}
                <button
                  type="button"
                  onClick={() => toggleMode(isRegister ? 'login' : 'register')}
                  className="text-red-500 font-bold hover:text-red-400 transition-colors tracking-wider ml-1"
                >
                  {isRegister ? 'LOGIN' : 'REGISTER'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-8">
          <Link
            to="/"
            className="text-zinc-600 hover:text-red-500 text-xs font-bold uppercase tracking-widest transition-colors"
          >
            ← Return to Homepage
          </Link>
        </div>

      </div>
    </div>
  );
}