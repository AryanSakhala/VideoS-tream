# Level 1: System Overview 🌍

## Complete System Architecture Understanding

---

## Q1: What is the complete system architecture of this video streaming platform?

**A:** This is a **full-stack, multi-tenant video streaming platform** with real-time processing capabilities. Think of it as a mini-YouTube with content safety features!

### **System Components:**

```
USER DEVICE (Browser)
    ↓
FRONTEND (React + Vite)
    ↓ ↑
COMMUNICATION LAYER (HTTP + WebSocket)
    ↓ ↑
BACKEND (Node.js + Express)
    ↓ ↑
DATA LAYER (MongoDB + Redis)
    ↓ ↑
PROCESSING LAYER (FFmpeg + Bull Queue)
```

### **💡 Real-World Example from Your Project:**

```javascript
// backend/src/app.js - Main application setup
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';

const app = express();
const httpServer = createServer(app);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.frontendUrl,     // Allow frontend requests
  credentials: true                // Allow cookies
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Real-time communication
import { initializeSocket } from './socket/socket.js';
initializeSocket(httpServer);

// API Routes
import routes from './routes/index.js';
app.use('/api', routes);
```

### **🔍 Deep Dive:**

The system follows a **3-tier architecture**:

1. **Presentation Tier** (Frontend)
   - React components for UI
   - Vite for fast development
   - Tailwind CSS for styling

2. **Application Tier** (Backend)
   - Express.js for API routing
   - Socket.IO for real-time updates
   - JWT for authentication
   - Multer for file uploads

3. **Data Tier** (Databases)
   - MongoDB for persistent storage
   - Redis for caching and job queues

### **✅ Key Takeaway:**
Your system is a **modern, scalable architecture** that separates concerns, uses real-time communication, and handles video processing asynchronously.

---

## Q2: How does a video upload request flow through the entire system?

**A:** A video upload goes through **9 distinct steps** from user click to processed video!

### **Step-by-Step Flow:**

```
1. USER CLICKS "UPLOAD" → Frontend validates file
2. FRONTEND → Sends multipart/form-data to Backend
3. MULTER MIDDLEWARE → Saves file to disk temporarily
4. VIDEO CONTROLLER → Creates database record
5. BULL QUEUE → Adds processing job
6. VIDEO WORKER → Picks up job from queue
7. FFMPEG → Extracts metadata, generates thumbnail
8. SENSITIVITY SERVICE → Analyzes video content
9. SOCKET.IO → Notifies frontend of completion
```

### **💡 Real Code from Your Project:**

#### **Step 1-2: Frontend Upload**
```javascript
// frontend/src/pages/Upload.jsx
const handleUpload = async () => {
  const formData = new FormData();
  formData.append('video', selectedFile);
  formData.append('title', title);
  formData.append('description', description);

  try {
    const response = await videoService.uploadVideo(
      formData,
      (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        setUploadProgress(percentCompleted);
      }
    );
    
    console.log('Upload successful:', response.video);
  } catch (error) {
    console.error('Upload error:', error);
  }
};
```

#### **Step 3: Multer Middleware**
```javascript
// backend/src/middleware/upload.js
import multer from 'multer';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);  // Save to ./uploads
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueName}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['video/mp4', 'video/mpeg', 'video/quicktime'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);  // Accept file
  } else {
    cb(new Error('Invalid file type'), false);  // Reject file
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }  // 500 MB max
});
```

#### **Step 4: Video Controller**
```javascript
// backend/src/controllers/video.controller.js
export const uploadVideo = async (req, res) => {
  try {
    const { title, description, visibility = 'private' } = req.body;
    const videoFile = req.file;

    // Create database record
    const video = new Video({
      title,
      description,
      visibility,
      filePath: videoFile.path,
      fileSize: videoFile.size,
      uploadedBy: req.userId,
      organizationId: req.organizationId,
      status: 'processing'
    });

    await video.save();

    // Add to processing queue
    await addToQueue(video._id);

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      video
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

#### **Step 5-6: Bull Queue & Worker**
```javascript
// backend/src/services/processing.service.js
import Queue from 'bull';

export const videoQueue = new Queue('video-processing', {
  redis: config.redisUrl
});

export const addToQueue = async (videoId) => {
  await videoQueue.add(
    { videoId },
    {
      attempts: 3,        // Retry 3 times on failure
      backoff: 5000,      // Wait 5s between retries
      removeOnComplete: true
    }
  );
};

// backend/src/workers/videoProcessor.worker.js
videoQueue.process(async (job) => {
  const { videoId } = job.data;
  
  // Update progress: 10%
  job.progress(10);
  
  // Step 1: Extract metadata
  const metadata = await ffmpeg.getMetadata(filePath);
  job.progress(40);
  
  // Step 2: Generate thumbnail
  const thumbnail = await ffmpeg.generateThumbnail(filePath);
  job.progress(70);
  
  // Step 3: Analyze sensitivity
  const sensitivity = await sensitivityService.analyze(filePath);
  job.progress(100);
  
  // Update database
  video.status = 'completed';
  video.metadata = metadata;
  video.thumbnail = thumbnail;
  video.sensitivity = sensitivity;
  await video.save();
  
  // Notify frontend via Socket.IO
  io.to(video.organizationId).emit('video:processed', video);
});
```

### **🔍 Deep Dive: Why This Architecture?**

**Q: Why not process the video immediately in the controller?**
**A:** Because video processing is **CPU-intensive** and **time-consuming**!

If you processed videos synchronously:
- ❌ API request would timeout (30-60 seconds limit)
- ❌ Server would be blocked from handling other requests
- ❌ No way to retry if processing fails
- ❌ No progress updates for user

With **async queue processing**:
- ✅ API responds immediately (user doesn't wait)
- ✅ Server stays responsive
- ✅ Automatic retries on failure
- ✅ Real-time progress via Socket.IO

### **✅ Key Takeaway:**
Video uploads use **asynchronous background processing** with a job queue to keep the system responsive and scalable.

---

## Q3: What happens when a user streams a video?

**A:** Video streaming uses **HTTP Range Requests** to send video in chunks, not all at once!

### **Streaming Flow:**

```
1. USER CLICKS PLAY → Video player requests first chunk
2. HTTP REQUEST → "Range: bytes=0-1048576" (first 1MB)
3. BACKEND → Reads that specific part of file
4. HTTP RESPONSE → Returns 206 Partial Content
5. PLAYER BUFFERS → Plays first chunk
6. USER SEEKS/SCROLLS → Requests different chunk
7. REPEAT → Only loads what's needed
```

### **💡 Real Code from Your Project:**

#### **Frontend Video Player**
```javascript
// frontend/src/pages/VideoDetail.jsx
const VideoDetail = () => {
  const [video, setVideo] = useState(null);
  const token = localStorage.getItem('accessToken');
  
  // Build video URL with authentication
  const videoUrl = `${import.meta.env.VITE_API_URL}/stream/${video._id}/video?token=${token}`;
  const thumbnailUrl = `${import.meta.env.VITE_API_URL}/stream/${video._id}/thumbnail?token=${token}`;

  return (
    <video
      controls
      poster={thumbnailUrl}
      className="w-full rounded-lg"
    >
      <source src={videoUrl} type="video/mp4" />
      Your browser does not support video playback.
    </video>
  );
};
```

#### **Backend Stream Controller**
```javascript
// backend/src/controllers/stream.controller.js
export const streamVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = await Video.findById(videoId);

    // Check access permissions
    if (video.organizationId.toString() !== req.organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const videoPath = video.filePath;
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Parse range: "bytes=0-1048576"
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      // Create read stream for this chunk only
      const fileStream = fs.createReadStream(videoPath, { start, end });

      // HTTP 206 Partial Content
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      });

      fileStream.pipe(res);
    } else {
      // No range requested - send entire file
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      });
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### **🔍 Deep Dive: HTTP Range Requests**

**What is a Range Request?**
```http
GET /api/stream/67890/video HTTP/1.1
Range: bytes=0-1048575
```

**What does the backend send back?**
```http
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1048575/52428800
Content-Length: 1048576
Content-Type: video/mp4

[Binary video data for first 1MB]
```

**Why is this better than sending the whole file?**
- ✅ Faster initial load (video starts playing sooner)
- ✅ Less bandwidth waste (only load what's watched)
- ✅ Seekable (user can jump to any part)
- ✅ Mobile-friendly (doesn't consume entire data plan)

### **✅ Key Takeaway:**
Video streaming uses **chunked delivery** via HTTP range requests, allowing instant playback and efficient bandwidth usage.

---

## Q4: How does multi-tenant architecture work?

**A:** **Multi-tenancy** means multiple organizations use the same system, but their data is completely isolated!

### **Tenant Isolation Strategy:**

```
Organization A                Organization B
    ↓                             ↓
Users: [user1, user2]         Users: [user3, user4]
    ↓                             ↓
Videos: [video1, video2]      Videos: [video5, video6]
    ↓                             ↓
SAME DATABASE                 SAME DATABASE
BUT FILTERED BY organizationId
```

### **💡 Real Code from Your Project:**

#### **User Registration - Creating Organization**
```javascript
// backend/src/controllers/auth.controller.js
export const register = async (req, res) => {
  const { email, password, name, organizationName, role } = req.body;

  let organization;
  let userRole = 'editor';

  if (organizationName) {
    // User is creating a NEW organization
    organization = new Organization({
      name: organizationName,
      slug: generateSlug(organizationName)
    });
    await organization.save();
    userRole = 'admin';  // First user is admin
  } else {
    // User is joining without organization
    // They can be invited later
    userRole = role || 'editor';
  }

  const user = new User({
    email,
    password,
    name,
    role: userRole,
    organizationId: organization?._id
  });

  await user.save();

  res.status(201).json({
    success: true,
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
    }
  });
};
```

#### **Authentication Middleware - Adding Organization Context**
```javascript
// backend/src/middleware/auth.js
export const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken || 
                  req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Attach user context to request
    req.userId = decoded.userId;
    req.organizationId = decoded.organizationId;  // ← Tenant ID
    req.userRole = decoded.role;

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

#### **Data Filtering by Organization**
```javascript
// backend/src/controllers/video.controller.js
export const getVideos = async (req, res) => {
  try {
    // Only fetch videos belonging to user's organization
    const videos = await Video.find({
      organizationId: req.organizationId  // ← Tenant filter
    })
    .populate('uploadedBy', 'name email')
    .sort({ createdAt: -1 });

    res.json({ videos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

#### **RBAC Middleware - Organization-Level Access**
```javascript
// backend/src/middleware/rbac.js
export const checkOrganizationAccess = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const video = await Video.findById(videoId);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check if video belongs to user's organization
    if (video.organizationId.toString() !== req.organizationId) {
      return res.status(403).json({ 
        error: 'Access denied - different organization' 
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### **🔍 Deep Dive: Database Schema Design**

#### **User Model with Organization**
```javascript
// backend/src/models/User.js
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['viewer', 'editor', 'admin'], 
    default: 'viewer' 
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false  // Can be null for invited users
  }
}, { timestamps: true });

// Compound index for fast queries
userSchema.index({ email: 1, organizationId: 1 });
```

#### **Video Model with Organization**
```javascript
// backend/src/models/Video.js
const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  filePath: { type: String, required: true },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true  // ← Fast filtering by organization
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  visibility: {
    type: String,
    enum: ['private', 'organization', 'public'],
    default: 'private'
  }
}, { timestamps: true });

// Compound index for tenant + time queries
videoSchema.index({ organizationId: 1, createdAt: -1 });
```

### **✅ Key Takeaway:**
Multi-tenancy is achieved by storing an `organizationId` in every data record and filtering all queries by it, ensuring complete data isolation between tenants.

---

## Q5: What is the complete request/response lifecycle?

**A:** Every API request goes through a **pipeline of middleware** before reaching your controller!

### **Request Lifecycle:**

```
1. HTTP REQUEST arrives
    ↓
2. Express receives it
    ↓
3. CORS middleware (allow frontend)
    ↓
4. Helmet middleware (security headers)
    ↓
5. Body Parser (parse JSON)
    ↓
6. Cookie Parser (extract JWT)
    ↓
7. Rate Limiter (prevent abuse)
    ↓
8. Authentication (verify JWT)
    ↓
9. Authorization (check role)
    ↓
10. Validation (check data)
    ↓
11. CONTROLLER (business logic)
    ↓
12. RESPONSE sent back
    ↓
13. Error Handler (if error occurred)
```

### **💡 Real Code from Your Project:**

```javascript
// backend/src/routes/video.routes.js
import express from 'express';
import { upload } from '../middleware/upload.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate, schemas } from '../middleware/validator.js';
import { uploadVideo, getVideos } from '../controllers/video.controller.js';

const router = express.Router();

// Each middleware runs in sequence
router.post(
  '/upload',
  authenticate,                    // 1. Verify JWT token
  authorize('editor', 'admin'),    // 2. Check role
  upload.single('video'),          // 3. Handle file upload
  validate(schemas.uploadVideo),   // 4. Validate request data
  uploadVideo                      // 5. Execute controller
);

router.get(
  '/',
  authenticate,                    // 1. Verify JWT token
  getVideos                        // 2. Execute controller
);

export default router;
```

### **🔍 Deep Dive: Middleware Chain Visualization**

```
User Uploads Video → POST /api/videos/upload
                        ↓
    ┌───────────────────────────────────────┐
    │ 1. authenticate middleware            │
    │    - Extract JWT from cookie          │
    │    - Verify signature                 │
    │    - Decode userId, organizationId    │
    │    - Attach to req object             │
    └───────────────┬───────────────────────┘
                    ↓ req.userId = 12345
                    ↓ req.organizationId = 67890
    ┌───────────────────────────────────────┐
    │ 2. authorize middleware               │
    │    - Check req.userRole               │
    │    - Must be 'editor' or 'admin'      │
    │    - Reject if 'viewer'               │
    └───────────────┬───────────────────────┘
                    ↓ req.userRole = 'editor' ✅
    ┌───────────────────────────────────────┐
    │ 3. multer upload middleware           │
    │    - Parse multipart/form-data        │
    │    - Validate file type (MP4 only)    │
    │    - Check file size (max 500MB)      │
    │    - Save to disk                     │
    └───────────────┬───────────────────────┘
                    ↓ req.file = { path, size, ... }
    ┌───────────────────────────────────────┐
    │ 4. validate middleware                │
    │    - Check req.body.title exists      │
    │    - Validate description length      │
    │    - Check visibility enum            │
    └───────────────┬───────────────────────┘
                    ↓ All validation passed ✅
    ┌───────────────────────────────────────┐
    │ 5. uploadVideo CONTROLLER             │
    │    - Create Video document            │
    │    - Save to MongoDB                  │
    │    - Add to processing queue          │
    │    - Send response                    │
    └───────────────┬───────────────────────┘
                    ↓
            res.json({ success: true })
```

### **✅ Key Takeaway:**
Every request passes through a **middleware pipeline** that handles cross-cutting concerns (auth, validation, logging) before reaching business logic.

---

## 🚀 Try This Exercise!

**Debug Challenge:** Trace a video upload request through your system:

1. Set a breakpoint in `frontend/src/pages/Upload.jsx` at the `handleUpload` function
2. Set another breakpoint in `backend/src/controllers/video.controller.js` at `uploadVideo`
3. Upload a video and watch the flow
4. Check the MongoDB database to see the record
5. Check Redis to see the queue entry
6. Watch the worker process the video
7. See the Socket.IO event in browser console

**Build Challenge:** Add a new field "tags" to videos:
1. Update the frontend upload form
2. Update the Joi validation schema
3. Update the Video model
4. Update the controller to save tags
5. Add tag-based filtering to the library

---

## Next Steps

Now that you understand the big picture, dive deeper into:
- 📖 **Level 2:** Backend Architecture (Node.js, Express)
- 📖 **Level 3:** Frontend Architecture (React, Vite)
- 📖 **Socket.IO:** Real-time communication details
- 📖 **Video Streaming:** HTTP range requests explained

**Continue to:** `02_LEVEL2_BACKEND_ARCHITECTURE.md`

