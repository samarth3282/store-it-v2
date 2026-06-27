import { Router } from 'express';
import { register, verifyOtp, resendOtp, login, refreshToken, logout } from '../controllers/authController.js';
import { verifyJWT } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Auth routes — stricter rate limiting
router.use(authLimiter);

router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', verifyJWT, logout);

export default router;
