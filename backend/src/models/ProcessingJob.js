import mongoose from 'mongoose';

const processingJobSchema = new mongoose.Schema({
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: true,
    index: true
  },
  jobType: {
    type: String,
    enum: ['sensitivity_analysis', 'thumbnail', 'transcoding', 'full_processing'],
    default: 'full_processing'
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  result: {
    type: mongoose.Schema.Types.Mixed
  },
  error: {
    type: String
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  startedAt: Date,
  completedAt: Date
}, {
  timestamps: true
});

// Indexes
processingJobSchema.index({ status: 1, createdAt: 1 });

export default mongoose.model('ProcessingJob', processingJobSchema);

