import fs from 'fs';
import path from 'path';
import config from '../config/env.js';
import logger from '../utils/logger.js';

class StorageService {
  constructor() {
    this.provider = config.storage.provider;
  }

  /**
   * Get local file path
   */
  getLocalPath(storageKey) {
    return path.join(config.upload.uploadDir, storageKey);
  }

  /**
   * Delete file from storage
   */
  async deleteFile(storageKey) {
    try {
      if (this.provider === 'local') {
        const filePath = this.getLocalPath(storageKey);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info(`File deleted: ${storageKey}`);
        }
      } else if (this.provider === 's3' || this.provider === 'cloudflare') {
        // TODO: Implement S3/Cloudflare deletion
        logger.warn('S3/Cloudflare deletion not implemented');
      }

      return true;
    } catch (error) {
      logger.error('Delete file error:', error);
      throw error;
    }
  }

  /**
   * Upload file (for thumbnails, etc.)
   */
  async uploadFile(localPath, destinationKey) {
    try {
      if (this.provider === 'local') {
        // For local storage, just return the path
        return localPath;
      } else if (this.provider === 's3' || this.provider === 'cloudflare') {
        // TODO: Implement S3/Cloudflare upload
        logger.warn('S3/Cloudflare upload not implemented');
        return localPath;
      }

      return localPath;
    } catch (error) {
      logger.error('Upload file error:', error);
      throw error;
    }
  }

  /**
   * Get file stream
   */
  async getFileStream(storageKey) {
    if (this.provider === 'local') {
      const filePath = this.getLocalPath(storageKey);
      return fs.createReadStream(filePath);
    } else {
      // TODO: Implement for cloud storage
      throw new Error('Cloud storage streaming not implemented');
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(storageKey) {
    if (this.provider === 'local') {
      const filePath = this.getLocalPath(storageKey);
      return fs.existsSync(filePath);
    } else {
      // TODO: Implement for cloud storage
      return false;
    }
  }
}

export default new StorageService();

