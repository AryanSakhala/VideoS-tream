import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  filename: {
    type: String,
    required: true
  },
  originalFilename: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  duration: {
    type: Number // in seconds
  },
  format: {
    type: String
  },
  resolution: {
    width: Number,
    height: Number
  },
  metadata: {
    codec: String,
    bitrate: Number,
    frameRate: Number,
    audioCodec: String,
    duration: Number,
    resolution: {
      width: Number,
      height: Number
    },
    format: String
  },

  // Storage
  storageProvider: {
    type: String,
    enum: ['local', 's3', 'gridfs', 'cloudflare', 'blob'],
    required: true
  },
  storageKey: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String
  },
  thumbnail: {
    type: String
  },

  // Processing
  status: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'failed'],
    default: 'uploading'
  },
  processingProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // Sensitivity
  sensitivityStatus: {
    type: String,
    enum: ['pending', 'safe', 'flagged'],
    default: 'pending'
  },
  sensitivityScore: {
    type: Number,
    min: 0,
    max: 1
  },
  sensitivityDetails: {
    categories: [String],
    detectedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewNotes: String
  },
  sensitivity: {
    level: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    score: {
      type: Number,
      min: 0,
      max: 1
    },
    analysis: {
      type: mongoose.Schema.Types.Mixed
    },
    analyzedAt: Date
  },

  // Multi-tenant
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Access control
  visibility: {
    type: String,
    enum: ['private', 'organization', 'public'],
    default: 'organization'
  },
  allowedRoles: [String],
  allowedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Metadata
  metadata: {
    codec: String,
    bitrate: Number,
    frameRate: Number,
    audioCodec: String
  },

  // Tracking
  viewCount: {
    type: Number,
    default: 0
  },
  lastViewedAt: Date
}, {
  timestamps: true
});

// Indexes
videoSchema.index({ organizationId: 1, status: 1 });
videoSchema.index({ organizationId: 1, uploadedBy: 1 });
videoSchema.index({ sensitivityStatus: 1 });
videoSchema.index({ createdAt: -1 });
videoSchema.index({ title: 'text', description: 'text' });

export default mongoose.model('Video', videoSchema);

