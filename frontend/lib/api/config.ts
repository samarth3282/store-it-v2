const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Token management — in-memory for security.
 * Access tokens should never be in localStorage.
 */
let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export const setTokens = (access: string, _refresh?: string) => {
  accessToken = access;
  // Also store in sessionStorage for page reloads (access token only)
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('accessToken', access);
  }
};

export const getAccessToken = (): string | null => {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = sessionStorage.getItem('accessToken');
  }
  return accessToken;
};

export const clearTokens = () => {
  accessToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('accessToken');
  }
};

/**
 * Refresh the access token using the httpOnly refresh cookie.
 */
const refreshAccessToken = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!response.ok) {
      clearTokens();
      return false;
    }

    const data = await response.json();
    setTokens(data.data.accessToken);
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

  const fetchOptions = { ...options, headers, credentials: 'include' as RequestCredentials };
  let response = await fetch(url, fetchOptions);

  // If 401 TOKEN_EXPIRED, try to refresh
  if (response.status === 401) {
    const body = await response.clone().json().catch(() => null);
    if (body?.code === 'TOKEN_EXPIRED') {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      
      const refreshed = await refreshPromise;
      if (refreshed) {
        // Retry the original request with the new token
        headers['Authorization'] = `Bearer ${getAccessToken()}`;
        response = await fetch(url, { ...options, headers, credentials: 'include' as RequestCredentials });
      }
    }
  }

  return response;
};

export { API_BASE_URL };
