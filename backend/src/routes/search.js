import { Router } from 'express';
import { searchFiles } from '../controllers/searchController.js';
import { verifyJWT } from '../middleware/auth.js';

const router = Router();

router.use(verifyJWT);

router.get('/', searchFiles);

export default router;
