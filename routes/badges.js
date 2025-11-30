const express = require('express');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Badge definitions
const BADGES = {
  'on-time-streak-5': {
    name: 'On-Time Streak 5 Days',
    description: 'Maintain 5 consecutive days of on-time attendance',
    icon: '🏆',
  },
  'perfect-month': {
    name: 'Perfect Month',
    description: 'Perfect attendance for an entire month',
    icon: '⭐',
  },
  'early-bird': {
    name: 'Early Bird',
    description: 'Check in before 9:00 AM for 10 days',
    icon: '🐦',
  },
  'champion-punctuality': {
    name: 'Champion of Punctuality',
    description: 'No late arrivals for 30 consecutive days',
    icon: '👑',
  },
};

// Helper function to evaluate badges
const evaluateBadges = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user || user.role !== 'employee') return;

    const earnedBadges = [...(user.badges || [])];
    let streakUpdated = false;

    // Get last 30 days of attendance
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const attendance = await Attendance.find({
      userId,
      date: { $gte: thirtyDaysAgo },
    }).sort({ date: 1 });

    // Calculate current streak (consecutive on-time days)
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = attendance.length - 1; i >= 0; i--) {
      const record = attendance[i];
      const recordDate = new Date(record.date);
      recordDate.setHours(0, 0, 0, 0);

      // Check if this is today or yesterday
      const daysDiff = Math.floor((today - recordDate) / (1000 * 60 * 60 * 24));
      if (daysDiff > 1) break; // Gap in attendance

      if (record.status === 'present' || record.status === 'late') {
        if (record.status === 'present') {
          currentStreak++;
        } else {
          break; // Late breaks the streak
        }
      } else {
        break; // Absent breaks the streak
      }
    }

    // Update streak if changed
    if (user.currentStreak !== currentStreak) {
      user.currentStreak = currentStreak;
      if (currentStreak > user.longestStreak) {
        user.longestStreak = currentStreak;
      }
      streakUpdated = true;
    }

    // Check for "On-Time Streak 5 Days" badge
    if (currentStreak >= 5 && !earnedBadges.includes('on-time-streak-5')) {
      earnedBadges.push('on-time-streak-5');
    }

    // Check for "Perfect Month" badge
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    const monthAttendance = attendance.filter((a) => {
      const aDate = new Date(a.date);
      return aDate >= monthStart && aDate <= monthEnd;
    });

    const workingDays = monthAttendance.filter((a) => a.status === 'present').length;
    const totalDays = monthAttendance.length;
    if (workingDays === totalDays && totalDays >= 20 && !earnedBadges.includes('perfect-month')) {
      earnedBadges.push('perfect-month');
    }

    // Check for "Early Bird" badge
    const earlyCheckIns = attendance.filter((a) => {
      if (!a.checkInTime) return false;
      const checkIn = new Date(a.checkInTime);
      return checkIn.getHours() < 9;
    }).length;

    if (earlyCheckIns >= 10 && !earnedBadges.includes('early-bird')) {
      earnedBadges.push('early-bird');
    }

    // Check for "Champion of Punctuality" badge
    const last30Days = attendance.filter((a) => {
      const aDate = new Date(a.date);
      return aDate >= thirtyDaysAgo;
    });

    const hasNoLate = last30Days.every((a) => a.status !== 'late');
    if (hasNoLate && last30Days.length >= 20 && !earnedBadges.includes('champion-punctuality')) {
      earnedBadges.push('champion-punctuality');
    }

    // Update user badges and streak
    user.badges = earnedBadges;
    await user.save();

    return { badges: earnedBadges, currentStreak, longestStreak: user.longestStreak };
  } catch (error) {
    console.error('Badge evaluation error:', error);
    throw error;
  }
};

// @route   GET /api/badges/me
// @desc    Get user's badges
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('badges currentStreak longestStreak');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const badgeDetails = (user.badges || []).map((badgeId) => ({
      id: badgeId,
      ...BADGES[badgeId],
    }));

    res.json({
      badges: badgeDetails,
      currentStreak: user.currentStreak || 0,
      longestStreak: user.longestStreak || 0,
      allBadges: BADGES,
    });
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/badges/evaluate
// @desc    Evaluate and award badges
// @access  Private
router.post('/evaluate', protect, async (req, res) => {
  try {
    const result = await evaluateBadges(req.user._id);
    res.json({
      message: 'Badges evaluated',
      ...result,
    });
  } catch (error) {
    console.error('Evaluate badges error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Export evaluateBadges for use in other routes
module.exports = router;
module.exports.evaluateBadges = evaluateBadges;
