import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, Film, X, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import videoService from '../services/video.service';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_TYPES = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm'];

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [metadata, setMetadata] = useState({
    title: '',
    description: '',
    visibility: 'organization'
  });
  const [errors, setErrors] = useState({});

  const validateFile = (file) => {
    const newErrors = {};

    if (!file) {
      newErrors.file = 'Please select a file';
      return newErrors;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      newErrors.file = `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}`;
      return newErrors;
    }

    if (file.size > MAX_FILE_SIZE) {
      newErrors.file = `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`;
      return newErrors;
    }

    return newErrors;
  };

  const validateMetadata = () => {
    const newErrors = {};

    if (!metadata.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (metadata.title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }

    if (metadata.description && metadata.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    return newErrors;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleFileSelect = (selectedFile) => {
    const fileErrors = validateFile(selectedFile);
    
    if (Object.keys(fileErrors).length > 0) {
      setErrors(fileErrors);
      toast.error(fileErrors.file);
      return;
    }

    setFile(selectedFile);
    setErrors({});
    
    // Auto-populate title from filename
    if (!metadata.title) {
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, '');
      setMetadata({ ...metadata, title: fileName });
    }
    
    toast.success('File selected successfully');
  };

  const handleFileInputChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setErrors({});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMetadataChange = (field, value) => {
    setMetadata({ ...metadata, [field]: value });
    // Clear error for this field
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    // Validate
    const fileErrors = validateFile(file);
    const metadataErrors = validateMetadata();
    const allErrors = { ...fileErrors, ...metadataErrors };

    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      toast.error('Please fix the errors before uploading');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const result = await videoService.uploadVideo(
        file,
        metadata,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      toast.success('Video uploaded successfully! Processing started.');
      
      // Redirect to video library after a short delay
      setTimeout(() => {
        navigate('/videos');
      }, 1500);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.error || 'Failed to upload video');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Upload Video</h1>

      <form onSubmit={handleUpload} className="max-w-4xl">
        {/* Drag and Drop Zone */}
        <div className="card mb-6">
          {!file ? (
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragging
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <UploadIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">
                Drop your video here or click to browse
              </h3>
              <p className="text-gray-600 mb-4">
                Supported formats: MP4, AVI, MOV, MKV, WEBM
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Maximum file size: 500MB
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-primary"
              >
                Select File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
              {errors.file && (
                <p className="mt-4 text-red-600 text-sm flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {errors.file}
                </p>
              )}
            </div>
          ) : (
            <div className="border-2 border-green-500 rounded-lg p-6 bg-green-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <Film className="w-12 h-12 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h4 className="font-semibold text-green-900">File Selected</h4>
                    </div>
                    <p className="text-green-800 font-medium mb-1">{file.name}</p>
                    <p className="text-green-700 text-sm">
                      Size: {formatFileSize(file.size)} | Type: {file.type}
                    </p>
                  </div>
                </div>
                {!uploading && (
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="text-red-600 hover:text-red-800 p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Metadata Form */}
        {file && (
          <div className="card mb-6">
            <h3 className="text-xl font-semibold mb-4">Video Details</h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  value={metadata.title}
                  onChange={(e) => handleMetadataChange('title', e.target.value)}
                  disabled={uploading}
                  className={`input ${errors.title ? 'border-red-500' : ''}`}
                  placeholder="Enter video title"
                />
                {errors.title && (
                  <p className="mt-1 text-red-600 text-sm">{errors.title}</p>
                )}
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={metadata.description}
                  onChange={(e) => handleMetadataChange('description', e.target.value)}
                  disabled={uploading}
                  rows={4}
                  className={`input ${errors.description ? 'border-red-500' : ''}`}
                  placeholder="Enter video description (optional)"
                />
                <div className="flex justify-between mt-1">
                  <div>
                    {errors.description && (
                      <p className="text-red-600 text-sm">{errors.description}</p>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm">
                    {metadata.description.length}/500
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="visibility" className="block text-sm font-medium text-gray-700 mb-1">
                  Visibility
                </label>
                <select
                  id="visibility"
                  value={metadata.visibility}
                  onChange={(e) => handleMetadataChange('visibility', e.target.value)}
                  disabled={uploading}
                  className="input"
                >
                  <option value="organization">Organization</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
                <p className="mt-1 text-gray-500 text-sm">
                  {metadata.visibility === 'organization' && 'Visible to your organisation members'}
                  {metadata.visibility === 'public' && 'Visible to everyone'}
                  {metadata.visibility === 'private' && 'Only visible to you'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Uploading...
              </span>
              <span className="text-sm font-medium text-gray-700">
                {uploadProgress}%
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Please wait while your video is being uploaded. Do not close this page.
            </p>
          </div>
        )}

        {/* Submit Button */}
        {file && !uploading && (
          <div className="flex gap-4">
            <button
              type="submit"
              className="btn btn-primary"
            >
              Upload Video
            </button>
            <button
              type="button"
              onClick={() => navigate('/videos')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        )}

        {uploading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>Note:</strong> After upload completes, your video will be processed automatically. 
              You'll receive real-time updates on the processing status.
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
