/**
 * Wraps async controller functions — catches unhandled promise rejections
 * and passes them to Express's next() error handler.
 * This eliminates the need for try/catch in every controller.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
