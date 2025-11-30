const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Attendance = require('../models/Attendance');

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/employee_attendance');
    console.log('MongoDB Connected for seeding');

    // Clear existing data
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Attendance.deleteMany({});
    
    // Drop indexes to avoid conflicts, then recreate
    try {
      await User.collection.dropIndexes();
    } catch (err) {
      // Ignore if indexes don't exist
      if (err.code !== 27) throw err;
    }
    
    // Wait a bit to ensure deletion is complete
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('Cleared existing data');

    // Create Manager
    const manager = await User.create({
      name: 'John Manager',
      email: 'manager@company.com',
      password: 'manager123',
      role: 'manager',
      employeeId: 'MGR001',
      department: 'Management',
    });
    console.log('Created manager:', manager.email);

    // Create Employees with explicit employeeIds to avoid conflicts
    const employees = await User.create([
      {
        name: 'Alice Johnson',
        email: 'alice@company.com',
        password: 'employee123',
        role: 'employee',
        employeeId: 'EMP001',
        department: 'Engineering',
      },
      {
        name: 'Bob Smith',
        email: 'bob@company.com',
        password: 'employee123',
        role: 'employee',
        employeeId: 'EMP002',
        department: 'Engineering',
      },
      {
        name: 'Carol Williams',
        email: 'carol@company.com',
        password: 'employee123',
        role: 'employee',
        employeeId: 'EMP003',
        department: 'Sales',
      },
      {
        name: 'David Brown',
        email: 'david@company.com',
        password: 'employee123',
        role: 'employee',
        employeeId: 'EMP004',
        department: 'Sales',
      },
      {
        name: 'Eva Davis',
        email: 'eva@company.com',
        password: 'employee123',
        role: 'employee',
        employeeId: 'EMP005',
        department: 'HR',
      },
    ]);
    console.log(`Created ${employees.length} employees`);

    // Create sample attendance data for the last 30 days
    const today = new Date();
    const attendanceRecords = [];

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // Skip weekends (optional - you can remove this)
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      for (const employee of employees) {
        // Randomly create attendance (80% chance)
        if (Math.random() > 0.2) {
          const checkIn = new Date(date);
          checkIn.setHours(9 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);

          let status = 'present';
          if (checkIn.getHours() > 9 || (checkIn.getHours() === 9 && checkIn.getMinutes() > 30)) {
            status = 'late';
          }

          const checkOut = new Date(checkIn);
          checkOut.setHours(17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);

          // Sometimes half-day
          if (Math.random() < 0.1) {
            checkOut.setHours(13, 0, 0, 0);
            status = 'half-day';
          }

          attendanceRecords.push({
            userId: employee._id,
            date: date,
            checkInTime: checkIn,
            checkOutTime: checkOut,
            status: status,
          });
        }
      }
    }

    await Attendance.insertMany(attendanceRecords);
    console.log(`Created ${attendanceRecords.length} attendance records`);

    console.log('\n=== Seed Data Summary ===');
    console.log('Manager: manager@company.com / manager123');
    console.log('Employees: alice@company.com, bob@company.com, etc. / employee123');
    console.log('\nSeeding completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedData();

