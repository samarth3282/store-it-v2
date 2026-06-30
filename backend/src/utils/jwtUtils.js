import jwt from 'jsonwebtoken';

/**
 * Sign an access token containing the user's ID and email.
 * 15-minute TTL — do not store in localStorage (use memory or httpOnly cookie).
 */
export const signAccessToken = (user) =>
  jwt.sign(
    { sub: user._id.toString(), email: user.email, type: 'access' },
    process.env.JWT_ACCESS_SECRET,
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
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '30d', issuer: 'storeit-api' }
  );

export const verifyAccessToken = (token) =>
  jwt.verify(token, process.env.JWT_ACCESS_SECRET, { issuer: 'storeit-api' });

export const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET, { issuer: 'storeit-api' });
