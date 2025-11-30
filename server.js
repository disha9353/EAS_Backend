const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');

dotenv.config();

const app = express();

// -------------------------------------------------------------
// 🛡 Security Middleware
// -------------------------------------------------------------
app.use(helmet());

// Rate Limiting (general)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Rate Limiting (Auth Routes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// -------------------------------------------------------------
// 📜 Logging
// -------------------------------------------------------------
app.use(
  process.env.NODE_ENV === 'development'
    ? morgan('dev')
    : morgan('combined')
);

// -------------------------------------------------------------
// 🌐 CORS Configuration
// -------------------------------------------------------------
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowed = [
      'http://localhost:3000',
      'http://localhost:5173',
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    if (allowed.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// -------------------------------------------------------------
// 📝 Body Parsers
// -------------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// -------------------------------------------------------------
// 📁 Static File Serving
// -------------------------------------------------------------
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads/leaves', express.static(path.join(__dirname, 'uploads/leaves')));

// -------------------------------------------------------------
// 🟢 Root Route (Fixes Route Not Found / Issue)
// -------------------------------------------------------------
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Backend Running Successfully 🚀',
    timestamp: new Date().toISOString(),
  });
});

// -------------------------------------------------------------
// 🚀 API Routes
// -------------------------------------------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/badges', require('./routes/badges'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/leaves', require('./routes/leaves'));
app.use('/api/leave-types', require('./routes/leaveTypes'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/leave-analytics', require('./routes/leaveAnalytics'));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// -------------------------------------------------------------
// ❌ 404 Handler (Must be after routes)
// -------------------------------------------------------------
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
  });
});

// -------------------------------------------------------------
// 🔗 MongoDB + Start Server
// -------------------------------------------------------------
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/employee_attendance',
      { useNewUrlParser: true, useUnifiedTopology: true }
    );

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });

    // Handle server errors
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use!`);
        process.exit(1);
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      server.close(() => {
        mongoose.connection.close(false, () => {
          process.exit(0);
        });
      });
    });
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

connectDB();

module.exports = app;
