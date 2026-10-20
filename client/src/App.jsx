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
// 1. Add this import line:
import Chat from './pages/Chat'; 

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster /* ... toast settings remain unchanged ... */ />

        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/booking" element={<BookingFlow />} />
          <Route path="/dashboard" element={<CustomerDashboard />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/staff" element={<StaffDashboard />} />
          <Route path="/profile" element={<Profile />} />
          
          {/* 2. Add this route line: */}
          <Route path="/chat" element={<Chat />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}