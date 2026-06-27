import { verifyAccessToken } from '../utils/jwtUtils.js';
import User from '../models/User.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Attaches req.user if a valid Bearer token is present.
 * Rejects with 401 if missing or invalid.
 */
export const verifyJWT = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      code: 'NO_TOKEN',
      message: 'Authentication token required.',
    });
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    return res.status(401).json({ success: false, code, message: err.message });
  }

  // Fetch user — ensures account still exists and is active
  const user = await User.findById(payload.sub).select('-__v');
  if (!user || !user.isActive) {
    return res.status(401).json({
      success: false,
      code: 'USER_NOT_FOUND',
      message: 'User account not found or deactivated.',
    });
  }

  req.user = user;
  next();
});
