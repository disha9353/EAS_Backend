const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Leave = require('../models/Leave');
const LeaveType = require('../models/LeaveType');
const LeaveBalance = require('../models/LeaveBalance');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Attendance = require('../models/Attendance');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/leaves');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for leave attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'leave-' + req.user._id + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only image, PDF, and document files are allowed'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter,
});

// Helper function to check date overlap
const checkDateOverlap = (fromDate1, toDate1, fromDate2, toDate2) => {
  return fromDate1 <= toDate2 && fromDate2 <= toDate1;
};

// Helper function to check conflicts
const checkDepartmentConflicts = async (userId, fromDate, toDate, excludeLeaveId = null) => {
  const user = await User.findById(userId);
  if (!user || !user.department) return [];

  const departmentEmployees = await User.find({ department: user.department, role: 'employee' });
  const employeeIds = departmentEmployees.map((emp) => emp._id);

  const query = {
    userId: { $in: employeeIds },
    status: 'approved',
    $or: [
      { fromDate: { $lte: toDate }, toDate: { $gte: fromDate } },
    ],
  };

  if (excludeLeaveId) {
    query._id = { $ne: excludeLeaveId };
  }

  const conflictingLeaves = await Leave.find(query).populate('userId', 'name employeeId');
  return conflictingLeaves;
};

// Helper function to create notification
const createNotification = async (userId, type, title, message, relatedId = null) => {
  await Notification.create({
    userId,
    type,
    title,
    message,
    relatedId,
    relatedModel: relatedId ? 'Leave' : null,
  });
};

// Helper function to update leave balance
const updateLeaveBalance = async (userId, leaveTypeId, days, year, action = 'add') => {
  let balance = await LeaveBalance.findOne({ userId, leaveType: leaveTypeId, year });
  
  if (!balance) {
    const leaveType = await LeaveType.findById(leaveTypeId);
    balance = await LeaveBalance.create({
      userId,
      leaveType: leaveTypeId,
      year,
      totalAllocated: leaveType.yearlyQuota || 0,
      used: 0,
      pending: 0,
      balance: leaveType.yearlyQuota || 0,
    });
  }

  if (action === 'add') {
    balance.pending += days;
  } else if (action === 'approve') {
    balance.pending -= days;
    balance.used += days;
  } else if (action === 'reject') {
    balance.pending -= days;
  } else if (action === 'cancel') {
    balance.pending -= days;
  }

  await balance.save();
  return balance;
};

// @route   POST /api/leaves/request
// @desc    Employee submit leave request
// @access  Private (Employee)
router.post('/request', protect, upload.single('attachment'), async (req, res) => {
  try {
    const { leaveType, fromDate, toDate, reason, isHalfDay, halfDayType, delegatedTo, delegationNote } = req.body;

    // Validation
    if (!leaveType || !fromDate || !toDate || !reason) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (from > to) {
      return res.status(400).json({ message: 'From date cannot be after to date' });
    }

    if (from < new Date().setHours(0, 0, 0, 0)) {
      return res.status(400).json({ message: 'Cannot request leave for past dates' });
    }

    // Check for overlapping leaves
    const overlappingLeaves = await Leave.find({
      userId: req.user._id,
      status: { $in: ['pending', 'approved', 'on-hold'] },
      $or: [
        { fromDate: { $lte: to }, toDate: { $gte: from } },
      ],
    });

    if (overlappingLeaves.length > 0) {
      return res.status(400).json({ 
        message: 'You already have a leave request for these dates',
        overlappingLeaves 
      });
    }

    // Calculate total days
    const diff = to - from;
    const totalDays = isHalfDay ? 0.5 : Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;

    // Check leave type rules
    const leaveTypeDoc = await LeaveType.findById(leaveType);
    if (!leaveTypeDoc || !leaveTypeDoc.isActive) {
      return res.status(400).json({ message: 'Invalid or inactive leave type' });
    }

    if (leaveTypeDoc.maxContinuousDays && totalDays > leaveTypeDoc.maxContinuousDays) {
      return res.status(400).json({ 
        message: `Maximum continuous days allowed: ${leaveTypeDoc.maxContinuousDays}` 
      });
    }

    if (isHalfDay && !leaveTypeDoc.allowHalfDay) {
      return res.status(400).json({ message: 'Half day not allowed for this leave type' });
    }

    if (leaveTypeDoc.requiresAttachment && !req.file) {
      return res.status(400).json({ message: 'Attachment is required for this leave type' });
    }

    // Check leave balance
    const currentYear = new Date().getFullYear();
    const balance = await LeaveBalance.findOne({ 
      userId: req.user._id, 
      leaveType, 
      year: currentYear 
    });

    const availableBalance = balance ? balance.balance - balance.pending : leaveTypeDoc.yearlyQuota;
    if (availableBalance < totalDays) {
      return res.status(400).json({ 
        message: 'Insufficient leave balance',
        availableBalance,
        requested: totalDays
      });
    }

    // Create leave request
    const leave = await Leave.create({
      userId: req.user._id,
      leaveType,
      fromDate: from,
      toDate: to,
      reason,
      isHalfDay: isHalfDay === 'true' || isHalfDay === true,
      halfDayType: isHalfDay ? halfDayType : null,
      attachment: req.file ? `/api/uploads/leaves/${req.file.filename}` : null,
      delegatedTo: delegatedTo || null,
      delegationNote: delegationNote || null,
      totalDays,
    });

    // Update leave balance (add to pending)
    await updateLeaveBalance(req.user._id, leaveType, totalDays, currentYear, 'add');

    // Create notification for managers
    const managers = await User.find({ role: 'manager' });
    for (const manager of managers) {
      await createNotification(
        manager._id,
        'new-leave-request',
        'New Leave Request',
        `${req.user.name} has submitted a leave request from ${from.toDateString()} to ${to.toDateString()}`,
        leave._id
      );
    }

    res.status(201).json({
      message: 'Leave request submitted successfully',
      leave,
    });
  } catch (error) {
    console.error('Leave request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/leaves/my-leaves
// @desc    Get employee's leave requests
// @access  Private (Employee)
router.get('/my-leaves', protect, async (req, res) => {
  try {
    const { status, year } = req.query;
    const query = { userId: req.user._id };

    if (status) {
      query.status = status;
    }

    if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
      query.fromDate = { $gte: startDate };
      query.toDate = { $lte: endDate };
    }

    const leaves = await Leave.find(query)
      .populate('leaveType', 'name code colorCode')
      .populate('reviewedBy', 'name')
      .populate('delegatedTo', 'name employeeId')
      .sort({ createdAt: -1 });

    res.json({ leaves });
  } catch (error) {
    console.error('Get my leaves error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/leaves/balance
// @desc    Get employee's leave balance
// @access  Private (Employee)
router.get('/balance', protect, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const balances = await LeaveBalance.find({ 
      userId: req.user._id, 
      year: currentYear 
    })
      .populate('leaveType', 'name code colorCode yearlyQuota')
      .sort({ 'leaveType.name': 1 });

    // If no balances exist, create default ones
    if (balances.length === 0) {
      const leaveTypes = await LeaveType.find({ isActive: true });
      if (leaveTypes.length === 0) {
        return res.json({ 
          balances: [],
          message: 'No leave types configured. Please contact administrator.' 
        });
      }
      
      const createdBalances = [];
      for (const leaveType of leaveTypes) {
        const newBalance = await LeaveBalance.create({
          userId: req.user._id,
          leaveType: leaveType._id,
          year: currentYear,
          totalAllocated: leaveType.yearlyQuota || 0,
          used: 0,
          pending: 0,
          balance: leaveType.yearlyQuota || 0,
        });
        createdBalances.push(newBalance);
      }
      
      const updatedBalances = await LeaveBalance.find({ 
        userId: req.user._id, 
        year: currentYear 
      })
        .populate('leaveType', 'name code colorCode yearlyQuota')
        .sort({ 'leaveType.name': 1 });
      return res.json({ balances: updatedBalances });
    }

    res.json({ balances });
  } catch (error) {
    console.error('Get leave balance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/leaves/calendar
// @desc    Get employee's leave calendar
// @access  Private (Employee)
router.get('/calendar', protect, async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    const leaves = await Leave.find({
      userId: req.user._id,
      $or: [
        { fromDate: { $lte: endDate }, toDate: { $gte: startDate } },
      ],
    })
      .populate('leaveType', 'name code colorCode')
      .sort({ fromDate: 1 });

    res.json({ leaves });
  } catch (error) {
    console.error('Get leave calendar error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/leaves/pending
// @desc    Get pending leave requests (Manager)
// @access  Private (Manager)
router.get('/pending', protect, authorize('manager'), async (req, res) => {
  try {
    const leaves = await Leave.find({ status: 'pending' })
      .populate('userId', 'name email employeeId department')
      .populate('leaveType', 'name code colorCode')
      .populate('delegatedTo', 'name employeeId')
      .sort({ createdAt: -1 });

    res.json({ leaves });
  } catch (error) {
    console.error('Get pending leaves error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/leaves/all
// @desc    Get all leave requests (Manager)
// @access  Private (Manager)
router.get('/all', protect, authorize('manager'), async (req, res) => {
  try {
    const { status, department, startDate, endDate } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    if (startDate && endDate) {
      query.$or = [
        { fromDate: { $lte: new Date(endDate) }, toDate: { $gte: new Date(startDate) } },
      ];
    }

    let leaves = await Leave.find(query)
      .populate('userId', 'name email employeeId department')
      .populate('leaveType', 'name code colorCode')
      .populate('reviewedBy', 'name')
      .populate('delegatedTo', 'name employeeId')
      .sort({ createdAt: -1 });

    // Filter by department if specified
    if (department) {
      leaves = leaves.filter((leave) => leave.userId.department === department);
    }

    res.json({ leaves });
  } catch (error) {
    console.error('Get all leaves error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/leaves/:id/approve
// @desc    Approve leave request (Manager)
// @access  Private (Manager)
router.put('/:id/approve', protect, authorize('manager'), async (req, res) => {
  try {
    const { managerRemarks } = req.body;
    const leave = await Leave.findById(req.params.id)
      .populate('userId', 'name email department')
      .populate('leaveType', 'name');

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    if (leave.status !== 'pending' && leave.status !== 'on-hold') {
      return res.status(400).json({ message: 'Leave request is not in a valid state for approval' });
    }

    // Check for department conflicts
    const conflicts = await checkDepartmentConflicts(
      leave.userId._id,
      leave.fromDate,
      leave.toDate,
      leave._id
    );

    let conflictWarning = null;
    if (conflicts.length > 0) {
      conflictWarning = {
        message: `Warning: ${conflicts.length} other employee(s) from the same department are on leave during these dates`,
        conflicts: conflicts.map((c) => ({
          name: c.userId.name,
          employeeId: c.userId.employeeId,
          fromDate: c.fromDate,
          toDate: c.toDate,
        })),
      };
    }

    // Update leave status
    leave.status = 'approved';
    leave.managerRemarks = managerRemarks || '';
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    await leave.save();

    // Update leave balance
    const currentYear = new Date().getFullYear();
    await updateLeaveBalance(leave.userId._id, leave.leaveType, leave.totalDays, currentYear, 'approve');

    // Create notification for employee
    await createNotification(
      leave.userId._id,
      'leave-approved',
      'Leave Approved',
      `Your leave request from ${leave.fromDate.toDateString()} to ${leave.toDate.toDateString()} has been approved.`,
      leave._id
    );

    res.json({
      message: 'Leave request approved successfully',
      leave,
      conflictWarning,
    });
  } catch (error) {
    console.error('Approve leave error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/leaves/:id/reject
// @desc    Reject leave request (Manager)
// @access  Private (Manager)
router.put('/:id/reject', protect, authorize('manager'), async (req, res) => {
  try {
    const { managerRemarks } = req.body;
    const leave = await Leave.findById(req.params.id)
      .populate('userId', 'name email');

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    if (leave.status !== 'pending' && leave.status !== 'on-hold') {
      return res.status(400).json({ message: 'Leave request is not in a valid state for rejection' });
    }

    if (!managerRemarks) {
      return res.status(400).json({ message: 'Manager remarks are required for rejection' });
    }

    // Update leave status
    leave.status = 'rejected';
    leave.managerRemarks = managerRemarks;
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    await leave.save();

    // Update leave balance (remove from pending)
    const currentYear = new Date().getFullYear();
    await updateLeaveBalance(leave.userId._id, leave.leaveType, leave.totalDays, currentYear, 'reject');

    // Create notification for employee
    await createNotification(
      leave.userId._id,
      'leave-rejected',
      'Leave Rejected',
      `Your leave request has been rejected. Remarks: ${managerRemarks}`,
      leave._id
    );

    res.json({
      message: 'Leave request rejected',
      leave,
    });
  } catch (error) {
    console.error('Reject leave error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/leaves/:id/hold
// @desc    Put leave request on hold (Manager)
// @access  Private (Manager)
router.put('/:id/hold', protect, authorize('manager'), async (req, res) => {
  try {
    const { managerRemarks } = req.body;
    const leave = await Leave.findById(req.params.id)
      .populate('userId', 'name email');

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending leave requests can be put on hold' });
    }

    // Update leave status
    leave.status = 'on-hold';
    leave.managerRemarks = managerRemarks || '';
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    await leave.save();

    // Create notification for employee
    await createNotification(
      leave.userId._id,
      'leave-on-hold',
      'Leave On Hold',
      `Your leave request has been put on hold. Remarks: ${managerRemarks || 'No remarks provided'}`,
      leave._id
    );

    res.json({
      message: 'Leave request put on hold',
      leave,
    });
  } catch (error) {
    console.error('Hold leave error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/leaves/check-today
// @desc    Check if employee has approved leave today
// @access  Private (Employee)
router.get('/check-today', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const leave = await Leave.findOne({
      userId: req.user._id,
      status: 'approved',
      fromDate: { $lte: tomorrow },
      toDate: { $gte: today },
    })
      .populate('leaveType', 'name code');

    res.json({
      hasLeave: !!leave,
      leave: leave || null,
    });
  } catch (error) {
    console.error('Check today leave error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

