import api from './api';

const videoService = {
  async uploadVideo(file, metadata, onProgress) {
    const formData = new FormData();
    formData.append('video', file);
    
    if (metadata.title) formData.append('title', metadata.title);
    if (metadata.description) formData.append('description', metadata.description);
    if (metadata.visibility) formData.append('visibility', metadata.visibility);

    const response = await api.post('/videos', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        if (onProgress) {
          onProgress(percentCompleted);
        }
      },
    });

    return response.data;
  },

  async getVideos(params = {}) {
    const response = await api.get('/videos', { params });
    return response.data;
  },

  async getVideo(id) {
    const response = await api.get(`/videos/${id}`);
    return response.data;
  },

  async updateVideo(id, data) {
    const response = await api.put(`/videos/${id}`, data);
    return response.data;
  },

  async deleteVideo(id) {
    const response = await api.delete(`/videos/${id}`);
    return response.data;
  },

  async getVideoStatus(id) {
    const response = await api.get(`/videos/${id}/status`);
    return response.data;
  },

  getStreamUrl(videoId) {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    return `${baseUrl}/stream/${videoId}?token=${token}`;
  },

  getThumbnailUrl(videoId) {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    return `${baseUrl}/stream/${videoId}/thumbnail?token=${token}`;
  }
};

export default videoService;

