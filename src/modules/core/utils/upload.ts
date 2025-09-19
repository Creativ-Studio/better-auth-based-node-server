import { fileTypeFromBuffer } from 'file-type';
import sizeOf from 'image-size';
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileMetadata } from '../models/upload.model';
import sharp from 'sharp';
import { Readable,Writable } from 'stream';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';


export interface MediaMetadata {
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
}

export async function extractMediaMetadata(buffer: Buffer): Promise<MediaMetadata> {
  const metadata: MediaMetadata = {};

  const fileType = await fileTypeFromBuffer(buffer);
  if (fileType) {
    metadata.mimeType = fileType.mime;
  }

  // Try image size first
  try {
    const dimensions = sizeOf(buffer);
    if (dimensions.width && dimensions.height) {
      metadata.width = dimensions.width;
      metadata.height = dimensions.height;
      return metadata;
    }
  } catch {}

  // Try video/audio duration using temporary file
  let tempFile: string | null = null;
  try {
    // Create temporary file
    tempFile = join(tmpdir(), `temp_media_${Date.now()}.tmp`);
    await writeFile(tempFile, buffer);

    const ffprobe = promisify(ffmpeg.ffprobe);
    const info = await ffprobe(tempFile) as any;
    
    const videoStream = info.streams.find((s: any) => s.width && s.height);
    if (videoStream) {
      metadata.width = videoStream.width;
      metadata.height = videoStream.height;
    }

    if (info.format.duration) {
      metadata.duration = info.format.duration;
    }
  } catch (error) {
    console.warn('Failed to extract video/audio metadata:', error);
  } finally {
    // Clean up temporary file
    if (tempFile) {
      try {
        await unlink(tempFile);
      } catch {}
    }
  }

  return metadata;
}

// Utility function to determine file type from MIME type and filename
export const getFileType = (mimeType: string, filename?: string): 'image' | 'video' | 'audio' | 'document' | 'other' => {
  if (mimeType.startsWith('image/')) {
    return 'image';
  } else if (mimeType.startsWith('video/')) {
    return 'video';
  } else if (mimeType.startsWith('audio/')) {
    return 'audio';
  } else if (mimeType === 'application/octet-stream' && filename) {
    // For octet-stream, try to determine type from file extension
    const ext = filename.toLowerCase().split('.').pop();
    
    // Image extensions
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'].includes(ext || '')) {
      return 'image';
    }
    // Video extensions
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', '3gp'].includes(ext || '')) {
      return 'video';
    }
    // Audio extensions
    if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext || '')) {
      return 'audio';
    }
    // Document extensions
    if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext || '')) {
      return 'document';
    }
  } else if (mimeType.startsWith('application/pdf') || 
             mimeType.startsWith('application/msword') || 
             mimeType.startsWith('application/vnd.openxmlformats') ||
             mimeType.startsWith('text/')) {
    return 'document';
  }
  
  return 'other';
};


// Preview generation configuration
const PREVIEW_CONFIG = {
  MAX_WIDTH: 720,
  MAX_HEIGHT: 720,
  JPEG_QUALITY: 85,
  VIDEO_SCREENSHOT_TIME: '00:00:01', // 1 second into video
};

/**
 * Generate a preview image with maximum dimension of 720px
 */
export async function generateImagePreview(buffer: Buffer, mimeType: string): Promise<Buffer | null> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    // Only resize if image is larger than max dimensions
    if ((metadata.width && metadata.width > PREVIEW_CONFIG.MAX_WIDTH) || 
        (metadata.height && metadata.height > PREVIEW_CONFIG.MAX_HEIGHT)) {
      
      return await image
        .resize(PREVIEW_CONFIG.MAX_WIDTH, PREVIEW_CONFIG.MAX_HEIGHT, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: PREVIEW_CONFIG.JPEG_QUALITY })
        .toBuffer();
    }
    
    // If image is already small enough, return null (use original)
    return null;
  } catch (error) {
    console.error('Error generating image preview:', error);
    return null;
  }
}

/**
 * Extract video poster frame as preview using temporary file approach
 */
export async function generateVideoPoster(buffer: Buffer): Promise<Buffer | null> {
  let tempInputPath: string | undefined;
  let tempOutputPath: string | undefined;

  try {
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    
    // Create temporary input file path
    tempInputPath = path.join(tempDir, `video_input_${timestamp}_${randomId}.mp4`);
    
    // Create temporary output file path
    const outputFilename = `screenshot_${timestamp}_${randomId}.jpg`;
    tempOutputPath = path.join(tempDir, outputFilename);
    
    // Write the video buffer to temporary input file
    await fs.writeFile(tempInputPath, buffer);
    console.log('Temporary video file written:', tempInputPath);
    
    // Generate screenshot using ffmpeg
    return new Promise((resolve) => {
      const cleanup = async () => {
        try {
          if (tempInputPath) {
            await fs.unlink(tempInputPath).catch(() => {});
          }
          if (tempOutputPath) {
            await fs.unlink(tempOutputPath).catch(() => {});
          }
        } catch (error) {
          // Ignore cleanup errors
        }
      };

      ffmpeg(tempInputPath)
        .screenshots({
          timestamps: [PREVIEW_CONFIG.VIDEO_SCREENSHOT_TIME || '00:00:01'],
          filename: outputFilename,
          folder: tempDir,
          size: `${PREVIEW_CONFIG.MAX_WIDTH || 800}x?`,
        })
        .outputOptions([
          '-y', // Overwrite output file if it exists
          '-q:v', '2', // High quality JPEG
        ])
        .on('start', (commandLine) => {
          // Log the actual ffmpeg command being executed
          console.log('🎬 FFmpeg command:', commandLine);
          console.log('📁 Input file:', tempInputPath);
          console.log('📁 Output file:', tempOutputPath);
        })
        .on('error', async (err) => {
          console.error('Error generating video poster:', err);
          await cleanup();
          resolve(null);
        })
        .on('end', async () => {
          try {
            // Verify the output file was created
            await fs.access(tempOutputPath as string);
            
            // Read the generated screenshot
            const screenshotBuffer = await fs.readFile(tempOutputPath as string);
            
            // Clean up temporary files
            await cleanup();
            
            resolve(screenshotBuffer);
          } catch (readError) {
            console.error('Error reading screenshot file:', readError);
            await cleanup();
            resolve(null);
          }
        });
    });
    
  } catch (error) {
    console.error('Error in video poster generation setup:', error);
    
    // Clean up on setup error
    try {
      if (tempInputPath) await fs.unlink(tempInputPath).catch(() => {});
      if (tempOutputPath) await fs.unlink(tempOutputPath).catch(() => {});
    } catch {}
    
    return null;
  }
}


/**
 * Alternative video poster extraction using sharp (if video has embedded thumbnail)
 */
export async function extractVideoThumbnail(buffer: Buffer): Promise<Buffer | null> {
  try {
    // Some video formats have embedded thumbnails that sharp can extract
    const thumbnail = await sharp(buffer, { failOnError: false })
      .resize(PREVIEW_CONFIG.MAX_WIDTH, PREVIEW_CONFIG.MAX_HEIGHT, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: PREVIEW_CONFIG.JPEG_QUALITY })
      .toBuffer();
    
    return thumbnail;
  } catch (error) {
    // Fallback to ffmpeg method or no preview
    throw new Error('Failed to read video thumbnail');
  }
}
