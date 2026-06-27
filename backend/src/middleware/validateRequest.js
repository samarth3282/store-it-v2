import { z } from 'zod';

/**
 * Generic request validation middleware factory.
 * Validates req.body, req.query, or req.params against a Zod schema.
 *
 * Usage:
 *   router.post('/register', validateRequest({ body: registerSchema }), controller.register);
 */
export const validateRequest = ({ body, query, params }) => {
  return (req, res, next) => {
    try {
      if (body) {
        req.body = body.parse(req.body);
      }
      if (query) {
        req.query = query.parse(req.query);
      }
      if (params) {
        req.params = params.parse(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(422).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};
