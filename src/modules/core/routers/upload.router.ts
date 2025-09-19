import { Router } from 'express';
import { upload } from '../utils/multer';
import { 
  uploadFile, 
  searchFiles, 
  deleteFile, 
  bulkDeleteFiles, 
  getFileById 
} from '../controllers/upload.controller';
import { authMiddleware } from '../../authentication/middleware';

const router = Router();
router.use(authMiddleware); // Authentication required for all routes

// Root route
router.get("/", (req, res) => {
  res.send("Welcome to API root");
});

// Upload endpoint
router.post('/', upload.single('file'), uploadFile);

// Search files endpoint with filters and pagination
// GET /files/search?query=image&type=image&page=1&limit=20&sortBy=uploadedAt&sortOrder=desc
router.get('/search', searchFiles);

// Get single file by ID
router.get('/:fileId', getFileById);

// Delete single file
router.delete('/:fileId', deleteFile);

// Bulk delete files
// POST /files/bulk-delete with body: { "fileIds": ["id1", "id2", "id3"] }
router.post('/bulk-delete', bulkDeleteFiles);

export default router;