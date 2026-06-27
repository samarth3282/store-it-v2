import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Determine the file category from MIME type.
 * Mirrors the Appwrite type field used in the original StoreIt.
 */
export const getFileType = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';

  // Document types
  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'text/html',
    'text/markdown',
    'application/json',
  ];

  if (documentTypes.includes(mimeType)) return 'document';

  return 'other';
};

/**
 * Extract file extension from the original filename.
 */
export const getExtension = (filename) => {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return ext || 'unknown';
};

/**
 * Build a unique S3 key for the file.
 * Format: uploads/{userId}/{uuid}.{extension}
 */
export const buildS3Key = (userId, extension) => {
  const uuid = uuidv4();
  return `uploads/${userId}/${uuid}.${extension}`;
};

/**
 * Format bytes into human-readable string.
 */
export const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};
