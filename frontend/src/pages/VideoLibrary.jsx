import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Film, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Eye,
  Globe,
  Lock,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import videoService from '../services/video.service';
import websocketService from '../services/websocket.service';
import { formatDistanceToNow } from 'date-fns';

const STATUS_CONFIG = {
  uploading: { 
    label: 'Uploading', 
    color: 'blue', 
    icon: Clock,
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800'
  },
  processing: { 
    label: 'Processing', 
    color: 'yellow', 
    icon: Clock,
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800'
  },
  completed: { 
    label: 'Ready', 
    color: 'green', 
    icon: CheckCircle,
    bgColor: 'bg-green-100',
    textColor: 'text-green-800'
  },
  failed: { 
    label: 'Failed', 
    color: 'red', 
    icon: XCircle,
    bgColor: 'bg-red-100',
    textColor: 'text-red-800'
  }
};

const SENSITIVITY_CONFIG = {
  low: { label: 'Low', color: 'green', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  medium: { label: 'Medium', color: 'yellow', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
  high: { label: 'High', color: 'red', bgColor: 'bg-red-100', textColor: 'text-red-800' }
};

const VISIBILITY_ICONS = {
  public: Globe,
  private: Lock,
  organization: Users
};

export default function VideoLibrary() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sensitivityFilter, setSensitivityFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchVideos();
    
    // Set up WebSocket listeners for real-time updates
    websocketService.on('video:status', handleVideoStatusUpdate);
    websocketService.on('video:processing', handleProcessingUpdate);

    return () => {
      websocketService.off('video:status', handleVideoStatusUpdate);
      websocketService.off('video:processing', handleProcessingUpdate);
    };
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const params = {};
      
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      if (sensitivityFilter !== 'all') {
        params.sensitivity = sensitivityFilter;
      }
      
      if (searchQuery) {
        params.search = searchQuery;
      }

      const response = await videoService.getVideos(params);
      setVideos(response.videos || []);
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast.error('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoStatusUpdate = (data) => {
    setVideos(prevVideos =>
      prevVideos.map(video =>
        video._id === data.videoId
          ? { ...video, status: data.status, ...data.updates }
          : video
      )
    );

    if (data.status === 'completed') {
      toast.success(`Video "${data.title || 'Video'}" processing completed!`);
    } else if (data.status === 'failed') {
      toast.error(`Video "${data.title || 'Video'}" processing failed`);
    }
  };

  const handleProcessingUpdate = (data) => {
    setVideos(prevVideos =>
      prevVideos.map(video =>
        video._id === data.videoId
          ? { ...video, processingProgress: data.progress }
          : video
      )
    );
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchVideos();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, statusFilter, sensitivityFilter]);

  const getFilteredVideos = () => {
    return videos;
  };

  const filteredVideos = getFilteredVideos();

  const VideoCard = ({ video }) => {
    const statusConfig = STATUS_CONFIG[video.status] || STATUS_CONFIG.processing;
    const StatusIcon = statusConfig.icon;
    const VisibilityIcon = VISIBILITY_ICONS[video.visibility] || Users;
    
    const sensitivityConfig = video.sensitivity?.level 
      ? SENSITIVITY_CONFIG[video.sensitivity.level] 
      : null;

    return (
      <Link 
        to={`/videos/${video._id}`}
        className="card hover:shadow-lg transition-shadow duration-200 block"
      >
        {/* Thumbnail */}
        <div className="relative aspect-video bg-gray-200 rounded-md overflow-hidden mb-3">
          {video.thumbnail ? (
            <img
              src={videoService.getThumbnailUrl(video._id)}
              alt={video.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className="absolute inset-0 flex items-center justify-center bg-gray-300"
            style={{ display: video.thumbnail ? 'none' : 'flex' }}
          >
            <Film className="w-16 h-16 text-gray-400" />
          </div>
          
          {/* Duration Badge */}
          {video.metadata?.duration && (
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
              {formatDuration(video.metadata.duration)}
            </div>
          )}

          {/* Processing Progress */}
          {(video.status === 'processing' || video.status === 'uploading') && (
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
              <div className="progress-bar h-1">
                <div
                  className="h-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${video.processingProgress || 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div>
          <h3 className="font-semibold text-lg mb-1 line-clamp-2">{video.title}</h3>
          
          {video.description && (
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{video.description}</p>
          )}

          {/* Status and Badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`badge ${statusConfig.bgColor} ${statusConfig.textColor}`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </span>

            {sensitivityConfig && (
              <span className={`badge ${sensitivityConfig.bgColor} ${sensitivityConfig.textColor}`}>
                <AlertTriangle className="w-3 h-3 mr-1" />
                {sensitivityConfig.label} Sensitivity
              </span>
            )}

            <span className="badge badge-gray">
              <VisibilityIcon className="w-3 h-3 mr-1" />
              {video.visibility}
            </span>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {video.views || 0} views
            </div>
            {video.createdAt && (
              <div>
                {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Video Library</h1>
        <Link to="/upload" className="btn btn-primary">
          Upload Video
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="card mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
            {(statusFilter !== 'all' || sensitivityFilter !== 'all') && (
              <span className="bg-primary-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                {(statusFilter !== 'all' ? 1 : 0) + (sensitivityFilter !== 'all' ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input"
              >
                <option value="all">All Statuses</option>
                <option value="uploading">Uploading</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sensitivity Level
              </label>
              <select
                value={sensitivityFilter}
                onChange={(e) => setSensitivityFilter(e.target.value)}
                className="input"
              >
                <option value="all">All Levels</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Video Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full"></div>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="card text-center py-12">
          <Film className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-semibold mb-2">No videos found</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery || statusFilter !== 'all' || sensitivityFilter !== 'all'
              ? 'Try adjusting your filters or search query'
              : 'Upload your first video to get started'}
          </p>
          {!(searchQuery || statusFilter !== 'all' || sensitivityFilter !== 'all') && (
            <Link to="/upload" className="btn btn-primary">
              Upload Video
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-gray-600">
            Showing {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredVideos.map((video) => (
              <VideoCard key={video._id} video={video} />
            ))}
          </div>
        </>
      )}

      {/* WebSocket Status Indicator */}
      {websocketService.isConnected() && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-3 py-2 rounded-full text-xs flex items-center gap-2 shadow-lg">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          Live updates active
        </div>
      )}
    </div>
  );
}
