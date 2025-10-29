# Node.js Architecture - Under the Hood ⚙️

## Understanding How Node.js Works

---

## Q1: What is Node.js and how is it different from browser JavaScript?

**A:** Node.js is **JavaScript running on the server** (not in a browser), with access to file systems, networks, and operating system features!

### **Browser JavaScript:**

```javascript
// Can access browser APIs
document.getElementById('btn');  // ✅ DOM access
localStorage.setItem('key', 'value');  // ✅ Web Storage API
fetch('https://api.example.com');  // ✅ Network requests (browser-controlled)

// Cannot access system resources
fs.readFile('file.txt');  // ❌ No file system access
require('express');  // ❌ No Node.js modules
```

### **Node.js:**

```javascript
// Can access server APIs
const fs = require('fs');  // ✅ File system access
const http = require('http');  // ✅ Create HTTP servers
const path = require('path');  // ✅ Path manipulation

// Cannot access browser APIs
document.getElementById('btn');  // ❌ No DOM
window.location.href;  // ❌ No window object
localStorage.setItem();  // ❌ No browser storage
```

---

## Q2: What is the Node.js Event Loop?

**A:** The Event Loop is the **heart of Node.js** - it handles asynchronous operations without blocking the main thread!

### **Traditional Multi-Threaded (e.g., Apache):**

```
Request 1 arrives → Create Thread 1 (2MB RAM)
Request 2 arrives → Create Thread 2 (2MB RAM)
Request 3 arrives → Create Thread 3 (2MB RAM)
...
Request 10,000 → Create Thread 10,000 (20GB RAM!) 💥

Problems:
❌ Each thread uses memory
❌ Context switching overhead
❌ Limited by CPU cores
```

### **Node.js Event Loop (Single-Threaded):**

```
ALL requests handled by ONE thread! 🎯

Request 1 arrives → Add to Event Loop
Request 2 arrives → Add to Event Loop
Request 3 arrives → Add to Event Loop
...
Request 10,000 → Add to Event Loop

Benefits:
✅ Minimal memory overhead
✅ No context switching
✅ Handles thousands of concurrent connections
```

### **How It Works:**

```
┌───────────────────────────────────────────┐
│           Event Loop (Single Thread)       │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │ 1. Timers (setTimeout, setInterval)  │ │
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │ 2. Pending Callbacks (I/O)           │ │
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │ 3. Idle, Prepare (internal)          │ │
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │ 4. Poll (new I/O events)             │ │
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │ 5. Check (setImmediate)              │ │
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │ 6. Close Callbacks (cleanup)         │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  Loop repeats continuously ♻️              │
└───────────────────────────────────────────┘
```

---

## Q3: How does asynchronous code work in Node.js?

**A:** Node.js uses **callbacks, promises, and async/await** to handle operations without blocking!

### **Blocking (Bad) vs Non-Blocking (Good):**

#### **❌ Blocking Code (Synchronous):**
```javascript
// Read file SYNCHRONOUSLY (blocks thread)
const fs = require('fs');

console.log('Start');
const data = fs.readFileSync('large-file.txt', 'utf8');  // WAITS here! ⏸️
console.log('File read complete');
console.log('End');

// During file read, NOTHING else can happen!
// Other users get no response!
```

**Timeline:**
```
0ms: Start
0ms: Reading file... ⏸️ (blocks for 5 seconds)
5000ms: File read complete
5000ms: End
```

#### **✅ Non-Blocking Code (Asynchronous):**
```javascript
// Read file ASYNCHRONOUSLY (doesn't block)
const fs = require('fs').promises;

console.log('Start');
fs.readFile('large-file.txt', 'utf8').then(data => {
  console.log('File read complete');
});
console.log('End');  // Executes IMMEDIATELY!

// Thread continues, file reads in background
// Other users get responses!
```

**Timeline:**
```
0ms: Start
0ms: Reading file... (in background)
1ms: End (continues immediately)
5000ms: File read complete (callback fires)
```

---

## Q4: What are callbacks, promises, and async/await?

**A:** Three ways to handle asynchronous operations, each improving on the previous!

### **1. Callbacks (Old Way):**

```javascript
// Nested callbacks = "Callback Hell" 🔥
fs.readFile('file1.txt', (err, data1) => {
  if (err) return console.error(err);
  
  fs.readFile('file2.txt', (err, data2) => {
    if (err) return console.error(err);
    
    fs.readFile('file3.txt', (err, data3) => {
      if (err) return console.error(err);
      
      console.log('All files read!');
    });
  });
});

// Problems:
// ❌ Hard to read (pyramid of doom)
// ❌ Error handling messy
// ❌ Can't use try/catch
```

### **2. Promises (Better):**

```javascript
// Chained promises = cleaner
fs.promises.readFile('file1.txt')
  .then(data1 => fs.promises.readFile('file2.txt'))
  .then(data2 => fs.promises.readFile('file3.txt'))
  .then(data3 => {
    console.log('All files read!');
  })
  .catch(err => {
    console.error('Error:', err);
  });

// Benefits:
// ✅ Flatter structure
// ✅ Single .catch() for all errors
// ✅ Can chain operations
```

### **3. Async/Await (Best - Modern Way):**

```javascript
// Async/await = looks synchronous, acts asynchronous!
const readFiles = async () => {
  try {
    const data1 = await fs.promises.readFile('file1.txt');
    const data2 = await fs.promises.readFile('file2.txt');
    const data3 = await fs.promises.readFile('file3.txt');
    
    console.log('All files read!');
  } catch (err) {
    console.error('Error:', err);
  }
};

readFiles();

// Benefits:
// ✅ Reads like synchronous code
// ✅ Use try/catch naturally
// ✅ Easier to debug
// ✅ Most readable
```

### **💡 Your Project Uses Async/Await:**

```javascript
// backend/src/controllers/video.controller.js
export const uploadVideo = async (req, res) => {
  try {
    const video = new Video({ ...req.body });
    await video.save();  // ← Waits for save, doesn't block thread
    
    await addToQueue(video._id);  // ← Waits for queue add
    
    res.json({ success: true, video });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

---

## Q5: What is Node.js good at (and not good at)?

**A:** Node.js excels at **I/O-intensive tasks** but struggles with **CPU-intensive tasks**!

### **✅ Perfect For (I/O-Intensive):**

```javascript
// Real-time applications
io.emit('message', data);  // WebSockets/Socket.IO

// API servers
app.get('/users', async (req, res) => {
  const users = await User.find();  // Database I/O
  res.json(users);
});

// File operations
const data = await fs.readFile('file.txt');  // File I/O

// Network requests
const response = await fetch('https://api.example.com');  // Network I/O

// Streaming data
fs.createReadStream('video.mp4').pipe(res);  // Stream I/O
```

**Why it's good:** While waiting for I/O, Node.js handles other requests!

### **❌ Not Great For (CPU-Intensive):**

```javascript
// Video encoding (heavy computation)
ffmpeg.convert(video);  // BLOCKS thread for minutes ⏸️

// Image processing
sharp(image).resize(1000, 1000).toFile();  // BLOCKS thread

// Cryptography (heavy hashing)
bcrypt.hash(password, 10);  // BLOCKS thread

// Complex calculations
for (let i = 0; i < 1000000000; i++) {
  // Complex math
}  // BLOCKS thread
```

**Why it's bad:** Single thread blocked = entire server frozen!

### **💡 Your Project's Solution:**

```javascript
// CPU-intensive tasks offloaded to WORKER processes
videoQueue.process(async (job) => {
  // FFmpeg runs in separate process (doesn't block main thread)
  await ffmpeg.generateThumbnail(filePath);
});
```

---

## Q6: How does Express.js work with Node.js?

**A:** Express.js is a **middleware framework** that simplifies building web servers in Node.js!

### **Raw Node.js HTTP Server:**

```javascript
// Without Express (verbose)
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/users') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ users: [] }));
  } else if (req.method === 'POST' && req.url === '/users') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const user = JSON.parse(body);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ user }));
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(3000);
```

### **With Express.js (Clean):**

```javascript
// With Express (simple!)
const express = require('express');
const app = express();

app.use(express.json());  // Parse JSON automatically

app.get('/users', (req, res) => {
  res.json({ users: [] });
});

app.post('/users', (req, res) => {
  const user = req.body;  // Already parsed!
  res.status(201).json({ user });
});

app.listen(3000);
```

### **💡 Your Project's Express Setup:**

```javascript
// backend/src/app.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

const app = express();

// Security middleware
app.use(helmet());

// CORS (allow frontend)
app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/stream', streamRoutes);

// Error handling
app.use(errorHandler);

export default app;
```

---

## Q7: What are Node.js modules and how do they work?

**A:** Modules are **reusable pieces of code** that can be imported into other files!

### **Three Types of Modules:**

#### **1. Core Modules (Built-in):**
```javascript
const fs = require('fs');        // File system
const http = require('http');    // HTTP server
const path = require('path');    // Path utilities
const crypto = require('crypto'); // Cryptography
```

#### **2. npm Modules (Third-Party):**
```javascript
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Install via: npm install express mongoose jsonwebtoken
```

#### **3. Custom Modules (Your Code):**
```javascript
// utils/logger.js
module.exports = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`)
};

// app.js
const logger = require('./utils/logger');
logger.info('Server started');
```

### **CommonJS vs ES Modules:**

#### **CommonJS (Old Way):**
```javascript
// Export
module.exports = { func1, func2 };

// Import
const myModule = require('./myModule');
```

#### **ES Modules (Modern Way - Your Project):**
```javascript
// Export
export const func1 = () => {};
export default { func1, func2 };

// Import
import myModule from './myModule.js';
import { func1 } from './myModule.js';
```

**Your project uses ES Modules** (note `"type": "module"` in `package.json`)

---

## Q8: How does Node.js handle concurrency?

**A:** Node.js uses **non-blocking I/O** and the **Event Loop** to handle thousands of connections with a single thread!

### **Example: Handling 1000 Concurrent Requests:**

```javascript
// Each request queries database (takes 100ms)
app.get('/users', async (req, res) => {
  const users = await User.find();  // ← 100ms I/O operation
  res.json(users);
});

// 1000 requests arrive at the same time
```

**What Happens:**
```
Request 1: Start query → Wait in Event Loop
Request 2: Start query → Wait in Event Loop
Request 3: Start query → Wait in Event Loop
...
Request 1000: Start query → Wait in Event Loop

All queries run CONCURRENTLY in database!
Node.js thread doesn't wait - handles next request immediately

After ~100ms:
Request 1 callback: Send response
Request 2 callback: Send response
Request 3 callback: Send response
...

Total time: ~100ms (not 100 seconds!)
```

### **💡 Your Project Example:**

```javascript
// backend/src/controllers/video.controller.js
export const getVideos = async (req, res) => {
  try {
    // MongoDB query (I/O operation)
    const videos = await Video.find({ organizationId: req.organizationId });
    // ↑ Thread doesn't block here!
    // Other requests are handled while waiting for DB
    
    res.json({ videos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

While `Video.find()` queries MongoDB, Node.js processes other incoming requests!

---

## Q9: What is the Thread Pool?

**A:** Node.js uses a **Thread Pool** (libuv) for CPU-intensive operations to avoid blocking the main thread!

### **Event Loop vs Thread Pool:**

```
┌─────────────────────────────┐
│   Event Loop (Main Thread)  │
│   - Handle requests          │
│   - Manage I/O callbacks     │
│   - Non-blocking operations  │
└──────────┬──────────────────┘
           │
           │ Offloads CPU-intensive tasks
           ↓
┌─────────────────────────────┐
│   Thread Pool (4 threads)   │
│   - File system operations   │
│   - Cryptography (bcrypt)    │
│   - Compression (zlib)       │
│   - DNS lookups              │
└─────────────────────────────┘
```

### **Operations Using Thread Pool:**

```javascript
// These operations use thread pool (don't block Event Loop)
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');

// File read (thread pool)
fs.readFile('file.txt', callback);

// Password hashing (thread pool)
bcrypt.hash(password, 10, callback);

// Compression (thread pool)
zlib.gzip(data, callback);
```

---

## Q10: How does your project's architecture leverage Node.js?

**A:** Your project uses Node.js strengths perfectly: **async I/O, real-time communication, and background processing**!

### **Architecture Breakdown:**

```javascript
// 1. EXPRESS SERVER (Main Thread - Event Loop)
const app = express();

// Handle API requests (non-blocking)
app.post('/api/videos/upload', async (req, res) => {
  await video.save();  // ← MongoDB I/O (non-blocking)
  await addToQueue(videoId);  // ← Redis I/O (non-blocking)
  res.json({ success: true });
});

// 2. SOCKET.IO (Real-time - Perfect for Node.js)
io.on('connection', (socket) => {
  // Handle thousands of concurrent connections!
  socket.join(socket.organizationId);
});

// 3. BULL QUEUE + WORKER (Background Processing)
videoQueue.process(async (job) => {
  // CPU-intensive FFmpeg runs in SEPARATE PROCESS
  // Doesn't block main Express server!
  await ffmpeg.generateThumbnail(filePath);
});

// 4. STREAMING (Efficient with Node.js Streams)
app.get('/api/stream/:id/video', (req, res) => {
  // Stream video in chunks (minimal memory)
  fs.createReadStream(videoPath, { start, end }).pipe(res);
});
```

**Why This Works Well:**

1. **API requests** → Non-blocking I/O (MongoDB, Redis)
2. **Real-time updates** → Socket.IO excels with persistent connections
3. **File streaming** → Node.js streams handle large files efficiently
4. **Video processing** → Offloaded to separate worker process
5. **Concurrency** → Single thread handles thousands of connections

---

## ✅ Key Takeaways

1. **Node.js = JavaScript on the server** with access to system resources
2. **Event Loop** handles async operations without blocking
3. **Single thread** but non-blocking I/O enables high concurrency
4. **Perfect for I/O-intensive tasks** (APIs, streaming, real-time)
5. **Not ideal for CPU-intensive tasks** (offload to workers)
6. **Async/await** makes asynchronous code readable
7. **Express.js** simplifies HTTP server creation
8. **Modules** enable code reusability and organization

---

## 🚀 Try This Exercise!

**Understanding Event Loop:**
1. Create a file `event-loop-demo.js`:
```javascript
console.log('1. Synchronous');

setTimeout(() => {
  console.log('2. setTimeout (0ms)');
}, 0);

Promise.resolve().then(() => {
  console.log('3. Promise');
});

console.log('4. Synchronous');
```

2. Run it: `node event-loop-demo.js`
3. Output order: 1, 4, 3, 2
4. Why? Event Loop phases!

**Build Challenge:**
1. Create a CPU-intensive endpoint (e.g., calculate Fibonacci)
2. Load test it → See response time degrades for all requests
3. Move calculation to a worker thread
4. Load test again → Response time stays fast!

---

**Next:** Read `QUICK_REFERENCE.md` for a comprehensive cheat sheet!

