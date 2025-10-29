# RBAC - Role-Based Access Control 👥

## Understanding Permissions and User Roles

---

## Q1: What is RBAC and why is it needed?

**A:** RBAC (Role-Based Access Control) defines **what actions different users can perform** based on their role!

### **Without RBAC (Chaos):**

```
ANY logged-in user can:
❌ Delete all videos
❌ Invite new users
❌ Change organization settings
❌ Access other organizations' data

Result: Security nightmare! 🔥
```

### **With RBAC (Order):**

```
VIEWER Role:
✅ Watch videos
✅ View video library
❌ Upload videos
❌ Delete videos
❌ Manage users

EDITOR Role:
✅ Everything Viewer can do
✅ Upload videos
✅ Edit/delete own videos
❌ Manage users
❌ Change organization settings

ADMIN Role:
✅ Everything Editor can do
✅ Delete ANY video
✅ Invite/remove users
✅ Change organization settings
✅ Full system access
```

---

## Q2: How are roles defined in your project?

**A:** Roles are stored in the **User model** and checked by **middleware**!

### **💡 Real Code - User Model:**

```javascript
// backend/src/models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['viewer', 'editor', 'admin'],  // ← Only these 3 roles allowed
    default: 'viewer'
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
```

---

## Q3: How is role-based authorization implemented?

**A:** Use an **authorize middleware** that checks if the user's role is allowed for that route!

### **💡 Real Code - RBAC Middleware:**

```javascript
// backend/src/middleware/rbac.js
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // req.userRole is set by authenticate middleware
    if (!req.userRole) {
      return res.status(401).json({ 
        error: 'Authentication required' 
      });
    }

    // Check if user's role is in allowed list
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        yourRole: req.userRole
      });
    }

    // Role authorized → continue
    next();
  };
};

// Check if video belongs to user's organization
export const checkOrganizationAccess = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const video = await Video.findById(videoId);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Compare video's organization with user's organization
    if (video.organizationId.toString() !== req.organizationId) {
      return res.status(403).json({ 
        error: 'Access denied - video belongs to different organization' 
      });
    }

    // Attach video to request for controller use
    req.video = video;
    next();

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Check ownership - user can only modify their own videos (unless admin)
export const checkVideoOwnership = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const video = await Video.findById(videoId);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Admins can modify any video in their organization
    if (req.userRole === 'admin') {
      req.video = video;
      return next();
    }

    // Others can only modify their own videos
    if (video.uploadedBy.toString() !== req.userId) {
      return res.status(403).json({ 
        error: 'Access denied - you can only modify your own videos' 
      });
    }

    req.video = video;
    next();

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

---

## Q4: How are routes protected with RBAC?

**A:** Chain authentication and authorization middleware before controllers!

### **💡 Real Code - Protected Routes:**

```javascript
// backend/src/routes/video.routes.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize, checkOrganizationAccess, checkVideoOwnership } from '../middleware/rbac.js';
import { 
  uploadVideo, 
  getVideos, 
  getVideo, 
  updateVideo, 
  deleteVideo 
} from '../controllers/video.controller.js';

const router = express.Router();

// PUBLIC: Anyone can view (no auth)
router.get('/public', getPublicVideos);

// VIEWER+: View videos in their organization
router.get(
  '/',
  authenticate,  // Must be logged in
  getVideos
);

// VIEWER+: View specific video (if in their org)
router.get(
  '/:videoId',
  authenticate,
  checkOrganizationAccess,
  getVideo
);

// EDITOR+: Upload videos
router.post(
  '/upload',
  authenticate,
  authorize('editor', 'admin'),  // ← Only editor or admin
  upload.single('video'),
  uploadVideo
);

// EDITOR (own videos) or ADMIN (any video): Update video
router.put(
  '/:videoId',
  authenticate,
  checkVideoOwnership,  // Checks ownership
  updateVideo
);

// EDITOR (own videos) or ADMIN (any video): Delete video
router.delete(
  '/:videoId',
  authenticate,
  checkVideoOwnership,
  deleteVideo
);

export default router;
```

### **Middleware Chain Visualization:**

```
DELETE /api/videos/12345
    ↓
┌───────────────────────┐
│ 1. authenticate       │ → Verify JWT, extract user info
└───────┬───────────────┘
        ↓ req.userId = "abc"
        ↓ req.userRole = "editor"
        ↓ req.organizationId = "xyz"
┌───────────────────────┐
│ 2. checkVideoOwnership│ → Is video owned by user OR is user admin?
└───────┬───────────────┘
        ↓ video.uploadedBy === req.userId? ✅
        ↓ OR req.userRole === 'admin'? ✅
┌───────────────────────┐
│ 3. deleteVideo        │ → Execute deletion
└───────────────────────┘
```

---

## Q5: How are admins assigned during registration?

**A:** The **first user creating an organization becomes its admin**. Others must be invited!

### **💡 Real Code - Registration Logic:**

```javascript
// backend/src/controllers/auth.controller.js
export const register = async (req, res) => {
  try {
    const { email, password, name, organizationName, role } = req.body;

    let organization;
    let userRole = 'editor';  // Default role

    if (organizationName) {
      // USER IS CREATING A NEW ORGANIZATION
      
      // Check if organization name already exists
      const existingOrg = await Organization.findOne({
        slug: generateSlug(organizationName)
      });

      if (existingOrg) {
        return res.status(400).json({ 
          error: 'Organization name already taken' 
        });
      }

      // Create organization
      organization = new Organization({
        name: organizationName,
        slug: generateSlug(organizationName)
      });
      await organization.save();

      // First user is ADMIN
      userRole = 'admin';
      
    } else {
      // USER IS JOINING WITHOUT ORGANIZATION
      // They select their role (viewer or editor)
      // Can be invited to organization later
      userRole = role || 'editor';
    }

    // Create user
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
      message: 'User registered successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

---

## Q6: How does role selection work during registration?

**A:** Users creating an organization become **admin**. Others choose between **viewer** or **editor**!

### **💡 Real Code - Frontend Registration:**

```javascript
// frontend/src/pages/Register.jsx
const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    organizationName: '',
    role: 'editor'  // Default role
  });

  return (
    <form onSubmit={handleSubmit}>
      {/* Email, Password, Name fields... */}

      {/* Organization name (optional) */}
      <input
        type="text"
        name="organizationName"
        placeholder="Company Name (optional)"
        value={formData.organizationName}
        onChange={handleChange}
      />

      {/* Role selection - only if NOT creating organization */}
      {!formData.organizationName && (
        <div>
          <label>Select Your Role:</label>
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
          >
            <option value="viewer">Viewer - Watch videos only</option>
            <option value="editor">Editor - Upload and manage videos</option>
          </select>
        </div>
      )}

      {formData.organizationName && (
        <p className="text-green-600">
          You will be the organization admin
        </p>
      )}

      <button type="submit">Register</button>
    </form>
  );
};
```

### **Registration Logic:**

```
User enters organization name?
    │
    ├─ YES → Create organization
    │         User role = ADMIN (automatic)
    │
    └─ NO → No organization yet
              User chooses role:
              - Viewer (read-only)
              - Editor (can upload)
```

---

## Q7: How do you display different UI based on user role?

**A:** Check the user's role in the frontend and conditionally render components!

### **💡 Real Code - Conditional Rendering:**

```javascript
// frontend/src/pages/VideoLibrary.jsx
import { useAuth } from '../contexts/AuthContext';

const VideoLibrary = () => {
  const { user } = useAuth();  // Get logged-in user
  const [videos, setVideos] = useState([]);

  return (
    <div>
      <h1>Video Library</h1>

      {/* Upload button - only for EDITOR and ADMIN */}
      {(user.role === 'editor' || user.role === 'admin') && (
        <Link to="/upload">
          <button>Upload New Video</button>
        </Link>
      )}

      {/* Video grid */}
      <div className="video-grid">
        {videos.map(video => (
          <VideoCard 
            key={video._id} 
            video={video}
            canEdit={
              video.uploadedBy === user.id ||  // Own video
              user.role === 'admin'             // Or admin
            }
          />
        ))}
      </div>
    </div>
  );
};
```

```javascript
// frontend/src/components/VideoCard.jsx
const VideoCard = ({ video, canEdit }) => {
  return (
    <div className="video-card">
      <img src={video.thumbnail} alt={video.title} />
      <h3>{video.title}</h3>
      
      {/* Show edit/delete only if user can edit */}
      {canEdit && (
        <div className="actions">
          <button onClick={() => handleEdit(video._id)}>
            Edit
          </button>
          <button onClick={() => handleDelete(video._id)}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
};
```

---

## Q8: What about admin-only features?

**A:** Admin routes are protected with `authorize('admin')` middleware!

### **💡 Real Code - Admin Routes:**

```javascript
// backend/src/routes/admin.routes.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { 
  getUsers, 
  inviteUser, 
  updateUserRole, 
  removeUser,
  getOrganizationStats
} from '../controllers/admin.controller.js';

const router = express.Router();

// ALL routes require ADMIN role
router.use(authenticate);
router.use(authorize('admin'));  // ← Applied to all routes below

// Get all users in organization
router.get('/users', getUsers);

// Invite new user
router.post('/users/invite', inviteUser);

// Change user role
router.put('/users/:userId/role', updateUserRole);

// Remove user from organization
router.delete('/users/:userId', removeUser);

// Organization statistics
router.get('/stats', getOrganizationStats);

export default router;
```

### **💡 Admin Controller Example:**

```javascript
// backend/src/controllers/admin.controller.js
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // Validate role
    if (!['viewer', 'editor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user belongs to same organization
    if (user.organizationId.toString() !== req.organizationId) {
      return res.status(403).json({ 
        error: 'Cannot modify users from other organizations' 
      });
    }

    // Prevent self-demotion (admin can't remove their own admin role)
    if (user._id.toString() === req.userId && role !== 'admin') {
      return res.status(400).json({ 
        error: 'You cannot change your own role' 
      });
    }

    // Update role
    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: 'User role updated',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

---

## Q9: How do you handle organization-level data isolation?

**A:** Every query filters by `organizationId` to ensure complete data isolation!

### **💡 Real Code - Data Filtering:**

```javascript
// backend/src/controllers/video.controller.js
export const getVideos = async (req, res) => {
  try {
    // req.organizationId is set by authenticate middleware
    const videos = await Video.find({
      organizationId: req.organizationId  // ← Only videos from user's org
    })
    .populate('uploadedBy', 'name email')  // Include uploader info
    .sort({ createdAt: -1 });  // Newest first

    res.json({
      success: true,
      videos
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const uploadVideo = async (req, res) => {
  try {
    const { title, description } = req.body;
    const videoFile = req.file;

    const video = new Video({
      title,
      description,
      filePath: videoFile.path,
      fileSize: videoFile.size,
      uploadedBy: req.userId,
      organizationId: req.organizationId,  // ← Associate with user's org
      status: 'processing'
    });

    await video.save();

    res.status(201).json({
      success: true,
      video
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

---

## Q10: Can a user belong to multiple organizations?

**A:** In the current implementation, **no**. Each user belongs to **one organization**.

### **Current Model:**

```javascript
// Each user has ONE organizationId
{
  _id: "abc123",
  email: "user@example.com",
  role: "editor",
  organizationId: "org456"  // ← Single organization
}
```

### **To Support Multiple Organizations (Future Enhancement):**

```javascript
// Change to array of organizations with roles
{
  _id: "abc123",
  email: "user@example.com",
  organizations: [
    {
      organizationId: "org456",
      role: "editor"
    },
    {
      organizationId: "org789",
      role: "admin"
    }
  ]
}

// User switches organization via UI dropdown
// JWT token includes currentOrganizationId
```

---

## ✅ Key Takeaways

1. **Three roles:** Viewer (read-only), Editor (can upload), Admin (full access)
2. **First user creating an organization becomes admin** automatically
3. **Middleware chains** enforce authentication and authorization
4. **Organization-level isolation** prevents cross-tenant data access
5. **Frontend UI adapts** based on user role
6. **Admins manage users** within their organization only

---

## 🚀 Try This Exercise!

**Debug Challenge:**
1. Register as a new user with a company name → You become admin
2. Try to access `/api/admin/users` → Success ✅
3. Register another user (no company) as viewer
4. Login as viewer
5. Try to upload video → 403 Forbidden ❌
6. Try to access `/api/admin/users` → 403 Forbidden ❌

**Build Challenge:**
1. Add a "Manager" role between Editor and Admin
2. Managers can:
   - Upload videos (like Editor)
   - Delete videos from their team (not all videos)
   - View user list (but not change roles)
3. Update middleware and routes
4. Add role selection in frontend

---

**Next:** Read `VIDEO_PROCESSING.md` to learn about FFmpeg and sensitivity analysis!

