import { upload, uploadAvatar } from '../config/multer.js';

/**
 * Single file upload middleware.
 * Expects the file field name to be 'file'.
 */
export const uploadSingle = upload.single('file');

/**
 * Avatar upload middleware.
 * Expects the file field name to be 'avatar'.
 */
export const uploadAvatarSingle = uploadAvatar.single('avatar');
