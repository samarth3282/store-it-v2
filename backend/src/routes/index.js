import { Router } from 'express';
import authRouter from './auth.js';
import filesRouter from './files.js';
import usersRouter from './users.js';
import searchRouter from './search.js';
import agentRouter from './agent.js';
import { apiLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Apply general rate limiter to all API routes
router.use(apiLimiter);

// Mount sub-routers
router.use('/auth', authRouter);
router.use('/files', filesRouter);
router.use('/users', usersRouter);
router.use('/search', searchRouter);
router.use('/agent', agentRouter);

export default router;
