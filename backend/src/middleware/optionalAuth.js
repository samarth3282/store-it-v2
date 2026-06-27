import { verifyAccessToken } from '../utils/jwtUtils.js';
import User from '../models/User.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Same as verifyJWT but does NOT reject if no token is present.
 * Used for shared file access where auth is optional.
 * If a valid token is present, req.user is populated.
 * If no token or invalid token, req.user remains undefined and request continues.
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(); // No token — continue without user
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select('-__v');
    if (user && user.isActive) {
      req.user = user;
    }
  } catch {
    // Invalid token — continue without user (non-blocking)
  }

  next();
});
