import axios from 'axios';

const axiosClient = axios.create({
  // Use environment variable for production, fallback to localhost for dev
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Request interceptor: attach auth token
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 Unauthorized
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 🚨 FIX: Only redirect if the user HAS a token (meaning the session expired).
    // If they don't have a token, it's a failed login attempt, so let the error pass through to the UI.
    const hasToken = localStorage.getItem('token');
    
    if (error.response && error.response.status === 401 && hasToken) {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default axiosClient;