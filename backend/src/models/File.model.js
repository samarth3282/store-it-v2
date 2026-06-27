import mongoose from 'mongoose';

// Mirrors the Appwrite 'files' collection exactly, adds s3Key/s3Bucket
const fileSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [255, 'File name too long'],
    },
    originalName: {
      type: String, // Original filename before any rename
      required: true,
    },
    // S3 storage location
    s3Key: {
      type: String,
      required: true,
      unique: true,
      // Format: uploads/{userId}/{uuid}.{extension}
    },
    s3Bucket: {
      type: String,
      required: true,
    },

    // File metadata
    mimeType: {
      type: String,
      required: true,
    },
    extension: {
      type: String,
      lowercase: true,
      // e.g. 'pdf', 'mp4', 'jpg'
    },
    size: {
      type: Number, // Bytes
      required: true,
    },
    // Computed file category — mirrors Appwrite's type field
    type: {
      type: String,
      enum: ['document', 'image', 'video', 'audio', 'other'],
      required: true,
    },

    // Pre-signed URL cache (regenerated on GET, not stored permanently)
    // This field is populated in the controller at response time, never persisted
    url: {
      type: String,
      default: null,
    },

    // Sharing
    sharedWith: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        email: { type: String },
        permission: { type: String, enum: ['view', 'download'], default: 'view' },
        sharedAt: { type: Date, default: Date.now },
      },
    ],

    // Legacy compatibility — stores emails of users file is shared with (like Appwrite's users[])
    users: {
      type: [String],
      default: [],
    },

    // Tagging — used by AI agent for semantic grouping
    tags: {
      type: [String],
      default: [],
      index: true,
    },

    // Soft-delete (recycle bin pattern)
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },

    // AI agent fields — set after embedding is complete
    isIndexed: {
      type: Boolean,
      default: false, // True once Vector documents exist for this file
    },
    indexedAt: {
      type: Date,
      default: null,
    },
    // Number of text chunks extracted (useful for the AI agent)
    chunkCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common query patterns
fileSchema.index({ owner: 1, type: 1 });                    // Filter by owner + type
fileSchema.index({ owner: 1, isDeleted: 1, createdAt: -1 }); // Dashboard list
fileSchema.index({ name: 'text', tags: 'text' });            // Full-text search

// Virtual: human-readable file size
fileSchema.virtual('sizeFormatted').get(function () {
  const bytes = this.size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
});

fileSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.s3Key;    // Never expose the raw S3 key to clients
    delete ret.s3Bucket;
    return ret;
  },
});

const File = mongoose.model('File', fileSchema);
export default File;
