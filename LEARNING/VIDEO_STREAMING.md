# Video Streaming - HTTP Range Requests 🎬

## Understanding Efficient Video Delivery

---

## Q1: How does video streaming actually work?

**A:** Video streaming uses **HTTP Range Requests** to send video in small chunks, not the entire file at once!

### **Traditional Download (Bad):**

```
USER: "Send me video.mp4"
SERVER: "OK, here's all 500MB at once"
USER: Waits 5 minutes... then video plays

Problems:
❌ Must download entire file before playback
❌ Wastes bandwidth if user stops watching
❌ Can't seek to middle of video
❌ Mobile users use entire data plan
```

### **Chunked Streaming (Good):**

```
USER: "Send me the first 1MB of video.mp4"
SERVER: "Here's bytes 0-1048576"
USER: Starts playing immediately!
USER: "Now send me the next 1MB"
SERVER: "Here's bytes 1048577-2097152"
...continues as needed

Benefits:
✅ Video starts instantly
✅ Only loads what you watch
✅ Can seek to any position
✅ Mobile-friendly
```

---

## Q2: What is an HTTP Range Request?

**A:** A Range Request asks for **specific bytes** of a file, not the whole thing!

### **Standard HTTP Request:**

```http
GET /api/stream/12345/video HTTP/1.1
Host: localhost:5000
```

**Server sends:** Entire file (500MB)

### **Range HTTP Request:**

```http
GET /api/stream/12345/video HTTP/1.1
Host: localhost:5000
Range: bytes=0-1048575
```

**Server sends:** Only first 1MB (bytes 0 to 1,048,575)

### **Server Response:**

```http
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1048575/524288000
Content-Length: 1048576
Content-Type: video/mp4

[Binary video data - first 1MB]
```

**Key Headers:**
- `206 Partial Content` - "I'm sending part of the file, not all"
- `Content-Range` - "This is bytes 0-1048575 out of 524288000 total"
- `Accept-Ranges: bytes` - "I support range requests"

---

## Q3: How is this implemented in your backend?

**A:** The stream controller reads and sends specific byte ranges from the video file!

### **💡 Real Code from Your Project:**

```javascript
// backend/src/controllers/stream.controller.js
import fs from 'fs';
import path from 'path';
import Video from '../models/Video.js';

export const streamVideo = async (req, res) => {
  try {
    const { videoId } = req.params;

    // 1. Find video in database
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // 2. Check access permissions
    if (video.organizationId.toString() !== req.organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 3. Get file info
    const videoPath = video.filePath;
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;  // Total file size in bytes

    // 4. Check if client sent Range header
    const range = req.headers.range;

    if (range) {
      // CLIENT REQUESTED SPECIFIC BYTES
      
      // Parse: "bytes=0-1048575" → start=0, end=1048575
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      
      const chunkSize = (end - start) + 1;

      // 5. Create read stream for ONLY this chunk
      const fileStream = fs.createReadStream(videoPath, { start, end });

      // 6. Send 206 Partial Content response
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=31536000'  // Cache for 1 year
      });

      // 7. Stream the chunk
      fileStream.pipe(res);

    } else {
      // NO RANGE - Send entire file (fallback)
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      });

      fs.createReadStream(videoPath).pipe(res);
    }

  } catch (error) {
    console.error('Streaming error:', error);
    res.status(500).json({ error: error.message });
  }
};
```

### **🔍 Deep Dive: What is `fs.createReadStream()`?**

Instead of loading the entire file into memory:
```javascript
// ❌ BAD: Loads entire file into RAM
const fileData = fs.readFileSync(videoPath);  // 500MB in memory!
res.send(fileData);
```

Use streams to read and send incrementally:
```javascript
// ✅ GOOD: Reads in small chunks (64KB at a time)
const stream = fs.createReadStream(videoPath, { start: 0, end: 1048575 });
stream.pipe(res);  // Pipe directly to response
```

**Memory usage:** ~64KB instead of 500MB!

---

## Q4: How does the video player request chunks?

**A:** The HTML5 `<video>` element **automatically sends Range requests** as needed!

### **💡 Frontend Implementation:**

```javascript
// frontend/src/pages/VideoDetail.jsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import videoService from '../services/video.service';

const VideoDetail = () => {
  const { id } = useParams();
  const [video, setVideo] = useState(null);

  useEffect(() => {
    loadVideo();
  }, [id]);

  const loadVideo = async () => {
    const data = await videoService.getVideo(id);
    setVideo(data);
  };

  if (!video) return <div>Loading...</div>;

  // Build URLs with authentication token
  const token = localStorage.getItem('accessToken');
  const videoUrl = `${import.meta.env.VITE_API_URL}/stream/${video._id}/video?token=${token}`;
  const thumbnailUrl = `${import.meta.env.VITE_API_URL}/stream/${video._id}/thumbnail?token=${token}`;

  return (
    <div className="video-container">
      {/* HTML5 video player handles Range requests automatically */}
      <video
        controls
        poster={thumbnailUrl}
        className="w-full rounded-lg"
        preload="metadata"  // Load only metadata initially
      >
        <source src={videoUrl} type="video/mp4" />
        Your browser does not support video playback.
      </video>

      <div className="video-info">
        <h1>{video.title}</h1>
        <p>{video.description}</p>
      </div>
    </div>
  );
};
```

### **What Happens Behind the Scenes:**

```
1. Browser loads <video> element
    ↓
2. Requests metadata (first few KB)
   Range: bytes=0-8191
    ↓
3. Displays thumbnail and duration
    ↓
4. User clicks PLAY
    ↓
5. Requests first chunk for playback
   Range: bytes=0-1048575
    ↓
6. Starts playing while downloading
    ↓
7. As playback nears end of buffer...
   Requests next chunk
   Range: bytes=1048576-2097151
    ↓
8. Seamless playback continues!
```

---

## Q5: What happens when user seeks/skips to the middle?

**A:** The player requests a **different byte range** starting from that position!

### **Seeking Example:**

```
Video: 500MB total (524,288,000 bytes)
User watches first 10 seconds...

Then user CLICKS at 2:30 (middle of video)
    ↓
Browser calculates byte position:
  2:30 into 5:00 video = 50% through
  50% of 524,288,000 = 262,144,000 bytes
    ↓
Browser sends:
  Range: bytes=262144000-263192575
    ↓
Backend sends that chunk
    ↓
Video starts playing from 2:30!
```

### **💡 Why This is Efficient:**

```
WITHOUT range requests:
  Must download 0-262MB before reaching 2:30 mark
  Wasted bandwidth: 262MB
  
WITH range requests:
  Jump directly to byte 262,144,000
  Wasted bandwidth: 0MB
  Instant seeking!
```

---

## Q6: How do you handle authentication for streaming?

**A:** Use **query parameter tokens** since `<video>` tags can't send custom headers!

### **The Problem:**

```javascript
// ❌ DOESN'T WORK: <video> can't send Authorization header
<video>
  <source src="http://localhost:5000/api/stream/12345/video" />
</video>

// Backend tries to read req.headers.authorization
// → undefined ❌
```

### **The Solution:**

```javascript
// ✅ WORKS: Send token as query parameter
const token = localStorage.getItem('accessToken');
const videoUrl = `http://localhost:5000/api/stream/12345/video?token=${token}`;

<video>
  <source src={videoUrl} />
</video>
```

### **💡 Backend Implementation:**

```javascript
// backend/src/middleware/auth.js
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Try to get token from multiple sources
    if (req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization) {
      token = req.headers.authorization.replace('Bearer ', '');
    } else if (req.query.token) {
      // ← For video streaming!
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    req.userId = decoded.userId;
    req.organizationId = decoded.organizationId;
    req.userRole = decoded.role;

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

```javascript
// backend/src/routes/stream.routes.js
import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { streamVideo, getThumbnail } from '../controllers/stream.controller.js';

const router = express.Router();

// Use optionalAuth (supports query token)
router.get('/:videoId/video', optionalAuth, streamVideo);
router.get('/:videoId/thumbnail', optionalAuth, getThumbnail);

export default router;
```

---

## Q7: How do you serve thumbnails efficiently?

**A:** Same pattern as video streaming, but simpler since thumbnails are small!

### **💡 Real Code from Your Project:**

```javascript
// backend/src/controllers/stream.controller.js
export const getThumbnail = async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = await Video.findById(videoId);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check access
    if (video.organizationId.toString() !== req.organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get thumbnail path (check both fields for backward compatibility)
    const thumbnailPath = video.thumbnail || video.thumbnailUrl;

    if (!thumbnailPath || !fs.existsSync(thumbnailPath)) {
      return res.status(404).json({ error: 'Thumbnail not found' });
    }

    // Send thumbnail (no Range needed - small file)
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000');  // Cache 1 year

    fs.createReadStream(thumbnailPath).pipe(res);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### **Why No Range Requests for Thumbnails?**

Thumbnails are small (~50-200KB), so:
- ✅ Send entire file at once
- ✅ Browser caches it
- ✅ No need for chunking overhead

---

## Q8: What about caching and performance?

**A:** Use **HTTP caching headers** to avoid re-downloading the same content!

### **Caching Strategy:**

```javascript
// backend/src/controllers/stream.controller.js
res.writeHead(206, {
  'Content-Range': `bytes ${start}-${end}/${fileSize}`,
  'Accept-Ranges': 'bytes',
  'Content-Length': chunkSize,
  'Content-Type': 'video/mp4',
  
  // CACHING HEADERS
  'Cache-Control': 'public, max-age=31536000',  // Cache for 1 year
  'ETag': `"${video._id}-${stat.mtime.getTime()}"`,  // Unique identifier
  'Last-Modified': stat.mtime.toUTCString()  // When file was last modified
});
```

### **How Caching Works:**

```
FIRST REQUEST:
  Browser: "Give me video"
  Server: "Here's the video + Cache for 1 year"
  Browser: *saves to cache*

SECOND REQUEST (same video):
  Browser: "I have video cached, ETag: xyz"
  Server: "ETag matches? Yes → 304 Not Modified"
  Browser: *uses cached version*
  
NO DATA TRANSFERRED! ✅
```

### **🔍 Deep Dive: Cache Headers Explained**

```javascript
// Tell browser it's OK to cache
'Cache-Control': 'public, max-age=31536000'
//                ^^^^^^  ^^^^^^^^^^^^^^^^^^
//                Anyone  Cache for 1 year (in seconds)

// Unique version identifier
'ETag': '"12345-1698765432000"'
//       ^^^^^^  ^^^^^^^^^^^^^^
//       VideoID LastModified timestamp

// When file was last changed
'Last-Modified': 'Mon, 01 Nov 2025 10:00:00 GMT'
```

---

## Q9: How do you handle video processing status?

**A:** Return appropriate HTTP status codes based on video state!

### **💡 Status Handling:**

```javascript
// backend/src/controllers/stream.controller.js
export const streamVideo = async (req, res) => {
  const video = await Video.findById(videoId);

  // Check video status
  if (video.status === 'processing') {
    return res.status(202).json({
      message: 'Video is still processing',
      progress: video.processingProgress || 0
    });
  }

  if (video.status === 'failed') {
    return res.status(500).json({
      error: 'Video processing failed',
      reason: video.error
    });
  }

  if (video.status === 'completed') {
    // Stream the video (code from above)
  }
};
```

### **HTTP Status Codes:**

- `200 OK` - Full file sent
- `206 Partial Content` - Chunk sent (Range request)
- `202 Accepted` - Processing in progress
- `401 Unauthorized` - No valid token
- `403 Forbidden` - Wrong organization
- `404 Not Found` - Video doesn't exist
- `416 Range Not Satisfiable` - Invalid byte range
- `500 Internal Server Error` - Server issue

---

## Q10: Can you stream to multiple devices simultaneously?

**A:** Yes! Each device gets its own stream, and range requests make this efficient!

### **Concurrent Streaming:**

```
Device 1 (Desktop):
  Request: bytes=0-1048575 (playing from start)
    ↓
  Server sends chunk 1 to Device 1

Device 2 (Mobile):
  Request: bytes=52428800-53477375 (seeked to middle)
    ↓
  Server sends chunk 50 to Device 2

Device 3 (Tablet):
  Request: bytes=104857600-105906175 (seeked to end)
    ↓
  Server sends chunk 100 to Device 3

ALL SIMULTANEOUS! No conflicts!
```

### **Why This Works:**

- Each request is **independent**
- File is **read-only** (not modified)
- Streams use **minimal memory** (64KB buffer per request)
- Node.js handles **concurrent I/O** efficiently

---

## ✅ Key Takeaways

1. **HTTP Range Requests** enable efficient video streaming by sending chunks
2. **206 Partial Content** response indicates chunk delivery
3. **HTML5 video player** automatically handles Range requests
4. **Query parameter tokens** solve authentication for `<video>` tags
5. **Caching headers** reduce bandwidth and improve performance
6. **Streaming uses minimal memory** thanks to Node.js streams

---

## 🚀 Try This Exercise!

**Debug Challenge:**
1. Open browser DevTools → Network tab
2. Click on a video to play it
3. Find the video request
4. Look at Request Headers → See `Range: bytes=...`
5. Look at Response Headers → See `206 Partial Content`
6. Seek to middle of video
7. See NEW request with different byte range!

**Build Challenge:**
1. Add video quality selection (480p, 720p, 1080p)
2. Generate multiple quality versions during processing
3. Let user switch quality mid-playback
4. Stream appropriate version based on selection

---

**Next:** Read `VIDEO_PROCESSING.md` to learn about FFmpeg and thumbnail generation!

