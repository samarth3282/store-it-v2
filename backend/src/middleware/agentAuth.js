import { env } from '../config/env.js';

/**
 * Agent authentication middleware.
 * Verifies the x-agent-secret header on /api/agent/* routes.
 * This is a second factor on top of JWT — ensures only the FastAPI agent can hit these endpoints.
 */
export const verifyAgentSecret = (req, res, next) => {
  const agentSecret = req.headers['x-agent-secret'];

  if (!agentSecret || agentSecret !== env.AGENT_SECRET) {
    return res.status(403).json({
      success: false,
      code: 'AGENT_AUTH_FAILED',
      message: 'Invalid or missing agent secret.',
    });
  }

  next();
};
