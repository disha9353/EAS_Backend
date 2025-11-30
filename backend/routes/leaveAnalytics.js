const express = require('express');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/leave-analytics/employee
// @desc    Get employee leave analytics
// @access  Private (Employee)
router.get('/employee', protect, async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);

    // Get all leaves for the year
    const leaves = await Leave.find({
      userId: req.user._id,
      fromDate: { $gte: startDate },
      toDate: { $lte: endDate },
    })
      .populate('leaveType', 'name code');

    // Calculate statistics
    const totalLeaves = leaves.length;
    const approvedLeaves = leaves.filter((l) => l.status === 'approved').length;
    const pendingLeaves = leaves.filter((l) => l.status === 'pending').length;
    const rejectedLeaves = leaves.filter((l) => l.status === 'rejected').length;
    const totalDaysTaken = leaves
      .filter((l) => l.status === 'approved')
      .reduce((sum, l) => sum + l.totalDays, 0);
    const halfDays = leaves
      .filter((l) => l.status === 'approved' && l.isHalfDay)
      .length;

    // Monthly distribution
    const monthlyDistribution = Array.from({ length: 12 }, (_, i) => {
      const monthLeaves = leaves.filter((l) => {
        const leaveMonth = new Date(l.fromDate).getMonth();
        return leaveMonth === i && l.status === 'approved';
      });
      return {
        month: i + 1,
        monthName: new Date(currentYear, i).toLocaleString('default', { month: 'long' }),
        count: monthLeaves.length,
        days: monthLeaves.reduce((sum, l) => sum + l.totalDays, 0),
      };
    });

    // Leave type distribution
    const leaveTypeDistribution = {};
    leaves
      .filter((l) => l.status === 'approved')
      .forEach((leave) => {
        const typeName = leave.leaveType.name;
        if (!leaveTypeDistribution[typeName]) {
          leaveTypeDistribution[typeName] = { count: 0, days: 0 };
        }
        leaveTypeDistribution[typeName].count++;
        leaveTypeDistribution[typeName].days += leave.totalDays;
      });

    res.json({
      year: currentYear,
      summary: {
        totalLeaves,
        approvedLeaves,
        pendingLeaves,
        rejectedLeaves,
        totalDaysTaken,
        halfDays,
      },
      monthlyDistribution,
      leaveTypeDistribution,
    });
  } catch (error) {
    console.error('Get employee analytics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/leave-analytics/manager
// @desc    Get manager leave analytics
// @access  Private (Manager)
router.get('/manager', protect, authorize('manager'), async (req, res) => {
  try {
    const { year, department } = req.query;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);

    // Build query
    const query = {
      fromDate: { $gte: startDate },
      toDate: { $lte: endDate },
    };

    let leaves = await Leave.find(query)
      .populate('userId', 'name email employeeId department')
      .populate('leaveType', 'name code');

    // Filter by department if specified
    if (department) {
      leaves = leaves.filter((leave) => leave.userId.department === department);
    }

    // Department-wise distribution
    const departmentStats = {};
    leaves.forEach((leave) => {
      const dept = leave.userId.department || 'Unassigned';
      if (!departmentStats[dept]) {
        departmentStats[dept] = {
          totalLeaves: 0,
          approvedLeaves: 0,
          pendingLeaves: 0,
          totalDays: 0,
          employees: new Set(),
        };
      }
      departmentStats[dept].totalLeaves++;
      departmentStats[dept].employees.add(leave.userId._id.toString());
      if (leave.status === 'approved') {
        departmentStats[dept].approvedLeaves++;
        departmentStats[dept].totalDays += leave.totalDays;
      } else if (leave.status === 'pending') {
        departmentStats[dept].pendingLeaves++;
      }
    });

    // Convert Set to count
    Object.keys(departmentStats).forEach((dept) => {
      departmentStats[dept].employees = departmentStats[dept].employees.size;
    });

    // Monthly consumption
    const monthlyConsumption = Array.from({ length: 12 }, (_, i) => {
      const monthLeaves = leaves.filter((l) => {
        const leaveMonth = new Date(l.fromDate).getMonth();
        return leaveMonth === i && l.status === 'approved';
      });
      return {
        month: i + 1,
        monthName: new Date(currentYear, i).toLocaleString('default', { month: 'long' }),
        leaves: monthLeaves.length,
        days: monthLeaves.reduce((sum, l) => sum + l.totalDays, 0),
        employees: new Set(monthLeaves.map((l) => l.userId._id.toString())).size,
      };
    });

    // Most frequent leave days
    const dayFrequency = {};
    leaves
      .filter((l) => l.status === 'approved')
      .forEach((leave) => {
        const start = new Date(leave.fromDate);
        const end = new Date(leave.toDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dayKey = d.toISOString().split('T')[0];
          dayFrequency[dayKey] = (dayFrequency[dayKey] || 0) + 1;
        }
      });

    const mostFrequentDays = Object.entries(dayFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([date, count]) => ({ date, count }));

    res.json({
      year: currentYear,
      departmentStats,
      monthlyConsumption,
      mostFrequentDays,
      totalLeaves: leaves.length,
    });
  } catch (error) {
    console.error('Get manager analytics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/leave-analytics/export
// @desc    Export leave data (Manager)
// @access  Private (Manager)
router.get('/export', protect, authorize('manager'), async (req, res) => {
  try {
    const { startDate, endDate, department, format } = req.query;

    const query = {};
    if (startDate && endDate) {
      query.$or = [
        { fromDate: { $lte: new Date(endDate) }, toDate: { $gte: new Date(startDate) } },
      ];
    }

    let leaves = await Leave.find(query)
      .populate('userId', 'name email employeeId department')
      .populate('leaveType', 'name code')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });

    // Filter by department if specified
    if (department) {
      leaves = leaves.filter((leave) => leave.userId.department === department);
    }

    if (format === 'csv') {
      // CSV export
      const csvData = leaves.map((leave) => ({
        date: leave.createdAt.toISOString().split('T')[0],
        employeeId: leave.userId.employeeId,
        name: leave.userId.name,
        email: leave.userId.email,
        department: leave.userId.department,
        leaveType: leave.leaveType.name,
        fromDate: leave.fromDate.toISOString().split('T')[0],
        toDate: leave.toDate.toISOString().split('T')[0],
        totalDays: leave.totalDays,
        status: leave.status,
        managerRemarks: leave.managerRemarks || '',
        reviewedBy: leave.reviewedBy ? leave.reviewedBy.name : '',
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=leave-report.csv');

      const header = 'Date,Employee ID,Name,Email,Department,Leave Type,From Date,To Date,Total Days,Status,Manager Remarks,Reviewed By\n';
      const rows = csvData
        .map(
          (row) =>
            `${row.date},${row.employeeId},${row.name},${row.email},${row.department},${row.leaveType},${row.fromDate},${row.toDate},${row.totalDays},${row.status},${row.managerRemarks},${row.reviewedBy}`
        )
        .join('\n');

      res.send(header + rows);
    } else {
      // JSON export
      res.json({
        leaves: leaves.map((leave) => ({
          id: leave._id,
          employeeId: leave.userId.employeeId,
          name: leave.userId.name,
          email: leave.userId.email,
          department: leave.userId.department,
          leaveType: leave.leaveType.name,
          fromDate: leave.fromDate,
          toDate: leave.toDate,
          totalDays: leave.totalDays,
          status: leave.status,
          reason: leave.reason,
          managerRemarks: leave.managerRemarks,
          reviewedBy: leave.reviewedBy ? leave.reviewedBy.name : null,
          createdAt: leave.createdAt,
        })),
      });
    }
  } catch (error) {
    console.error('Export leave data error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

