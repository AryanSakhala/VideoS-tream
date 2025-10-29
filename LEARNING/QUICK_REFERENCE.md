# Quick Reference Guide 📚

## Your Video Streaming Platform - At a Glance

---

## 🏗️ Architecture Overview

```
FRONTEND (React + Vite + Tailwind)
    ↓ ↑ HTTP + WebSocket
BACKEND (Node.js + Express)
    ↓ ↑
MongoDB (Data) + Redis (Queue/Cache)
    ↓
FFmpeg (Video Processing)
```

---

## 📁 Project Structure

```
Video-stream/
├── backend/
│   ├── src/
│   │   ├── controllers/      # Request handlers
│   │   ├── middleware/       # Auth, RBAC, validation
│   │   ├── models/           # MongoDB schemas
│   │   ├── routes/           # API endpoints
│   │   ├── services/         # Business logic
│   │   ├── workers/          # Background jobs
│   │   ├── utils/            # Helpers (JWT, FFmpeg)
│   │   └── socket/           # Socket.IO setup
│   ├── uploads/              # Video storage
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI
│   │   ├── pages/            # Route pages
│   │   ├── services/         # API & WebSocket clients
│   │   └── contexts/         # Global state (Auth)
│   └── package.json
│
└── LEARNING/                 # This guide!
```

---

## 🔑 Core Technologies

| Technology | Purpose | Location |
|------------|---------|----------|
| **Node.js** | JavaScript runtime | Backend |
| **Express.js** | Web framework | Backend |
| **MongoDB** | Database | Backend |
| **Mongoose** | MongoDB ORM | Backend |
| **Redis** | Caching & queues | Backend |
| **Bull** | Job queue manager | Backend |
| **Socket.IO** | Real-time communication | Both |
| **FFmpeg** | Video processing | Backend |
| **JWT** | Authentication | Both |
| **React** | UI framework | Frontend |
| **Vite** | Build tool | Frontend |
| **Tailwind CSS** | Styling | Frontend |
| **Axios** | HTTP client | Frontend |

---

## 🔐 Authentication Flow

```
1. User submits login form
2. Backend validates credentials
3. Generate JWT tokens (access + refresh)
4. Send tokens as cookies + response body
5. Frontend stores tokens
6. Every API request includes token
7. Middleware verifies token
8. If expired → Auto-refresh
9. If refresh fails → Redirect to login
```

**Key Files:**
- `backend/src/controllers/auth.controller.js` - Login/register logic
- `backend/src/middleware/auth.js` - Token verification
- `frontend/src/contexts/AuthContext.jsx` - Auth state
- `frontend/src/services/api.js` - Token refresh interceptor

---

## 🎥 Video Upload Flow

```
1. User selects file → Frontend validates
2. Upload via multipart/form-data → Multer saves to disk
3. Create Video document in MongoDB → Status: 'processing'
4. Add job to Bull Queue (Redis)
5. Worker picks up job
6. Extract metadata (FFmpeg)
7. Generate thumbnail (FFmpeg)
8. Analyze sensitivity (Custom algorithm)
9. Update Video document → Status: 'completed'
10. Notify frontend (Socket.IO)
11. UI updates automatically
```

**Key Files:**
- `frontend/src/pages/Upload.jsx` - Upload UI
- `backend/src/middleware/upload.js` - Multer configuration
- `backend/src/controllers/video.controller.js` - Upload handler
- `backend/src/workers/videoProcessor.worker.js` - Processing logic
- `backend/src/utils/ffmpeg.js` - FFmpeg utilities
- `backend/src/services/sensitivity.service.js` - Sensitivity analysis

---

## 📺 Video Streaming Flow

```
1. User clicks video
2. HTML5 <video> player requests first chunk
   → Range: bytes=0-1048575
3. Backend verifies token & organization
4. Stream chunk (206 Partial Content)
5. Player buffers and starts playback
6. As playback continues, request more chunks
7. User seeks → Request different byte range
8. Seamless playback continues
```

**Key Files:**
- `frontend/src/pages/VideoDetail.jsx` - Video player
- `backend/src/controllers/stream.controller.js` - Streaming logic
- `backend/src/routes/stream.routes.js` - Stream routes

---

## 👥 RBAC (Role-Based Access Control)

### Roles & Permissions

| Role | View Videos | Upload | Edit Own | Delete Own | Edit Any | Delete Any | Manage Users |
|------|-------------|--------|----------|------------|----------|------------|--------------|
| **Viewer** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Editor** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Assignment Rules
- First user creating organization → **Admin**
- Other users → Choose **Viewer** or **Editor** during registration
- Admins can change roles of users in their organization

**Key Files:**
- `backend/src/models/User.js` - Role definition
- `backend/src/middleware/rbac.js` - Authorization middleware
- `backend/src/routes/video.routes.js` - Protected routes
- `frontend/src/pages/Register.jsx` - Role selection

---

## 🔌 Real-Time Communication

### Socket.IO Events

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `connect` | Client → Server | `{ token }` | Establish connection |
| `video:progress` | Server → Client | `{ videoId, progress, stage }` | Processing progress |
| `video:processed` | Server → Client | `{ videoId, status, metadata }` | Processing complete |
| `video:failed` | Server → Client | `{ videoId, error }` | Processing failed |

### Rooms
- Each organization has its own room
- Users auto-join their organization's room on connect
- Events broadcast to room members only

**Key Files:**
- `backend/src/socket/socket.js` - Server setup
- `frontend/src/services/websocket.service.js` - Client setup
- `frontend/src/contexts/AuthContext.jsx` - Connection management

---

## 🗄️ Database Schemas

### User
```javascript
{
  email: String (unique),
  password: String (hashed),
  name: String,
  role: 'viewer' | 'editor' | 'admin',
  organizationId: ObjectId (ref: Organization)
}
```

### Organization
```javascript
{
  name: String,
  slug: String (unique),
  createdAt: Date
}
```

### Video
```javascript
{
  title: String,
  description: String,
  filePath: String,
  fileSize: Number,
  thumbnail: String,
  status: 'processing' | 'completed' | 'failed',
  visibility: 'private' | 'organization' | 'public',
  uploadedBy: ObjectId (ref: User),
  organizationId: ObjectId (ref: Organization),
  metadata: {
    duration: Number,
    resolution: { width, height },
    format: String,
    codec: String,
    bitrate: Number
  },
  sensitivity: {
    level: 'low' | 'medium' | 'high',
    score: Number (0-100),
    analysis: Object
  }
}
```

**Key Files:**
- `backend/src/models/User.js`
- `backend/src/models/Organization.js`
- `backend/src/models/Video.js`

---

## 🛣️ API Endpoints

### Authentication
```
POST   /api/auth/register       - Register new user
POST   /api/auth/login          - Login
POST   /api/auth/refresh        - Refresh access token
POST   /api/auth/logout         - Logout
```

### Videos
```
GET    /api/videos              - List all videos (user's org)
GET    /api/videos/:id          - Get single video
POST   /api/videos/upload       - Upload video (editor+)
PUT    /api/videos/:id          - Update video (owner or admin)
DELETE /api/videos/:id          - Delete video (owner or admin)
```

### Streaming
```
GET    /api/stream/:id/video    - Stream video (Range requests)
GET    /api/stream/:id/thumbnail - Get thumbnail
```

### Admin (Admin only)
```
GET    /api/admin/users         - List users in org
POST   /api/admin/users/invite  - Invite user
PUT    /api/admin/users/:id/role - Change user role
DELETE /api/admin/users/:id     - Remove user
GET    /api/admin/stats         - Organization statistics
```

---

## 🔧 Environment Variables

### Backend (.env)
```env
NODE_ENV=development|production
PORT=5000
MONGODB_URI=mongodb://...
JWT_SECRET=random_secret_key
JWT_REFRESH_SECRET=another_random_key
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:5173
UPLOAD_DIR=./uploads
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=http://localhost:5000
```

---

## 🚀 Running the Application

### Development

**Terminal 1 - Redis:**
```bash
redis-server
```

**Terminal 2 - Backend:**
```bash
cd backend
npm install
npm run dev
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Access:** http://localhost:5173

### Production

**Backend (Render.com):**
- Build command: `npm install`
- Start command: `npm start`
- Environment variables injected via dashboard

**Frontend (Vercel):**
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: `frontend`

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot find module 'cookie-parser'"
**Solution:** `npm install cookie-parser` in backend

### Issue: "Tailwind border-border class not found"
**Solution:** Replace with valid Tailwind class (e.g., `border-gray-200`)

### Issue: "401 Unauthorized on API calls"
**Solution:** Check token expiry, refresh token, or re-login

### Issue: "Video not streaming"
**Solution:** Verify token in query params for `<video>` src

### Issue: "WebSocket connection failed"
**Solution:** Check JWT token validity, ensure backend is running

### Issue: "Processing stuck at 'processing'"
**Solution:** Check Redis is running, check worker logs

### Issue: "Thumbnail not displaying"
**Solution:** Check FFmpeg is installed, thumbnail path is correct

---

## 📊 Performance Tips

1. **Caching:** Set long `Cache-Control` headers for videos/thumbnails
2. **Compression:** Use gzip compression for API responses
3. **Indexing:** Add MongoDB indexes on frequently queried fields
4. **CDN:** Serve static assets via CDN in production
5. **Lazy Loading:** Load videos on-demand, not all at once
6. **Pagination:** Limit video list queries (e.g., 20 per page)
7. **Thumbnails:** Generate multiple sizes for different devices

---

## 🔍 Debugging Tools

### Backend Logs
```javascript
// backend/src/utils/logger.js
import winston from 'winston';

logger.info('Info message');
logger.error('Error message', error);
logger.debug('Debug details');
```

### Frontend DevTools
- **Network Tab:** See API requests, WebSocket frames
- **Application Tab:** Check cookies, localStorage
- **Console:** Socket.IO events, errors
- **React DevTools:** Inspect component state

### Database
```bash
# MongoDB
mongosh "mongodb://..."
> use video-streaming
> db.videos.find()

# Redis
redis-cli
> KEYS *
> GET key_name
```

---

## 📚 Learn More

For detailed explanations, see:
- `01_LEVEL1_SYSTEM_OVERVIEW.md` - Big picture
- `SOCKETIO_REALTIME.md` - Real-time communication
- `VIDEO_STREAMING.md` - HTTP range requests
- `JWT_AUTHENTICATION.md` - Token-based auth
- `RBAC_ACCESS_CONTROL.md` - Roles & permissions
- `VIDEO_PROCESSING.md` - FFmpeg & sensitivity

---

## 💡 Quick Tips

- **Always use `authenticate` middleware** before protected routes
- **Filter by `organizationId`** in every database query
- **Emit Socket.IO events to rooms**, not globally
- **Use `optionalAuth` for streaming** routes (supports query tokens)
- **Handle token refresh automatically** with Axios interceptors
- **Check user role** before showing UI elements
- **Process videos in background** using Bull Queue
- **Stream videos in chunks** using Range requests

---

**Happy Coding! 🚀**

