import { Router } from 'express';
import {
  uploadFile, getFiles, getFileById, renameFile,
  deleteFile, permanentDelete, restoreFile,
  downloadFile, shareFile, updateTags, bulkDelete, getStorageStats,
} from '../controllers/fileController.js';
import { verifyJWT } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';

const router = Router();

// All file routes require authentication
router.use(verifyJWT);

// Stats must come before :fileId to avoid matching 'stats' as a fileId
router.get('/stats', getStorageStats);

// Bulk operations
router.delete('/bulk', bulkDelete);

// CRUD
router.post('/upload', uploadSingle, uploadFile);
router.get('/', getFiles);
router.get('/:fileId', getFileById);
router.patch('/:fileId/rename', renameFile);
router.delete('/:fileId', deleteFile);
router.delete('/:fileId/permanent', permanentDelete);
router.post('/:fileId/restore', restoreFile);
router.get('/:fileId/download', downloadFile);
router.post('/:fileId/share', shareFile);
router.patch('/:fileId/tags', updateTags);

export default router;
