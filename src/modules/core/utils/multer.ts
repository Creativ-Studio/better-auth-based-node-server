import multer from 'multer';

// Use memory storage so multer gives a buffer (to stream to S3)
export const upload = multer({ storage: multer.memoryStorage() });
