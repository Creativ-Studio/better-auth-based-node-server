import { db } from "../../../database/mongo-connection";
import { ObjectId } from 'mongodb';

interface FileMetadata {
  _id?: ObjectId;
  id?: string;
  filename: string;
  src: string;
  preview?: string; // URL to a preview image (e.g., thumbnail)
  mimeType: string;
  type: string;
  details: {
    src: string;
    duration?: number; // in seconds, for audio/video
    width?: number;    // in pixels, for images/videos
    height?: number;   // in pixels, for images/videos
    [key: string]: any; // for any additional metadata
  };
  size: number;
  s3Key: string;
  uploadedAt: Date;
  uploadedBy?: string;
}

const uploadCollection = db.collection<FileMetadata>('files');


// Type guards
function isImageFile(file: FileMetadata): boolean {
  return file.mimeType.startsWith('image/');
}

function isVideoFile(file: FileMetadata): boolean {
  return file.mimeType.startsWith('video/');
}

function isAudioFile(file: FileMetadata): boolean {
  return file.mimeType.startsWith('audio/');
}

function hasMediaDimensions(file: FileMetadata): boolean {
  return !!(file.details.width && file.details.height);
}

// File category helpers
type FileCategory = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

function getFileCategory(mimeType: string): FileCategory {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  
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
    'application/rtf'
  ];
  
  if (documentTypes.includes(mimeType)) return 'document';
  
  const archiveTypes = [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/gzip',
    'application/x-tar'
  ];
  
  if (archiveTypes.includes(mimeType)) return 'archive';
  
  return 'other';
}


// File validation constraints
const FILE_CONSTRAINTS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_FILES_PER_USER: 1000,
  ALLOWED_IMAGE_TYPES: [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ],
  ALLOWED_VIDEO_TYPES: [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm'
  ],
  ALLOWED_AUDIO_TYPES: [
    'audio/mpeg',
    'audio/wav',
    'audio/aac',
    'audio/ogg',
    'audio/webm'
  ],
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
} as const;

export {
  FileMetadata,
  uploadCollection,
  isImageFile,
  isVideoFile,
  isAudioFile,
  hasMediaDimensions,
  getFileCategory,
  FILE_CONSTRAINTS
}
