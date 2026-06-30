import { asyncHandler } from '../utils/asyncHandler.js';
import User from '../models/User.model.js';

/**
 * GET /api/users/me
 */
export const getProfile = asyncHandler(async (req, res) => {
  let userData = req.user.toJSON();
  if (userData.avatar && !userData.avatar.startsWith('http')) {
    const { generatePresignedGetUrl } = await import('../services/s3Service.js');
    try {
      userData.avatar = await generatePresignedGetUrl(userData.avatar);
    } catch {
      userData.avatar = null;
    }
  }

  res.json({
    success: true,
    data: userData,
  });
});

/**
 * PATCH /api/users/me
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const updates = {};
  if (req.body.fullName) updates.fullName = req.body.fullName;

  // Handle avatar upload if present
  if (req.file) {
    const { uploadToS3, generatePresignedGetUrl } = await import('../services/s3Service.js');
    const { buildS3Key, getExtension } = await import('../utils/fileUtils.js');

    const extension = getExtension(req.file.originalname);
    const s3Key = buildS3Key(req.user._id, extension);
    await uploadToS3({ key: s3Key, buffer: req.file.buffer, contentType: req.file.mimetype });

    updates.avatar = s3Key;
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  let userData = user.toJSON();
  if (userData.avatar && !userData.avatar.startsWith('http')) {
    const { generatePresignedGetUrl } = await import('../services/s3Service.js');
    try {
      userData.avatar = await generatePresignedGetUrl(userData.avatar);
    } catch {
      userData.avatar = null;
    }
  }

  res.json({ success: true, data: userData });
});
