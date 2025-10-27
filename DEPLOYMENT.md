# Deployment Guide

## Prerequisites
- GitHub repository (✅ Done)
- Vercel account (free)
- Railway account (free)
- Upstash account (free Redis)
- MongoDB Atlas (already configured)

## Part 1: Deploy Backend to Railway

### Step 1: Sign up for Railway
1. Go to https://railway.app
2. Sign up with GitHub
3. Authorize Railway to access your repositories

### Step 2: Create Redis on Upstash
1. Go to https://upstash.com
2. Sign up (free)
3. Create a new database
4. Choose region closest to you
5. Copy the Redis URL (looks like: `rediss://default:xxx@xxx.upstash.io:6379`)

### Step 3: Deploy Backend
1. On Railway dashboard, click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose `AryanSakhala/VideoS-tream`
4. Railway will detect it's a Node.js app
5. Click "Add variables" and add:
   ```
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=your_mongodb_atlas_connection_string
   JWT_SECRET=your_jwt_secret_here
   JWT_REFRESH_SECRET=your_refresh_secret_here
   REDIS_URL=your_upstash_redis_url
   FRONTEND_URL=https://your-app.vercel.app
   FFMPEG_PATH=ffmpeg
   FFPROBE_PATH=ffprobe
   STORAGE_TYPE=local
   UPLOAD_DIR=./uploads
   ```
6. Click "Deploy"
7. Copy your backend URL (like: `https://your-app.railway.app`)

### Step 4: Configure Root Directory (Important!)
Railway needs to know where your backend is:

1. In Railway project settings
2. Click on your service
3. Go to "Settings"
4. Under "Build", set:
   - **Root Directory**: `backend`
   - **Start Command**: `npm start`
5. Redeploy

## Part 2: Deploy Frontend to Vercel

### Step 1: Sign up for Vercel
1. Go to https://vercel.com
2. Sign up with GitHub
3. Click "Add New" → "Project"

### Step 2: Import Repository
1. Select `AryanSakhala/VideoS-tream`
2. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### Step 3: Add Environment Variables
In Vercel project settings, add:
```
VITE_API_URL=https://your-backend.railway.app/api
VITE_WS_URL=https://your-backend.railway.app
```

### Step 4: Deploy
1. Click "Deploy"
2. Wait for deployment to complete
3. Copy your frontend URL (like: `https://your-app.vercel.app`)

### Step 5: Update Backend Environment
Go back to Railway and update:
```
FRONTEND_URL=https://your-app.vercel.app
```

## Part 3: Verify Deployment

1. Visit your Vercel URL
2. Register a new account
3. Try uploading a video
4. Check if it processes correctly

## Troubleshooting

### Backend Issues
- Check Railway logs: Dashboard → Service → Logs
- Ensure MongoDB Atlas allows Railway's IP (0.0.0.0/0 for testing)
- Verify all environment variables are set

### Frontend Issues
- Check Vercel deployment logs
- Verify API URLs are correct
- Check browser console for CORS errors

### CORS Issues
Backend already has CORS configured. Just ensure `FRONTEND_URL` matches your Vercel URL exactly.

## Alternative Platforms

### Backend Alternatives
- **Render**: https://render.com (also free tier)
- **Fly.io**: https://fly.io (free tier with credit card)

### Frontend Alternatives
- **Netlify**: https://netlify.com (also free, similar to Vercel)

## Cost Breakdown
- **Railway**: Free tier (500 hours/month)
- **Vercel**: Free tier (unlimited)
- **Upstash**: Free tier (10,000 commands/day)
- **MongoDB Atlas**: Free tier (512MB storage)
- **Total**: $0/month for small projects! 🎉


