import User from '../models/User.model.js';
import { formatBytes } from '../utils/fileUtils.js';

/**
 * Check if adding `additionalBytes` would exceed the user's storage limit.
 * Throws with 507 status if exceeded.
 */
export const enforceStorageLimit = async (user, additionalBytes) => {
  const totalAfterUpload = user.storageUsed + additionalBytes;
  if (totalAfterUpload > user.storageLimit) {
    const error = new Error(
      `You have used ${formatBytes(user.storageUsed)} of your ${formatBytes(user.storageLimit)} storage limit.`
    );
    error.statusCode = 507;
    error.code = 'STORAGE_QUOTA_EXCEEDED';
    throw error;
  }
};

/**
 * Atomically reserve storage for a new upload.
 * If quota is exceeded, it returns null or throws.
 */
export const reserveStorage = async (userId, additionalBytes) => {
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      $expr: { $lte: [{ $add: ["$storageUsed", additionalBytes] }, "$storageLimit"] }
    },
    { $inc: { storageUsed: additionalBytes } },
    { new: true }
  );

  if (!user) {
    const error = new Error('Storage quota exceeded.');
    error.statusCode = 507;
    error.code = 'STORAGE_QUOTA_EXCEEDED';
    throw error;
  }
  return user;
};

/**
 * Increment or decrement the user's storageUsed counter.
 * Pass positive bytes for upload, negative for delete.
 */
export const updateStorageUsed = async (userId, bytes) => {
  await User.findByIdAndUpdate(userId, {
    $inc: { storageUsed: bytes },
  });
};

/**
 * Recalculate the total storage used by summing all file sizes.
 * Useful as a consistency check.
 */
export const calculateUserStorageUsed = async (userId) => {
  const File = (await import('../models/File.model.js')).default;
  const result = await File.aggregate([
    { $match: { owner: userId } },
    { $group: { _id: null, total: { $sum: '$size' } } },
  ]);
  return result[0]?.total || 0;
};
