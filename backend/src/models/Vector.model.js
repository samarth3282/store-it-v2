import mongoose from 'mongoose';

const vectorSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
      // Chunk 0, 1, 2... within the file
    },
    text: {
      type: String,
      required: true, // Raw extracted text for this chunk
    },
    embedding: {
      type: [Number],
      required: true,
      // Google Gemini text-embedding-004 produces 768-dim vectors
    },
    embeddingModel: {
      type: String,
      default: 'text-embedding-004',
    },
    tokenCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index — fast lookup of all chunks for a file
vectorSchema.index({ fileId: 1, chunkIndex: 1 }, { unique: true });
// Index for owner-scoped vector search (AI agent needs this)
vectorSchema.index({ owner: 1, fileId: 1 });

const Vector = mongoose.model('Vector', vectorSchema);
export default Vector;
