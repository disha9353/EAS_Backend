const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const testConnection = async () => {
  try {
    console.log('Testing MongoDB connection...');
    console.log('MongoDB URI:', process.env.MONGODB_URI || 'mongodb://localhost:27017/employee_attendance');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/employee_attendance', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB Connected Successfully!');
    console.log('Database:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    console.log('Port:', mongoose.connection.port);
    
    // Test database operations
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nCollections in database:');
    collections.forEach(col => console.log(`  - ${col.name}`));
    
    await mongoose.connection.close();
    console.log('\n✅ Connection test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ MongoDB connection failed!');
    console.error('Error:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure MongoDB is installed and running');
    console.log('2. Check if MongoDB service is started');
    console.log('3. Verify MONGODB_URI in .env file');
    console.log('4. Try: mongod (to start MongoDB)');
    process.exit(1);
  }
};

testConnection();

