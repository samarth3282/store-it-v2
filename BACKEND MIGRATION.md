# StoreIt — Backend Migration Guide
## Appwrite + Next.js Server Actions → MERN Stack (Express + MongoDB + Multer + S3)
### MVC Architecture | Agentic-Ready | Full REST API

---

> **Scope of this document:** Backend only. The React/Next.js frontend and the Python FastAPI AI agent are addressed separately. This guide covers everything needed to stand up a production-grade Express.js backend that completely replaces Appwrite as the BaaS layer, while exposing a clean REST contract that the existing Next.js frontend and the FastAPI AI agent can both consume.

---

## Table of Contents

1. [Why Migrate Away from Appwrite](#1-why-migrate-away-from-appwrite)
2. [Migration Philosophy](#2-migration-philosophy)
3. [Current Architecture (Source)](#3-current-architecture-source)
4. [Target Architecture (Destination)](#4-target-architecture-destination)
5. [Technology Stack Decisions](#5-technology-stack-decisions)
6. [Complete Project Structure](#6-complete-project-structure)
7. [MongoDB Schema Design](#7-mongodb-schema-design)
8. [API Surface — Every Endpoint Documented](#8-api-surface--every-endpoint-documented)
9. [Multer Configuration and S3 Upload Flow](#9-multer-configuration-and-s3-upload-flow)
10. [JWT Authentication (Replacing Appwrite OTP)](#10-jwt-authentication-replacing-appwrite-otp)
11. [Complete Environment Variables Reference](#11-complete-environment-variables-reference)
12. [Dependencies — Full List with Purpose and Version](#12-dependencies--full-list-with-purpose-and-version)
13. [Step-by-Step Implementation Guide](#13-step-by-step-implementation-guide)
14. [MVC Layer Breakdown with Annotated Code](#14-mvc-layer-breakdown-with-annotated-code)
15. [Middleware Chain Explained](#15-middleware-chain-explained)
16. [S3 Bucket Policies and IAM Setup](#16-s3-bucket-policies-and-iam-setup)
17. [Agentic Integration Contract](#17-agentic-integration-contract)
18. [Error Handling Strategy](#18-error-handling-strategy)
19. [Security Hardening Checklist](#19-security-hardening-checklist)
20. [Migration Sequence: Data and Feature Parity Map](#20-migration-sequence-data-and-feature-parity-map)
21. [Local Development Runbook](#21-local-development-runbook)
22. [What Changes in the Frontend (Next.js)](#22-what-changes-in-the-frontend-nextjs)

---

## 1. Why Migrate Away from Appwrite

The original StoreIt used Appwrite Cloud as a full BaaS layer. While Appwrite accelerates early development, it introduces the following constraints that this migration removes:

**Vendor Lock-in**
- All auth, database queries, file storage, and permissions are expressed in Appwrite's proprietary SDK and query syntax. Moving providers requires a full rewrite of every data access call.

**Storage Limitations**
- Appwrite's free tier enforces a 75K executions/month cap and limited bandwidth. AWS S3 scales to petabytes with pay-per-use pricing, pre-signed URL support, CDN integration, and lifecycle policies — none of which Appwrite free tier offers.

**No Real Server-Side Logic**
- With Next.js Server Actions calling Appwrite directly, there is no dedicated server layer to insert middleware (rate limiting, virus scanning, audit logging) between the client and the data store. This makes the codebase hostile to agentic integration, where an AI agent needs to make the same file and user operations via a clean HTTP contract.

**Agentic Incompatibility**
- The FastAPI AI agent currently reaches into Appwrite directly using the Appwrite Python SDK. This creates a second, uncoordinated data access path with no shared middleware, no shared auth, and no unified audit trail. A proper REST API that both the frontend and the AI agent consume through the same endpoints solves this.

**MVC Absence**
- Logic is split between Next.js Server Actions (`lib/actions/`) and Appwrite's SDK calls. There is no controller layer, no service layer, and no clear model boundary. The new architecture enforces MVC strictly so every operation has a predictable home.

---

## 2. Migration Philosophy

Every decision in this migration follows three rules:

**Rule 1 — Zero Appwrite surface.** No `node-appwrite`, no Appwrite SDK, no Appwrite-specific query syntax anywhere in the new codebase.

**Rule 2 — Agentic-first API design.** Every endpoint is designed as if an autonomous AI agent will call it. This means: deterministic JSON responses, machine-readable error codes, idempotent operations where possible, and a dedicated `/agent` route namespace for AI-specific operations.

**Rule 3 — Multer → S3 as the single file pipeline.** All file I/O flows through Multer (parsing the multipart form), then through the S3 service (upload, presign, delete). No file is ever written to the local disk in production.

---

## 3. Current Architecture (Source)

```
Browser (Next.js 15)
     │
     ├── Server Actions (lib/actions/file.actions.ts)
     │        └── Appwrite Node SDK  ──────────────────────► Appwrite Cloud
     │                                                          ├── Auth (OTP)
     ├── Server Actions (lib/actions/user.actions.ts)          ├── Database
     │        └── Appwrite Node SDK  ──────────────────────►   │   ├── users collection
     │                                                          │   ├── files collection
     └── Appwrite Browser SDK (lib/appwrite.ts)                │   └── vectors collection
              └── Direct client calls for session              └── Storage Bucket

FastAPI AI Agent (ai-agent/)
     └── Appwrite Python SDK ─────────────────────────────► Same Appwrite Cloud
          (separate, uncoordinated access to same data)
```

**Problems with this picture:**
- The AI agent and the frontend talk to Appwrite independently. There is no single server to intercept, validate, or log these calls.
- Auth state lives entirely in Appwrite. There is no JWT or session token the Express server can verify.
- File metadata (name, size, type, owner, URL) is stored in Appwrite's `files` collection. The file bytes are in the Appwrite storage bucket. Both must be replaced.
- The `vectors` collection (used by the AI agent for RAG) is in Appwrite. It must move to MongoDB.

---

## 4. Target Architecture (Destination)

```
Browser (React / Next.js)
     │
     │   HTTP REST (Bearer JWT)
     ▼
Express.js API Server  (Node.js / MVC)
     ├── routes/
     ├── controllers/
     ├── services/
     │     ├── s3Service.js  ──────────────────────────────► AWS S3 Bucket
     │     │                                                   (file bytes + presigned URLs)
     │     └── emailService.js ─────────────────────────────► SendGrid / Nodemailer (OTP)
     ├── models/  ───────────────────────────────────────────► MongoDB Atlas
     │     ├── User
     │     ├── File
     │     └── Vector
     └── middleware/
           ├── auth.js (JWT verify)
           ├── upload.js (Multer memory storage)
           └── errorHandler.js

FastAPI AI Agent  (ai-agent/)
     │
     │   HTTP REST (Bearer JWT — same tokens)
     ▼
Express.js API Server  (/api/agent/* routes)
     └── Same controllers, same models, same S3 — unified data access
```

**What this gives you:**
- One server owns all business logic. Both the Next.js frontend and the FastAPI AI agent are clients of this server.
- JWT tokens issued by Express are verified by both the Next.js middleware and the FastAPI agent's auth header, giving you a single identity plane.
- Multer runs in memory (no temp disk files), hands the buffer directly to the AWS SDK `PutObjectCommand`. The file never touches the filesystem.
- MongoDB stores all metadata. S3 stores all bytes. These are the only two external datastores.

---

## 5. Technology Stack Decisions

| Concern | Appwrite (Old) | New Choice | Reason |
|---|---|---|---|
| Runtime | Appwrite Cloud | Node.js 20 LTS + Express 5 | Full control, same ecosystem as Next.js |
| Database | Appwrite Collections | MongoDB 7 + Mongoose 8 | Flexible schema, excellent aggregation pipeline for file search |
| Auth | Appwrite OTP | JWT (jsonwebtoken) + bcrypt + Nodemailer OTP | Self-contained, works with any client |
| File upload parsing | Appwrite SDK | Multer (memoryStorage) | Industry standard, zero disk writes |
| File storage | Appwrite Bucket | AWS S3 (aws-sdk v3) | Scale, CDN, lifecycle rules, pre-signed URLs |
| Email | Appwrite internal | Nodemailer + Gmail/SendGrid | Direct SMTP control |
| Validation | None (Appwrite enforces schema) | Zod + express-validator | Portable schema, same library the frontend already uses |
| Rate limiting | Appwrite Cloud limits | express-rate-limit | Per-route granularity |
| CORS | Appwrite dashboard | cors npm package | Programmatic control per environment |
| Logging | None | Morgan + Winston | Access log + structured app log |
| Security headers | None | Helmet.js | One-line hardening |

---

## 6. Complete Project Structure

Every directory and file is listed here with its exact responsibility. No ambiguity about where logic lives.

```
backend/
│
├── src/
│   │
│   ├── config/                          # Pure configuration — no business logic
│   │   ├── db.js                        # Mongoose connect/disconnect + retry logic
│   │   ├── aws.js                       # S3Client singleton (aws-sdk v3)
│   │   ├── multer.js                    # Multer instance (memoryStorage, size limits, mime filter)
│   │   ├── email.js                     # Nodemailer transporter singleton
│   │   └── env.js                       # Loads + validates .env with Zod; throws on missing keys
│   │
│   ├── models/                          # Mongoose schemas — the M in MVC
│   │   ├── User.model.js                      # User schema: email, passwordHash, otpHash, otpExpiry,
│   │   │                                #   storageUsed, storageLimit, isVerified, refreshTokens[]
│   │   ├── File.model.js                      # File schema: owner (ref User), name, originalName,
│   │   │                                #   s3Key, s3Bucket, mimeType, size, extension, type,
│   │   │                                #   url (pre-signed or CDN), sharedWith[], tags[],
│   │   │                                #   isDeleted, deletedAt, createdAt, updatedAt
│   │   └── Vector.model.js                    # Vector schema: fileId (ref File), owner (ref User),
│   │                                    #   chunkIndex, text, embedding[], model, createdAt
│   │
│   ├── controllers/                     # The C in MVC — orchestrate, never query DB directly
│   │   ├── authController.js            # register, verifyOtp, resendOtp, login, logout,
│   │   │                                #   refreshToken, forgotPassword, resetPassword
│   │   ├── fileController.js            # uploadFile, getFiles, getFileById, renameFile,
│   │   │                                #   deleteFile, downloadFile, shareFile, getFilesByType,
│   │   │                                #   updateFileTags, bulkDelete, getStorageStats
│   │   ├── userController.js            # getProfile, updateProfile, getStorageUsage
│   │   ├── searchController.js          # searchFiles (full-text + type filter + date range)
│   │   └── agentController.js           # listFilesForAgent, getFileChunks, storeVectors,
│   │                                    #   queryVectors, getFileBuffer (for AI to read bytes)
│   │
│   ├── services/                        # Thin wrappers around external systems
│   │   ├── s3Service.js                 # uploadToS3, generatePresignedGetUrl,
│   │   │                                #   generatePresignedPutUrl, deleteFromS3, getFileBuffer
│   │   ├── emailService.js              # sendOtpEmail, sendPasswordResetEmail,
│   │   │                                #   sendShareNotificationEmail
│   │   └── storageService.js            # calculateUserStorageUsed, enforceStorageLimit,
│   │                                    #   updateStorageUsed (called after every upload/delete)
│   │
│   ├── middleware/                      # Express middleware functions
│   │   ├── auth.js                      # verifyJWT — reads Bearer token, attaches req.user
│   │   ├── optionalAuth.js              # Same but does not reject if no token (for shared files)
│   │   ├── upload.js                    # Multer instance exported as uploadSingle / uploadMultiple
│   │   ├── validateRequest.js           # Wraps Zod schema validation for body/query/params
│   │   ├── rateLimiter.js               # Separate limiters for auth routes vs file routes
│   │   ├── ownershipCheck.js            # Confirms req.user._id === file.owner before mutation
│   │   └── errorHandler.js              # Global error handler — normalises all errors to JSON
│   │
│   ├── routes/                          # The R in Express — maps HTTP verbs+paths to controllers
│   │   ├── index.js                     # Mounts all routers under /api prefix
│   │   ├── auth.js                      # /api/auth/*
│   │   ├── files.js                     # /api/files/*
│   │   ├── users.js                     # /api/users/*
│   │   ├── search.js                    # /api/search
│   │   └── agent.js                     # /api/agent/* — consumed by FastAPI, not the browser
│   │
│   ├── utils/
│   │   ├── otpUtils.js                  # generateOtp (6-digit), hashOtp, compareOtp
│   │   ├── jwtUtils.js                  # signAccessToken, signRefreshToken, verifyToken
│   │   ├── fileUtils.js                 # getFileType (image/document/media/other),
│   │   │                                #   getExtension, buildS3Key, formatBytes
│   │   ├── asyncHandler.js              # Wraps async controller functions — catches unhandled promise
│   │   └── logger.js                    # Winston logger instance (console + file transport)
│   │
│   └── app.js                           # Express app factory (not server.js — keeps app testable)
│
├── server.js                            # Entry point — imports app, connects DB, starts HTTP server
├── .env                                 # Local secrets (never commit)
├── .env.example                         # Template with all keys and descriptions
├── .gitignore
├── package.json
└── README.md                            # This file
```

**Why service layer between controller and model?**

Controllers call services. Services call models or external SDKs (S3, email). This means:
- You can unit-test a controller by mocking the service — no real DB or S3 needed.
- You can swap S3 for GCS tomorrow by rewriting only `s3Service.js`.
- The FastAPI AI agent calling `/api/agent/file-chunks` goes through the same `agentController` → `s3Service` path as the browser upload, so there is exactly one code path to audit.

---

## 7. MongoDB Schema Design

This section replaces the three Appwrite collections (`users`, `files`, `vectors`) with Mongoose models.

### 7.1 User Model (`src/models/User.js`)

```javascript
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    passwordHash: {
      type: String,
      // Not required — OTP-only sign-in is also supported
      select: false,        // Never returned in queries unless explicitly .select('+passwordHash')
    },
    avatar: {
      type: String,         // S3 key of avatar image
      default: null,
    },

    // OTP fields — used for email OTP sign-in (replicating Appwrite's OTP auth)
    otpHash: {
      type: String,
      select: false,
    },
    otpExpiry: {
      type: Date,
      select: false,
    },
    otpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    // JWT refresh token store (array supports multi-device)
    refreshTokens: {
      type: [String],
      select: false,
      default: [],
    },

    // Account state
    isVerified: {
      type: Boolean,
      default: false,        // Set to true after OTP verification
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Storage quota
    storageUsed: {
      type: Number,          // Bytes
      default: 0,
    },
    storageLimit: {
      type: Number,          // Bytes — default 2 GB
      default: 2 * 1024 * 1024 * 1024,
    },

    // Password reset
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpiry: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,        // Adds createdAt, updatedAt automatically
  }
);

// Index for fast email lookups (already unique, but explicit for query planner)
userSchema.index({ email: 1 });

// Virtual: storage used as a percentage
userSchema.virtual('storageUsedPercent').get(function () {
  return ((this.storageUsed / this.storageLimit) * 100).toFixed(2);
});

// Instance method — never expose this on the returned object
userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// Pre-save hook — hash password if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// toJSON transform — strip sensitive fields from API responses
userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.otpHash;
    delete ret.otpExpiry;
    delete ret.otpAttempts;
    delete ret.refreshTokens;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpiry;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);
export default User;
```

### 7.2 File Model (`src/models/File.js`)

```javascript
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
      type: String,          // Original filename before any rename
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
      type: Number,          // Bytes
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
        permission: { type: String, enum: ['view', 'download'], default: 'view' },
        sharedAt: { type: Date, default: Date.now },
      },
    ],

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
      default: false,        // True once Vector documents exist for this file
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
fileSchema.index({ owner: 1, type: 1 });                  // Filter by owner + type
fileSchema.index({ owner: 1, isDeleted: 1, createdAt: -1 }); // Dashboard list
fileSchema.index({ owner: 1, name: 'text', tags: 'text' });  // Full-text search

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
    delete ret.__v;
    delete ret.s3Key;        // Never expose the raw S3 key to clients
    delete ret.s3Bucket;
    return ret;
  },
});

const File = mongoose.model('File', fileSchema);
export default File;
```

### 7.3 Vector Model (`src/models/Vector.js`)

This replaces the Appwrite `vectors` collection used by the FastAPI RAG pipeline.

```javascript
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
      required: true,        // Raw extracted text for this chunk
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
```

---

## 8. API Surface — Every Endpoint Documented

All routes are prefixed with `/api`. All requests and responses are `application/json` unless noted. Protected routes require `Authorization: Bearer <accessToken>`.

### 8.1 Auth Routes (`/api/auth`)

---

#### `POST /api/auth/register`
Create a new account. Sends an OTP to the provided email. Does NOT return a token yet — verification is required first.

**Request body:**
```json
{
  "fullName": "Parth Goswami",
  "email": "parth@example.com"
}
```

**Success `201`:**
```json
{
  "success": true,
  "message": "Account created. Check your email for the OTP.",
  "data": {
    "userId": "6868a1b2c3d4e5f6a7b8c9d0",
    "email": "parth@example.com"
  }
}
```

**Error `409` (email already exists):**
```json
{
  "success": false,
  "code": "EMAIL_ALREADY_EXISTS",
  "message": "An account with this email already exists."
}
```

---

#### `POST /api/auth/verify-otp`
Verify the OTP sent to email. On success, issues an access token and refresh token.

**Request body:**
```json
{
  "userId": "6868a1b2c3d4e5f6a7b8c9d0",
  "otp": "847291"
}
```

**Success `200`:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "6868a1b2c3d4e5f6a7b8c9d0",
      "fullName": "Parth Goswami",
      "email": "parth@example.com",
      "storageUsed": 0,
      "storageLimit": 2147483648,
      "createdAt": "2026-06-27T00:00:00.000Z"
    }
  }
}
```

**Error `400` (invalid/expired OTP):**
```json
{
  "success": false,
  "code": "OTP_INVALID_OR_EXPIRED",
  "message": "The OTP is invalid or has expired. Request a new one."
}
```

---

#### `POST /api/auth/resend-otp`
Resend OTP. Rate-limited to 3 requests per 10 minutes per userId.

**Request body:**
```json
{ "userId": "6868a1b2c3d4e5f6a7b8c9d0" }
```

**Success `200`:**
```json
{ "success": true, "message": "A new OTP has been sent to your email." }
```

---

#### `POST /api/auth/login`
Email+OTP-based login (same flow as register but for existing verified users). Alternatively, you can add password login in the same endpoint using a `method` discriminator.

**Request body:**
```json
{ "email": "parth@example.com" }
```

**Success `200`:**
```json
{
  "success": true,
  "message": "OTP sent to your email.",
  "data": { "userId": "6868a1b2c3d4e5f6a7b8c9d0" }
}
```

---

#### `POST /api/auth/refresh`
Exchange a valid refresh token for a new access token. The old refresh token is invalidated (rotation).

**Request body:**
```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

**Success `200`:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

#### `POST /api/auth/logout` *(Protected)*
Invalidates the refresh token on the server. Access token expires naturally (15 min TTL).

**Request body:**
```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

**Success `200`:**
```json
{ "success": true, "message": "Logged out successfully." }
```

---

### 8.2 File Routes (`/api/files`)

All file routes are protected (JWT required).

---

#### `POST /api/files/upload` *(Protected)*
Upload one file. Multer parses the `multipart/form-data`. The file buffer is streamed to S3. File metadata is saved to MongoDB. User's `storageUsed` is incremented.

**Request:** `Content-Type: multipart/form-data`
```
file:        (binary) — the file
name:        (string, optional) — display name; defaults to original filename
```

**Success `201`:**
```json
{
  "success": true,
  "data": {
    "id": "6868b1b2c3d4e5f6a7b8c9d1",
    "name": "project-brief.pdf",
    "originalName": "project-brief.pdf",
    "mimeType": "application/pdf",
    "extension": "pdf",
    "size": 204800,
    "sizeFormatted": "200.0 KB",
    "type": "document",
    "url": "https://storeit-bucket.s3.amazonaws.com/uploads/...?X-Amz-Signature=...",
    "isIndexed": false,
    "tags": [],
    "createdAt": "2026-06-27T00:00:00.000Z"
  }
}
```

**Error `413` (file too large):**
```json
{
  "success": false,
  "code": "FILE_TOO_LARGE",
  "message": "File exceeds the 100 MB per-file limit."
}
```

**Error `415` (unsupported type):**
```json
{
  "success": false,
  "code": "UNSUPPORTED_FILE_TYPE",
  "message": "Files of type application/x-msdownload are not allowed."
}
```

**Error `507` (storage quota exceeded):**
```json
{
  "success": false,
  "code": "STORAGE_QUOTA_EXCEEDED",
  "message": "You have used 2.0 GB of your 2.0 GB storage limit."
}
```

---

#### `GET /api/files` *(Protected)*
List files for the authenticated user. Supports pagination, type filtering, and sorting.

**Query parameters:**
```
type:        document | image | video | audio | other   (optional)
page:        integer, default 1
limit:       integer, default 20, max 100
sortBy:      createdAt | name | size                     (default: createdAt)
sortOrder:   asc | desc                                  (default: desc)
deleted:     true | false                                (default: false — shows only active files)
```

**Success `200`:**
```json
{
  "success": true,
  "data": {
    "files": [ /* array of File objects */ ],
    "pagination": {
      "total": 47,
      "page": 1,
      "limit": 20,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

#### `GET /api/files/:fileId` *(Protected)*
Get a single file by ID. The `url` field is a fresh pre-signed S3 GET URL valid for 1 hour.

**Success `200`:**
```json
{
  "success": true,
  "data": { /* full File object with url */ }
}
```

**Error `404`:**
```json
{
  "success": false,
  "code": "FILE_NOT_FOUND",
  "message": "File not found or you do not have access."
}
```

---

#### `PATCH /api/files/:fileId/rename` *(Protected)*
Rename a file. Only the display `name` field changes. The S3 key is not modified.

**Request body:**
```json
{ "name": "final-draft.pdf" }
```

**Success `200`:**
```json
{
  "success": true,
  "data": { /* updated File object */ }
}
```

---

#### `DELETE /api/files/:fileId` *(Protected)*
Soft-delete a file. Sets `isDeleted: true`, `deletedAt: now`. The S3 object is NOT deleted yet — a scheduled job or explicit restore/purge action handles final deletion. This replicates the "trash" UX of the original StoreIt.

**Success `200`:**
```json
{
  "success": true,
  "message": "File moved to trash.",
  "data": { "id": "6868b1b2c3d4e5f6a7b8c9d1", "deletedAt": "2026-06-27T00:00:00.000Z" }
}
```

---

#### `DELETE /api/files/:fileId/permanent` *(Protected)*
Permanently delete a file. Deletes the S3 object, removes all associated Vector documents, decrements user's `storageUsed`.

**Success `200`:**
```json
{
  "success": true,
  "message": "File permanently deleted."
}
```

---

#### `POST /api/files/:fileId/restore` *(Protected)*
Restore a soft-deleted file.

**Success `200`:**
```json
{ "success": true, "message": "File restored." }
```

---

#### `GET /api/files/:fileId/download` *(Protected)*
Returns a short-lived (15-minute) pre-signed S3 GET URL for direct browser download. Does not proxy the file through Express — the client is redirected to S3 directly.

**Success `200`:**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://storeit-bucket.s3.amazonaws.com/uploads/...?response-content-disposition=attachment...",
    "expiresAt": "2026-06-27T00:15:00.000Z"
  }
}
```

---

#### `POST /api/files/:fileId/share` *(Protected)*
Share a file with another user by email.

**Request body:**
```json
{
  "email": "colleague@example.com",
  "permission": "view"
}
```

**Success `200`:**
```json
{ "success": true, "message": "File shared with colleague@example.com." }
```

---

#### `PATCH /api/files/:fileId/tags` *(Protected)*
Update the tags array on a file. Used by the AI agent to annotate files after indexing.

**Request body:**
```json
{ "tags": ["contract", "Q2-2026", "reviewed"] }
```

**Success `200`:**
```json
{
  "success": true,
  "data": { /* updated File object */ }
}
```

---

#### `DELETE /api/files/bulk` *(Protected)*
Soft-delete multiple files at once.

**Request body:**
```json
{ "fileIds": ["id1", "id2", "id3"] }
```

**Success `200`:**
```json
{ "success": true, "message": "3 files moved to trash." }
```

---

#### `GET /api/files/stats` *(Protected)*
Storage usage summary — powers the dashboard chart.

**Success `200`:**
```json
{
  "success": true,
  "data": {
    "totalUsed": 536870912,
    "totalUsedFormatted": "512.0 MB",
    "totalLimit": 2147483648,
    "totalLimitFormatted": "2.0 GB",
    "usedPercent": "25.00",
    "byType": {
      "document": { "count": 23, "size": 104857600, "sizeFormatted": "100.0 MB" },
      "image":    { "count": 41, "size": 209715200, "sizeFormatted": "200.0 MB" },
      "video":    { "count": 5,  "size": 209715200, "sizeFormatted": "200.0 MB" },
      "audio":    { "count": 3,  "size": 12582912,  "sizeFormatted": "12.0 MB" },
      "other":    { "count": 8,  "size": 10485760,  "sizeFormatted": "10.0 MB" }
    },
    "recentUploads": [ /* 5 most recent File objects */ ]
  }
}
```

---

### 8.3 User Routes (`/api/users`)

---

#### `GET /api/users/me` *(Protected)*
Get the authenticated user's profile.

**Success `200`:**
```json
{
  "success": true,
  "data": {
    "id": "6868a1b2c3d4e5f6a7b8c9d0",
    "fullName": "Parth Goswami",
    "email": "parth@example.com",
    "storageUsed": 536870912,
    "storageLimit": 2147483648,
    "storageUsedPercent": "25.00",
    "isVerified": true,
    "createdAt": "2026-06-27T00:00:00.000Z"
  }
}
```

---

#### `PATCH /api/users/me` *(Protected)*
Update profile (full name, avatar).

**Request:** `multipart/form-data` or `application/json`
```
fullName:   (string, optional)
avatar:     (file, optional) — uploaded to S3, old avatar deleted
```

**Success `200`:**
```json
{ "success": true, "data": { /* updated User object */ } }
```

---

### 8.4 Search Routes (`/api/search`)

---

#### `GET /api/search` *(Protected)*
Full-text search across the authenticated user's files. Uses MongoDB's text index on `name` and `tags`.

**Query parameters:**
```
q:           (string, required) — search query
type:        document | image | video | audio | other  (optional filter)
limit:       integer, default 20
```

**Success `200`:**
```json
{
  "success": true,
  "data": {
    "query": "contract",
    "total": 7,
    "results": [
      {
        "id": "6868b1b2c3d4e5f6a7b8c9d1",
        "name": "service-contract-2026.pdf",
        "type": "document",
        "score": 1.2,
        "url": "https://storeit-bucket.s3.amazonaws.com/...",
        "createdAt": "2026-06-27T00:00:00.000Z"
      }
    ]
  }
}
```

---

### 8.5 Agent Routes (`/api/agent`)

These routes are consumed exclusively by the FastAPI AI agent. They use the same JWT auth middleware but can enforce an additional `x-agent-secret` header as a second factor (configured via env).

All agent routes accept `Authorization: Bearer <token>` where the token is the same JWT issued to the user whose files are being processed.

---

#### `GET /api/agent/files` *(Protected + Agent)*
List all non-deleted files for the token owner, with S3 keys included. Unlike `/api/files`, this returns `s3Key` and `s3Bucket` — needed by the agent to fetch raw bytes for embedding.

**Query parameters:**
```
type:        document | image | ... (optional)
isIndexed:   true | false          (optional — get only unindexed files)
```

**Success `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "6868b1b2c3d4e5f6a7b8c9d1",
      "name": "project-brief.pdf",
      "mimeType": "application/pdf",
      "s3Key": "uploads/6868a1.../uuid.pdf",
      "s3Bucket": "storeit-prod",
      "size": 204800,
      "isIndexed": false
    }
  ]
}
```

---

#### `GET /api/agent/files/:fileId/buffer` *(Protected + Agent)*
Returns the raw file as a binary stream. The Express controller fetches the S3 object and pipes it directly to the response. The FastAPI agent uses this to read PDF/text content without needing its own AWS credentials.

**Response:** `Content-Type: {mimeType}` — binary body

**Why this design:** The AI agent never needs its own S3 credentials. All file access is mediated by the Express server, which enforces ownership checks before streaming.

---

#### `POST /api/agent/vectors` *(Protected + Agent)*
Store vector embeddings generated by the AI agent after processing a file.

**Request body:**
```json
{
  "fileId": "6868b1b2c3d4e5f6a7b8c9d1",
  "chunks": [
    {
      "chunkIndex": 0,
      "text": "This service contract between...",
      "embedding": [0.021, -0.043, ...],    // 768 floats
      "tokenCount": 512
    }
  ],
  "embeddingModel": "text-embedding-004"
}
```

**Success `201`:**
```json
{
  "success": true,
  "message": "3 chunks stored. File marked as indexed.",
  "data": { "fileId": "6868b1b2c3d4e5f6a7b8c9d1", "chunkCount": 3 }
}
```

**Side effects:** Updates `File.isIndexed = true`, `File.indexedAt = now`, `File.chunkCount = chunks.length`.

---

#### `POST /api/agent/vectors/query` *(Protected + Agent)*
Vector similarity search. Returns the N most similar text chunks to a query embedding.

**Request body:**
```json
{
  "queryEmbedding": [0.021, -0.043, ...],   // 768 floats
  "topK": 5,
  "fileId": "6868b1b2c3d4e5f6a7b8c9d1"     // optional — scope to one file
}
```

**Success `200`:**
```json
{
  "success": true,
  "data": [
    {
      "chunkIndex": 2,
      "text": "Payment terms are NET-30...",
      "score": 0.94,
      "fileId": "6868b1b2c3d4e5f6a7b8c9d1",
      "fileName": "service-contract-2026.pdf"
    }
  ]
}
```

**Note on vector similarity:** MongoDB Atlas Vector Search handles this natively with `$vectorSearch` if you use Atlas. For a self-hosted setup, this endpoint does cosine similarity in JavaScript (`embedding dot product / magnitudes`). Switch to Atlas Search for production scale.

---

#### `DELETE /api/agent/vectors/:fileId` *(Protected + Agent)*
Delete all vectors for a file (called when a file is re-indexed or permanently deleted).

**Success `200`:**
```json
{ "success": true, "message": "All vectors for file deleted." }
```

---

## 9. Multer Configuration and S3 Upload Flow

This is the most architecturally important section. Every file upload decision is explained here.

### 9.1 Why `memoryStorage` and Not `diskStorage`

`multer.diskStorage` writes the file to the local filesystem before your handler runs. In a deployed environment (Render, Railway, AWS EC2) this means:

- Disk fills up if uploads are frequent and cleanup fails.
- If you run multiple instances (horizontal scaling), the file lands on one instance's disk, not the others.
- You have to explicitly `fs.unlink` after S3 upload — a cleanup step that can fail silently.

`multer.memoryStorage` keeps the file as a `Buffer` on `req.file.buffer`. You pass this buffer directly to the AWS SDK `PutObjectCommand`. The file never touches the disk. Memory is freed by garbage collection after the request ends.

**Trade-off:** Large files (> 50 MB) will consume significant RAM per concurrent upload. Mitigate this with a `limits.fileSize` of 100 MB and by using S3 multipart upload for files above 10 MB (the `s3Service` handles this automatically).

### 9.2 `src/config/multer.js`

```javascript
import multer from 'multer';
import path from 'path';

// Allowed MIME types — extend this list to allow more file types
const ALLOWED_MIME_TYPES = new Set([
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Video
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/webm',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
]);

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(`Unsupported file type: ${file.mimetype}`);
    error.code = 'UNSUPPORTED_FILE_TYPE';
    cb(error, false);
  }
};

const storage = multer.memoryStorage();

// Main upload instance — 100 MB limit per file
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,  // 100 MB
    files: 1,                       // Single file per request
  },
});

// Avatar upload — 5 MB limit, images only
const avatarFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Avatar must be an image.'), false);
  }
};

export const uploadAvatar = multer({
  storage,
  fileFilter: avatarFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
```

### 9.3 Upload Flow — Step by Step

```
Client (browser or AI agent)
  │
  │  POST /api/files/upload
  │  Content-Type: multipart/form-data
  │  Authorization: Bearer <jwt>
  │  Body: { file: <binary>, name: "doc.pdf" }
  │
  ▼
auth.js middleware
  │  → Verifies JWT, attaches req.user
  ▼
upload.js middleware (multer.single('file'))
  │  → Parses multipart body
  │  → Runs fileFilter — rejects disallowed MIME types
  │  → Checks size limit — rejects > 100 MB
  │  → Populates req.file = { originalname, mimetype, size, buffer }
  ▼
storageService.enforceStorageLimit(req.user)
  │  → Checks user.storageUsed + req.file.size <= user.storageLimit
  │  → Throws 507 if exceeded
  ▼
fileController.uploadFile
  │  → Calls fileUtils.getFileType(mimetype) → 'document'
  │  → Calls fileUtils.buildS3Key(userId, filename) → 'uploads/abc123/uuid.pdf'
  │  → Calls s3Service.uploadToS3({
  │      key: s3Key,
  │      buffer: req.file.buffer,
  │      contentType: req.file.mimetype,
  │      bucket: process.env.AWS_S3_BUCKET,
  │    })
  │  → On S3 success: creates File document in MongoDB
  │  → Calls storageService.updateStorageUsed(userId, +req.file.size)
  │  → Calls s3Service.generatePresignedGetUrl(s3Key) → url
  │  → Returns 201 with File object
  ▼
AWS S3
  → Object stored at s3://storeit-prod/uploads/{userId}/{uuid}.pdf
  → No public access — only reachable via pre-signed URL
```

### 9.4 `src/services/s3Service.js`

```javascript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage'; // for multipart
import { s3Client } from '../config/aws.js';

const BUCKET = process.env.AWS_S3_BUCKET;

/**
 * Upload a file buffer to S3.
 * Uses multipart upload for files > 10 MB for reliability.
 */
export const uploadToS3 = async ({ key, buffer, contentType }) => {
  const fileSizeMB = buffer.length / (1024 * 1024);

  if (fileSizeMB > 10) {
    // Multipart upload — recommended by AWS for files > 5 MB
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      },
    });
    await upload.done();
  } else {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    });
    await s3Client.send(command);
  }

  return { key, bucket: BUCKET };
};

/**
 * Generate a pre-signed GET URL valid for the specified TTL.
 * Default: 3600 seconds (1 hour)
 */
export const generatePresignedGetUrl = async (key, expiresInSeconds = 3600) => {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
};

/**
 * Generate a pre-signed GET URL with Content-Disposition: attachment
 * for browser download.
 */
export const generateDownloadUrl = async (key, filename, expiresInSeconds = 900) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
};

/**
 * Delete an object from S3.
 * Called on permanent file deletion.
 */
export const deleteFromS3 = async (key) => {
  const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
  await s3Client.send(command);
};

/**
 * Fetch the raw file buffer from S3.
 * Used by the /api/agent/files/:fileId/buffer endpoint.
 */
export const getFileBuffer = async (key) => {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await s3Client.send(command);

  // response.Body is a ReadableStream; convert to Buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};
```

---

## 10. JWT Authentication (Replacing Appwrite OTP)

Appwrite's email OTP was handled entirely by the Appwrite SDK. The new auth system replicates the same UX (user never sets a password — OTP only) but owns the full flow.

### 10.1 Token Architecture

Two-token system:
- **Access token** — Short-lived (15 minutes). Sent in every `Authorization: Bearer` header. Stateless — the server just verifies the signature, no DB lookup.
- **Refresh token** — Long-lived (30 days). Stored in `user.refreshTokens[]` in MongoDB. Used only to obtain a new access token. Rotated on every use (old token deleted, new one issued).

### 10.2 `src/utils/jwtUtils.js`

```javascript
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;

/**
 * Sign an access token containing the user's ID and email.
 * 15-minute TTL — do not store in localStorage (use memory or httpOnly cookie).
 */
export const signAccessToken = (user) =>
  jwt.sign(
    { sub: user._id.toString(), email: user.email, type: 'access' },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '15m', issuer: 'storeit-api' }
  );

/**
 * Sign a refresh token.
 * 30-day TTL — store in httpOnly, Secure, SameSite=Strict cookie on the browser.
 * For the AI agent, store in the agent's secret store.
 */
export const signRefreshToken = (user) =>
  jwt.sign(
    { sub: user._id.toString(), type: 'refresh' },
    REFRESH_TOKEN_SECRET,
    { expiresIn: '30d', issuer: 'storeit-api' }
  );

export const verifyAccessToken = (token) =>
  jwt.verify(token, ACCESS_TOKEN_SECRET, { issuer: 'storeit-api' });

export const verifyRefreshToken = (token) =>
  jwt.verify(token, REFRESH_TOKEN_SECRET, { issuer: 'storeit-api' });
```

### 10.3 `src/middleware/auth.js`

```javascript
import { verifyAccessToken } from '../utils/jwtUtils.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Attaches req.user if a valid Bearer token is present.
 * Rejects with 401 if missing or invalid.
 */
export const verifyJWT = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      code: 'NO_TOKEN',
      message: 'Authentication token required.',
    });
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    return res.status(401).json({ success: false, code, message: err.message });
  }

  // Fetch user — ensures account still exists and is active
  const user = await User.findById(payload.sub).select('-__v');
  if (!user || !user.isActive) {
    return res.status(401).json({
      success: false,
      code: 'USER_NOT_FOUND',
      message: 'User account not found or deactivated.',
    });
  }

  req.user = user;
  next();
});
```

### 10.4 OTP Generation (`src/utils/otpUtils.js`)

```javascript
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Generate a 6-digit OTP as a zero-padded string.
 * Uses crypto.randomInt for cryptographically secure randomness.
 */
export const generateOtp = () => {
  const otp = crypto.randomInt(100000, 999999);
  return otp.toString();
};

/**
 * Hash the OTP before storing — prevents database leaks from exposing valid OTPs.
 */
export const hashOtp = async (otp) => bcrypt.hash(otp, 10);

/**
 * Compare a plain OTP against its stored hash.
 */
export const compareOtp = async (plain, hash) => bcrypt.compare(plain, hash);
```

---

## 11. Complete Environment Variables Reference

Create `.env` in the project root. Never commit this file. The `.env.example` template lists all keys with descriptions.

```env
# ─── Server ────────────────────────────────────────────────────────────────────
NODE_ENV=development                    # development | production | test
PORT=5000                               # Express server port
FRONTEND_URL=http://localhost:3000      # Next.js app URL — used for CORS and email links

# ─── MongoDB ───────────────────────────────────────────────────────────────────
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/storeit?retryWrites=true&w=majority
# For local dev: mongodb://localhost:27017/storeit

# ─── JWT ───────────────────────────────────────────────────────────────────────
JWT_ACCESS_SECRET=generate-with-openssl-rand-base64-64     # min 64 random chars
JWT_REFRESH_SECRET=generate-with-openssl-rand-base64-64    # DIFFERENT from access secret

# ─── AWS ───────────────────────────────────────────────────────────────────────
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...              # IAM user with s3:PutObject, s3:GetObject, s3:DeleteObject
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=storeit-prod             # Bucket name (private, no public access)

# ─── Email (OTP delivery) ──────────────────────────────────────────────────────
EMAIL_HOST=smtp.gmail.com              # or smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false                     # true for port 465
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password  # Gmail: 16-char app password (not account password)
EMAIL_FROM="StoreIt <noreply@storeit.app>"

# ─── OTP Settings ──────────────────────────────────────────────────────────────
OTP_EXPIRY_MINUTES=10                  # OTP valid for 10 minutes
OTP_MAX_ATTEMPTS=5                     # Lock after 5 wrong attempts

# ─── Storage Limits ────────────────────────────────────────────────────────────
DEFAULT_STORAGE_LIMIT_GB=2             # Default user quota in gigabytes
MAX_FILE_SIZE_MB=100                   # Max single file size

# ─── Agentic Integration ───────────────────────────────────────────────────────
AGENT_SECRET=a-long-random-string      # Extra header required on /api/agent/* routes
                                        # Set the same value in the FastAPI .env

# ─── Rate Limiting ─────────────────────────────────────────────────────────────
RATE_LIMIT_WINDOW_MS=900000            # 15 minutes
RATE_LIMIT_AUTH_MAX=20                 # Max auth attempts per window per IP
RATE_LIMIT_API_MAX=200                 # Max API calls per window per IP

# ─── Logging ───────────────────────────────────────────────────────────────────
LOG_LEVEL=info                         # error | warn | info | debug
LOG_FILE_PATH=./logs                   # Directory for Winston file transport

# ─── LangSmith (optional — for AI agent tracing) ───────────────────────────────
LANGCHAIN_TRACING_V2=false
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=storeit
```

---

## 12. Dependencies — Full List with Purpose and Version

Install with:
```bash
npm install express mongoose multer @aws-sdk/client-s3 @aws-sdk/lib-storage \
  @aws-sdk/s3-request-presigner jsonwebtoken bcryptjs nodemailer \
  zod cors helmet morgan express-rate-limit express-validator \
  winston dotenv uuid

npm install -D nodemon @types/node
```

| Package | Version (min) | Purpose |
|---|---|---|
| `express` | 5.x | HTTP server and routing |
| `mongoose` | 8.x | MongoDB ODM — schemas, validation, virtuals |
| `multer` | 1.4.x | Multipart form parsing, memoryStorage |
| `@aws-sdk/client-s3` | 3.x | S3 PutObject, GetObject, DeleteObject commands |
| `@aws-sdk/lib-storage` | 3.x | Managed multipart upload for large files |
| `@aws-sdk/s3-request-presigner` | 3.x | `getSignedUrl` for pre-signed GET URLs |
| `jsonwebtoken` | 9.x | JWT sign and verify |
| `bcryptjs` | 2.x | Password and OTP hashing (pure JS, no native bindings) |
| `nodemailer` | 6.x | SMTP email for OTP delivery |
| `zod` | 3.x | Schema validation in config/env.js and request validators |
| `cors` | 2.x | CORS headers — configured per-environment |
| `helmet` | 8.x | Security headers (X-Frame-Options, CSP, HSTS, etc.) |
| `morgan` | 1.x | HTTP request access log (stdout + file) |
| `express-rate-limit` | 7.x | Per-route rate limiting |
| `express-validator` | 7.x | Request body/query validation chains |
| `winston` | 3.x | Structured application logging (JSON in prod) |
| `dotenv` | 16.x | `.env` file loader |
| `uuid` | 11.x | `v4()` for unique S3 keys |

**Dev only:**

| Package | Version | Purpose |
|---|---|---|
| `nodemon` | 3.x | Auto-restart on file changes in dev |
| `jest` | 29.x | Test runner |
| `supertest` | 7.x | HTTP integration testing against Express app |

---

## 13. Step-by-Step Implementation Guide

Follow these steps in order. Each step is a complete, verifiable milestone.

### Step 1 — Scaffold the Project

```bash
mkdir storeit-backend && cd storeit-backend
npm init -y

# Create the full directory tree
mkdir -p src/{config,models,controllers,services,middleware,routes,utils}
mkdir logs

# Install all dependencies
npm install express mongoose multer @aws-sdk/client-s3 @aws-sdk/lib-storage \
  @aws-sdk/s3-request-presigner jsonwebtoken bcryptjs nodemailer \
  zod cors helmet morgan express-rate-limit express-validator \
  winston dotenv uuid

npm install -D nodemon
```

Add to `package.json`:
```json
{
  "type": "module",
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js"
  }
}
```

### Step 2 — Environment Configuration (`src/config/env.js`)

```javascript
import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  FRONTEND_URL: z.string().url(),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  AWS_REGION: z.string(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_S3_BUCKET: z.string(),
  EMAIL_HOST: z.string(),
  EMAIL_PORT: z.string(),
  EMAIL_USER: z.string(),
  EMAIL_PASS: z.string(),
  EMAIL_FROM: z.string(),
  AGENT_SECRET: z.string().min(16),
});

// Throws at startup if any required variable is missing
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
```

### Step 3 — Database Connection (`src/config/db.js`)

```javascript
import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

// Graceful disconnect on SIGINT/SIGTERM
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed on app termination');
  process.exit(0);
});
```

### Step 4 — AWS S3 Client (`src/config/aws.js`)

```javascript
import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});
```

### Step 5 — Create All Three Models

Copy the full schemas from Section 7 into `src/models/User.js`, `src/models/File.js`, `src/models/Vector.js`.

### Step 6 — Build the Auth Flow

Implement in this order:
1. `src/utils/otpUtils.js` — OTP generation and hashing
2. `src/utils/jwtUtils.js` — token signing/verification
3. `src/services/emailService.js` — Nodemailer OTP email
4. `src/controllers/authController.js` — register, verifyOtp, login, refresh, logout
5. `src/routes/auth.js` — wire routes to controller
6. `src/middleware/auth.js` — JWT verification middleware

### Step 7 — Build the File Upload Flow

1. Copy `src/config/multer.js` from Section 9.2
2. Copy `src/services/s3Service.js` from Section 9.4
3. Implement `src/services/storageService.js`
4. Implement `src/controllers/fileController.js` — full CRUD
5. Implement `src/controllers/agentController.js` — agent-facing operations
6. Wire `src/routes/files.js` and `src/routes/agent.js`

### Step 8 — Wire the Express App (`src/app.js`)

```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import indexRouter from './routes/index.js';

const app = express();

// Security headers
app.use(helmet());

// CORS — only allow configured frontend + agent origins
app.use(cors({
  origin: [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:8000'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-agent-secret'],
}));

// Body parsers
app.use(express.json({ limit: '10kb' }));           // JSON body (not for file uploads)
app.use(express.urlencoded({ extended: true }));

// HTTP access logging
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Routes
app.use('/api', indexRouter);

// Health check — for load balancers / CI
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler — must be last middleware
app.use(errorHandler);

export default app;
```

### Step 9 — Entry Point (`server.js`)

```javascript
import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { env } from './src/config/env.js';
import { logger } from './src/utils/logger.js';

const start = async () => {
  await connectDB();

  const server = app.listen(env.PORT, () => {
    logger.info(`StoreIt API running on port ${env.PORT} (${env.NODE_ENV})`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down gracefully.`);
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000); // Force exit after 10s
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
};

start();
```

---

## 14. MVC Layer Breakdown with Annotated Code

### The Controller Rule

Controllers do exactly four things and nothing else:
1. Extract data from the request (`req.body`, `req.params`, `req.query`, `req.user`, `req.file`).
2. Call a service or model method.
3. Handle the result and call `res.json(...)`.
4. Pass errors to `next(err)`.

Controllers never call `mongoose.Model.find(...)` directly. All DB access goes through the model via a service or directly via the Mongoose model imported into the controller. The controller is thin — it is a translator between HTTP and business logic.

### Example — `src/controllers/fileController.js` (upload action)

```javascript
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadToS3, generatePresignedGetUrl } from '../services/s3Service.js';
import { enforceStorageLimit, updateStorageUsed } from '../services/storageService.js';
import { buildS3Key, getFileType, getExtension } from '../utils/fileUtils.js';
import File from '../models/File.js';

export const uploadFile = asyncHandler(async (req, res) => {
  // 1. Extract from request
  const { user, file } = req;
  const displayName = req.body.name || file.originalname;

  // 2. Business logic: enforce quota
  await enforceStorageLimit(user, file.size);

  // 3. Build S3 key and upload
  const extension = getExtension(file.originalname);
  const s3Key = buildS3Key(user._id, extension);
  await uploadToS3({ key: s3Key, buffer: file.buffer, contentType: file.mimetype });

  // 4. Persist metadata to MongoDB
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

  // 5. Update user's storage counter
  await updateStorageUsed(user._id, file.size);

  // 6. Generate pre-signed URL for immediate use
  const url = await generatePresignedGetUrl(s3Key);

  // 7. Respond
  const response = fileDoc.toJSON();
  response.url = url;

  res.status(201).json({ success: true, data: response });
});
```

---

## 15. Middleware Chain Explained

For the `POST /api/files/upload` route, the full middleware chain is:

```
Request arrives
   │
   ├─ 1. helmet()                — sets security headers before anything else
   ├─ 2. cors()                  — validates Origin header; responds to OPTIONS preflight
   ├─ 3. morgan()                — logs: "POST /api/files/upload 201 243ms"
   │
   ├─ 4. rateLimiter (API)       — checks IP against sliding window counter in memory
   │
   ├─ 5. verifyJWT               — reads Authorization header, verifies JWT,
   │                               fetches user from MongoDB, attaches req.user
   │
   ├─ 6. upload.single('file')   — Multer: parses multipart, runs fileFilter,
   │                               checks size limit, populates req.file
   │
   ├─ 7. fileController.uploadFile
   │       └─ enforceStorageLimit  — storageService: checks quota
   │       └─ uploadToS3           — s3Service: PutObjectCommand to S3
   │       └─ File.create(...)     — mongoose: insert File document
   │       └─ updateStorageUsed    — storageService: $inc user.storageUsed
   │       └─ generatePresignedGetUrl — s3Service: sign URL
   │       └─ res.json(201, ...)
   │
   └─ 8. errorHandler            — catches any thrown error from the above chain;
                                    maps to structured JSON response with code
```

The chain is linear and each layer has a single responsibility. If Multer throws a size error, it goes straight to `errorHandler` — the controller never runs.

---

## 16. S3 Bucket Policies and IAM Setup

### 16.1 Create the S3 Bucket

```
Bucket name:       storeit-prod          (or any name — match AWS_S3_BUCKET env var)
Region:            us-east-1
Block all public access: ON              (critical — files are served via pre-signed URLs only)
Bucket versioning: optional             (enable for file recovery)
Server-side encryption: AES-256         (enabled by default on new buckets)
```

### 16.2 Bucket Lifecycle Rules (Recommended)

In AWS Console → S3 → storeit-prod → Management → Lifecycle rules:

```
Rule 1: Delete incomplete multipart uploads
  Scope: All objects
  Action: Delete incomplete multipart uploads after 1 day

Rule 2: Expire soft-deleted files
  Scope: Prefix "uploads/"
  Action: This requires tagging on delete — add a tag {deleted: true}
          via the S3 CopyObject command when soft-deleting.
          Then expire objects with that tag after 30 days.
```

### 16.3 IAM User Policy

Create a dedicated IAM user `storeit-backend-prod` with no console access. Attach this inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "StoreItS3Access",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::storeit-prod",
        "arn:aws:s3:::storeit-prod/*"
      ]
    }
  ]
}
```

**Do not give `s3:*` or `s3:PutBucketPolicy`. The principle of least privilege means the backend can only touch objects in its own bucket.**

---

## 17. Agentic Integration Contract

The FastAPI AI agent (`ai-agent/`) currently calls Appwrite directly. After this migration it calls the Express `/api/agent/*` routes instead. Here is the complete change required in the FastAPI codebase.

### 17.1 What the Agent Needs

| Operation | Old (Appwrite Python SDK) | New (Express REST) |
|---|---|---|
| List user's files | `databases.list_documents(db, files_collection)` | `GET /api/agent/files?isIndexed=false` |
| Fetch file bytes | `storage.get_file_download(bucket_id, file_id)` | `GET /api/agent/files/:fileId/buffer` |
| Store embeddings | `databases.create_document(db, vectors_collection, ...)` | `POST /api/agent/vectors` |
| Search vectors | In-memory cosine similarity | `POST /api/agent/vectors/query` |
| Delete vectors | `databases.delete_document(...)` | `DELETE /api/agent/vectors/:fileId` |

### 17.2 Auth Flow for the Agent

The FastAPI agent must obtain a JWT from the Express API using the file owner's credentials before it can call any agent route.

**Design:** The user's JWT (issued at browser login) is passed to the FastAPI agent as a parameter when the user triggers a re-index. The FastAPI agent uses that token for the duration of the operation. The token is never stored persistently in the agent — it is passed per-request.

Additionally, all `/api/agent/*` requests must include:
```
x-agent-secret: <AGENT_SECRET from env>
```

This ensures that even if someone steals a user JWT, they cannot call agent endpoints directly without also knowing the agent secret.

### 17.3 New FastAPI Agent HTTP Client (Python)

Replace all Appwrite SDK calls in `ai-agent/agent.py` with:

```python
import httpx
import os

EXPRESS_API_URL = os.getenv("EXPRESS_API_URL", "http://localhost:5000")
AGENT_SECRET    = os.getenv("AGENT_SECRET")

def get_headers(user_jwt: str) -> dict:
    return {
        "Authorization": f"Bearer {user_jwt}",
        "x-agent-secret": AGENT_SECRET,
        "Content-Type": "application/json",
    }

async def list_unindexed_files(user_jwt: str) -> list:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{EXPRESS_API_URL}/api/agent/files",
            params={"isIndexed": "false"},
            headers=get_headers(user_jwt),
            timeout=30,
        )
        r.raise_for_status()
        return r.json()["data"]

async def get_file_bytes(user_jwt: str, file_id: str) -> bytes:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{EXPRESS_API_URL}/api/agent/files/{file_id}/buffer",
            headers=get_headers(user_jwt),
            timeout=120,
        )
        r.raise_for_status()
        return r.content

async def store_vectors(user_jwt: str, file_id: str, chunks: list) -> None:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{EXPRESS_API_URL}/api/agent/vectors",
            json={"fileId": file_id, "chunks": chunks},
            headers=get_headers(user_jwt),
            timeout=60,
        )
        r.raise_for_status()

async def query_vectors(user_jwt: str, query_embedding: list, top_k: int = 5) -> list:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{EXPRESS_API_URL}/api/agent/vectors/query",
            json={"queryEmbedding": query_embedding, "topK": top_k},
            headers=get_headers(user_jwt),
            timeout=30,
        )
        r.raise_for_status()
        return r.json()["data"]
```

### 17.4 FastAPI Environment Changes

Remove from `ai-agent/.env`:
```
# DELETE THESE:
APPWRITE_ENDPOINT=
APPWRITE_PROJECT=
APPWRITE_API_KEY=
APPWRITE_DATABASE=
APPWRITE_FILES_COLLECTION=
APPWRITE_VECTORS_COLLECTION=
APPWRITE_BUCKET=
```

Add to `ai-agent/.env`:
```
EXPRESS_API_URL=http://localhost:5000    # or your deployed backend URL
AGENT_SECRET=same-value-as-backend-env  # Must match backend AGENT_SECRET
GOOGLE_API_KEY=...                       # Unchanged
```

---

## 18. Error Handling Strategy

### 18.1 Global Error Handler (`src/middleware/errorHandler.js`)

All controllers use `asyncHandler` which catches unhandled promise rejections and passes them to `next(err)`. The global error handler normalises all error types to a single JSON shape:

```javascript
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred.';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = Object.values(err.errors).map(e => e.message).join(', ');
  }

  // Mongoose duplicate key error (e.g. duplicate email)
  if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists.`;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid value for field: ${err.path}`;
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    code = 'FILE_TOO_LARGE';
    message = `File exceeds the ${process.env.MAX_FILE_SIZE_MB || 100} MB limit.`;
  }

  if (err.code === 'UNSUPPORTED_FILE_TYPE') {
    statusCode = 415;
    code = 'UNSUPPORTED_FILE_TYPE';
  }

  // AWS S3 errors
  if (err.name === 'S3ServiceException') {
    statusCode = 502;
    code = 'S3_ERROR';
    message = `Storage service error: ${err.message}`;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    code,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
```

### 18.2 `asyncHandler` Utility

```javascript
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
```

Wrapping every async controller with this means you never write `try/catch` in controllers. All errors flow to the global handler.

---

## 19. Security Hardening Checklist

These items must all be in place before deploying to production.

- [ ] `helmet()` is the first middleware in `app.js` — sets 10+ security headers
- [ ] JWT secrets are at least 64 random base64 characters (not short phrases)
- [ ] Access token TTL is 15 minutes or less
- [ ] Refresh tokens are rotated on every use
- [ ] S3 bucket has "Block All Public Access" enabled
- [ ] S3 objects served only via pre-signed URLs (no bucket policy granting `s3:GetObject` to `*`)
- [ ] IAM user has only `PutObject`, `GetObject`, `DeleteObject`, `ListBucket` permissions
- [ ] OTPs are hashed with bcrypt before storage (never stored in plain text)
- [ ] OTPs expire after 10 minutes
- [ ] OTP attempts are rate-limited to 5 per userId before lockout
- [ ] File upload MIME type is validated both by Multer `fileFilter` AND by checking `file.buffer` magic bytes in the controller (defence in depth — clients can spoof MIME headers)
- [ ] `s3Key` and `s3Bucket` are never exposed in any API response (stripped in `toJSON`)
- [ ] `passwordHash`, `otpHash`, `refreshTokens` are never exposed in any API response (stripped in `toJSON`)
- [ ] `express-rate-limit` is applied to all routes with stricter limits on auth routes
- [ ] `AGENT_SECRET` is required on all `/api/agent/*` routes as a second factor
- [ ] CORS `origin` is an explicit whitelist, not `*`
- [ ] `express.json({ limit: '10kb' })` prevents JSON payload overflow
- [ ] MongoDB connection string uses `w=majority` for write concern durability
- [ ] Logs never contain OTPs, passwords, JWTs, or S3 keys

---

## 20. Migration Sequence: Data and Feature Parity Map

This table maps every Appwrite feature used in the original StoreIt to its replacement.

| Original (Appwrite) | Replacement | File/Location |
|---|---|---|
| `account.createEmailPasswordSession()` | `POST /api/auth/login` → OTP flow | `authController.js` |
| `account.createEmailToken()` | OTP generation + `emailService.sendOtpEmail()` | `otpUtils.js`, `emailService.js` |
| `account.verifyEmailToken()` | `POST /api/auth/verify-otp` | `authController.js` |
| `account.deleteSession()` | `POST /api/auth/logout` | `authController.js` |
| `account.get()` | `GET /api/users/me` | `userController.js` |
| `databases.createDocument(users)` | `User.create(...)` | `authController.js` |
| `databases.getDocument(users, id)` | `User.findById(id)` | `userController.js` |
| `databases.createDocument(files)` | `File.create(...)` | `fileController.js` |
| `databases.listDocuments(files, queries)` | `File.find({ owner, type, isDeleted })` | `fileController.js` |
| `databases.getDocument(files, id)` | `File.findOne({ _id, owner })` | `fileController.js` |
| `databases.updateDocument(files, id)` | `File.findByIdAndUpdate(id, ...)` | `fileController.js` |
| `databases.deleteDocument(files, id)` | Soft-delete: `File.findByIdAndUpdate(id, {isDeleted:true})` | `fileController.js` |
| `storage.createFile(bucket, fileId, blob)` | `multer` + `s3Service.uploadToS3()` | `fileController.js` |
| `storage.getFile(bucket, fileId)` | `File.findById()` + `s3Service.generatePresignedGetUrl()` | `fileController.js` |
| `storage.getFileDownload(bucket, fileId)` | `s3Service.generateDownloadUrl()` | `fileController.js` |
| `storage.deleteFile(bucket, fileId)` | `s3Service.deleteFromS3()` | `fileController.js` |
| `databases.createDocument(vectors, data)` | `Vector.insertMany(chunks)` | `agentController.js` |
| `databases.listDocuments(vectors, queries)` | `Vector.find({ owner, fileId })` | `agentController.js` |
| `databases.deleteDocument(vectors, id)` | `Vector.deleteMany({ fileId })` | `agentController.js` |

---

## 21. Local Development Runbook

### Prerequisites

- Node.js 20 LTS
- MongoDB: either [MongoDB Atlas free tier](https://www.mongodb.com/atlas) or Docker local instance
- AWS account with S3 bucket configured (Section 16)
- Gmail account with App Password enabled (for OTP email)

### First-Time Setup

```bash
# 1. Clone and navigate to backend
git clone https://github.com/ParthGoswami13/StoreIt.git
cd StoreIt
mkdir backend && cd backend

# 2. Copy the project files (or init fresh as per Step 1)
npm install

# 3. Create .env from template
cp .env.example .env
# Edit .env — fill in MONGODB_URI, JWT secrets, AWS keys, EMAIL credentials

# 4. Start the server
npm run dev

# 5. Verify health endpoint
curl http://localhost:5000/health
# Expected: {"status":"ok","timestamp":"..."}

# 6. Test auth flow
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test User","email":"test@example.com"}'
# Expected: 201 with userId

# 7. Check email for OTP, then verify
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"userId":"<from above>","otp":"<from email>"}'
# Expected: 200 with accessToken + refreshToken

# 8. Test file upload
curl -X POST http://localhost:5000/api/files/upload \
  -H "Authorization: Bearer <accessToken>" \
  -F "file=@/path/to/test.pdf" \
  -F "name=Test PDF"
# Expected: 201 with File object including url
```

### MongoDB Local Setup with Docker

```bash
docker run -d \
  --name storeit-mongo \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:7

# Update .env:
# MONGODB_URI=mongodb://admin:password@localhost:27017/storeit?authSource=admin
```

---

## 22. What Changes in the Frontend (Next.js)

> This section is a brief reference only. Frontend migration is documented separately.

Every Appwrite SDK call in `lib/actions/` must be replaced with a `fetch` call to the Express API. The pattern is identical:

**Before (Appwrite Server Action):**
```typescript
// lib/actions/file.actions.ts
import { databases } from '../appwrite';
const files = await databases.listDocuments(DB_ID, FILES_COLLECTION_ID, queries);
```

**After (Express REST):**
```typescript
// lib/api/files.ts
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/files`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const { data } = await response.json();
```

**Auth changes:**
- Remove all `node-appwrite` and `appwrite` imports from `lib/appwrite.ts`.
- Replace `account.createEmailToken()` with `POST /api/auth/login`.
- Replace `account.verifyEmailToken()` with `POST /api/auth/verify-otp`.
- Store the JWT `accessToken` in React state (or a non-persistent cookie).
- Store the `refreshToken` in an `httpOnly` cookie.
- Add an `axios` or `fetch` interceptor that calls `POST /api/auth/refresh` when a 401 `TOKEN_EXPIRED` is received.

**New env vars for Next.js:**
```env
NEXT_PUBLIC_API_URL=http://localhost:5000   # Express backend URL
```

Remove all `NEXT_PUBLIC_APPWRITE_*` and `NEXT_APPWRITE_KEY` variables.

---

*End of Backend Migration Guide.*

*Agentic layer migration (LangChain refactor, FastAPI agent updates, vector search strategy) will be documented in a separate AGENT_MIGRATION.md.*
