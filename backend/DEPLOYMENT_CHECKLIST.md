# Backend Deployment Checklist

## ✅ Pre-Deployment Checklist

### Environment Variables
- [x] `MONGODB_URI` - MongoDB Atlas connection string configured
- [x] `JWT_SECRET` - Strong random secret generated
- [x] `NODE_ENV` - Set to `production`
- [x] `PORT` - Set to `5000` (or platform default)
- [ ] `FRONTEND_URL` - Set to your frontend deployment URL (e.g., `https://your-app.vercel.app`)

### Security Features
- [x] Helmet.js installed and configured
- [x] Rate limiting enabled (100 requests/15min general, 5 requests/15min for auth)
- [x] CORS configured for production
- [x] Global error handler implemented
- [x] Request logging (Morgan) configured

### Code Quality
- [x] Error handling middleware added
- [x] 404 handler for unknown routes
- [x] Graceful shutdown handling
- [x] MongoDB connection with proper error handling

### Deployment Files
- [x] `Procfile` created for Heroku/Railway
- [x] `package.json` with production start script
- [x] `.env` file configured (not committed to Git)

## 🚀 Deployment Steps

### For Render.com
1. Create new Web Service
2. Connect GitHub repository
3. Set Root Directory: `backend`
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Add Environment Variables:
   ```
   PORT=5000
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://Disha:A21p3XDV3YehXqwq@cluster0.yusheow.mongodb.net/employee_attendance?appName=Cluster0
   JWT_SECRET=+NINfnhTntDJRB+zjsxNge8jggjYP6yaigTWebPkg9U=
   JWT_EXPIRE=7d
   FRONTEND_URL=https://your-frontend-url.vercel.app
   ```

### For Railway.app
1. Create new project
2. Deploy from GitHub repo
3. Set Root Directory: `backend`
4. Add same environment variables as above
5. Deploy automatically

### For Heroku
1. Install Heroku CLI
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Set environment variables:
   ```bash
   heroku config:set MONGODB_URI=your_mongodb_uri
   heroku config:set JWT_SECRET=your_secret
   heroku config:set JWT_EXPIRE=7d
   heroku config:set NODE_ENV=production
   heroku config:set FRONTEND_URL=your_frontend_url
   ```
5. Deploy: `git push heroku main`

## 🔍 Post-Deployment Testing

1. Test health endpoint: `GET https://your-backend-url.com/api/health`
2. Test CORS: Verify frontend can make API calls
3. Test authentication: Try login/register endpoints
4. Test rate limiting: Make multiple rapid requests
5. Check logs: Verify no errors in deployment logs

## 📝 Important Notes

- **JWT_SECRET**: Keep this secure and never commit to Git
- **FRONTEND_URL**: Must match your actual frontend deployment URL
- **MongoDB Atlas**: Ensure Network Access allows your deployment platform IPs
- **Rate Limiting**: Adjust limits in `server.js` if needed for your use case

## 🐛 Troubleshooting

### CORS Errors
- Verify `FRONTEND_URL` environment variable is set correctly
- Check that frontend URL matches exactly (including https/http)

### MongoDB Connection Errors
- Verify MongoDB Atlas Network Access allows all IPs (0.0.0.0/0) or specific deployment IPs
- Check connection string is correct

### Rate Limiting Issues
- Adjust limits in `server.js` if legitimate users are being blocked
- Check deployment platform logs for rate limit messages




