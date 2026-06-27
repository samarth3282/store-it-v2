import { apiFetch } from './config';

/**
 * Get the current user's profile.
 */
export const getProfile = async (): Promise<any> => {
  const response = await apiFetch('/api/users/me');
  return response.json();
};

/**
 * Update the current user's profile.
 */
export const updateProfile = async (data: { fullName?: string; avatar?: File }): Promise<any> => {
  if (data.avatar) {
    const formData = new FormData();
    if (data.fullName) formData.append('fullName', data.fullName);
    formData.append('avatar', data.avatar);

    const response = await apiFetch('/api/users/me', {
      method: 'PATCH',
      body: formData,
    });
    return response.json();
  }

  const response = await apiFetch('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify({ fullName: data.fullName }),
  });
  return response.json();
};
