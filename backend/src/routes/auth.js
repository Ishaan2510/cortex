const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many attempts, try again later' },
});

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const cookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
};

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(409).json({ message: 'Email already in use' });

    const user = await User.create({ email, password });
    const token = signToken(user._id);
    res.cookie('cortex_session', token, cookieOptions());
    res.status(201).json({ token, user: { id: user._id, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken(user._id);
    res.cookie('cortex_session', token, cookieOptions());
    res.json({ token, user: { id: user._id, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('cortex_session', { ...cookieOptions(), maxAge: undefined });
  res.json({ message: 'Logged out' });
});

/**
 * Refresh the session cookie from a Bearer token.
 *
 * Existing users who logged in before cookie auth shipped have JWT in
 * localStorage but no session cookie. The frontend calls this endpoint
 * once on app mount; protect middleware validates the Bearer header and
 * we re-issue the cookie. Idempotent — safe to call repeatedly.
 */
router.post('/refresh-cookie', protect, (req, res) => {
  const token = signToken(req.user.id);
  res.cookie('cortex_session', token, cookieOptions());
  res.json({ message: 'Cookie refreshed' });
});

module.exports = router;