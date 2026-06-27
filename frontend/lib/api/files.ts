import { apiFetch } from './config';

/**
 * Upload a file to the backend.
 */
export const uploadFile = async (file: File, name?: string): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);

  const response = await apiFetch('/api/files/upload', {
    method: 'POST',
    body: formData,
  });
  return response.json();
};

/**
 * Get files for the current user.
 */
export const getFiles = async (params: {
  type?: string;
  types?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  searchText?: string;
  deleted?: boolean;
} = {}): Promise<any> => {
  const searchParams = new URLSearchParams();

  // Handle types array — use the first type if provided
  if (params.types && params.types.length > 0) {
    searchParams.set('type', params.types[0]);
  } else if (params.type) {
    searchParams.set('type', params.type);
  }

  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.searchText) searchParams.set('searchText', params.searchText);
  if (params.deleted) searchParams.set('deleted', 'true');

  // Handle sort — convert from "createdAt-desc" format
  if (params.sortBy) {
    const sortBy = params.sortBy.replace('$', '');
    searchParams.set('sortBy', sortBy);
  }
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const response = await apiFetch(`/api/files?${searchParams.toString()}`);
  return response.json();
};

/**
 * Get a single file by ID.
 */
export const getFileById = async (fileId: string): Promise<any> => {
  const response = await apiFetch(`/api/files/${fileId}`);
  return response.json();
};

/**
 * Rename a file.
 */
export const renameFile = async (fileId: string, name: string): Promise<any> => {
  const response = await apiFetch(`/api/files/${fileId}/rename`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  return response.json();
};

/**
 * Soft-delete a file.
 */
export const deleteFile = async (fileId: string): Promise<any> => {
  const response = await apiFetch(`/api/files/${fileId}`, {
    method: 'DELETE',
  });
  return response.json();
};

/**
 * Share a file with users by email.
 */
export const shareFile = async (fileId: string, emails: string[]): Promise<any> => {
  const response = await apiFetch(`/api/files/${fileId}/share`, {
    method: 'POST',
    body: JSON.stringify({ emails }),
  });
  return response.json();
};

/**
 * Get download URL for a file.
 */
export const downloadFile = async (fileId: string): Promise<any> => {
  const response = await apiFetch(`/api/files/${fileId}/download`);
  return response.json();
};

/**
 * Get storage stats.
 */
export const getStorageStats = async (): Promise<any> => {
  const response = await apiFetch('/api/files/stats');
  return response.json();
};
