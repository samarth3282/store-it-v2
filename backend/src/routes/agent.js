import { Router } from 'express';
import {
  listFilesForAgent, getFileBufferHandler,
  storeVectors, queryVectors, deleteVectors,
} from '../controllers/agentController.js';
import { verifyJWT } from '../middleware/auth.js';
import { verifyAgentSecret } from '../middleware/agentAuth.js';

const router = Router();

// All agent routes require both JWT and agent secret
router.use(verifyJWT);
router.use(verifyAgentSecret);

router.get('/files', listFilesForAgent);
router.get('/files/:fileId/buffer', getFileBufferHandler);
router.post('/vectors', storeVectors);
router.post('/vectors/query', queryVectors);
router.delete('/vectors/:fileId', deleteVectors);

export default router;
