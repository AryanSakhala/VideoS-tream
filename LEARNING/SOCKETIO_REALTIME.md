# Socket.IO - Real-Time Communication 🔌

## Understanding WebSockets and Real-Time Updates

---

## Q1: What is Socket.IO and why do we need it?

**A:** Socket.IO enables **bi-directional, real-time communication** between browser and server using WebSockets!

### **The Problem Without Socket.IO:**

```javascript
// ❌ BAD: Polling every second to check video status
setInterval(async () => {
  const response = await fetch('/api/videos/12345');
  const video = await response.json();
  console.log('Status:', video.status);
}, 1000);  // Wastes bandwidth, delays updates
```

**Problems:**
- 🔴 Wastes bandwidth (constant unnecessary requests)
- 🔴 Battery drain on mobile devices
- 🔴 Delayed updates (1-second lag minimum)
- 🔴 Servers overloaded with polling requests

### **The Solution With Socket.IO:**

```javascript
// ✅ GOOD: Server pushes updates instantly
socket.on('video:processed', (video) => {
  console.log('Video ready!', video);
  // Update UI immediately
});
```

**Benefits:**
- ✅ Instant updates (no polling delay)
- ✅ Minimal bandwidth usage
- ✅ Battery efficient
- ✅ Scalable for thousands of users

---

## Q2: How does Socket.IO work under the hood?

**A:** Socket.IO establishes a **persistent connection** between client and server that stays open for bidirectional communication.

### **Connection Lifecycle:**

```
1. CLIENT: "I want to connect via WebSocket"
    ↓
2. SERVER: "Let me check... WebSocket supported? Yes!"
    ↓
3. HANDSHAKE: Exchange session IDs
    ↓
4. CONNECTION ESTABLISHED (persistent)
    ↓
5. Both sides can send messages anytime
    ↓
6. CONNECTION STAYS OPEN until closed
```

### **💡 Real Code from Your Project:**

#### **Backend: Socket.IO Server Setup**
```javascript
// backend/src/socket/socket.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';

let io;

export const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: config.frontendUrl,
      credentials: true
    },
    transports: ['websocket', 'polling']  // Fallback options
  });

  // Middleware: Authenticate before connection
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, config.jwtSecret);
      
      // Attach user data to socket
      socket.userId = decoded.userId;
      socket.organizationId = decoded.organizationId;
      socket.userRole = decoded.role;

      next();  // Allow connection
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Handle new connections
  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);

    // Join organization-specific room
    socket.join(socket.organizationId);
    console.log(`📁 User joined room: ${socket.organizationId}`);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`❌ User disconnected: ${socket.userId}, Reason: ${reason}`);
    });

    // Custom event: Request video update
    socket.on('video:subscribe', (videoId) => {
      socket.join(`video:${videoId}`);
      console.log(`🎥 User subscribed to video: ${videoId}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};
```

#### **Frontend: Socket.IO Client Setup**
```javascript
// frontend/src/services/websocket.service.js
import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect(token) {
    if (this.socket?.connected) {
      return;  // Already connected
    }

    const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

    this.socket = io(WS_URL, {
      auth: { token },  // Send JWT for authentication
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    // Connection successful
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected:', this.socket.id);
    });

    // Connection failed
    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error.message);
    });

    // Disconnected
    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ WebSocket disconnected:', reason);
    });
  }

  // Subscribe to video processing updates
  on(event, callback) {
    if (!this.socket) {
      console.warn('Socket not initialized');
      return;
    }

    this.socket.on(event, callback);
    
    // Store for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // Emit custom events
  emit(event, data) {
    if (!this.socket) {
      console.warn('Socket not initialized');
      return;
    }
    this.socket.emit(event, data);
  }

  disconnect() {
    if (this.socket) {
      // Clean up all listeners
      this.listeners.forEach((callbacks, event) => {
        callbacks.forEach(callback => {
          this.socket.off(event, callback);
        });
      });
      this.listeners.clear();

      this.socket.disconnect();
      this.socket = null;
      console.log('🔌 WebSocket disconnected');
    }
  }
}

export default new WebSocketService();
```

---

## Q3: How do rooms work in Socket.IO?

**A:** **Rooms** are like chat channels - you can group sockets together and broadcast messages to specific groups!

### **Room Concept:**

```
Organization A Room               Organization B Room
├── Socket 1 (User A1)           ├── Socket 3 (User B1)
└── Socket 2 (User A2)           └── Socket 4 (User B2)

When video processes in Org A:
  io.to('orgA-room').emit('video:processed', data)
  
Only Socket 1 and Socket 2 receive the update!
Socket 3 and Socket 4 do NOT receive it (different room)
```

### **💡 Real Code from Your Project:**

#### **Joining Organization Room on Connection**
```javascript
// backend/src/socket/socket.js
io.on('connection', (socket) => {
  // Every user joins their organization's room
  socket.join(socket.organizationId);
  
  console.log(`User ${socket.userId} joined room: ${socket.organizationId}`);
});
```

#### **Broadcasting to Organization Room**
```javascript
// backend/src/workers/videoProcessor.worker.js
import { getIO } from '../socket/socket.js';

videoQueue.process(async (job) => {
  const { videoId } = job.data;
  const video = await Video.findById(videoId);

  // ... video processing ...

  // Update database
  video.status = 'completed';
  await video.save();

  // Notify ALL users in this organization
  const io = getIO();
  io.to(video.organizationId.toString()).emit('video:processed', {
    videoId: video._id,
    status: video.status,
    thumbnail: video.thumbnail,
    sensitivity: video.sensitivity
  });

  console.log(`✅ Notified organization ${video.organizationId}`);
});
```

#### **Frontend: Listening for Updates**
```javascript
// frontend/src/pages/VideoLibrary.jsx
import { useEffect } from 'react';
import websocketService from '../services/websocket.service';

const VideoLibrary = () => {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    // Listen for video processing completion
    websocketService.on('video:processed', (data) => {
      console.log('📹 Video processed:', data);

      // Update the video in the list
      setVideos(prevVideos =>
        prevVideos.map(video =>
          video._id === data.videoId
            ? { ...video, ...data }  // Merge updates
            : video
        )
      );
    });

    // Cleanup on unmount
    return () => {
      websocketService.disconnect();
    };
  }, []);

  return (
    <div>
      {videos.map(video => (
        <VideoCard key={video._id} video={video} />
      ))}
    </div>
  );
};
```

---

## Q4: How does Socket.IO handle reconnections?

**A:** Socket.IO has **built-in reconnection logic** with exponential backoff!

### **Reconnection Strategy:**

```
1. Connection Lost (network issue)
    ↓
2. Wait 1 second → Try to reconnect
    ↓ Failed
3. Wait 2 seconds → Try again
    ↓ Failed
4. Wait 4 seconds → Try again
    ↓ Failed
5. Wait 8 seconds → Try again
    ↓ Success!
6. Rejoin all rooms automatically
```

### **💡 Configuration in Your Project:**

```javascript
// frontend/src/services/websocket.service.js
this.socket = io(WS_URL, {
  reconnection: true,              // Enable reconnection
  reconnectionDelay: 1000,         // Start with 1 second
  reconnectionDelayMax: 5000,      // Max 5 seconds between attempts
  reconnectionAttempts: 5,         // Try 5 times before giving up
  timeout: 20000                   // Connection timeout: 20 seconds
});

// Handle reconnection events
this.socket.on('reconnect', (attemptNumber) => {
  console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
});

this.socket.on('reconnect_attempt', (attemptNumber) => {
  console.log(`🔁 Reconnection attempt #${attemptNumber}`);
});

this.socket.on('reconnect_failed', () => {
  console.error('❌ Failed to reconnect after all attempts');
  // Show user notification
  alert('Lost connection to server. Please refresh the page.');
});
```

---

## Q5: What's the difference between WebSocket and HTTP?

**A:** They serve different purposes!

### **HTTP (Traditional API Calls):**

```
CLIENT                          SERVER
   │                               │
   │──── GET /api/videos ────────>│
   │                               │
   │<──── Response (videos) ──────│
   │                               │
Connection CLOSED immediately
```

**Characteristics:**
- Request-Response pattern
- Client initiates every interaction
- New connection for each request
- Stateless (no session memory)
- Good for: Fetching data, CRUD operations

### **WebSocket (Real-Time Communication):**

```
CLIENT                          SERVER
   │                               │
   │──── Handshake ───────────────>│
   │<──── Connection Accepted ─────│
   │                               │
   │<──── video:processed ─────────│
   │                               │
   │──── video:subscribe ─────────>│
   │                               │
   │<──── progress:update ─────────│
   │                               │
Connection STAYS OPEN
```

**Characteristics:**
- Bidirectional communication
- Both sides can send messages anytime
- Single persistent connection
- Stateful (maintains session)
- Good for: Live updates, chat, notifications

### **💡 When to Use Each:**

```javascript
// ✅ USE HTTP for data fetching
const fetchVideos = async () => {
  const response = await axios.get('/api/videos');
  return response.data;
};

// ✅ USE WebSocket for real-time updates
websocketService.on('video:processed', (data) => {
  updateUI(data);  // Instant UI update
});
```

---

## Q6: How do you emit events from backend to frontend?

**A:** Use `io.emit()`, `io.to(room).emit()`, or `socket.emit()` depending on who should receive!

### **3 Types of Emitting:**

#### **1. Broadcast to ALL connected clients**
```javascript
// backend - Send to EVERYONE
io.emit('server:announcement', {
  message: 'Server maintenance in 5 minutes'
});
```

#### **2. Send to specific ROOM (organization)**
```javascript
// backend - Send to ONE ORGANIZATION
io.to(organizationId).emit('video:processed', {
  videoId: video._id,
  status: 'completed'
});
```

#### **3. Send to ONE specific socket**
```javascript
// backend - Send to individual user
socket.emit('notification:personal', {
  message: 'Your video is ready!'
});
```

### **💡 Real Example from Your Project:**

```javascript
// backend/src/workers/videoProcessor.worker.js
videoQueue.process(async (job) => {
  const { videoId } = job.data;
  const video = await Video.findById(videoId);
  const io = getIO();

  try {
    // Progress: 10% - Extracting metadata
    io.to(video.organizationId.toString()).emit('video:progress', {
      videoId: video._id,
      progress: 10,
      stage: 'metadata'
    });

    const metadata = await ffmpeg.getMetadata(filePath);

    // Progress: 40% - Generating thumbnail
    io.to(video.organizationId.toString()).emit('video:progress', {
      videoId: video._id,
      progress: 40,
      stage: 'thumbnail'
    });

    const thumbnail = await ffmpeg.generateThumbnail(filePath);

    // Progress: 70% - Analyzing sensitivity
    io.to(video.organizationId.toString()).emit('video:progress', {
      videoId: video._id,
      progress: 70,
      stage: 'sensitivity'
    });

    const sensitivity = await sensitivityService.analyze(filePath);

    // Progress: 100% - Complete
    video.status = 'completed';
    video.metadata = metadata;
    video.thumbnail = thumbnail;
    video.sensitivity = sensitivity;
    await video.save();

    io.to(video.organizationId.toString()).emit('video:processed', {
      videoId: video._id,
      status: 'completed',
      metadata,
      thumbnail,
      sensitivity
    });

  } catch (error) {
    // Notify about failure
    io.to(video.organizationId.toString()).emit('video:failed', {
      videoId: video._id,
      error: error.message
    });
  }
});
```

---

## Q7: How do you handle authentication with Socket.IO?

**A:** Use **middleware** to verify JWT tokens before allowing connections!

### **Authentication Flow:**

```
1. User logs in → Receives JWT token
2. Frontend stores token
3. Socket.IO client sends token during handshake
4. Server middleware verifies token
5. If valid → Allow connection
6. If invalid → Reject connection
```

### **💡 Real Code from Your Project:**

#### **Backend: Auth Middleware**
```javascript
// backend/src/socket/socket.js
io.use((socket, next) => {
  try {
    // Extract token from handshake
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    // Verify JWT
    const decoded = jwt.verify(token, config.jwtSecret);

    // Attach user data to socket instance
    socket.userId = decoded.userId;
    socket.organizationId = decoded.organizationId;
    socket.userRole = decoded.role;

    next();  // ✅ Connection allowed

  } catch (error) {
    next(new Error('Invalid token'));  // ❌ Connection rejected
  }
});
```

#### **Frontend: Send Token During Connection**
```javascript
// frontend/src/contexts/AuthContext.jsx
useEffect(() => {
  if (user && user.accessToken) {
    // Connect to WebSocket with authentication
    websocketService.connect(user.accessToken);
  }

  return () => {
    websocketService.disconnect();
  };
}, [user]);
```

---

## Q8: What happens if video processing takes a long time?

**A:** Socket.IO sends **progress updates** throughout the process!

### **Progress Update Strategy:**

```
Video Upload (5 seconds)
    ↓
Queue Job (instant)
    ↓
Processing Starts
    ↓
Progress: 10% - "Extracting metadata"
    ↓ Emit event
Progress: 40% - "Generating thumbnail"
    ↓ Emit event
Progress: 70% - "Analyzing sensitivity"
    ↓ Emit event
Progress: 100% - "Complete!"
    ↓ Emit event
```

### **💡 Frontend Implementation:**

```javascript
// frontend/src/pages/VideoLibrary.jsx
const VideoCard = ({ video }) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');

  useEffect(() => {
    // Listen for progress updates
    websocketService.on('video:progress', (data) => {
      if (data.videoId === video._id) {
        setProgress(data.progress);
        setStage(data.stage);
      }
    });

    // Listen for completion
    websocketService.on('video:processed', (data) => {
      if (data.videoId === video._id) {
        setProgress(100);
        // Refresh video data
      }
    });
  }, [video._id]);

  return (
    <div className="video-card">
      {video.status === 'processing' && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
          <span>{stage} - {progress}%</span>
        </div>
      )}
    </div>
  );
};
```

---

## ✅ Key Takeaways

1. **Socket.IO enables instant bidirectional communication** without polling
2. **Rooms allow targeted messaging** to specific organizations/groups
3. **Built-in reconnection** handles network interruptions automatically
4. **Authentication via JWT** ensures only authorized users connect
5. **Progress events** provide real-time feedback for long operations

---

## 🚀 Try This Exercise!

**Build a Chat Feature:**
1. Add a `chat:message` event to the Socket.IO server
2. Create a chat component in the frontend
3. Emit messages from one user
4. Broadcast to all users in the same organization
5. Display messages in real-time

**Debug Challenge:**
1. Open browser DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. Upload a video
4. Watch the WebSocket frames
5. See the real-time events being sent!

---

**Next:** Read `VIDEO_STREAMING.md` to learn about HTTP range requests!

