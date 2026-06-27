import { asyncHandler } from '../utils/asyncHandler.js';
import { generatePresignedGetUrl } from '../services/s3Service.js';
import File from '../models/File.model.js';

/**
 * GET /api/search
 * Full-text search across user's files.
 */
export const searchFiles = asyncHandler(async (req, res) => {
  const { q, type, limit = 20 } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_QUERY',
      message: 'Search query is required.',
    });
  }

  const query = {
    $or: [
      { owner: req.user._id },
      { users: req.user.email },
    ],
    isDeleted: false,
    name: { $regex: q, $options: 'i' },
  };

  if (type) query.type = type;

  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const files = await File.find(query)
    .sort({ createdAt: -1 })
    .limit(limitNum)
    .populate('owner', 'fullName email avatar');

  // Generate presigned URLs
  const results = await Promise.all(
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
      query: q,
      total: results.length,
      results,
    },
  });
});
