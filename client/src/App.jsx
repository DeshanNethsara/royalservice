import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';

import Homepage from './pages/Homepage';
import Login from './pages/Login';
import BookingFlow from './pages/BookingFlow';
import CustomerDashboard from './pages/CustomerDashboard';
import AdminPanel from './pages/AdminPanel';
import StaffDashboard from './pages/StaffDashboard';
import Profile from './pages/Profile';
import Chat from './pages/Chat'; 

// 🚨 Optional: Import ChatWidget here if you want it on every page
import ChatWidget from './components/ChatWidget';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster />

        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/booking" element={<BookingFlow />} />
          <Route path="/dashboard" element={<CustomerDashboard />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/staff" element={<StaffDashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/chat" element={<Chat />} />
        </Routes>

        {/* 🚨 Place it here, outside Routes but inside BrowserRouter, so it floats globally! */}
        {/* <ChatWidget /> */}
        
      </BrowserRouter>
    </AuthProvider>
  );
}