import { asyncHandler } from '../utils/asyncHandler.js';
import { getFileBuffer } from '../services/s3Service.js';
import File from '../models/File.model.js';
import Vector from '../models/Vector.model.js';

/**
 * GET /api/agent/files
 * List files for agent — includes s3Key and s3Bucket (unlike the user-facing endpoint).
 */
export const listFilesForAgent = asyncHandler(async (req, res) => {
  const { type, isIndexed, fileId } = req.query;

  const query = { 
    isDeleted: false,
    $or: [
      { owner: req.user._id },
      { users: req.user.email }
    ]
  };
  if (type) query.type = type;
  if (isIndexed !== undefined) query.isIndexed = isIndexed === 'true';
  if (fileId) query._id = fileId;

  const files = await File.find(query).select('name mimeType s3Key s3Bucket size isIndexed extension type createdAt');

  res.json({
    success: true,
    data: files.map((f) => ({
      id: f._id,
      name: f.name,
      mimeType: f.mimeType,
      s3Key: f.s3Key,
      s3Bucket: f.s3Bucket,
      size: f.size,
      isIndexed: f.isIndexed,
      extension: f.extension,
      type: f.type,
      createdAt: f.createdAt,
    })),
  });
});

/**
 * GET /api/agent/files/:fileId/buffer
 * Stream the raw file bytes from S3 to the agent.
 */
export const getFileBufferHandler = asyncHandler(async (req, res) => {
  const file = await File.findOne({
    _id: req.params.fileId,
    $or: [
      { owner: req.user._id },
      { users: req.user.email }
    ]
  });

  if (!file) {
    return res.status(404).json({
      success: false,
      code: 'FILE_NOT_FOUND',
      message: 'File not found.',
    });
  }

  const buffer = await getFileBuffer(file.s3Key);

  res.set('Content-Type', file.mimeType);
  res.set('Content-Length', buffer.length);
  res.send(buffer);
});

/**
 * POST /api/agent/vectors
 * Store vector embeddings for a file.
 */
export const storeVectors = asyncHandler(async (req, res) => {
  const { fileId, chunks, embeddingModel } = req.body;

  const file = await File.findOne({
    _id: fileId,
    $or: [{ owner: req.user._id }, { users: req.user.email }]
  });
  if (!file) {
    return res.status(404).json({
      success: false,
      code: 'FILE_NOT_FOUND',
      message: 'File not found.',
    });
  }

  // Prepare vector documents
  const vectorDocs = chunks.map((chunk) => ({
    fileId: file._id,
    owner: req.user._id,
    chunkIndex: chunk.chunkIndex,
    text: chunk.text,
    embedding: chunk.embedding,
    embeddingModel: embeddingModel || 'text-embedding-004',
    tokenCount: chunk.tokenCount || 0,
  }));

  // Insert vectors (upsert: delete existing, then insert)
  await Vector.deleteMany({ fileId: file._id });
  await Vector.insertMany(vectorDocs);

  // Update file indexing status
  file.isIndexed = true;
  file.indexedAt = new Date();
  file.chunkCount = chunks.length;
  await file.save();

  res.status(201).json({
    success: true,
    message: `${chunks.length} chunks stored. File marked as indexed.`,
    data: { fileId: file._id, chunkCount: chunks.length },
  });
});

/**
 * POST /api/agent/vectors/query
 * Cosine similarity search over stored vectors.
 */
export const queryVectors = asyncHandler(async (req, res) => {
  const { queryEmbedding, topK = 5, fileId } = req.body;

  let allowedFileIds = [];
  if (fileId) {
    const file = await File.findOne({
      _id: fileId,
      $or: [{ owner: req.user._id }, { users: req.user.email }]
    });
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    allowedFileIds = [fileId];
  } else {
    const files = await File.find({
      isDeleted: false,
      $or: [{ owner: req.user._id }, { users: req.user.email }]
    }).select('_id');
    allowedFileIds = files.map(f => f._id);
  }

  // Use MongoDB Atlas $vectorSearch aggregation pipeline
  // Requires an Atlas Vector Search index named "vector_index" on the "embedding" field.
  const pipeline = [
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: parseInt(topK) * 10,
        limit: parseInt(topK),
        // Filter directly inside vector search is faster, but requires defining the filter in the index schema.
        // We match afterwards for simplicity and schema agnosticism, though it's less efficient.
      }
    },
    {
      $match: {
        fileId: { $in: allowedFileIds }
      }
    },
    {
      $project: {
        chunkIndex: 1,
        text: 1,
        fileId: 1,
        score: { $meta: "vectorSearchScore" }
      }
    }
  ];

  const results = await Vector.aggregate(pipeline);

  // Populate file metadata
  await Vector.populate(results, { path: 'fileId', select: 'name type' });

  const scored = results.map((v) => ({
    chunkIndex: v.chunkIndex,
    text: v.text,
    score: parseFloat((v.score || 0).toFixed(4)),
    fileId: v.fileId?._id,
    fileName: v.fileId?.name,
  }));

  res.json({ success: true, data: scored });
});

/**
 * DELETE /api/agent/vectors/:fileId
 * Delete all vectors for a file.
 */
export const deleteVectors = asyncHandler(async (req, res) => {
  const file = await File.findOne({
    _id: req.params.fileId,
    $or: [{ owner: req.user._id }, { users: req.user.email }]
  });
  if (!file) {
    return res.status(404).json({
      success: false,
      code: 'FILE_NOT_FOUND',
      message: 'File not found.',
    });
  }

  await Vector.deleteMany({ fileId: file._id });

  file.isIndexed = false;
  file.indexedAt = null;
  file.chunkCount = 0;
  await file.save();

  res.json({ success: true, message: 'All vectors for file deleted.' });
});
