# Backend Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://Disha:A21p3XDV3YehXqwq@cluster0.yusheow.mongodb.net/employee_attendance?appName=Cluster0
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d
```

## MongoDB Atlas Connection

The project is configured to use MongoDB Atlas (cloud database):
- **Connection String**: `mongodb+srv://disha:Disha%409353@cluster0.yusheow.mongodb.net/employee_attendance?appName=Cluster0`
- **Database Name**: `employee_attendance`

## Description

- **PORT**: Port number for the Express server (default: 5000)
- **NODE_ENV**: Environment mode (development/production)
- **MONGODB_URI**: MongoDB connection string
- **JWT_SECRET**: Secret key for JWT token signing (use a strong random string in production)
- **JWT_EXPIRE**: JWT token expiration time (default: 7d)

