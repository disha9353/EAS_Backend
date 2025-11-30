const mongoose = require('mongoose');
const dotenv = require('dotenv');
const LeaveType = require('../models/LeaveType');

dotenv.config();

const defaultLeaveTypes = [
  {
    name: 'Casual Leave',
    code: 'CL',
    description: 'Casual leave for personal work',
    yearlyQuota: 12,
    carryForward: true,
    maxCarryForward: 3,
    requiresAttachment: false,
    colorCode: '#3b82f6',
    maxContinuousDays: 3,
    allowHalfDay: true,
  },
  {
    name: 'Sick Leave',
    code: 'SL',
    description: 'Medical leave for health issues',
    yearlyQuota: 10,
    carryForward: false,
    maxCarryForward: 0,
    requiresAttachment: true,
    colorCode: '#ef4444',
    maxContinuousDays: null,
    allowHalfDay: true,
  },
  {
    name: 'Earned Leave',
    code: 'EL',
    description: 'Earned leave based on service',
    yearlyQuota: 15,
    carryForward: true,
    maxCarryForward: 10,
    requiresAttachment: false,
    colorCode: '#10b981',
    maxContinuousDays: null,
    allowHalfDay: true,
  },
  {
    name: 'Comp Off',
    code: 'CO',
    description: 'Compensatory off for working on holidays',
    yearlyQuota: 5,
    carryForward: true,
    maxCarryForward: 2,
    requiresAttachment: false,
    colorCode: '#f59e0b',
    maxContinuousDays: null,
    allowHalfDay: true,
  },
  {
    name: 'Work From Home',
    code: 'WFH',
    description: 'Work from home request',
    yearlyQuota: 20,
    carryForward: false,
    maxCarryForward: 0,
    requiresAttachment: false,
    colorCode: '#8b5cf6',
    maxContinuousDays: 5,
    allowHalfDay: false,
  },
];

async function seedLeaveTypes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/employee_attendance');
    console.log('MongoDB Connected');

    // Clear existing leave types
    await LeaveType.deleteMany({});

    // Insert default leave types
    for (const leaveType of defaultLeaveTypes) {
      await LeaveType.create(leaveType);
      console.log(`Created leave type: ${leaveType.name}`);
    }

    console.log('\n✅ Leave types seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding leave types:', error);
    process.exit(1);
  }
}

seedLeaveTypes();

