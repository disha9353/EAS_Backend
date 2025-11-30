const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema({
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
  year: {
    type: Number,
    required: true,
  },
  totalAllocated: {
    type: Number,
    default: 0,
  },
  used: {
    type: Number,
    default: 0,
  },
  pending: {
    type: Number,
    default: 0,
  },
  balance: {
    type: Number,
    default: 0,
  },
  carriedForward: {
    type: Number,
    default: 0,
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

// Unique index for user, leaveType, and year
leaveBalanceSchema.index({ userId: 1, leaveType: 1, year: 1 }, { unique: true });

leaveBalanceSchema.pre('save', function (next) {
  this.balance = this.totalAllocated + this.carriedForward - this.used - this.pending;
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);

