const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'profile-' + req.user._id + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter,
});

// @route   GET /api/profile/me
// @desc    Get user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get attendance statistics
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    const attendance = await Attendance.find({
      userId: req.user._id,
      date: { $gte: monthStart, $lte: monthEnd },
    });

    const stats = {
      totalHours: attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0),
      present: attendance.filter((a) => a.status === 'present').length,
      late: attendance.filter((a) => a.status === 'late').length,
      absent: attendance.filter((a) => a.status === 'absent').length,
      halfDay: attendance.filter((a) => a.status === 'half-day').length,
      perfectDays: attendance.filter((a) => a.status === 'present').length,
    };

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        employeeId: user.employeeId,
        role: user.role,
        department: user.department,
        profilePicture: user.profilePicture,
        themePreference: user.themePreference,
        badges: user.badges || [],
        currentStreak: user.currentStreak || 0,
        longestStreak: user.longestStreak || 0,
      },
      stats,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/profile/me
// @desc    Update user profile
// @access  Private
router.put('/me', protect, upload.single('profilePicture'), async (req, res) => {
  try {
    const { name, department, themePreference } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    if (name) user.name = name;
    if (department) user.department = department;
    if (themePreference && ['light', 'dark'].includes(themePreference)) {
      user.themePreference = themePreference;
    }

    // Handle profile picture upload
    if (req.file) {
      // Delete old profile picture if exists
      if (user.profilePicture) {
        const oldPath = path.join(uploadsDir, path.basename(user.profilePicture));
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      // Save new profile picture path
      user.profilePicture = `/api/uploads/${req.file.filename}`;
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        employeeId: user.employeeId,
        role: user.role,
        department: user.department,
        profilePicture: user.profilePicture,
        themePreference: user.themePreference,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/profile/theme
// @desc    Update theme preference
// @access  Private
router.put('/theme', protect, async (req, res) => {
  try {
    const { themePreference } = req.body;

    if (!themePreference || !['light', 'dark'].includes(themePreference)) {
      return res.status(400).json({ message: 'Invalid theme preference' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.themePreference = themePreference;
    await user.save();

    res.json({
      message: 'Theme preference updated',
      themePreference: user.themePreference,
    });
  } catch (error) {
    console.error('Update theme error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
