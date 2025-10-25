import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Clock,
  Eye,
  Globe,
  Lock,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Film,
  Calendar,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import videoService from '../services/video.service';
import websocketService from '../services/websocket.service';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow, format } from 'date-fns';

const STATUS_CONFIG = {
  uploading: { label: 'Uploading', color: 'blue', icon: Clock },
  processing: { label: 'Processing', color: 'yellow', icon: Clock },
  completed: { label: 'Ready', color: 'green', icon: CheckCircle },
  failed: { label: 'Failed', color: 'red', icon: XCircle }
};

const SENSITIVITY_CONFIG = {
  low: { label: 'Low', color: 'green' },
  medium: { label: 'Medium', color: 'yellow' },
  high: { label: 'High', color: 'red' }
};

const VISIBILITY_ICONS = {
  public: Globe,
  private: Lock,
  organization: Users
};

export default function VideoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef(null);

  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    visibility: 'organization'
  });

  useEffect(() => {
    fetchVideo();

    // Subscribe to video updates
    websocketService.subscribeToVideo(id);
    websocketService.on('video:status', handleVideoUpdate);
    websocketService.on('video:processing', handleProcessingUpdate);

    return () => {
      websocketService.unsubscribeFromVideo(id);
      websocketService.off('video:status', handleVideoUpdate);
      websocketService.off('video:processing', handleProcessingUpdate);
    };
  }, [id]);

  const fetchVideo = async () => {
    try {
      setLoading(true);
      const response = await videoService.getVideo(id);
      setVideo(response.video);
      setEditForm({
        title: response.video.title || '',
        description: response.video.description || '',
        visibility: response.video.visibility || 'organization'
      });
    } catch (error) {
      console.error('Error fetching video:', error);
      toast.error('Failed to load video');
      navigate('/videos');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoUpdate = (data) => {
    if (data.videoId === id) {
      setVideo(prev => ({ ...prev, ...data.updates, status: data.status }));
      
      if (data.status === 'completed') {
        toast.success('Video processing completed!');
      } else if (data.status === 'failed') {
        toast.error('Video processing failed');
      }
    }
  };

  const handleProcessingUpdate = (data) => {
    if (data.videoId === id) {
      setVideo(prev => ({ ...prev, processingProgress: data.progress }));
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    
    try {
      await videoService.updateVideo(id, editForm);
      setVideo(prev => ({ ...prev, ...editForm }));
      setEditing(false);
      toast.success('Video updated successfully');
    } catch (error) {
      console.error('Error updating video:', error);
      toast.error('Failed to update video');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(true);
      await videoService.deleteVideo(id);
      toast.success('Video deleted successfully');
      navigate('/videos');
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error('Failed to delete video');
      setDeleting(false);
    }
  };

  const canEdit = user && video && (
    user.role === 'admin' || 
    video.uploadedBy === user.id ||
    video.uploadedBy?._id === user.id
  );

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="card text-center py-12">
        <Film className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h3 className="text-xl font-semibold mb-2">Video not found</h3>
        <Link to="/videos" className="btn btn-primary mt-4">
          Back to Library
        </Link>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[video.status] || STATUS_CONFIG.processing;
  const StatusIcon = statusConfig.icon;
  const VisibilityIcon = VISIBILITY_ICONS[video.visibility] || Users;
  const sensitivityConfig = video.sensitivity?.level ? SENSITIVITY_CONFIG[video.sensitivity.level] : null;

  return (
    <div className="max-w-6xl">
      {/* Back Button */}
      <Link 
        to="/videos" 
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Library
      </Link>

      {/* Video Player */}
      <div className="card mb-6">
        {video.status === 'completed' ? (
          <div className="video-container bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              controls
              className="w-full h-full"
              src={videoService.getStreamUrl(id)}
              poster={video.thumbnail ? videoService.getThumbnailUrl(id) : undefined}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        ) : (
          <div className="aspect-video bg-gray-200 rounded-lg flex flex-col items-center justify-center">
            <StatusIcon className={`w-16 h-16 mb-4 text-${statusConfig.color}-600`} />
            <h3 className="text-xl font-semibold mb-2">{statusConfig.label}</h3>
            {(video.status === 'processing' || video.status === 'uploading') && (
              <div className="w-64">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${video.processingProgress || 0}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-2 text-center">
                  {video.processingProgress || 0}% complete
                </p>
              </div>
            )}
            {video.status === 'failed' && (
              <p className="text-red-600 mt-2">Video processing failed. Please try uploading again.</p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title and Actions */}
          <div className="card">
            {!editing ? (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold mb-2">{video.title}</h1>
                    <div className="flex flex-wrap gap-2">
                      <span className={`badge bg-${statusConfig.color}-100 text-${statusConfig.color}-800`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig.label}
                      </span>
                      {sensitivityConfig && (
                        <span className={`badge bg-${sensitivityConfig.color}-100 text-${sensitivityConfig.color}-800`}>
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {sensitivityConfig.label} Sensitivity
                        </span>
                      )}
                      <span className="badge badge-gray">
                        <VisibilityIcon className="w-3 h-3 mr-1" />
                        {video.visibility}
                      </span>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => setEditing(true)}
                        className="btn btn-secondary p-2"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="btn btn-danger p-2"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {video.description && (
                  <div>
                    <h3 className="font-semibold mb-2">Description</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{video.description}</p>
                  </div>
                )}
              </>
            ) : (
              <form onSubmit={handleEdit}>
                <h3 className="font-semibold mb-4">Edit Video</h3>
                
                <div className="space-y-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="input"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={4}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Visibility
                    </label>
                    <select
                      value={editForm.visibility}
                      onChange={(e) => setEditForm({ ...editForm, visibility: e.target.value })}
                      className="input"
                    >
                      <option value="organization">Organization</option>
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button type="submit" className="btn btn-primary">
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Sensitivity Analysis */}
          {video.sensitivity && video.sensitivity.analysis && (
            <div className="card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Sensitivity Analysis
              </h3>
              <div className="space-y-3">
                {Object.entries(video.sensitivity.analysis).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-gray-700 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className={`badge ${
                      value < 0.3 ? 'badge-success' :
                      value < 0.6 ? 'badge-warning' :
                      'badge-danger'
                    }`}>
                      {(value * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <div className="card">
            <h3 className="font-semibold mb-4">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Eye className="w-4 h-4 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-gray-500">Views</p>
                  <p className="font-medium">{video.views || 0}</p>
                </div>
              </div>

              {video.metadata?.duration && (
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-gray-500">Duration</p>
                    <p className="font-medium">{formatDuration(video.metadata.duration)}</p>
                  </div>
                </div>
              )}

              {video.metadata?.resolution && (
                <div className="flex items-start gap-3">
                  <Film className="w-4 h-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-gray-500">Resolution</p>
                    <p className="font-medium">
                      {video.metadata.resolution.width}x{video.metadata.resolution.height}
                    </p>
                  </div>
                </div>
              )}

              {video.metadata?.format && (
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-gray-500">Format</p>
                    <p className="font-medium">{video.metadata.format}</p>
                  </div>
                </div>
              )}

              {video.createdAt && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-gray-500">Uploaded</p>
                    <p className="font-medium">
                      {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(video.createdAt), 'PPp')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
