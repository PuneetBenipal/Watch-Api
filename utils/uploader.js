// Try to import AWS SDK, but make it optional
let AWS;
try {
  AWS = require('aws-sdk');
} catch (error) {
  console.warn('AWS SDK not installed. S3 uploads will be disabled.');
  AWS = null;
}

// Try to import Google Cloud Storage, but make it optional
let { Storage } = {};
try {
  const gcs = require('@google-cloud/storage');
  Storage = gcs.Storage;
} catch (error) {
  console.warn('Google Cloud Storage not installed. GCS uploads will be disabled.');
  Storage = null;
}

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Uploader {
  constructor() {
    this.s3 = null;
    this.gcs = null;
    this.storageType = process.env.STORAGE_TYPE || 'local'; // 's3', 'gcs', 'local'
    this.initialize();
  }

  async initialize() {
    try {
      if (this.storageType === 's3' && AWS) {
        this.s3 = new AWS.S3({
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION || 'us-east-1'
        });
        console.log('S3 uploader initialized');
      } else if (this.storageType === 'gcs' && Storage) {
        this.gcs = new Storage({
          keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });
        console.log('Google Cloud Storage uploader initialized');
      } else {
        console.log('Using local file storage');
      }
    } catch (error) {
      console.error('Failed to initialize uploader:', error);
      throw error;
    }
  }

  // Generate unique filename
  generateFilename(originalName, prefix = '') {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalName);
    const name = path.basename(originalName, extension);
    
    return `${prefix}${name}_${timestamp}_${randomString}${extension}`;
  }

  // Upload single file
  async uploadFile(file, folder = 'uploads') {
    try {
      const filename = this.generateFilename(file.originalname, folder + '/');
      
      if (this.storageType === 's3' && this.s3) {
        return await this.uploadToS3(file, filename);
      } else if (this.storageType === 'gcs' && this.gcs) {
        return await this.uploadToGCS(file, filename);
      } else {
        return await this.uploadToLocal(file, filename);
      }
    } catch (error) {
      console.error('Upload file error:', error);
      throw error;
    }
  }

  // Upload multiple files
  async uploadMultipleFiles(files, folder = 'uploads') {
    try {
      const uploadPromises = files.map(file => this.uploadFile(file, folder));
      const results = await Promise.all(uploadPromises);
      
      return results;
    } catch (error) {
      console.error('Upload multiple files error:', error);
      throw error;
    }
  }

  // Upload to S3
  async uploadToS3(file, filename) {
    try {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: filename,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read'
      };

      const result = await this.s3.upload(params).promise();
      
      return {
        url: result.Location,
        key: result.Key,
        size: file.size,
        mimetype: file.mimetype,
        filename: path.basename(filename)
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw error;
    }
  }

  // Upload to Google Cloud Storage
  async uploadToGCS(file, filename) {
    try {
      const bucket = this.gcs.bucket(process.env.GOOGLE_CLOUD_BUCKET);
      const blob = bucket.file(filename);
      
      const stream = blob.createWriteStream({
        metadata: {
          contentType: file.mimetype
        },
        resumable: false
      });

      return new Promise((resolve, reject) => {
        stream.on('error', (error) => {
          reject(error);
        });

        stream.on('finish', async () => {
          await blob.makePublic();
          const publicUrl = `https://storage.googleapis.com/${process.env.GOOGLE_CLOUD_BUCKET}/${filename}`;
          
          resolve({
            url: publicUrl,
            key: filename,
            size: file.size,
            mimetype: file.mimetype,
            filename: path.basename(filename)
          });
        });

        stream.end(file.buffer);
      });
    } catch (error) {
      console.error('GCS upload error:', error);
      throw error;
    }
  }

  // Upload to local storage
  async uploadToLocal(file, filename) {
    try {
      const uploadDir = path.join(__dirname, '../uploads');
      const filePath = path.join(uploadDir, filename);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Write file to disk
      fs.writeFileSync(filePath, file.buffer);
      
      const baseUrl = process.env.BASE_URL || '[CENSORED_BASE_URL]';
      const publicUrl = `${baseUrl}/uploads/${filename}`;
      
      return {
        url: publicUrl,
        key: filename,
        size: file.size,
        mimetype: file.mimetype,
        filename: path.basename(filename),
        localPath: filePath
      };
    } catch (error) {
      console.error('Local upload error:', error);
      throw error;
    }
  }

  // Delete file
  async deleteFile(key) {
    try {
      if (this.storageType === 's3' && this.s3) {
        return await this.deleteFromS3(key);
      } else if (this.storageType === 'gcs' && this.gcs) {
        return await this.deleteFromGCS(key);
      } else {
        return await this.deleteFromLocal(key);
      }
    } catch (error) {
      console.error('Delete file error:', error);
      throw error;
    }
  }

  // Delete from S3
  async deleteFromS3(key) {
    try {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key
      };

      await this.s3.deleteObject(params).promise();
      
      return {
        success: true,
        message: 'File deleted from S3 successfully'
      };
    } catch (error) {
      console.error('S3 delete error:', error);
      throw error;
    }
  }

  // Delete from GCS
  async deleteFromGCS(key) {
    try {
      const bucket = this.gcs.bucket(process.env.GOOGLE_CLOUD_BUCKET);
      const file = bucket.file(key);
      
      await file.delete();
      
      return {
        success: true,
        message: 'File deleted from GCS successfully'
      };
    } catch (error) {
      console.error('GCS delete error:', error);
      throw error;
    }
  }

  // Delete from local storage
  async deleteFromLocal(key) {
    try {
      const filePath = path.join(__dirname, '../uploads', key);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      return {
        success: true,
        message: 'File deleted from local storage successfully'
      };
    } catch (error) {
      console.error('Local delete error:', error);
      throw error;
    }
  }

  // Get file info
  async getFileInfo(key) {
    try {
      if (this.storageType === 's3' && this.s3) {
        return await this.getS3FileInfo(key);
      } else if (this.storageType === 'gcs' && this.gcs) {
        return await this.getGCSFileInfo(key);
      } else {
        return await this.getLocalFileInfo(key);
      }
    } catch (error) {
      console.error('Get file info error:', error);
      throw error;
    }
  }

  // Get S3 file info
  async getS3FileInfo(key) {
    try {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key
      };

      const result = await this.s3.headObject(params).promise();
      
      return {
        key,
        size: result.ContentLength,
        mimetype: result.ContentType,
        lastModified: result.LastModified,
        url: `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${key}`
      };
    } catch (error) {
      console.error('S3 get file info error:', error);
      throw error;
    }
  }

  // Get GCS file info
  async getGCSFileInfo(key) {
    try {
      const bucket = this.gcs.bucket(process.env.GOOGLE_CLOUD_BUCKET);
      const file = bucket.file(key);
      
      const [metadata] = await file.getMetadata();
      
      return {
        key,
        size: parseInt(metadata.size),
        mimetype: metadata.contentType,
        lastModified: new Date(metadata.updated),
        url: `https://storage.googleapis.com/${process.env.GOOGLE_CLOUD_BUCKET}/${key}`
      };
    } catch (error) {
      console.error('GCS get file info error:', error);
      throw error;
    }
  }

  // Get local file info
  async getLocalFileInfo(key) {
    try {
      const filePath = path.join(__dirname, '../uploads', key);
      
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }

      const stats = fs.statSync(filePath);
      const baseUrl = process.env.BASE_URL || '[CENSORED_BASE_URL]';
      
      return {
        key,
        size: stats.size,
        mimetype: this.getMimeType(key),
        lastModified: stats.mtime,
        url: `${baseUrl}/uploads/${key}`
      };
    } catch (error) {
      console.error('Local get file info error:', error);
      throw error;
    }
  }

  // Get MIME type from file extension
  getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // Validate file
  validateFile(file, allowedTypes = ['image/jpeg', 'image/png', 'image/gif'], maxSize = 5 * 1024 * 1024) {
    const errors = [];

    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors };
    }

    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} is not allowed`);
    }

    if (file.size > maxSize) {
      errors.push(`File size ${file.size} exceeds maximum allowed size ${maxSize}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Get storage status
  getStorageStatus() {
    return {
      type: this.storageType,
      s3Available: !!AWS,
      gcsAvailable: !!Storage,
      s3Connected: !!this.s3,
      gcsConnected: !!this.gcs
    };
  }
}

module.exports = Uploader; 