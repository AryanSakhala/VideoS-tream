# 🔥 SURVIVAL MODE: Full-Stack Interview Questions

## Based on Your Video Streaming Platform

---

## 1️⃣ NODE.JS (7 Critical Questions)

### Q1: Explain the Node.js Event Loop. What are its phases?
**Answer:** Single-threaded event loop with 6 phases: Timers → Pending Callbacks → Idle/Prepare → Poll → Check → Close Callbacks. Poll phase retrieves I/O events, Timers execute setTimeout/setInterval, Check runs setImmediate.

**Your Code:** `videoProcessor.worker.js` uses event loop for async video processing

---

### Q2: What's the difference between process.nextTick() and setImmediate()?
**Answer:** 
- `process.nextTick()` → Executes BEFORE next event loop iteration (current phase)
- `setImmediate()` → Executes in CHECK phase of NEXT iteration

**Use Case:** `nextTick` for immediate callbacks, `setImmediate` for I/O operations

---

### Q3: How does Node.js handle concurrency with a single thread?
**Answer:** Non-blocking I/O + Event Loop. While waiting for I/O (DB query, file read), Node processes other requests. libuv thread pool (4 threads) handles CPU-intensive ops.

**Your Code:** `video.controller.js` - DB queries don't block, handles 1000s of concurrent requests

---

### Q4: What's the difference between cluster and worker_threads?
**Answer:**
- **Cluster:** Multiple processes, shared port, IPC communication, good for scaling across CPU cores
- **Worker Threads:** Shared memory, good for CPU-intensive tasks (crypto, compression)

**Your Project:** Bull Queue workers = separate processes for video processing

---

### Q5: Explain streams and why they're efficient for large files
**Answer:** Streams process data in chunks (64KB), not loading entire file in memory. Types: Readable, Writable, Duplex, Transform.

**Your Code:** `stream.controller.js` - `fs.createReadStream()` pipes video chunks to response

---

### Q6: What's the difference between require() and import?
**Answer:**
- `require()` → CommonJS, synchronous, runtime loading, dynamic paths
- `import` → ES Modules, static, compile-time analysis, tree-shaking

**Your Project:** Uses ES Modules (`"type": "module"` in package.json)

---

### Q7: How would you handle memory leaks in Node.js?
**Answer:** 
1. Use `--inspect` flag with Chrome DevTools
2. Check for global variables, event listener leaks, unclosed connections
3. Use heap snapshots, compare over time
4. Monitor with `process.memoryUsage()`

**Your Code:** WebSocket connections cleaned up in `websocket.service.js` disconnect

---

## 2️⃣ EXPRESS.JS (7 Critical Questions)

### Q1: Explain middleware and the middleware chain
**Answer:** Functions with access to `req`, `res`, `next`. Execute in order. Can modify request, end response, or call `next()`.

**Your Code:**
```javascript
authenticate → authorize → checkVideoOwnership → deleteVideo
```

---

### Q2: What's the difference between app.use() and app.all()?
**Answer:**
- `app.use()` → Mounts middleware, matches START of path, no HTTP method
- `app.all()` → Route handler, matches EXACT path, ALL HTTP methods

**Your Code:** `app.use('/api/videos', videoRoutes)` - prefix matching

---

### Q3: How do you handle errors in Express?
**Answer:** Error-handling middleware with 4 parameters: `(err, req, res, next)`. Must be last middleware. Catches errors from async operations.

**Your Code:** `errorHandler.js` - centralized error handling

---

### Q4: What's req.params vs req.query vs req.body?
**Answer:**
- `req.params` → URL parameters (`:videoId`)
- `req.query` → Query string (`?token=abc`)
- `req.body` → POST/PUT data (needs body-parser)

**Your Code:** `/stream/:videoId/video?token=xyz` uses both

---

### Q5: How does Express handle async errors?
**Answer:** Express 5+ catches async errors. Express 4 needs try-catch or `express-async-handler`.

**Your Code:**
```javascript
export const uploadVideo = async (req, res) => {
  try {
    await video.save();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

---

### Q6: Explain CORS and how to configure it
**Answer:** Cross-Origin Resource Sharing. Browser blocks requests from different origins. Configure with `cors` middleware.

**Your Code:**
```javascript
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true  // Allow cookies
}));
```

---

### Q7: What's the order of execution: router middleware vs app middleware?
**Answer:** 
1. App-level middleware (app.use)
2. Router-level middleware (router.use)
3. Route-specific middleware
4. Route handler

**Your Code:** `auth.js` runs before `rbac.js` before `video.controller.js`

---

## 3️⃣ MONGODB (7 Critical Questions)

### Q1: SQL vs NoSQL - when to use each?
**Answer:**
- **SQL:** Structured data, ACID transactions, complex joins (banking, inventory)
- **NoSQL:** Flexible schema, horizontal scaling, large data (social media, logs)

**Your Project:** MongoDB - videos have varying metadata, easy schema changes

---

### Q2: Explain indexing and why it matters
**Answer:** B-tree structure for fast lookups. Without index = O(n) scan. With index = O(log n) lookup.

**Your Code:**
```javascript
videoSchema.index({ organizationId: 1, createdAt: -1 });
// Fast queries by org + sorted by date
```

---

### Q3: What's the difference between findOne() and find().limit(1)?
**Answer:**
- `findOne()` → Returns single document (object or null)
- `find().limit(1)` → Returns cursor/array with max 1 document

**Performance:** `findOne()` stops after first match (faster)

---

### Q4: Explain aggregation pipeline
**Answer:** Multi-stage data transformation: `$match` → `$group` → `$sort` → `$project`. Processes documents through stages.

**Use Case:**
```javascript
Video.aggregate([
  { $match: { organizationId: id } },
  { $group: { _id: "$status", count: { $sum: 1 } } }
]);
```

---

### Q5: What's populate() and when is it expensive?
**Answer:** Mongoose feature to join referenced documents. Expensive when:
- Deep nesting (populate of populate)
- Large result sets
- No indexes on foreign keys

**Your Code:**
```javascript
Video.find().populate('uploadedBy', 'name email');
```

---

### Q6: How do you handle concurrent updates?
**Answer:** Optimistic locking with version key (`__v`). Atomic operations (`$inc`, `$push`). Transactions for multi-document.

**Your Code:** Video status updates use `findByIdAndUpdate()` with atomic operations

---

### Q7: Explain schema validation in Mongoose
**Answer:** Define rules in schema: `required`, `enum`, `min`, `max`, `validate`. Runs before save. Custom validators for complex rules.

**Your Code:**
```javascript
role: {
  type: String,
  enum: ['viewer', 'editor', 'admin'],
  default: 'viewer'
}
```

---

## 4️⃣ REACT (7 Critical Questions)

### Q1: Virtual DOM vs Real DOM - how does React optimize?
**Answer:** Virtual DOM = JS representation. React diffs old vs new Virtual DOM, calculates minimal changes, batch updates Real DOM. Avoids expensive DOM operations.

**Your Code:** VideoLibrary re-renders only changed video cards, not entire list

---

### Q2: useState vs useContext - when to use each?
**Answer:**
- `useState` → Component-local state
- `useContext` → Share state across components without prop drilling

**Your Code:** `AuthContext` shares user/token across all components

---

### Q3: Explain useEffect and its dependency array
**Answer:** Runs side effects. Dependencies determine when it runs:
- `[]` → Once on mount
- `[dep]` → When dep changes
- No array → Every render

**Your Code:**
```javascript
useEffect(() => {
  websocketService.connect(token);
  return () => websocketService.disconnect();
}, [token]);
```

---

### Q4: What's the difference between controlled and uncontrolled components?
**Answer:**
- **Controlled:** React state controls value (`value={state}`)
- **Uncontrolled:** DOM controls value (use `ref`)

**Your Code:** Upload form is controlled - `value={title}` with `onChange`

---

### Q5: How do you prevent unnecessary re-renders?
**Answer:**
1. `React.memo()` - memoize component
2. `useMemo()` - memoize expensive calculations
3. `useCallback()` - memoize functions
4. Proper key props in lists

**Your Code:** VideoCard should use `React.memo()` to avoid re-render when other videos update

---

### Q6: Explain React Router and protected routes
**Answer:** Client-side routing, no page refresh. Protected routes check auth before rendering.

**Your Code:**
```javascript
<Route path="/upload" element={
  user ? <Upload /> : <Navigate to="/login" />
} />
```

---

### Q7: What's the difference between SPA and SSR?
**Answer:**
- **SPA:** Client-side rendering, initial blank page, fast after load (your project)
- **SSR:** Server renders HTML, better SEO, faster first paint (Next.js)

**Your Project:** Vite + React = SPA

---

## 5️⃣ JWT AUTHENTICATION (7 Critical Questions)

### Q1: JWT structure - what are the three parts?
**Answer:** 
1. **Header:** Algorithm (HS256) + Type (JWT)
2. **Payload:** Claims (userId, role, exp)
3. **Signature:** HMAC(header + payload, secret)

Base64 encoded, separated by dots

---

### Q2: Access Token vs Refresh Token - why both?
**Answer:**
- **Access Token:** Short-lived (15min), used for API calls
- **Refresh Token:** Long-lived (7 days), gets new access token

**Security:** If access token stolen, expires fast. Refresh token rarely sent.

**Your Code:** Login returns both, refresh endpoint exchanges refresh for new access

---

### Q3: Where to store tokens - localStorage vs cookies?
**Answer:**
- **localStorage:** XSS vulnerable, easy access, works cross-domain
- **httpOnly cookies:** XSS protected, CSRF vulnerable (use sameSite), auto-sent

**Your Code:** Both - cookies for API, localStorage for video src

---

### Q4: How do you invalidate JWT tokens?
**Answer:** JWT can't be invalidated (stateless). Solutions:
1. Short expiry (15min)
2. Blacklist (defeats stateless purpose)
3. Token version in DB
4. Refresh token rotation

**Your Code:** Short access token + logout clears cookies

---

### Q5: What's JWT vs session-based auth?
**Answer:**
- **JWT:** Stateless, scalable, no server storage, can't revoke
- **Session:** Stateful, revocable, needs session store (Redis)

**Your Project:** JWT - scales horizontally, no session store needed

---

### Q6: How do you handle token refresh automatically?
**Answer:** Axios interceptor catches 401, calls refresh endpoint, retries original request with new token.

**Your Code:**
```javascript
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401 && !originalRequest._retry) {
      const newToken = await refreshToken();
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    }
  }
);
```

---

### Q7: What claims should be in JWT payload?
**Answer:**
- **Standard:** `iss` (issuer), `sub` (subject), `exp` (expiry), `iat` (issued at)
- **Custom:** `userId`, `role`, `organizationId`

**Avoid:** Sensitive data (passwords, SSN) - JWT is not encrypted, just encoded!

**Your Code:** `{ userId, email, role, organizationId, exp, iat }`

---

## 6️⃣ SOCKET.IO (7 Critical Questions)

### Q1: WebSocket vs HTTP - key differences?
**Answer:**
- **HTTP:** Request-Response, client initiates, stateless, new connection each time
- **WebSocket:** Bidirectional, both initiate, stateful, persistent connection

**Use Case:** HTTP for REST APIs, WebSocket for real-time (chat, notifications)

---

### Q2: How does Socket.IO improve over raw WebSockets?
**Answer:**
1. Auto-reconnection with exponential backoff
2. Fallback to long-polling if WebSocket unavailable
3. Room and namespace support
4. Acknowledgements
5. Binary support

**Your Code:** `reconnection: true, reconnectionAttempts: 5`

---

### Q3: Explain rooms and namespaces
**Answer:**
- **Rooms:** Group sockets, can join multiple, private channels
- **Namespaces:** Separate communication channels, different endpoints

**Your Code:**
```javascript
socket.join(organizationId);  // Room per organization
io.to(organizationId).emit('video:processed', data);
```

---

### Q4: How do you authenticate Socket.IO connections?
**Answer:** Middleware checks JWT before connection:

**Your Code:**
```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const decoded = jwt.verify(token, secret);
  socket.userId = decoded.userId;
  next();
});
```

---

### Q5: Broadcasting - emit vs broadcast vs to(room).emit?
**Answer:**
- `socket.emit()` → Send to THIS socket only
- `socket.broadcast.emit()` → Send to ALL except this socket
- `io.to(room).emit()` → Send to specific room
- `io.emit()` → Send to EVERYONE

**Your Code:** `io.to(organizationId).emit()` - only that organization

---

### Q6: How do you handle disconnections and reconnections?
**Answer:** Listen to `disconnect` event, clean up resources. Socket.IO auto-reconnects with:
- Exponential backoff (1s, 2s, 4s, 8s)
- Rejoin rooms automatically
- Queue messages during disconnection

**Your Code:**
```javascript
socket.on('disconnect', (reason) => {
  console.log('User disconnected:', reason);
  // Cleanup
});
```

---

### Q7: Socket.IO scaling - how to handle multiple servers?
**Answer:** Use Redis adapter - publishes events to all server instances via pub/sub.

```javascript
const { createAdapter } = require('@socket.io/redis-adapter');
io.adapter(createAdapter(redisClient, redisClient.duplicate()));
```

**Without adapter:** Rooms work per-server only (user on server 1 won't get events from server 2)

---

## 7️⃣ VIDEO STREAMING (7 Critical Questions)

### Q1: Explain HTTP Range Requests and how they work
**Answer:** Client requests specific byte ranges: `Range: bytes=0-1048575`

Server responds with `206 Partial Content`:
```
Content-Range: bytes 0-1048575/52428800
Content-Length: 1048576
```

**Benefit:** Video starts playing before full download, seekable

**Your Code:** `stream.controller.js` parses range header, creates read stream with `{ start, end }`

---

### Q2: Why use 206 instead of 200 for video streaming?
**Answer:**
- **200 OK:** Full file sent
- **206 Partial Content:** Chunk sent, more available

Player knows there's more data, can request next chunks. Essential for seeking and progressive download.

---

### Q3: How does video seeking work technically?
**Answer:**
1. Player calculates byte position: `(seekTime / totalDuration) * fileSize`
2. Sends new range request: `Range: bytes=X-Y`
3. Server sends chunk from that position
4. Player starts playback from there

**Your Code:** `fs.createReadStream(path, { start: X, end: Y })`

---

### Q4: What's HLS vs DASH vs Progressive Download?
**Answer:**
- **Progressive:** Single file, range requests (your project)
- **HLS:** Segments + playlist (.m3u8), adaptive bitrate, Apple
- **DASH:** Segments + manifest (.mpd), adaptive bitrate, open standard

**Your Project:** Progressive download (simplest, good for small-medium videos)

---

### Q5: How do you handle authentication for video tags?
**Answer:** `<video>` can't send custom headers, so:
1. Token in query params: `src="/video?token=xyz"`
2. Signed URLs with expiry
3. Cookie-based auth (credentials: include)

**Your Code:** `optionalAuth` middleware checks `req.query.token`

---

### Q6: Explain video caching strategy
**Answer:**
```
Cache-Control: public, max-age=31536000
ETag: "video-id-timestamp"
Last-Modified: Mon, 01 Nov 2025 10:00:00 GMT
```

Browser caches, sends `If-None-Match` on next request, server responds `304 Not Modified` (no data sent).

**Your Code:** Set these headers in `stream.controller.js`

---

### Q7: How would you optimize video delivery at scale?
**Answer:**
1. **CDN:** CloudFront, Cloudflare - edge caching
2. **Adaptive Streaming:** HLS/DASH multiple qualities
3. **Compression:** H.265 (better than H.264)
4. **Lazy Loading:** Load videos on-demand
5. **Preconnect:** `<link rel="preconnect">` to CDN
6. **Worker Threads:** Parallel processing

**Your Project:** Could add CloudFront + S3 for global distribution

---

## 8️⃣ SYSTEM DESIGN (7 Critical Questions)

### Q1: How would you scale this application to 1 million users?
**Answer:**
1. **Load Balancer:** Nginx, ALB - distribute traffic
2. **Horizontal Scaling:** Multiple Node.js instances (PM2 cluster)
3. **Database:** MongoDB replica set (read replicas)
4. **Redis Cluster:** Distributed caching
5. **CDN:** Static assets + videos
6. **Object Storage:** S3 instead of local disk
7. **Monitoring:** Prometheus, Grafana

**Your Code:** Already architected for scaling - stateless, queue-based

---

### Q2: Design the database schema for multi-tenancy
**Answer:** **Shared Database, Shared Schema** (your approach):
```javascript
{
  organizationId: ObjectId,  // Tenant identifier
  // All queries filter by this
}
```

**Alternatives:**
- Shared DB, Separate Schema (schema per tenant)
- Separate DB (database per tenant)

**Your Code:** Index on `{ organizationId: 1 }` for fast filtering

---

### Q3: How do you prevent one org's videos from slowing down others?
**Answer:**
1. **Queue Priority:** Higher paying orgs get priority
2. **Rate Limiting:** Per-org upload limits
3. **Resource Isolation:** Separate worker pools per tier
4. **Async Processing:** Queue prevents blocking
5. **Database Indexing:** Fast queries per org

**Your Code:** Bull Queue supports priority, add per-org worker pools

---

### Q4: Explain CAP theorem in context of your system
**Answer:** **C**onsistency, **A**vailability, **P**artition tolerance - pick 2

**MongoDB (CP):**
- Consistency + Partition tolerance
- During network split, unavailable until healed

**Your System:** Prioritizes consistency (ACID within org) over availability

**Alternative:** Cassandra (AP) - always available, eventual consistency

---

### Q5: How would you handle video transcoding at scale?
**Answer:**
1. **Distributed Workers:** Kubernetes pods auto-scaling
2. **Spot Instances:** Cheap compute (AWS Spot, GCP Preemptible)
3. **Parallel Processing:** Split video into segments
4. **Queue Sharding:** Separate queues by priority/size
5. **Cloud Services:** AWS MediaConvert, GCP Transcoder API

**Your Code:** Bull Queue + FFmpeg already set up, add K8s for scaling

---

### Q6: Design a notification system for video processing
**Answer:**
1. **WebSocket:** Real-time updates (your project)
2. **Email:** Nodemailer on completion
3. **SMS:** Twilio for urgent notifications
4. **Push Notifications:** Firebase Cloud Messaging
5. **Webhooks:** POST to user's endpoint

**Architecture:**
```
Worker → Notification Service → [WebSocket/Email/SMS/Push]
```

**Your Code:** Already has WebSocket, add email via Bull Queue job

---

### Q7: How do you ensure data consistency across services?
**Answer:**
1. **Transactions:** MongoDB multi-document transactions
2. **Saga Pattern:** Orchestrated sequence with compensating transactions
3. **Event Sourcing:** Append-only event log
4. **Idempotency:** Retry-safe operations

**Your Project:**
```javascript
const session = await mongoose.startSession();
session.startTransaction();
try {
  await video.save({ session });
  await user.updateOne({ session });
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
}
```

---

## 9️⃣ SECURITY (7 Critical Questions)

### Q1: Common security vulnerabilities in your stack - how to prevent?
**Answer:**
1. **XSS:** Sanitize input, httpOnly cookies, CSP headers
2. **SQL Injection:** Parameterized queries (Mongoose does this)
3. **CSRF:** SameSite cookies, CSRF tokens
4. **DoS:** Rate limiting (express-rate-limit)
5. **JWT Theft:** Short expiry, secure cookies, HTTPS only

**Your Code:** `helmet()` sets security headers, `cors()` restricts origins

---

### Q2: How does RBAC prevent unauthorized access?
**Answer:** Role-Based Access Control - permissions by role:

```javascript
// Middleware chain
authenticate → authorize('editor', 'admin') → controller

// Viewer tries to upload
❌ 403 Forbidden

// Editor tries to upload
✅ Allowed
```

**Your Code:** `rbac.js` checks `req.userRole` against allowed roles

---

### Q3: How do you prevent video access across organizations?
**Answer:** Filter every query by `organizationId`:

```javascript
Video.find({ organizationId: req.organizationId });
```

**Middleware:** `checkOrganizationAccess` verifies before allowing action

**Your Code:** JWT contains `organizationId`, attached to `req` by `authenticate`

---

### Q4: Rate limiting - how to implement and why?
**Answer:** Prevent abuse/DoS attacks. Track requests per IP/user:

```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100  // Max 100 requests
});

app.use('/api/', limiter);
```

**Your Code:** Should add `express-rate-limit` to production

---

### Q5: How do you protect against video piracy?
**Answer:**
1. **Signed URLs:** Time-limited, HMAC-signed tokens
2. **Token Rotation:** Generate new tokens regularly
3. **IP Whitelisting:** Restrict by geographic location
4. **DRM:** Widevine, FairPlay encryption
5. **Watermarking:** Embed user ID in video

**Your Code:** Token in query param, add expiry check

---

### Q6: Explain JWT security best practices
**Answer:**
1. **Strong Secret:** 256-bit random key
2. **Short Expiry:** 15 minutes for access token
3. **HTTPS Only:** Prevent man-in-the-middle
4. **Don't Store Sensitive Data:** JWT is encoded, not encrypted
5. **Validate Claims:** Check `exp`, `iss`, `aud`

**Your Code:** 15min expiry, refresh token rotation

---

### Q7: How do you prevent malicious file uploads?
**Answer:**
1. **Validate MIME Type:** Check `file.mimetype`
2. **Check Magic Numbers:** Read first bytes (not just extension)
3. **File Size Limit:** `multer({ limits: { fileSize: 500MB } })`
4. **Virus Scan:** ClamAV, VirusTotal API
5. **Sanitize Filename:** Remove special chars

**Your Code:**
```javascript
const fileFilter = (req, file, cb) => {
  const allowed = ['video/mp4', 'video/mpeg', 'video/quicktime'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};
```

---

## 🔟 VIDEO PROCESSING (7 Critical Questions)

### Q1: Why use Bull Queue instead of processing immediately?
**Answer:**
1. **Non-Blocking:** API responds fast, processing happens in background
2. **Retry Logic:** Auto-retry on failure (3 attempts)
3. **Scalability:** Add more workers horizontally
4. **Monitoring:** Track job status, progress
5. **Priority:** Process urgent videos first

**Your Code:** Upload returns immediately, worker processes async

---

### Q2: How does FFmpeg extract metadata?
**Answer:** Runs `ffprobe` command, parses JSON output:

```javascript
ffmpeg.ffprobe(filePath, (err, metadata) => {
  const duration = metadata.format.duration;
  const resolution = metadata.streams[0].width;
  const codec = metadata.streams[0].codec_name;
});
```

**Your Code:** `ffmpeg.js` wraps fluent-ffmpeg library

---

### Q3: How do you generate thumbnails at specific timestamps?
**Answer:**
```javascript
ffmpeg(videoPath)
  .screenshots({
    timestamps: ['1', '5', '10'],  // 1s, 5s, 10s
    folder: outputDir,
    size: '1280x720'
  });
```

**Your Code:** Takes screenshot at 1 second mark

---

### Q4: Explain the sensitivity analysis algorithm
**Answer:** Scores video 0-100 based on:
1. **Filename Keywords:** Flagged words (-15 points)
2. **File Size:** Too small/large (-10 points)
3. **Metadata:** Missing streams (-15 points)
4. **Duration:** Too short/long (-10 points)
5. **Format:** Non-standard format (-15 points)

**Score ≥70:** Safe | **40-69:** Review | **<40:** Flagged

**Your Code:** `sensitivity.service.js` implements this

---

### Q5: How do you handle processing failures?
**Answer:** Bull Queue retry strategy:
```javascript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000  // 5s, 10s, 20s
  }
}
```

After 3 failures → Mark video as `failed`, emit `video:failed` event

**Your Code:** `videoProcessor.worker.js` catches errors, updates status

---

### Q6: How would you add video compression?
**Answer:**
```javascript
ffmpeg(inputPath)
  .videoCodec('libx264')
  .videoBitrate('1000k')
  .audioCodec('aac')
  .audioBitrate('128k')
  .output(outputPath)
  .on('end', () => {
    // Replace original with compressed
  });
```

Add to worker pipeline between thumbnail and sensitivity

---

### Q7: How do you monitor queue health?
**Answer:**
```javascript
const stats = await videoQueue.getJobCounts();
// { waiting: 5, active: 2, completed: 100, failed: 3 }

videoQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed:`, err);
  // Alert admin if too many failures
});
```

**Production:** Integrate with Prometheus, alert on high failure rate

---

## 💡 BONUS: Behavioral Questions

### Q1: Walk me through your video streaming platform architecture
**Answer:** "I built a full-stack multi-tenant video platform. Users upload videos via React frontend, which hits Express API. Multer saves files, creates MongoDB record. Video is added to Bull Queue backed by Redis. Worker picks it up, uses FFmpeg to extract metadata and generate thumbnails, runs our sensitivity analysis algorithm. Socket.IO pushes real-time updates to frontend. For streaming, I implemented HTTP range requests so videos play instantly without full download. JWT handles auth with access/refresh tokens. RBAC controls permissions - viewers watch, editors upload, admins manage users."

---

### Q2: What was the biggest technical challenge?
**Answer:** "Implementing efficient video streaming. Initially sent entire file - slow, high memory. Learned about HTTP range requests. Now server sends chunks (206 Partial Content), player requests specific byte ranges. This enables instant playback and seeking. Also isolated video processing from main server using Bull Queue - prevents heavy FFmpeg operations from blocking API responses."

---

### Q3: How did you handle authentication and security?
**Answer:** "Implemented JWT-based auth with access (15min) and refresh (7 days) tokens. Access token for API calls, refresh for getting new access token. Stored in httpOnly cookies (XSS protection) and localStorage (for video src query params). Axios interceptor auto-refreshes expired tokens. Multi-tenancy via organizationId filtering - every query filters by user's org. RBAC middleware checks roles before sensitive operations."

---

### Q4: How would you improve the system?
**Answer:** "1) Add CDN (CloudFront) for global video delivery. 2) Implement adaptive streaming (HLS) for multiple quality levels. 3) Video compression during processing to reduce storage. 4) Redis cluster for queue high availability. 5) MongoDB replica sets for read scaling. 6) Kubernetes for auto-scaling workers based on queue size. 7) Add comprehensive monitoring (Prometheus/Grafana) and alerting."

---

## 🎯 Interview Pro Tips

1. **Start with Big Picture** → "The system is a full-stack multi-tenant video platform..."
2. **Use Technical Terms Correctly** → Event loop, HTTP 206, JWT claims
3. **Reference Your Code** → "In my stream.controller.js, I..."
4. **Explain Trade-offs** → "I chose JWT over sessions because..."
5. **Show Production Thinking** → "At scale, I'd add..."
6. **Be Honest** → "I haven't implemented X, but I'd approach it by..."
7. **Draw Diagrams** → Draw request flow, architecture

---

**STUDY ORDER:**
1. Node.js + Express (foundations)
2. MongoDB + React (data & UI)
3. JWT + RBAC (security)
4. Socket.IO + Video Streaming (advanced features)
5. System Design + Video Processing (architecture)

**PRACTICE:** Answer each question out loud, explain code examples, draw diagrams.

**Good luck! 🚀**

