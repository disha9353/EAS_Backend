const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  leaveType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveType',
    required: true,
  },
  fromDate: {
    type: Date,
    required: true,
  },
  toDate: {
    type: Date,
    required: true,
  },
  reason: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'on-hold'],
    default: 'pending',
  },
  managerRemarks: {
    type: String,
    trim: true,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: {
    type: Date,
  },
  attachment: {
    type: String,
    default: null,
  },
  totalDays: {
    type: Number,
    required: true,
  },
  isHalfDay: {
    type: Boolean,
    default: false,
  },
  halfDayType: {
    type: String,
    enum: ['first-half', 'second-half', null],
    default: null,
  },
  delegatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  delegationNote: {
    type: String,
    trim: true,
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

// Index for efficient queries
leaveSchema.index({ userId: 1, fromDate: 1, toDate: 1 });
leaveSchema.index({ status: 1 });
leaveSchema.index({ fromDate: 1, toDate: 1 });

// Calculate total days before saving
leaveSchema.pre('save', function (next) {
  if (this.fromDate && this.toDate) {
    const diff = this.toDate - this.fromDate;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    this.totalDays = this.isHalfDay ? 0.5 : days;
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Leave', leaveSchema);

