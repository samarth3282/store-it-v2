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
      select: false, // Never returned in queries unless explicitly .select('+passwordHash')
    },
    avatar: {
      type: String, // S3 key of avatar image or external URL
      default: 'https://img.freepik.com/free-psd/3d-illustration-person-with-sunglasses_23-2149436188.jpg',
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
      default: false, // Set to true after OTP verification
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Storage quota
    storageUsed: {
      type: Number, // Bytes
      default: 0,
    },
    storageLimit: {
      type: Number, // Bytes — default 2 GB
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
    timestamps: true, // Adds createdAt, updatedAt automatically
  }
);

// Index for fast email lookups (already unique, handled by `unique: true` above)

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
  if (!this.isModified('passwordHash') || !this.passwordHash) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// toJSON transform — strip sensitive fields from API responses
userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
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
