# Video Streaming Platform

A full-stack video management platform with real-time processing, sensitivity analysis, and secure streaming.

## Features

- User authentication with role-based access control
- Video upload with drag-and-drop interface
- Automatic video processing and metadata extraction
- Content sensitivity analysis
- Real-time processing updates via WebSocket
- Secure video streaming with range request support
- Responsive modern UI

## Tech Stack

**Frontend:** React 18, Vite, Tailwind CSS, Socket.io Client, Axios

**Backend:** Node.js, Express, MongoDB, Redis, Bull Queue, FFmpeg, Socket.io

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB
- Redis
- FFmpeg

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd Video-stream
```

2. Backend setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

3. Frontend setup
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with API URL
npm run dev
```

### Environment Variables

**Backend (.env):**
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:5173
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
STORAGE_TYPE=local
UPLOAD_DIR=./uploads
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=http://localhost:5000
```

## Usage

1. Register an account (first user becomes admin)
2. Upload videos through the web interface
3. Videos are automatically processed in the background
4. View and stream your videos in the library

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Videos
- `POST /api/videos` - Upload video
- `GET /api/videos` - List videos
- `GET /api/videos/:id` - Get video details
- `PUT /api/videos/:id` - Update video
- `DELETE /api/videos/:id` - Delete video

### Streaming
- `GET /api/stream/:id` - Stream video
- `GET /api/stream/:id/thumbnail` - Get thumbnail

## Features Explained

### Sensitivity Analysis

The system analyzes videos for unusual characteristics using FFmpeg metadata:

- Duration (extremely long videos)
- Resolution (very high or very low)
- Bitrate (unusual values)
- Frame rate (abnormal fps)
- Audio presence and codec
- File integrity

Videos are classified as:
- **Low** - Normal video (score < 0.3)
- **Medium** - Some unusual characteristics (0.3-0.7)
- **High** - Multiple red flags (> 0.7)

### Video Processing Pipeline

1. Upload → Saved to storage
2. Metadata extraction using FFmpeg
3. Thumbnail generation
4. Sensitivity analysis
5. Real-time status updates via WebSocket
6. Ready for streaming

## License

ISC

## Author

Aryan
