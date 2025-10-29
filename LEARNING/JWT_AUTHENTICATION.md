# JWT Authentication - Token-Based Security 🔐

## Understanding JSON Web Tokens and Session Management

---

## Q1: What is JWT and why use it instead of sessions?

**A:** JWT (JSON Web Token) is a **self-contained token** that carries user information without needing server-side storage!

### **Traditional Sessions (Old Way):**

```
1. User logs in
    ↓
2. Server creates session in memory/database
   Session ID: "abc123"
   Data: { userId: 5, role: 'editor' }
    ↓
3. Server sends session ID as cookie
    ↓
4. User sends session ID with every request
    ↓
5. Server looks up session ID in database
    ↓
6. Server retrieves user data
```

**Problems:**
- ❌ Must store sessions on server (memory/Redis/database)
- ❌ Doesn't scale well (every server needs access to sessions)
- ❌ Database lookup on every request

### **JWT (Modern Way):**

```
1. User logs in
    ↓
2. Server creates JWT token
   Token contains: { userId: 5, role: 'editor' }
    ↓
3. Server signs token with secret key
    ↓
4. User stores token (cookie or localStorage)
    ↓
5. User sends token with every request
    ↓
6. Server verifies signature
    ↓
7. Server reads user data from token directly
```

**Benefits:**
- ✅ No server-side storage needed
- ✅ Scales horizontally (any server can verify)
- ✅ No database lookups
- ✅ Works across different services (microservices)

---

## Q2: What does a JWT token look like?

**A:** A JWT has **three parts** separated by dots: `HEADER.PAYLOAD.SIGNATURE`

### **JWT Structure:**

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzMxOGUxZjU4MjM1IiwiZW1haWwiOiJhcnlhbkBleGFtcGxlLmNvbSIsInJvbGUiOiJlZGl0b3IiLCJvcmdhbml6YXRpb25JZCI6IjY3MzE4ZTFmNTgyMzQiLCJpYXQiOjE2OTg3NjU0MzIsImV4cCI6MTY5ODc2OTAzMn0.yF4_5pZxK8NqE3jT9mLwQvXnPaU7sRkD2fGhA6cBiJo

│                    HEADER                    │                            PAYLOAD                              │          SIGNATURE         │
```

### **Part 1: Header (Base64 encoded)**

```json
{
  "alg": "HS256",      // Algorithm used for signing
  "typ": "JWT"         // Token type
}
```

### **Part 2: Payload (Base64 encoded)**

```json
{
  "userId": "67318e1f58235",
  "email": "aryan@example.com",
  "role": "editor",
  "organizationId": "67318e1f58234",
  "iat": 1698765432,    // Issued At (timestamp)
  "exp": 1698769032     // Expiration (timestamp)
}
```

### **Part 3: Signature (HMAC-SHA256)**

```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret_key
)
```

**The signature proves:**
- ✅ Token wasn't tampered with
- ✅ Token was issued by our server
- ❌ Anyone changing payload → signature becomes invalid

---

## Q3: How is JWT implemented in your project?

**A:** Your system uses **two types of tokens**: Access Token (short-lived) and Refresh Token (long-lived)!

### **💡 Real Code - Token Generation:**

```javascript
// backend/src/utils/jwt.js
import jwt from 'jsonwebtoken';
import config from '../config/env.js';

export const generateAccessToken = (payload) => {
  return jwt.sign(
    payload,
    config.jwtSecret,
    { expiresIn: '15m' }  // Access token expires in 15 minutes
  );
};

export const generateRefreshToken = (payload) => {
  return jwt.sign(
    payload,
    config.jwtRefreshSecret,  // Different secret!
    { expiresIn: '7d' }  // Refresh token expires in 7 days
  );
};

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwtRefreshSecret);
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};
```

### **💡 Real Code - Login Controller:**

```javascript
// backend/src/controllers/auth.controller.js
import User from '../models/User.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2. Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3. Create token payload
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      organizationId: user.organizationId?.toString()
    };

    // 4. Generate tokens
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // 5. Send tokens as HTTP-only cookies (secure!)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,        // Can't access via JavaScript
      secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
      sameSite: 'strict',    // CSRF protection
      maxAge: 15 * 60 * 1000  // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
    });

    // 6. Also send in response body (for localStorage fallback)
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId
      },
      accessToken,    // Frontend can store this
      refreshToken    // Frontend can store this
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

---

## Q4: How does authentication middleware work?

**A:** Middleware **intercepts every protected request** and verifies the JWT token!

### **💡 Real Code - Auth Middleware:**

```javascript
// backend/src/middleware/auth.js
import jwt from 'jsonwebtoken';
import config from '../config/env.js';

export const authenticate = async (req, res, next) => {
  try {
    // 1. Extract token from multiple sources
    let token;

    if (req.cookies.accessToken) {
      // Try cookie first (most secure)
      token = req.cookies.accessToken;
    } else if (req.headers.authorization) {
      // Try Authorization header
      token = req.headers.authorization.replace('Bearer ', '');
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // 2. Verify token signature and expiration
    const decoded = jwt.verify(token, config.jwtSecret);

    // 3. Attach user context to request object
    req.userId = decoded.userId;
    req.email = decoded.email;
    req.userRole = decoded.role;
    req.organizationId = decoded.organizationId;

    // 4. Token valid → Continue to next middleware/controller
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### **💡 Usage in Routes:**

```javascript
// backend/src/routes/video.routes.js
import { authenticate } from '../middleware/auth.js';
import { uploadVideo, getVideos } from '../controllers/video.controller.js';

const router = express.Router();

// Public route - no authentication
router.get('/public', getPublicVideos);

// Protected route - must be authenticated
router.get('/', authenticate, getVideos);
//                 ^^^^^^^^^^^ Runs before controller

router.post('/upload', authenticate, uploadVideo);
```

---

## Q5: What is token refresh and why is it needed?

**A:** Access tokens expire quickly (15 min) for security. Refresh tokens let you get new access tokens without logging in again!

### **Token Lifecycle:**

```
1. Login → Receive both tokens
   Access Token: expires in 15 minutes
   Refresh Token: expires in 7 days
    ↓
2. Make API calls using Access Token
    ↓
3. After 15 minutes → Access Token expires
    ↓
4. Next API call → 401 Unauthorized
    ↓
5. Frontend intercepts 401 error
    ↓
6. Sends Refresh Token to /auth/refresh
    ↓
7. Backend verifies Refresh Token
    ↓
8. If valid → Issue NEW Access Token
    ↓
9. Retry original API call with new token
    ↓
10. Success! ✅
```

### **💡 Real Code - Refresh Endpoint:**

```javascript
// backend/src/controllers/auth.controller.js
export const refreshToken = async (req, res) => {
  try {
    // 1. Get refresh token
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // 2. Verify refresh token
    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);

    // 3. Optional: Check if user still exists and is active
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // 4. Generate new access token
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      organizationId: user.organizationId?.toString()
    };

    const newAccessToken = generateAccessToken(payload);

    // 5. Send new access token
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000
    });

    res.json({
      success: true,
      accessToken: newAccessToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};
```

---

## Q6: How does the frontend handle token expiration automatically?

**A:** Use **Axios interceptors** to catch 401 errors and automatically refresh tokens!

### **💡 Real Code - Axios Interceptor:**

```javascript
// frontend/src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true  // Send cookies with requests
});

// Track if we're currently refreshing
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor - catches errors
api.interceptors.response.use(
  (response) => response,  // Success - do nothing
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      if (isRefreshing) {
        // Already refreshing - queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
        .then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call refresh endpoint
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/auth/refresh`,
          { refreshToken },
          { withCredentials: true }
        );

        const { accessToken, user } = response.data;

        // Save new token
        localStorage.setItem('accessToken', accessToken);
        
        // Update user context if available
        if (window.updateAuthUser) {
          window.updateAuthUser({ ...user, accessToken });
        }

        // Update authorization header
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        // Process queued requests
        processQueue(null, accessToken);

        // Retry original request
        return api(originalRequest);

      } catch (refreshError) {
        // Refresh failed - log out user
        processQueue(refreshError, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);

      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

### **How It Works:**

```
User makes API call
    ↓
Access token expired
    ↓
Server returns 401 ❌
    ↓
Interceptor catches 401
    ↓
Is already refreshing? 
  NO → Refresh token
  YES → Queue request
    ↓
Get new access token ✅
    ↓
Retry original request with new token
    ↓
Success! ✅
```

---

## Q7: Should tokens be stored in localStorage or cookies?

**A:** **Both have pros and cons**. Your project uses both for flexibility!

### **localStorage:**

```javascript
// Save
localStorage.setItem('accessToken', token);

// Read
const token = localStorage.getItem('accessToken');

// Send with requests
axios.get('/api/videos', {
  headers: { Authorization: `Bearer ${token}` }
});
```

**Pros:**
- ✅ Easy to access in JavaScript
- ✅ Works with CORS
- ✅ Can send to any domain

**Cons:**
- ❌ Vulnerable to XSS attacks (malicious scripts can read it)
- ❌ Not automatically sent with requests
- ❌ Persists even if user closes browser

### **HTTP-Only Cookies:**

```javascript
// Backend sets cookie
res.cookie('accessToken', token, {
  httpOnly: true,  // JavaScript can't access it
  secure: true,    // HTTPS only
  sameSite: 'strict'  // CSRF protection
});

// Browser automatically sends cookie with every request
// No JavaScript needed!
```

**Pros:**
- ✅ Protected from XSS (JavaScript can't access)
- ✅ Automatically sent with requests
- ✅ Secure flags (httpOnly, secure, sameSite)

**Cons:**
- ❌ Vulnerable to CSRF (if not using sameSite)
- ❌ Harder to use with different domains
- ❌ Can't read token value in JavaScript

### **Your Project's Hybrid Approach:**

```javascript
// Backend sends BOTH
res.cookie('accessToken', accessToken, { httpOnly: true });  // For API calls
res.json({ accessToken });  // For JavaScript access (video streaming, etc.)

// Frontend stores in BOTH
localStorage.setItem('accessToken', accessToken);  // For <video> src
// Cookie sent automatically with API calls
```

---

## Q8: How do you log out a user?

**A:** Clear tokens on both frontend and backend!

### **💡 Real Code - Logout:**

```javascript
// backend/src/controllers/auth.controller.js
export const logout = async (req, res) => {
  // Clear cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
};
```

```javascript
// frontend/src/contexts/AuthContext.jsx
const logout = async () => {
  try {
    // Call logout endpoint
    await api.post('/auth/logout');

    // Clear local storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    // Clear user state
    setUser(null);

    // Disconnect WebSocket
    websocketService.disconnect();

    // Redirect to login
    navigate('/login');

  } catch (error) {
    console.error('Logout error:', error);
  }
};
```

---

## Q9: How do you handle "Remember Me" functionality?

**A:** Use **longer expiration** for refresh token when user checks "Remember Me"!

### **💡 Implementation:**

```javascript
// backend/src/controllers/auth.controller.js
export const login = async (req, res) => {
  const { email, password, rememberMe } = req.body;

  // ... authentication logic ...

  // Adjust refresh token expiration
  const refreshTokenExpiry = rememberMe ? '30d' : '7d';
  
  const refreshToken = jwt.sign(
    payload,
    config.jwtRefreshSecret,
    { expiresIn: refreshTokenExpiry }
  );

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: rememberMe 
      ? 30 * 24 * 60 * 60 * 1000  // 30 days
      : 7 * 24 * 60 * 60 * 1000   // 7 days
  });

  res.json({ success: true });
};
```

---

## ✅ Key Takeaways

1. **JWT tokens are self-contained** - no server-side session storage
2. **Access tokens expire quickly** (15 min) for security
3. **Refresh tokens last longer** (7 days) for convenience
4. **Axios interceptors** automatically handle token refresh
5. **HTTP-only cookies** protect against XSS attacks
6. **Signature verification** ensures tokens aren't tampered with

---

## 🚀 Try This Exercise!

**Debug Challenge:**
1. Open browser DevTools → Application tab
2. Log in to the app
3. Check Cookies → See accessToken and refreshToken
4. Check localStorage → See tokens there too
5. Wait 15 minutes (or change expiry to 1 minute)
6. Make an API call
7. Watch Network tab → See automatic refresh!

**Build Challenge:**
1. Add "Remember Me" checkbox to login form
2. Modify backend to accept rememberMe parameter
3. Adjust token expiry based on checkbox
4. Test that tokens last 30 days when checked

---

**Next:** Read `RBAC_ACCESS_CONTROL.md` to learn about role-based permissions!

