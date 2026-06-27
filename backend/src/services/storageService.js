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
    { $match: { owner: userId, isDeleted: false } },
    { $group: { _id: null, total: { $sum: '$size' } } },
  ]);
  return result[0]?.total || 0;
};
