const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  checkInTime: {
    type: Date,
  },
  checkOutTime: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half-day'],
    default: 'absent',
  },
  totalHours: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for efficient queries
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

// Calculate total hours before saving
attendanceSchema.pre('save', function (next) {
  if (this.checkInTime && this.checkOutTime) {
    const diff = this.checkOutTime - this.checkInTime;
    this.totalHours = parseFloat((diff / (1000 * 60 * 60)).toFixed(2));
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);

