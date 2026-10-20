import User from '../models/User.js';
import bcrypt from 'bcrypt';

// @desc    Get all users (with optional role/status filtering)
// @route   GET /api/users
// @access  Private/Admin
export const getAllUsers = async (req, res) => {
  try {
    const { role, status } = req.query;
    let query = {};

    if (role) query.role = role;
    if (status) query.status = Number(status);

    const users = await User.find(query).select('-password').sort({ created_at: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get a single user by ID
// @route   GET /api/users/:id
// @access  Private (own profile) / Admin (any)
export const getUserById = async (req, res) => {
  try {
    // Security: Users can only view their own profile (unless admin)
    if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this profile' });
    }

    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      avatar: user.avatar || '',
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user status (Suspend/Reactivate)
// @route   PATCH /api/users/:id/status
// @access  Private/Admin
export const updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body; // Expects 1 (Active) or 0 (Suspended)
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admin from suspending themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot change your own account status' });
    }

    user.status = status;
    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      status: updatedUser.status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new staff account
// @route   POST /api/users/staff
// @access  Private/Admin
export const createStaffAccount = async (req, res) => {
  const { name, email, phone, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const staffUser = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'staff',
      status: 1,
    });

    res.status(201).json({
      _id: staffUser._id,
      name: staffUser.name,
      email: staffUser.email,
      role: staffUser.role,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/:id
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    // Security check: Users can only update their own profile (unless admin)
    if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this profile' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update allowable fields
    user.name = req.body.name || user.name;
    user.phone = req.body.phone || user.phone;

    // Explicitly check for avatar (so users can clear it with an empty string if needed)
    if (req.body.avatar !== undefined) {
      user.avatar = req.body.avatar;
    }

    const updatedUser = await user.save();

    // Return updated user without password, ensuring avatar is sent back
    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      role: updatedUser.role,
      avatar: updatedUser.avatar,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};