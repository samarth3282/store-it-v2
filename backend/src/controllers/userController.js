import { asyncHandler } from '../utils/asyncHandler.js';
import User from '../models/User.model.js';

/**
 * GET /api/users/me
 */
export const getProfile = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: req.user.toJSON(),
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

    const avatarUrl = await generatePresignedGetUrl(s3Key);
    updates.avatar = avatarUrl;
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  res.json({ success: true, data: user.toJSON() });
});
