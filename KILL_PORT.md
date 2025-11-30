# How to Fix "Port Already in Use" Error

## Quick Fix

If you see `Error: listen EADDRINUSE: address already in use :::5000`, follow these steps:

### Windows PowerShell

1. **Find the process using port 5000:**
   ```powershell
   netstat -ano | findstr :5000
   ```

2. **Kill the process (replace <PID> with the actual PID from step 1):**
   ```powershell
   taskkill /PID <PID> /F
   ```

3. **Or use a single command:**
   ```powershell
   Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
   ```

### Alternative: Change Port

If you prefer to use a different port:

1. Edit `backend/.env` file
2. Change `PORT=5000` to `PORT=5001` (or any available port)
3. Update `frontend/vite.config.js` proxy target to match:
   ```js
   proxy: {
     '/api': {
       target: 'http://localhost:5001',  // Change this
       changeOrigin: true,
     },
   },
   ```

### One-Line Solution (PowerShell)

```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
```

Then restart your server:
```bash
cd backend
npm run dev
```


