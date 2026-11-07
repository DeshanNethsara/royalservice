import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import sendEmail from '../utils/sendEmail.js';

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// 🚨 NEW: Password validation helper
const validatePassword = (password) => {
  // Minimum 8 chars, at least 1 uppercase, at least 1 number
  const regex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
  return regex.test(password);
};

export const register = async (req, res) => {
  const { name, email, phone, password } = req.body;

  // 🚨 NEW: Validate password strength
  if (!validatePassword(password)) {
    return res.status(400).json({ 
      message: 'Password must be at least 8 characters long, contain at least one uppercase letter, and at least one number.' 
    });
  }

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

    // 1. Check if account is suspended
    if (user && user.status === 0) {
      return res.status(403).json({ message: 'Account is suspended. Contact administrator.' });
    }

    // 2. 🚨 CHECK IF ACCOUNT IS LOCKED
    if (user && user.lockUntil && user.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(403).json({ 
        message: `Account is temporarily locked due to multiple failed attempts. Please try again in ${minutesLeft} minute(s).` 
      });
    }

    // 3. Check if user exists AND password matches
    if (!user || !(await bcrypt.compare(password, user.password))) {
      
      // 🚨 IF USER EXISTS BUT PASSWORD IS WRONG -> INCREMENT ATTEMPTS
      if (user) {
        user.loginAttempts = (user.loginAttempts || 0) + 1;
        let lockMessage = 'Invalid email or password. Please try again.';

        // 🚨 APPLY LOCKOUT LOGIC
        if (user.loginAttempts >= 10) {
          // Second threshold (5 fails + 5 fails) -> Lock for 30 mins
          user.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
          user.loginAttempts = 0; // Reset counter for the next cycle
          lockMessage = 'Too many failed attempts. Account locked for 30 minutes.';
        } else if (user.loginAttempts >= 5) {
          // First threshold -> Lock for 2 mins
          user.lockUntil = Date.now() + 2 * 60 * 1000; // 2 minutes
          lockMessage = 'Too many failed attempts. Account locked for 2 minutes.';
        }

        await user.save();
        return res.status(401).json({ message: lockMessage });
      }

      // If user doesn't exist, just return generic error
      return res.status(401).json({ 
        message: 'Invalid email or password. Please try again.' 
      });
    }

    // 4. Success - Reset login attempts, lockout, and password reset backoff
    let needsSave = false;
    
    if (user.loginAttempts > 0 || user.lockUntil) {
      user.loginAttempts = 0;
      user.lockUntil = null;
      needsSave = true;
    }
    
    if (user.resetPasswordAttempts > 0) {
      user.resetPasswordLastSent = null;
      user.resetPasswordAttempts = 0;
      needsSave = true;
    }

    if (needsSave) {
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

    const now = new Date();
    const lastSent = user.resetPasswordLastSent;
    const attempts = user.resetPasswordAttempts || 0;

    if (lastSent) {
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

    const resetToken = crypto.randomBytes(20).toString('hex');

    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    
    user.resetPasswordLastSent = now;
    user.resetPasswordAttempts = attempts + 1;

    await user.save();

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
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      user.resetPasswordLastSent = undefined; 
      user.resetPasswordAttempts = Math.max(0, attempts - 1); 
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
    const { password } = req.body;

    // 🚨 NEW: Validate new password strength
    if (!validatePassword(password)) {
      return res.status(400).json({ 
        message: 'Password must be at least 8 characters long, contain at least one uppercase letter, and at least one number.' 
      });
    }

    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    user.resetPasswordLastSent = null;
    user.resetPasswordAttempts = 0;

    // Also reset login attempts since they are resetting their password
    user.loginAttempts = 0;
    user.lockUntil = null;
    
    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};