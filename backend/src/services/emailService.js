import { transporter } from '../config/email.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Send an OTP verification email.
 */
export const sendOtpEmail = async (email, otp, fullName = '') => {
  const mailOptions = {
    from: env.EMAIL_FROM,
    to: email,
    subject: 'StoreIt — Your Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #FA7275; margin-bottom: 8px;">StoreIt</h2>
        <p>Hi ${fullName || 'there'},</p>
        <p>Your verification code is:</p>
        <div style="background: #f4f4f5; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #18181b;">${otp}</span>
        </div>
        <p style="color: #71717a; font-size: 14px;">
          This code expires in ${env.OTP_EXPIRY_MINUTES} minutes. If you didn't request this, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
        <p style="color: #a1a1aa; font-size: 12px;">© ${new Date().getFullYear()} StoreIt. All rights reserved.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`OTP email sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send OTP email to ${email}: ${error.message}`);
    // Fallback for local development if email fails
    logger.info(`[FALLBACK] OTP for ${email} is: ${otp}`);
    // Do not throw so the user can still login locally
  }
};

/**
 * Send a password reset email.
 */
export const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: env.EMAIL_FROM,
    to: email,
    subject: 'StoreIt — Password Reset',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #FA7275; margin-bottom: 8px;">StoreIt</h2>
        <p>You requested a password reset. Click the button below:</p>
        <a href="${resetUrl}" style="display: inline-block; background: #FA7275; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 24px 0;">
          Reset Password
        </a>
        <p style="color: #71717a; font-size: 14px;">This link expires in 1 hour.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Send a share notification email.
 */
export const sendShareNotificationEmail = async (toEmail, fromName, fileName) => {
  const mailOptions = {
    from: env.EMAIL_FROM,
    to: toEmail,
    subject: `StoreIt — ${fromName} shared a file with you`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #FA7275; margin-bottom: 8px;">StoreIt</h2>
        <p><strong>${fromName}</strong> shared a file with you:</p>
        <div style="background: #f4f4f5; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="font-weight: bold; margin: 0;">📄 ${fileName}</p>
        </div>
        <a href="${env.FRONTEND_URL}" style="display: inline-block; background: #FA7275; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Open StoreIt
        </a>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    // Share notification failure is non-critical — log but don't throw
    logger.warn(`Failed to send share notification to ${toEmail}: ${error.message}`);
  }
};
