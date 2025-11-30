const express = require('express');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const router = express.Router();

// Helper function to get start and end of day
const getDayBounds = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// @route   POST /api/attendance/checkin
// @desc    Employee check in
// @access  Private (Employee)
router.post('/checkin', protect, async (req, res) => {
  try {
    const today = new Date();
    const { start, end } = getDayBounds(today);

    // Check if already checked in today
    let attendance = await Attendance.findOne({
      userId: req.user._id,
      date: { $gte: start, $lte: end },
    });

    if (attendance && attendance.checkInTime) {
      return res.status(400).json({ message: 'Already checked in today' });
    }

    // Determine if late (after 9:30 AM)
    const checkInTime = new Date();
    const lateThreshold = new Date(today);
    lateThreshold.setHours(9, 30, 0, 0);

    let status = 'present';
    if (checkInTime > lateThreshold) {
      status = 'late';
    }

    if (attendance) {
      attendance.checkInTime = checkInTime;
      attendance.status = status;
      await attendance.save();
    } else {
      attendance = await Attendance.create({
        userId: req.user._id,
        date: today,
        checkInTime: checkInTime,
        status: status,
      });
    }

    // Trigger badge evaluation (async, don't wait)
    setImmediate(async () => {
      try {
        const badgeRoutes = require('./badges');
        if (badgeRoutes.evaluateBadges) {
          await badgeRoutes.evaluateBadges(req.user._id);
        }
      } catch (error) {
        console.error('Badge evaluation error:', error);
      }
    });

    res.json({
      message: 'Checked in successfully',
      attendance: {
        id: attendance._id,
        date: attendance.date,
        checkInTime: attendance.checkInTime,
        status: attendance.status,
      },
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/attendance/checkout
// @desc    Employee check out
// @access  Private (Employee)
router.post('/checkout', protect, async (req, res) => {
  try {
    const today = new Date();
    const { start, end } = getDayBounds(today);

    const attendance = await Attendance.findOne({
      userId: req.user._id,
      date: { $gte: start, $lte: end },
    });

    if (!attendance || !attendance.checkInTime) {
      return res.status(400).json({ message: 'Please check in first' });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({ message: 'Already checked out today' });
    }

    const checkOutTime = new Date();
    attendance.checkOutTime = checkOutTime;

    // Check if half-day (less than 4 hours)
    const hoursWorked = (checkOutTime - attendance.checkInTime) / (1000 * 60 * 60);
    if (hoursWorked < 4 && attendance.status !== 'late') {
      attendance.status = 'half-day';
    }

    await attendance.save();

    // Trigger badge evaluation (async, don't wait)
    setImmediate(async () => {
      try {
        const badgeRoutes = require('./badges');
        if (badgeRoutes.evaluateBadges) {
          await badgeRoutes.evaluateBadges(req.user._id);
        }
      } catch (error) {
        console.error('Badge evaluation error:', error);
      }
    });

    res.json({
      message: 'Checked out successfully',
      attendance: {
        id: attendance._id,
        date: attendance.date,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        totalHours: attendance.totalHours,
        status: attendance.status,
      },
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/attendance/today
// @desc    Get today's attendance status
// @access  Private (Employee)
router.get('/today', protect, async (req, res) => {
  try {
    const today = new Date();
    const { start, end } = getDayBounds(today);

    const attendance = await Attendance.findOne({
      userId: req.user._id,
      date: { $gte: start, $lte: end },
    });

    res.json({
      attendance: attendance || null,
      canCheckIn: !attendance || !attendance.checkInTime,
      canCheckOut: attendance && attendance.checkInTime && !attendance.checkOutTime,
    });
  } catch (error) {
    console.error('Get today error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/attendance/my-history
// @desc    Get employee's attendance history
// @access  Private (Employee)
router.get('/my-history', protect, async (req, res) => {
  try {
    const { month, year } = req.query;
    const query = { userId: req.user._id };

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(query)
      .sort({ date: -1 })
      .limit(100);

    res.json({ attendance });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/attendance/my-summary
// @desc    Get employee's monthly summary
// @access  Private (Employee)
router.get('/my-summary', protect, async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentMonth = month || new Date().getMonth() + 1;
    const currentYear = year || new Date().getFullYear();

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    const attendance = await Attendance.find({
      userId: req.user._id,
      date: { $gte: startDate, $lte: endDate },
    });

    const summary = {
      present: attendance.filter((a) => a.status === 'present').length,
      absent: attendance.filter((a) => a.status === 'absent').length,
      late: attendance.filter((a) => a.status === 'late').length,
      halfDay: attendance.filter((a) => a.status === 'half-day').length,
      totalHours: attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0),
      totalDays: attendance.length,
    };

    res.json({ summary, month: currentMonth, year: currentYear });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/attendance/all
// @desc    Get all employees attendance (Manager)
// @access  Private (Manager)
router.get('/all', protect, authorize('manager'), async (req, res) => {
  try {
    const { startDate, endDate, employeeId, status, department } = req.query;
    const query = {};

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (employeeId) {
      const user = await User.findOne({ employeeId });
      if (user) {
        query.userId = user._id;
      } else {
        return res.json({ attendance: [] });
      }
    }

    if (status) {
      query.status = status;
    }

    let userIds = [];
    if (department) {
      const users = await User.find({ department });
      userIds = users.map((u) => u._id);
      if (userIds.length === 0) {
        return res.json({ attendance: [] });
      }
      query.userId = { $in: userIds };
    }

    const attendance = await Attendance.find(query)
      .populate('userId', 'name email employeeId department')
      .sort({ date: -1 })
      .limit(500);

    res.json({ attendance });
  } catch (error) {
    console.error('Get all attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/attendance/employee/:id
// @desc    Get specific employee attendance (Manager)
// @access  Private (Manager)
router.get('/employee/:id', protect, authorize('manager'), async (req, res) => {
  try {
    const { month, year } = req.query;
    const query = { userId: req.params.id };

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(query)
      .populate('userId', 'name email employeeId department')
      .sort({ date: -1 });

    res.json({ attendance });
  } catch (error) {
    console.error('Get employee attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/attendance/summary
// @desc    Get team attendance summary (Manager)
// @access  Private (Manager)
router.get('/summary', protect, authorize('manager'), async (req, res) => {
  try {
    const { month, year, department } = req.query;
    const currentMonth = month || new Date().getMonth() + 1;
    const currentYear = year || new Date().getFullYear();

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    let userIds = [];
    if (department) {
      const users = await User.find({ department });
      userIds = users.map((u) => u._id);
    } else {
      const users = await User.find({ role: 'employee' });
      userIds = users.map((u) => u._id);
    }

    const attendance = await Attendance.find({
      userId: { $in: userIds },
      date: { $gte: startDate, $lte: endDate },
    }).populate('userId', 'name employeeId department');

    const summary = {
      totalEmployees: userIds.length,
      present: attendance.filter((a) => a.status === 'present').length,
      absent: attendance.filter((a) => a.status === 'absent').length,
      late: attendance.filter((a) => a.status === 'late').length,
      halfDay: attendance.filter((a) => a.status === 'half-day').length,
      totalHours: attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0),
      attendance,
    };

    res.json({ summary, month: currentMonth, year: currentYear });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/attendance/today-status
// @desc    Get today's attendance status for all employees (Manager)
// @access  Private (Manager)
router.get('/today-status', protect, authorize('manager'), async (req, res) => {
  try {
    const today = new Date();
    const { start, end } = getDayBounds(today);

    const attendance = await Attendance.find({
      date: { $gte: start, $lte: end },
    }).populate('userId', 'name email employeeId department role');

    const allEmployees = await User.find({ role: 'employee' });

    const present = attendance.filter((a) => a.status === 'present' || a.status === 'late');
    const absent = allEmployees.filter(
      (emp) => !attendance.find((a) => a.userId._id.toString() === emp._id.toString())
    );
    const late = attendance.filter((a) => a.status === 'late');

    res.json({
      totalEmployees: allEmployees.length,
      present: present.length,
      absent: absent.length,
      late: late.length,
      attendance,
      absentList: absent.map((emp) => ({
        id: emp._id,
        name: emp.name,
        email: emp.email,
        employeeId: emp.employeeId,
        department: emp.department,
      })),
    });
  } catch (error) {
    console.error('Get today status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/attendance/export
// @desc    Export attendance to CSV (Manager)
// @access  Private (Manager)
router.get('/export', protect, authorize('manager'), async (req, res) => {
  try {
    const { startDate, endDate, employeeId, department } = req.query;
    const query = {};

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (employeeId) {
      const user = await User.findOne({ employeeId });
      if (user) {
        query.userId = user._id;
      }
    }

    let userIds = [];
    if (department) {
      const users = await User.find({ department });
      userIds = users.map((u) => u._id);
      query.userId = { $in: userIds };
    }

    const attendance = await Attendance.find(query)
      .populate('userId', 'name email employeeId department')
      .sort({ date: -1 });

    const csvData = attendance.map((a) => ({
      date: a.date.toISOString().split('T')[0],
      employeeId: a.userId.employeeId,
      name: a.userId.name,
      email: a.userId.email,
      department: a.userId.department,
      checkInTime: a.checkInTime ? a.checkInTime.toISOString() : 'N/A',
      checkOutTime: a.checkOutTime ? a.checkOutTime.toISOString() : 'N/A',
      status: a.status,
      totalHours: a.totalHours || 0,
    }));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance-report.csv');

    // CSV Header
    const header = 'Date,Employee ID,Name,Email,Department,Check In,Check Out,Status,Total Hours\n';
    const rows = csvData
      .map(
        (row) =>
          `${row.date},${row.employeeId},${row.name},${row.email},${row.department},${row.checkInTime},${row.checkOutTime},${row.status},${row.totalHours}`
      )
      .join('\n');

    res.send(header + rows);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

