import { apiFetch } from './config';

/**
 * Search files by query string.
 */
export const searchFiles = async (params: {
  q: string;
  type?: string;
  limit?: number;
}): Promise<any> => {
  const searchParams = new URLSearchParams({ q: params.q });
  if (params.type) searchParams.set('type', params.type);
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const response = await apiFetch(`/api/search?${searchParams.toString()}`);
  return response.json();
};
