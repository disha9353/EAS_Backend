const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  yearlyQuota: {
    type: Number,
    required: true,
    default: 0,
  },
  carryForward: {
    type: Boolean,
    default: false,
  },
  maxCarryForward: {
    type: Number,
    default: 0,
  },
  requiresAttachment: {
    type: Boolean,
    default: false,
  },
  colorCode: {
    type: String,
    default: '#3b82f6',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  maxContinuousDays: {
    type: Number,
    default: null, // null means no limit
  },
  allowHalfDay: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

leaveTypeSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('LeaveType', leaveTypeSchema);

