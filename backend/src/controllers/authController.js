import { asyncHandler } from '../utils/asyncHandler.js';
import { generateOtp, hashOtp, compareOtp } from '../utils/otpUtils.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwtUtils.js';
import { sendOtpEmail } from '../services/emailService.js';
import User from '../models/User.model.js';

/**
 * POST /api/auth/register
 * Create a new account + send OTP email.
 */
export const register = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({
      success: false,
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'An account with this email already exists.',
    });
  }

  // Generate OTP
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const otpExpiry = new Date(Date.now() + parseInt(process.env.OTP_EXPIRY_MINUTES || '10') * 60 * 1000);

  // Create user
  const user = await User.create({
    fullName,
    email,
    otpHash,
    otpExpiry,
    otpAttempts: 0,
  });

  // Send OTP email
  await sendOtpEmail(email, otp, fullName);

  res.status(201).json({
    success: true,
    message: 'Account created. Check your email for the OTP.',
    data: {
      userId: user._id,
      email: user.email,
    },
  });
});

/**
 * POST /api/auth/verify-otp
 * Verify OTP → issue access + refresh tokens.
 */
export const verifyOtp = asyncHandler(async (req, res) => {
  const { userId, otp } = req.body;

  const user = await User.findById(userId).select('+otpHash +otpExpiry +otpAttempts +refreshTokens');
  if (!user) {
    return res.status(404).json({
      success: false,
      code: 'USER_NOT_FOUND',
      message: 'User not found.',
    });
  }

  // Check OTP attempts
  const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS || '5');
  if (user.otpAttempts >= maxAttempts) {
    return res.status(429).json({
      success: false,
      code: 'OTP_MAX_ATTEMPTS',
      message: 'Too many failed attempts. Please request a new OTP.',
    });
  }

  // Check OTP expiry
  if (!user.otpExpiry || user.otpExpiry < new Date()) {
    return res.status(400).json({
      success: false,
      code: 'OTP_EXPIRED',
      message: 'The OTP has expired. Request a new one.',
    });
  }

  // Compare OTP
  const isValid = await compareOtp(otp, user.otpHash);
  if (!isValid) {
    user.otpAttempts += 1;
    await user.save();
    return res.status(400).json({
      success: false,
      code: 'OTP_INVALID_OR_EXPIRED',
      message: 'The OTP is invalid or has expired. Request a new one.',
    });
  }

  // OTP is valid — clear OTP fields, mark as verified
  user.otpHash = undefined;
  user.otpExpiry = undefined;
  user.otpAttempts = 0;
  user.isVerified = true;

  // Issue tokens
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  // Store refresh token
  user.refreshTokens.push(refreshToken);
  // Keep only the last 5 refresh tokens (multi-device support, but bounded)
  if (user.refreshTokens.length > 5) {
    user.refreshTokens = user.refreshTokens.slice(-5);
  }
  await user.save();

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: user.toJSON(),
    },
  });
});

/**
 * POST /api/auth/resend-otp
 * Resend OTP to a user's email.
 */
export const resendOtp = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  const user = await User.findById(userId).select('+otpHash +otpExpiry +otpAttempts');
  if (!user) {
    return res.status(404).json({
      success: false,
      code: 'USER_NOT_FOUND',
      message: 'User not found.',
    });
  }

  // Generate new OTP
  const otp = generateOtp();
  user.otpHash = await hashOtp(otp);
  user.otpExpiry = new Date(Date.now() + parseInt(process.env.OTP_EXPIRY_MINUTES || '10') * 60 * 1000);
  user.otpAttempts = 0;
  await user.save();

  // Send OTP email
  await sendOtpEmail(user.email, otp, user.fullName);

  res.json({
    success: true,
    message: 'A new OTP has been sent to your email.',
  });
});

/**
 * POST /api/auth/login
 * Email-based login — sends OTP to existing user.
 */
export const login = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email }).select('+otpHash +otpExpiry +otpAttempts');
  if (!user) {
    return res.status(404).json({
      success: false,
      code: 'USER_NOT_FOUND',
      message: 'No account found with this email.',
    });
  }

  // Generate OTP
  const otp = generateOtp();
  user.otpHash = await hashOtp(otp);
  user.otpExpiry = new Date(Date.now() + parseInt(process.env.OTP_EXPIRY_MINUTES || '10') * 60 * 1000);
  user.otpAttempts = 0;
  await user.save();
  
  // Send OTP email
  await sendOtpEmail(email, otp, user.fullName);

  res.json({
    success: true,
    message: 'OTP sent to your email.',
    data: { userId: user._id },
  });
});

/**
 * POST /api/auth/refresh
 * Exchange a valid refresh token for a new access + refresh token pair.
 * Old refresh token is invalidated (rotation).
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: oldToken } = req.body;

  if (!oldToken) {
    return res.status(400).json({
      success: false,
      code: 'NO_REFRESH_TOKEN',
      message: 'Refresh token is required.',
    });
  }

  // Verify the refresh token signature
  let payload;
  try {
    payload = verifyRefreshToken(oldToken);
  } catch (err) {
    return res.status(401).json({
      success: false,
      code: 'REFRESH_TOKEN_INVALID',
      message: 'Invalid or expired refresh token.',
    });
  }

  // Find user and check if the token exists in their refreshTokens array
  const user = await User.findById(payload.sub).select('+refreshTokens');
  if (!user) {
    return res.status(401).json({
      success: false,
      code: 'USER_NOT_FOUND',
      message: 'User not found.',
    });
  }

  const tokenIndex = user.refreshTokens.indexOf(oldToken);
  if (tokenIndex === -1) {
    // Token not found — possible token reuse attack. Clear all tokens.
    user.refreshTokens = [];
    await user.save();
    return res.status(401).json({
      success: false,
      code: 'REFRESH_TOKEN_REUSE',
      message: 'Refresh token has already been used. All sessions invalidated.',
    });
  }

  // Rotate: remove old token, issue new pair
  user.refreshTokens.splice(tokenIndex, 1);

  const newAccessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user);
  user.refreshTokens.push(newRefreshToken);
  await user.save();

  res.json({
    success: true,
    data: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    },
  });
});

/**
 * POST /api/auth/logout (Protected)
 * Invalidates the provided refresh token on the server.
 */
export const logout = asyncHandler(async (req, res) => {
  const { refreshToken: tokenToRemove } = req.body;

  if (tokenToRemove) {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { refreshTokens: tokenToRemove },
    });
  }

  res.json({
    success: true,
    message: 'Logged out successfully.',
  });
});
