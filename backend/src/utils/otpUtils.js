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
