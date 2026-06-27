import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadToS3, generatePresignedGetUrl, generateDownloadUrl, deleteFromS3 } from '../services/s3Service.js';
import { enforceStorageLimit, updateStorageUsed } from '../services/storageService.js';
import { buildS3Key, getFileType, getExtension } from '../utils/fileUtils.js';
import { sendShareNotificationEmail } from '../services/emailService.js';
import File from '../models/File.model.js';
import User from '../models/User.model.js';
import Vector from '../models/Vector.model.js';

/**
 * POST /api/files/upload
 */
export const uploadFile = asyncHandler(async (req, res) => {
  const { user, file } = req;
  const displayName = req.body.name || file.originalname;

  // Enforce quota
  await enforceStorageLimit(user, file.size);

  // Build S3 key and upload
  const extension = getExtension(file.originalname);
  const s3Key = buildS3Key(user._id, extension);
  await uploadToS3({ key: s3Key, buffer: file.buffer, contentType: file.mimetype });

  // Persist metadata to MongoDB
  const fileDoc = await File.create({
    owner: user._id,
    name: displayName,
    originalName: file.originalname,
    s3Key,
    s3Bucket: process.env.AWS_S3_BUCKET,
    mimeType: file.mimetype,
    extension,
    size: file.size,
    type: getFileType(file.mimetype),
  });

  // Update user's storage counter
  await updateStorageUsed(user._id, file.size);

  // Generate pre-signed URL for immediate use
  const url = await generatePresignedGetUrl(s3Key);

  const response = fileDoc.toJSON();
  response.url = url;

  res.status(201).json({ success: true, data: response });
});

/**
 * GET /api/files
 */
export const getFiles = asyncHandler(async (req, res) => {
  const { type, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', deleted = 'false', searchText = '' } = req.query;

  const query = { owner: req.user._id, isDeleted: deleted === 'true' };
  if (type) query.type = type;

  // Also include files shared with the user
  const orConditions = [
    { owner: req.user._id, isDeleted: deleted === 'true' },
    { users: req.user.email, isDeleted: false },
  ];
  if (type) {
    orConditions.forEach(c => c.type = type);
  }

  let filesQuery = File.find({ $or: orConditions });

  // Full-text search
  if (searchText) {
    filesQuery = File.find({
      $or: orConditions,
      name: { $regex: searchText, $options: 'i' },
    });
  }

  // Sort
  const sortField = sortBy === '$createdAt' ? 'createdAt' : sortBy;
  const sortDir = sortOrder === 'asc' ? 1 : -1;
  filesQuery = filesQuery.sort({ [sortField]: sortDir });

  // Pagination
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [files, total] = await Promise.all([
    filesQuery.skip(skip).limit(limitNum).populate('owner', 'fullName email avatar'),
    File.countDocuments({ $or: orConditions, ...(searchText ? { name: { $regex: searchText, $options: 'i' } } : {}) }),
  ]);

  // Generate presigned URLs for each file
  const filesWithUrls = await Promise.all(
    files.map(async (f) => {
      const json = f.toJSON();
      try {
        json.url = await generatePresignedGetUrl(f.s3Key);
      } catch {
        json.url = null;
      }
      return json;
    })
  );

  res.json({
    success: true,
    data: {
      files: filesWithUrls,
      total,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1,
      },
    },
  });
});

/**
 * GET /api/files/:fileId
 */
export const getFileById = asyncHandler(async (req, res) => {
  const file = await File.findOne({
    _id: req.params.fileId,
    $or: [
      { owner: req.user._id },
      { users: req.user.email },
    ],
    isDeleted: false,
  }).populate('owner', 'fullName email avatar');

  if (!file) {
    return res.status(404).json({
      success: false,
      code: 'FILE_NOT_FOUND',
      message: 'File not found or you do not have access.',
    });
  }

  const json = file.toJSON();
  json.url = await generatePresignedGetUrl(file.s3Key);

  res.json({ success: true, data: json });
});

/**
 * PATCH /api/files/:fileId/rename
 */
export const renameFile = asyncHandler(async (req, res) => {
  const { name } = req.body;

  const file = await File.findOneAndUpdate(
    { _id: req.params.fileId, owner: req.user._id },
    { name },
    { new: true }
  ).populate('owner', 'fullName email avatar');

  if (!file) {
    return res.status(404).json({
      success: false,
      code: 'FILE_NOT_FOUND',
      message: 'File not found or you do not have permission.',
    });
  }

  const json = file.toJSON();
  json.url = await generatePresignedGetUrl(file.s3Key);

  res.json({ success: true, data: json });
});

/**
 * DELETE /api/files/:fileId — soft delete
 */
export const deleteFile = asyncHandler(async (req, res) => {
  const file = await File.findOneAndUpdate(
    { _id: req.params.fileId, owner: req.user._id, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
    { new: true }
  );

  if (!file) {
    return res.status(404).json({
      success: false,
      code: 'FILE_NOT_FOUND',
      message: 'File not found.',
    });
  }

  res.json({
    success: true,
    message: 'File moved to trash.',
    data: { id: file._id, deletedAt: file.deletedAt },
  });
});

/**
 * DELETE /api/files/:fileId/permanent
 */
export const permanentDelete = asyncHandler(async (req, res) => {
  const file = await File.findOne({ _id: req.params.fileId, owner: req.user._id });

  if (!file) {
    return res.status(404).json({
      success: false,
      code: 'FILE_NOT_FOUND',
      message: 'File not found.',
    });
  }

  // Delete from S3
  await deleteFromS3(file.s3Key);

  // Delete associated vectors
  await Vector.deleteMany({ fileId: file._id });

  // Decrement storage
  await updateStorageUsed(req.user._id, -file.size);

  // Remove from MongoDB
  await File.findByIdAndDelete(file._id);

  res.json({ success: true, message: 'File permanently deleted.' });
});

/**
 * POST /api/files/:fileId/restore
 */
export const restoreFile = asyncHandler(async (req, res) => {
  const file = await File.findOneAndUpdate(
    { _id: req.params.fileId, owner: req.user._id, isDeleted: true },
    { isDeleted: false, deletedAt: null },
    { new: true }
  );

  if (!file) {
    return res.status(404).json({
      success: false,
      code: 'FILE_NOT_FOUND',
      message: 'File not found or not in trash.',
    });
  }

  res.json({ success: true, message: 'File restored.' });
});

/**
 * GET /api/files/:fileId/download
 */
export const downloadFile = asyncHandler(async (req, res) => {
  const file = await File.findOne({
    _id: req.params.fileId,
    $or: [
      { owner: req.user._id },
      { users: req.user.email },
    ],
    isDeleted: false,
  });

  if (!file) {
    return res.status(404).json({
      success: false,
      code: 'FILE_NOT_FOUND',
      message: 'File not found.',
    });
  }

  const downloadUrl = await generateDownloadUrl(file.s3Key, file.name);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  res.json({
    success: true,
    data: { downloadUrl, expiresAt },
  });
});

/**
 * POST /api/files/:fileId/share
 */
export const shareFile = asyncHandler(async (req, res) => {
  const { emails } = req.body;

  const file = await File.findOne({ _id: req.params.fileId, owner: req.user._id });
  if (!file) {
    return res.status(404).json({
      success: false,
      code: 'FILE_NOT_FOUND',
      message: 'File not found.',
    });
  }

  // Update the users array (emails of people file is shared with)
  file.users = emails;
  await file.save();

  // Send notification emails (non-blocking — failures are logged, not thrown)
  for (const email of emails) {
    sendShareNotificationEmail(email, req.user.fullName, file.name);
  }

  const json = file.toJSON();
  json.url = await generatePresignedGetUrl(file.s3Key);

  res.json({ success: true, data: json });
});

/**
 * PATCH /api/files/:fileId/tags
 */
export const updateTags = asyncHandler(async (req, res) => {
  const { tags } = req.body;

  const file = await File.findOneAndUpdate(
    { _id: req.params.fileId, owner: req.user._id },
    { tags },
    { new: true }
  );

  if (!file) {
    return res.status(404).json({
      success: false,
      code: 'FILE_NOT_FOUND',
      message: 'File not found.',
    });
  }

  res.json({ success: true, data: file.toJSON() });
});

/**
 * DELETE /api/files/bulk
 */
export const bulkDelete = asyncHandler(async (req, res) => {
  const { fileIds } = req.body;

  const result = await File.updateMany(
    { _id: { $in: fileIds }, owner: req.user._id, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() }
  );

  res.json({
    success: true,
    message: `${result.modifiedCount} files moved to trash.`,
  });
});

/**
 * GET /api/files/stats
 */
export const getStorageStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Aggregate by type
  const byType = await File.aggregate([
    { $match: { owner: userId, isDeleted: false } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        size: { $sum: '$size' },
      },
    },
  ]);

  // Recent uploads
  const recentUploads = await File.find({ owner: userId, isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('owner', 'fullName email avatar');

  // Build stats by type
  const typeStats = {};
  const types = ['document', 'image', 'video', 'audio', 'other'];
  for (const t of types) {
    const entry = byType.find((b) => b._id === t);
    typeStats[t] = {
      count: entry?.count || 0,
      size: entry?.size || 0,
    };
  }

  // Also compute per-type latest dates
  const latestByType = await File.aggregate([
    { $match: { owner: userId, isDeleted: false } },
    {
      $group: {
        _id: '$type',
        latestDate: { $max: '$updatedAt' },
      },
    },
  ]);

  for (const entry of latestByType) {
    if (typeStats[entry._id]) {
      typeStats[entry._id].latestDate = entry.latestDate;
    }
  }

  const user = await User.findById(userId);

  // Generate URLs for recent files
  const recentWithUrls = await Promise.all(
    recentUploads.map(async (f) => {
      const json = f.toJSON();
      try {
        json.url = await generatePresignedGetUrl(f.s3Key);
      } catch {
        json.url = null;
      }
      return json;
    })
  );

  res.json({
    success: true,
    data: {
      totalUsed: user.storageUsed,
      totalLimit: user.storageLimit,
      usedPercent: ((user.storageUsed / user.storageLimit) * 100).toFixed(2),
      byType: typeStats,
      recentUploads: recentWithUrls,
    },
  });
});
