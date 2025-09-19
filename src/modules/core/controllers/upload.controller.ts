import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import { FILE_CONSTRAINTS, FileMetadata, uploadCollection } from '../models/upload.model';
import { extractMediaMetadata, extractVideoThumbnail, generateImagePreview, generateVideoPoster, getFileType } from '../utils/upload';
import { s3Client, uploadToS3 } from '../../../database/s3-object-store';
import { env } from '../../../configs/env';
import { 
  DeleteObjectCommand,
  DeleteObjectsCommand,
  DeleteObjectsCommandInput
} from '@aws-sdk/client-s3';

// Interface for search query parameters
interface SearchQuery {
  query?: string;
  type?: string;
  mimeType?: string;
  minSize?: number;
  maxSize?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: 'uploadedAt' | 'size' | 'originalName';
  sortOrder?: 'asc' | 'desc';
}

export const uploadFile = async (req: Request, res: Response) => {
  // Get user from better-auth middleware
  const user = req.user;
  const userId = user?.id;

  if (!userId) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'User authentication required'
    });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({
      error: 'NO_FILE',
      message: 'No file uploaded'
    });
  }

  // Validate file size
  const maxSize = FILE_CONSTRAINTS.MAX_FILE_SIZE;
  if (file.size > maxSize) {
    return res.status(400).json({
      error: 'FILE_TOO_LARGE',
      message: `File size exceeds ${maxSize / (1024 * 1024)}MB limit`
    });
  }

  // Generate unique S3 keys
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const fileId = uuidv4();
  const baseKey = `uploads/${userId}/${timestamp}`;
  const s3Key = `${baseKey}/${fileId}-${file.originalname}`;

  try {
    // Extract metadata
    const meta = await extractMediaMetadata(file.buffer);
    const finalMimeType = meta.mimeType || file.mimetype;
    const fileType = getFileType(finalMimeType, file.originalname);
    
    let previewUrl: string | undefined | null = null;
    let previewBuffer: Buffer | null = null;
    let previewMimeType: string | undefined;
    let previewKey: string | undefined;
    // Generate preview based on file type

    if (!["image", "video", "audio"].includes(fileType)) {
      // Unsupported file type
      return res.status(400).json({
        error: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'File type not supported for preview generation'
      });
    }

    if (fileType === 'image') {
      // Generate image preview
      previewBuffer = await generateImagePreview(file.buffer, finalMimeType);
      
      if (previewBuffer) {
        // Upload preview with a different key
        previewKey = `${baseKey}/preview-${fileId}.jpg`;
        previewMimeType = 'image/jpeg';
       
      } 
    } else if (fileType === 'video') {
      // Try to extract video poster/thumbnail
      previewBuffer = await generateVideoPoster(file.buffer);
      
      if (!previewBuffer) {
        // Fallback: try to extract embedded thumbnail
        previewBuffer = await extractVideoThumbnail(file.buffer);
      }
      
      if (previewBuffer) {
        previewKey = `${baseKey}/poster-${fileId}.jpg`;
        previewMimeType = 'image/jpeg';
       
      }
    } 

    // Upload original file
    const originalUrl = await uploadToS3(
      file.buffer,
      s3Key,
      finalMimeType
    );
    if (!originalUrl) {
      throw new Error('Media upload failed');
    }

    if(fileType !== 'audio' && previewBuffer && previewKey && previewMimeType){
      previewUrl = await uploadToS3(
        previewBuffer,
        previewKey,
        previewMimeType
      );
    } else if(fileType === 'audio'){
      previewUrl = originalUrl; // For audio, use original as preview
    }

    // Prepare document for database
    const doc: Omit<FileMetadata, '_id'> = {
      filename: file.originalname,
      mimeType: finalMimeType,
      type: fileType,
      size: file.size,
      s3Key,
      src: originalUrl as string,
      preview: (previewUrl || originalUrl) as string, // Fallback to original if no preview
      details: {
        src: originalUrl as string,
        width: meta.width,
        height: meta.height,
        duration: meta.duration,
        preview: (previewUrl || originalUrl) as string, // Fallback to original if no preview
      },
      uploadedBy: userId,
      uploadedAt: new Date(),
    };

    const insertResult = await uploadCollection.insertOne(doc);

    return res.status(201).json({
      ...doc,
      id: insertResult.insertedId
    });

  } catch (err: any) {
    console.error('Upload error:', err);
    return res.status(500).json({
      message: 'Upload failed',
      error: err.message
    });
  }
};

export const searchFiles = async (req: Request, res: Response) => {
  const user = req.user;
  const userId = user?.id;

  if (!userId) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'User authentication required'
    });
  }

  try {
    const {
      query,
      type,
      mimeType,
      minSize,
      maxSize,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'uploadedAt',
      sortOrder = 'desc'
    }: SearchQuery = req.query;

    // Build filter object
    const filter: any = { uploadedBy: userId };

    // Text search on filename
    if (query) {
      filter.originalName = { $regex: query, $options: 'i' };
    }

    // Filter by file type (image, video, audio, etc.)
    if (type) {
      filter.type = type;
    }

    // Filter by specific mime type
    if (mimeType) {
      filter.mimeType = mimeType;
    }

    // File size filters
    if (minSize || maxSize) {
      filter.size = {};
      if (minSize) filter.size.$gte = parseInt(minSize.toString());
      if (maxSize) filter.size.$lte = parseInt(maxSize.toString());
    }

    // Date range filters
    if (startDate || endDate) {
      filter.uploadedAt = {};
      if (startDate) filter.uploadedAt.$gte = new Date(startDate.toString());
      if (endDate) filter.uploadedAt.$lte = new Date(endDate.toString());
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page.toString()));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit.toString()))); // Max 100 per page
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const [items, totalCount] = await Promise.all([
      uploadCollection
        .find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      uploadCollection.countDocuments(filter)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPreviousPage = pageNum > 1;
    const hasMore = hasNextPage;

    return res.status(200).json({
      items,
      hasMore,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage,
        hasPreviousPage
      },
      filters: {
        query,
        type,
        mimeType,
        minSize,
        maxSize,
        startDate,
        endDate,
        sortBy,
        sortOrder
      }
    });
  } catch (err: any) {
    console.error('Search error:', err);
    return res.status(500).json({ message: 'Search failed', error: err.message });
  }
};

/**
 * Helper function to get all S3 keys for a file (including preview/poster)
 */
function getS3KeysForFile(file: FileMetadata): string[] {
  const keys: string[] = [file.s3Key]; // Always include the main file
  
  // Extract the file ID and base path from the s3Key
  const pathParts = file.s3Key.split('/');
  const filename = pathParts[pathParts.length - 1];
  const fileId = filename.split('-')[0]; // Extract UUID
  const basePath = pathParts.slice(0, -1).join('/');
  
  // Add preview/poster keys if they might exist
  if (file.type === 'image' && file.preview && file.preview !== file.src) {
    keys.push(`${basePath}/preview-${fileId}.jpg`);
  } else if (file.type === 'video' && file.preview) {
    keys.push(`${basePath}/poster-${fileId}.jpg`);
  }
  
  return keys;
}

/**
 * Delete a single file
 */
export const deleteFile = async (req: Request, res: Response) => {
  const user = req.user;
  const userId = user?.id;

  if (!userId) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'User authentication required'
    });
  }

  const { fileId } = req.params;

  if (!fileId || !ObjectId.isValid(fileId)) {
    return res.status(400).json({
      error: 'INVALID_FILE_ID',
      message: 'Valid file ID required'
    });
  }

  try {
    // Find the file and verify ownership
    const file = await uploadCollection.findOne({
      _id: new ObjectId(fileId),
      uploadedBy: userId
    }) as FileMetadata | null;

    if (!file) {
      return res.status(404).json({
        error: 'FILE_NOT_FOUND',
        message: 'File not found or you do not have permission to delete it'
      });
    }

    // Get all S3 keys associated with this file
    const s3Keys = getS3KeysForFile(file);
    
    // Delete all associated files from S3
    const deletePromises = s3Keys.map(async (key) => {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: env.S3_COMP_BUCKET_BKT!,
          Key: key
        }));
        console.log(`Deleted S3 object: ${key}`);
      } catch (error) {
        // Log but don't fail if preview doesn't exist
        console.warn(`Failed to delete S3 object ${key}:`, error);
      }
    });
    
    await Promise.allSettled(deletePromises);

    // Delete from database
    await uploadCollection.deleteOne({
      _id: new ObjectId(fileId),
      uploadedBy: userId
    });

    return res.status(200).json({
      message: 'File deleted successfully',
      deletedFile: {
        _id: file._id,
        filename: file.filename,
        s3Key: file.s3Key,
        deletedKeys: s3Keys
      }
    });
  } catch (err: any) {
    console.error('Delete error:', err);
    return res.status(500).json({ 
      message: 'Delete failed', 
      error: err.message 
    });
  }
};

/**
 * Bulk delete multiple files
 */
export const bulkDeleteFiles = async (req: Request, res: Response) => {
  const user = req.user;
  const userId = user?.id;

  if (!userId) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'User authentication required'
    });
  }

  const { fileIds } = req.body;

  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      message: 'Array of file IDs required'
    });
  }

  // Limit bulk operations to prevent abuse
  const MAX_BULK_DELETE = 100;
  if (fileIds.length > MAX_BULK_DELETE) {
    return res.status(400).json({
      error: 'TOO_MANY_FILES',
      message: `Maximum ${MAX_BULK_DELETE} files can be deleted at once`
    });
  }

  // Validate all file IDs
  const validFileIds = fileIds.filter(id => ObjectId.isValid(id)) as string[];
  if (validFileIds.length !== fileIds.length) {
    return res.status(400).json({
      error: 'INVALID_FILE_IDS',
      message: 'Some file IDs are invalid',
      invalidIds: fileIds.filter(id => !ObjectId.isValid(id))
    });
  }

  try {
    // Find all files that belong to the user
    const files = await uploadCollection.find({
      _id: { $in: validFileIds.map(id => new ObjectId(id)) },
      uploadedBy: userId
    }).toArray() as FileMetadata[];

    if (files.length === 0) {
      return res.status(404).json({
        error: 'NO_FILES_FOUND',
        message: 'No files found or you do not have permission to delete them'
      });
    }

    // Collect all S3 keys (including previews/posters)
    const allS3Keys: string[] = [];
    files.forEach(file => {
      const keys = getS3KeysForFile(file);
      allS3Keys.push(...keys);
    });

    // Delete from S3 using batch delete (max 1000 objects per request)
    const deleteResults = [];
    const chunkSize = 1000;
    
    for (let i = 0; i < allS3Keys.length; i += chunkSize) {
      const chunk = allS3Keys.slice(i, i + chunkSize);
      const deleteParams: DeleteObjectsCommandInput = {
        Bucket: process.env.S3_BUCKET_NAME!,
        Delete: {
          Objects: chunk.map(key => ({ Key: key })),
          Quiet: false // Set to true to suppress successful delete responses
        }
      };

      try {
        const result = await s3Client.send(new DeleteObjectsCommand(deleteParams));
        deleteResults.push(result);
        
        if (result.Errors && result.Errors.length > 0) {
          console.error('S3 deletion errors:', result.Errors);
        }
      } catch (error) {
        console.error('Failed to delete S3 objects chunk:', error);
        // Continue with other chunks even if one fails
      }
    }

    // Delete from database
    const deleteResult = await uploadCollection.deleteMany({
      _id: { $in: files.map(file => new ObjectId(file._id)) },
      uploadedBy: userId
    });

    // Calculate successfully deleted S3 objects
    const successfulS3Deletes = deleteResults.reduce((acc, result) => {
      return acc + (result.Deleted?.length || 0);
    }, 0);

    return res.status(200).json({
      message: `${deleteResult.deletedCount} files deleted successfully`,
      deletedCount: deleteResult.deletedCount,
      s3ObjectsDeleted: successfulS3Deletes,
      deletedFiles: files.map(file => ({
        _id: file._id,
        filename: file.filename,
        s3Key: file.s3Key,
        type: file.type
      }))
    });
  } catch (err: any) {
    console.error('Bulk delete error:', err);
    return res.status(500).json({ 
      message: 'Bulk delete failed', 
      error: err.message 
    });
  }
};

/**
 * Get file by ID
 */
export const getFileById = async (req: Request, res: Response) => {
  const user = req.user;
  const userId = user?.id;

  if (!userId) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'User authentication required'
    });
  }

  const { fileId } = req.params;

  if (!fileId || !ObjectId.isValid(fileId)) {
    return res.status(400).json({
      error: 'INVALID_FILE_ID',
      message: 'Valid file ID required'
    });
  }

  try {
    const file = await uploadCollection.findOne({
      _id: new ObjectId(fileId),
      uploadedBy: userId
    });

    if (!file) {
      return res.status(404).json({
        error: 'FILE_NOT_FOUND',
        message: 'File not found or you do not have permission to access it'
      });
    }

    // Add computed properties for convenience
    const enrichedFile = {
      ...file,
      id: file._id.toString(),
      hasPreview: file.preview !== file.src,
      // Add download URL if needed
      downloadUrl: file.src,
      previewUrl: file.preview
    };

    return res.status(200).json(enrichedFile);
  } catch (err: any) {
    console.error('Get file error:', err);
    return res.status(500).json({ 
      message: 'Failed to retrieve file', 
      error: err.message 
    });
  }
};
