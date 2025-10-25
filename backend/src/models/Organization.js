import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true,
    minlength: [2, 'Organization name must be at least 2 characters'],
    maxlength: [100, 'Organization name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens']
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  settings: {
    maxStorageGB: {
      type: Number,
      default: 10
    },
    maxVideoSizeMB: {
      type: Number,
      default: 500
    },
    allowedFormats: {
      type: [String],
      default: ['mp4', 'avi', 'mov', 'mkv', 'webm']
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
organizationSchema.index({ slug: 1 }, { unique: true });

export default mongoose.model('Organization', organizationSchema);

