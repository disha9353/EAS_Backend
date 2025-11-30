const express = require('express');
const LeaveType = require('../models/LeaveType');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/leave-types
// @desc    Get all leave types
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const leaveTypes = await LeaveType.find({ isActive: true }).sort({ name: 1 });
    res.json({ leaveTypes });
  } catch (error) {
    console.error('Get leave types error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/leave-types
// @desc    Create leave type (Manager)
// @access  Private (Manager)
router.post('/', protect, authorize('manager'), async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      yearlyQuota,
      carryForward,
      maxCarryForward,
      requiresAttachment,
      colorCode,
      maxContinuousDays,
      allowHalfDay,
    } = req.body;

    if (!name || !code || yearlyQuota === undefined) {
      return res.status(400).json({ message: 'Please provide name, code, and yearly quota' });
    }

    const leaveType = await LeaveType.create({
      name,
      code: code.toUpperCase(),
      description,
      yearlyQuota: parseFloat(yearlyQuota),
      carryForward: carryForward || false,
      maxCarryForward: maxCarryForward || 0,
      requiresAttachment: requiresAttachment || false,
      colorCode: colorCode || '#3b82f6',
      maxContinuousDays: maxContinuousDays || null,
      allowHalfDay: allowHalfDay !== false,
    });

    res.status(201).json({
      message: 'Leave type created successfully',
      leaveType,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Leave type with this name or code already exists' });
    }
    console.error('Create leave type error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/leave-types/:id
// @desc    Update leave type (Manager)
// @access  Private (Manager)
router.put('/:id', protect, authorize('manager'), async (req, res) => {
  try {
    const leaveType = await LeaveType.findById(req.params.id);
    if (!leaveType) {
      return res.status(404).json({ message: 'Leave type not found' });
    }

    const {
      name,
      code,
      description,
      yearlyQuota,
      carryForward,
      maxCarryForward,
      requiresAttachment,
      colorCode,
      maxContinuousDays,
      allowHalfDay,
      isActive,
    } = req.body;

    if (name) leaveType.name = name;
    if (code) leaveType.code = code.toUpperCase();
    if (description !== undefined) leaveType.description = description;
    if (yearlyQuota !== undefined) leaveType.yearlyQuota = parseFloat(yearlyQuota);
    if (carryForward !== undefined) leaveType.carryForward = carryForward;
    if (maxCarryForward !== undefined) leaveType.maxCarryForward = maxCarryForward;
    if (requiresAttachment !== undefined) leaveType.requiresAttachment = requiresAttachment;
    if (colorCode) leaveType.colorCode = colorCode;
    if (maxContinuousDays !== undefined) leaveType.maxContinuousDays = maxContinuousDays;
    if (allowHalfDay !== undefined) leaveType.allowHalfDay = allowHalfDay;
    if (isActive !== undefined) leaveType.isActive = isActive;

    await leaveType.save();

    res.json({
      message: 'Leave type updated successfully',
      leaveType,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Leave type with this name or code already exists' });
    }
    console.error('Update leave type error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/leave-types/:id
// @desc    Delete leave type (Manager)
// @access  Private (Manager)
router.delete('/:id', protect, authorize('manager'), async (req, res) => {
  try {
    const leaveType = await LeaveType.findById(req.params.id);
    if (!leaveType) {
      return res.status(404).json({ message: 'Leave type not found' });
    }

    // Soft delete by setting isActive to false
    leaveType.isActive = false;
    await leaveType.save();

    res.json({
      message: 'Leave type deactivated successfully',
      leaveType,
    });
  } catch (error) {
    console.error('Delete leave type error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

