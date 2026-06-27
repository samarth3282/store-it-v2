import { logger } from '../utils/logger.js';

/**
 * Global error handler — normalises all errors to a structured JSON response.
 * Must be registered last in the Express middleware chain.
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred.';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = Object.values(err.errors).map((e) => e.message).join(', ');
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
    // code is already set by the multer fileFilter
  }

  // AWS S3 errors
  if (err.name === 'S3ServiceException' || err.$metadata) {
    statusCode = 502;
    code = 'S3_ERROR';
    message = `Storage service error: ${err.message}`;
  }

  // Log the error
  if (statusCode >= 500) {
    logger.error(`${code}: ${message}`, { stack: err.stack, path: req.path });
  } else {
    logger.warn(`${code}: ${message}`, { path: req.path });
  }

  res.status(statusCode).json({
    success: false,
    code,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
