import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import sendEmail from '../utils/sendEmail.js';

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

export const register = async (req, res) => {
  const { name, email, phone, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'customer',
      status: 1,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar || null,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    // 1. Check if account is suspended (if user exists)
    if (user && user.status === 0) {
      return res.status(403).json({ message: 'Account is suspended. Contact administrator.' });
    }

    // 2. Check if user exists AND password matches
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ 
        message: 'Invalid email or password. Please try again.' 
      });
    }

    // 3. Success - Reset any password reset backoff tracking
    if (user.resetPasswordAttempts > 0) {
      user.resetPasswordLastSent = null;
      user.resetPasswordAttempts = 0;
      await user.save();
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar || null,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================================================
// PASSWORD RESET FUNCTIONS
// ==========================================================

// 1. Request Password Reset
export const forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ message: 'There is no user with that email' });
    }

    // ==========================================================
    // 🚨 EXPONENTIAL BACKOFF LOGIC
    // ==========================================================
    const now = new Date();
    const lastSent = user.resetPasswordLastSent;
    const attempts = user.resetPasswordAttempts || 0;

    if (lastSent) {
      // Calculate the wait time in milliseconds.
      // 1st retry: 1 min (60,000ms)
      // 2nd retry: 5 min (300,000ms)
      // 3rd retry: 10 min (600,000ms)
      // 4th+ retry: 15 min (900,000ms)
      let waitTimeMs = 60000;
      if (attempts === 1) waitTimeMs = 5 * 60000;
      else if (attempts === 2) waitTimeMs = 10 * 60000;
      else if (attempts >= 3) waitTimeMs = 15 * 60000;

      const timeElapsed = now - lastSent;

      if (timeElapsed < waitTimeMs) {
        const secondsLeft = Math.ceil((waitTimeMs - timeElapsed) / 1000);
        const minutesLeft = Math.ceil(secondsLeft / 60);
        
        return res.status(429).json({ 
          message: `Please wait ${minutesLeft} minute(s) before requesting another reset email.` 
        });
      }
    }

    // Generate a random token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to resetPasswordToken field
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set expire time (10 minutes)
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    
    // 🚨 Save the tracking data
    user.resetPasswordLastSent = now;
    user.resetPasswordAttempts = attempts + 1;

    await user.save();

    // Point to /login?resetToken=... so the Login page can handle it
    const resetUrl = `${process.env.CLIENT_URL}/login?resetToken=${resetToken}`;

    const message = `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset. Please click the link below to reset your password:</p>
      <a href="${resetUrl}" style="background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Reset Password</a>
      <p>If you did not request this, please ignore this email. This link expires in 10 minutes.</p>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset - Royal Service Center',
        html: message,
      });
      res.status(200).json({ message: 'Email sent successfully' });
    } catch (err) {
      // If email fails, clear the token so they can try again without waiting
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      user.resetPasswordLastSent = undefined; // Reset the cooldown
      user.resetPasswordAttempts = Math.max(0, attempts - 1); // Undo the attempt count
      await user.save();
      
      console.error('Email sending error:', err);
      return res.status(500).json({ message: 'Email could not be sent' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Reset Password using Token
export const resetPassword = async (req, res) => {
  try {
    // Get hashed token from URL
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }, // Check it hasn't expired
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Set new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);
    
    // Clear the reset token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    // 🚨 Reset the backoff tracking on success
    user.resetPasswordLastSent = null;
    user.resetPasswordAttempts = 0;
    
    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};