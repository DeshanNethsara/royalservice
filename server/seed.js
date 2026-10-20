import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import "dotenv/config";
import connectDB from './configs/db.js';
import User from './models/User.js';
import Service from './models/Service.js';

await connectDB();

const seedData = async () => {
  try {
    await User.deleteMany();
    await Service.deleteMany();

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin@123', salt);

    const admin = await User.create({
      name: 'System Admin',
      email: 'admin@royal.com',
      phone: '0712345678',
      password: hashedPassword,
      role: 'admin',
      status: 1
    });

    await Service.insertMany([
      { name: 'Full Service', price: 15000.00, description: 'Complete diagnostics and maintenance.', duration_minutes: 180, is_active: true },
      { name: 'Engine Tune-up', price: 8500.00, description: 'Spark plug replacement and tuning.', duration_minutes: 90, is_active: true },
      { name: 'Oil & Filter Change', price: 4500.00, description: 'Standard oil and filter replacement.', duration_minutes: 45, is_active: true },
      { name: 'Brake Inspection', price: 6000.00, description: 'Brake pad replacement and bleeding.', duration_minutes: 60, is_active: true }
    ]);

    console.log('Database seeded successfully! Admin email: admin@royal.com | Password: Admin@123');
    process.exit();
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedData();