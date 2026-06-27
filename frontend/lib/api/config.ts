const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Token management — in-memory for security.
 * Access tokens should never be in localStorage.
 */
let accessToken: string | null = null;
let refreshTokenValue: string | null = null;

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshTokenValue = refresh;
  // Also store in sessionStorage for page reloads (access token only)
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('accessToken', access);
    sessionStorage.setItem('refreshToken', refresh);
  }
};

export const getAccessToken = (): string | null => {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = sessionStorage.getItem('accessToken');
  }
  return accessToken;
};

export const getRefreshToken = (): string | null => {
  if (refreshTokenValue) return refreshTokenValue;
  if (typeof window !== 'undefined') {
    refreshTokenValue = sessionStorage.getItem('refreshToken');
  }
  return refreshTokenValue;
};

export const clearTokens = () => {
  accessToken = null;
  refreshTokenValue = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
  }
};

/**
 * Refresh the access token using the refresh token.
 */
const refreshAccessToken = async (): Promise<boolean> => {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!response.ok) {
      clearTokens();
      return false;
    }

    const data = await response.json();
    setTokens(data.data.accessToken, data.data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
};

/**
 * Authenticated fetch wrapper with automatic token refresh on 401.
 */
export const apiFetch = async (
  path: string,
  options: RequestInit = {}
): Promise<Response> => {
  const url = `${API_BASE_URL}${path}`;
  const token = getAccessToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser sets multipart boundary)
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let response = await fetch(url, { ...options, headers });

  // If 401 TOKEN_EXPIRED, try to refresh
  if (response.status === 401) {
    const body = await response.clone().json().catch(() => null);
    if (body?.code === 'TOKEN_EXPIRED') {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Retry the original request with the new token
        headers['Authorization'] = `Bearer ${getAccessToken()}`;
        response = await fetch(url, { ...options, headers });
      }
    }
  }

  return response;
};

export { API_BASE_URL };
