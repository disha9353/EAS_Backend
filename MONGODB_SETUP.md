# MongoDB Setup Guide

## Step 1: Install MongoDB

### Windows
1. Download MongoDB Community Server from: https://www.mongodb.com/try/download/community
2. Run the installer and follow the setup wizard
3. Choose "Complete" installation
4. Install MongoDB as a Windows Service (recommended)

### macOS (using Homebrew)
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

## Step 2: Verify MongoDB Installation

### Check if MongoDB is running

**Windows:**
- Open Services (services.msc)
- Look for "MongoDB" service
- Ensure it's running

**macOS/Linux:**
```bash
# Check MongoDB status
brew services list  # macOS
# or
sudo systemctl status mongodb  # Linux

# Start MongoDB if not running
brew services start mongodb-community  # macOS
# or
sudo systemctl start mongodb  # Linux
```

### Test MongoDB Connection
```bash
# Open MongoDB shell
mongosh

# Or if using older version
mongo

# You should see MongoDB shell prompt
# Type: exit to leave
```

## Step 3: Configure Environment Variables

The `.env` file has been created in the `backend` directory with:

```env
MONGODB_URI=mongodb://localhost:27017/employee_attendance
```

### Alternative MongoDB URIs

**Local MongoDB (default):**
```
mongodb://localhost:27017/employee_attendance
```

**MongoDB with authentication:**
```
mongodb://username:password@localhost:27017/employee_attendance
```

**MongoDB Atlas (Cloud):**
```
mongodb+srv://username:password@cluster.mongodb.net/employee_attendance
```

**Custom port:**
```
mongodb://localhost:27018/employee_attendance
```

## Step 4: Test Database Connection

Run the connection test script:

```bash
cd backend
npm run test-connection
```

This will:
- ✅ Test MongoDB connection
- ✅ Show database information
- ✅ List existing collections
- ✅ Verify everything is working

## Step 5: Start the Backend Server

```bash
cd backend
npm run dev
```

You should see:
```
MongoDB Connected
Server running on port 5000
```

## Troubleshooting

### Error: "MongoDB connection error"

**Solution 1: Start MongoDB Service**

**Windows:**
1. Open Services (Win + R, type `services.msc`)
2. Find "MongoDB" service
3. Right-click → Start

**macOS:**
```bash
brew services start mongodb-community
```

**Linux:**
```bash
sudo systemctl start mongodb
```

**Solution 2: Check MongoDB Port**

Default MongoDB port is 27017. Verify it's not blocked:

```bash
# Windows PowerShell
Test-NetConnection -ComputerName localhost -Port 27017

# macOS/Linux
telnet localhost 27017
```

**Solution 3: Manual MongoDB Start**

If service doesn't work, start MongoDB manually:

```bash
# Navigate to MongoDB bin directory
# Windows: C:\Program Files\MongoDB\Server\<version>\bin\
# macOS: /usr/local/bin/
# Linux: /usr/bin/

mongod --dbpath <path-to-data-directory>
```

**Solution 4: Check Firewall**

Ensure port 27017 is not blocked by firewall.

**Solution 5: Use MongoDB Atlas (Cloud)**

If local MongoDB is problematic, use MongoDB Atlas (free tier available):
1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create a cluster
3. Get connection string
4. Update `MONGODB_URI` in `.env` file

## Common Issues

### "Cannot find module 'mongoose'"
```bash
cd backend
npm install
```

### "Port 27017 already in use"
- Another MongoDB instance is running
- Stop it or use a different port

### "Authentication failed"
- Check username/password in connection string
- Ensure MongoDB authentication is configured correctly

## Next Steps

Once MongoDB is connected:
1. ✅ Run `npm run test-connection` to verify
2. ✅ Run `npm run dev` to start server
3. ✅ Run `npm run seed` to populate sample data
4. ✅ Start frontend and test the application

## MongoDB Compass (GUI Tool - Optional)

Download MongoDB Compass for a visual database interface:
https://www.mongodb.com/products/compass

This allows you to:
- View databases and collections
- Browse documents
- Run queries
- Monitor database performance

