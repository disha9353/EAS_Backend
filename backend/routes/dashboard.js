const express = require('express');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Helper function to get start and end of day
const getDayBounds = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// @route   GET /api/dashboard/employee
// @desc    Get employee dashboard data
// @access  Private (Employee)
router.get('/employee', protect, async (req, res) => {
  try {
    const today = new Date();
    const { start, end } = getDayBounds(today);

    // Today's attendance
    const todayAttendance = await Attendance.findOne({
      userId: req.user._id,
      date: { $gte: start, $lte: end },
    });

    // Current month summary
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    const monthAttendance = await Attendance.find({
      userId: req.user._id,
      date: { $gte: monthStart, $lte: monthEnd },
    });

    const monthlyStats = {
      present: monthAttendance.filter((a) => a.status === 'present').length,
      absent: monthAttendance.filter((a) => a.status === 'absent').length,
      late: monthAttendance.filter((a) => a.status === 'late').length,
      halfDay: monthAttendance.filter((a) => a.status === 'half-day').length,
      totalHours: monthAttendance.reduce((sum, a) => sum + (a.totalHours || 0), 0),
    };

    // Last 7 days
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const last7Days = await Attendance.find({
      userId: req.user._id,
      date: { $gte: sevenDaysAgo, $lte: end },
    }).sort({ date: -1 });

    res.json({
      todayStatus: todayAttendance
        ? {
            status: todayAttendance.status,
            checkInTime: todayAttendance.checkInTime,
            checkOutTime: todayAttendance.checkOutTime,
            totalHours: todayAttendance.totalHours,
          }
        : null,
      monthlyStats,
      last7Days: last7Days.map((a) => ({
        date: a.date,
        status: a.status,
        checkInTime: a.checkInTime,
        checkOutTime: a.checkOutTime,
        totalHours: a.totalHours,
      })),
    });
  } catch (error) {
    console.error('Employee dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/dashboard/manager
// @desc    Get manager dashboard data
// @access  Private (Manager)
router.get('/manager', protect, authorize('manager'), async (req, res) => {
  try {
    const today = new Date();
    const { start, end } = getDayBounds(today);

    // Total employees
    const totalEmployees = await User.countDocuments({ role: 'employee' });

    // Today's attendance
    const todayAttendance = await Attendance.find({
      date: { $gte: start, $lte: end },
    }).populate('userId', 'name employeeId department');

    const allEmployees = await User.find({ role: 'employee' });
    const presentToday = todayAttendance.filter(
      (a) => a.status === 'present' || a.status === 'late'
    ).length;
    const lateToday = todayAttendance.filter((a) => a.status === 'late').length;
    const absentToday = allEmployees.length - presentToday;

    const absentList = allEmployees
      .filter(
        (emp) =>
          !todayAttendance.find(
            (a) => a.userId && a.userId._id.toString() === emp._id.toString()
          )
      )
      .map((emp) => ({
        id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        department: emp.department,
      }));

    // Current month summary
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    const monthAttendance = await Attendance.find({
      date: { $gte: monthStart, $lte: monthEnd },
    }).populate('userId', 'department');

    // Department-wise stats
    const departments = await User.distinct('department');
    const departmentStats = departments.map((dept) => {
      const deptUsers = allEmployees.filter((u) => u.department === dept);
      const deptAttendance = monthAttendance.filter(
        (a) => a.userId && a.userId.department === dept
      );
      return {
        department: dept,
        totalEmployees: deptUsers.length,
        present: deptAttendance.filter((a) => a.status === 'present').length,
        late: deptAttendance.filter((a) => a.status === 'late').length,
        absent: deptAttendance.filter((a) => a.status === 'absent').length,
      };
    });

    // Weekly trend (last 7 days)
    const weeklyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayBounds = getDayBounds(date);
      const dayAttendance = await Attendance.find({
        date: { $gte: dayBounds.start, $lte: dayBounds.end },
      });
      weeklyTrend.push({
        date: date.toISOString().split('T')[0],
        present: dayAttendance.filter((a) => a.status === 'present' || a.status === 'late')
          .length,
        absent: allEmployees.length - dayAttendance.filter((a) => a.status === 'present' || a.status === 'late').length,
      });
    }

    res.json({
      totalEmployees,
      todayStats: {
        present: presentToday,
        absent: absentToday,
        late: lateToday,
      },
      absentList,
      departmentStats,
      weeklyTrend,
    });
  } catch (error) {
    console.error('Manager dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

