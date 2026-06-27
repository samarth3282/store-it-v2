import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/userController.js';
import { verifyJWT } from '../middleware/auth.js';
import { uploadAvatarSingle } from '../middleware/upload.js';

const router = Router();

router.use(verifyJWT);

router.get('/me', getProfile);
router.patch('/me', uploadAvatarSingle, updateProfile);

export default router;
