import { apiFetch, setTokens, clearTokens, API_BASE_URL } from './config';

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    userId?: string;
    email?: string;
    accessToken?: string;
    refreshToken?: string;
    user?: any;
  };
  code?: string;
}

/**
 * Register a new account — sends OTP to email.
 */
export const register = async (fullName: string, email: string): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, email }),
  });
  return response.json();
};

/**
 * Login — sends OTP to existing user's email.
 */
export const login = async (email: string): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return response.json();
};

/**
 * Verify OTP — returns tokens on success.
 */
export const verifyOtp = async (userId: string, otp: string): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, otp }),
  });

  const data = await response.json();

  // Store tokens if verification succeeded
  if (data.success && data.data?.accessToken) {
    setTokens(data.data.accessToken, data.data.refreshToken);
  }

  return data;
};

/**
 * Resend OTP.
 */
export const resendOtp = async (userId: string): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return response.json();
};

/**
 * Logout — invalidates refresh token.
 */
export const logout = async (): Promise<void> => {
  try {
    await apiFetch('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: sessionStorage.getItem('refreshToken') }),
    });
  } catch {
    // Ignore errors — clear tokens regardless
  }
  clearTokens();
};
