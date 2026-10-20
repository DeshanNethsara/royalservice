import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ name: '', phone: '', avatar: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [avatarPreview, setAvatarPreview] = useState(null);
  
  // 🚨 NEW: Guard to prevent fetching and resetting data on every keystroke
  const hasFetchedRef = useRef(false);

  // Fetch fresh user data on mount
  useEffect(() => {
    const fetchFreshUser = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      // If we already fetched the data once, don't fetch it again (prevents input reverting)
      if (hasFetchedRef.current) return;
      hasFetchedRef.current = true;

      const userId = user._id || user.id;

      try {
        const response = await axiosClient.get(`/users/${userId}`);
        const freshUser = response.data?.user || response.data;

        setFormData({
          name: freshUser.name || '',
          phone: freshUser.phone || '',
          avatar: freshUser.avatar || '',
        });
        setAvatarPreview(freshUser.avatar || null);

        // Update context with fresh data
        const token = localStorage.getItem('token');
        if (login && token) {
          login(freshUser, token);
        }
      } catch (error) {
        console.warn('Could not fetch fresh user data, using cached:', error.message);
        // Fallback to cached user
        setFormData({
          name: user.name || '',
          phone: user.phone || '',
          avatar: user.avatar || '',
        });
        setAvatarPreview(user.avatar || null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFreshUser();
  }, [user, navigate, login]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please select a valid image (JPEG, PNG, WebP, GIF)');
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image too large. Max 2MB.');
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        setFormData({ ...formData, avatar: reader.result });
        setAvatarPreview(reader.result);
      };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.phone && !/^[0-9+\-\s()]{10,15}$/.test(formData.phone)) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('Updating profile...');

    try {
      const userId = user._id || user.id;
      const response = await axiosClient.put(`/users/${userId}`, formData);

      const updatedUser = response.data?.user || response.data;
      const token = localStorage.getItem('token');
      if (login && token) {
        login(updatedUser, token);
      }

      toast.dismiss(loadingToast);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error.response?.data?.message || 'Error updating profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center font-sans text-zinc-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 md:p-6 font-sans text-zinc-50 relative overflow-hidden">

      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md h-[300px] bg-red-600/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 animate-[fadeInUp_0.4s_ease-out]">

        {/* Header */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center shadow-lg shadow-red-600/20 group-hover:shadow-red-600/40 transition-all">
              <span className="text-white font-extrabold text-xl">R</span>
            </div>
          </Link>
        </div>

        <div className="bg-zinc-900 p-6 md:p-8 rounded-2xl border border-zinc-800 shadow-2xl">
          <h2 className="text-2xl font-black text-center mb-1 text-white tracking-tight uppercase">
            OPERATOR PROFILE
          </h2>
          <p className="text-zinc-500 text-center mb-5 text-xs uppercase tracking-widest font-semibold">
            Update your details
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Avatar Section */}
            <div className="flex justify-center mb-4">
              <div
                className="relative w-20 h-20 rounded-full border-2 border-zinc-800 overflow-hidden bg-zinc-950 flex items-center justify-center cursor-pointer group shrink-0 transition-all hover:border-red-600/60"
                onClick={() => document.getElementById('avatar-upload').click()}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-10 h-10 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-bold text-white">UPLOAD</span>
                </div>
              </div>

              <input
                id="avatar-upload"
                type="file"
                accept="image/jpeg, image/png, image/webp, image/gif"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>

            {/* Email - Read Only */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full bg-zinc-950/60 border border-zinc-800 text-zinc-500 p-3 rounded-lg cursor-not-allowed text-sm"
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Enter your name"
                className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 rounded-lg focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none transition-colors placeholder:text-zinc-600 text-sm"
              />
            </div>

            {/* Phone - Now shows current phone */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                Contact Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                placeholder="+94 XX XXX XXXX"
                className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 rounded-lg focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none transition-colors placeholder:text-zinc-600 text-sm"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="w-1/3 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-lg font-bold text-sm tracking-wide transition-all"
              >
                BACK
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-2/3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-3 rounded-lg font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    UPDATING...
                  </>
                ) : (
                  'SAVE CHANGES'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-4">
          <Link
            to="/"
            className="text-zinc-600 hover:text-red-500 text-xs font-bold uppercase tracking-widest transition-colors"
          >
            ← Back to Home
          </Link>
        </div>

      </div>
    </div>
  );
}