// [F0] Auth functions — login, logout, getCurrentUser
// Endpoints theo D2 spec: POST /auth/login, POST /auth/logout, GET /auth/me
import { apiFetch, setStoredToken, clearStoredToken } from './apiClient';
import type { LoginResult, User } from './types';

export async function login(schoolCode: string, password: string): Promise<LoginResult> {
  const result = await apiFetch<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ schoolCode, password }),
    skipAuth: true,
  });
  setStoredToken(result.accessToken);
  return result;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<void>('/auth/logout', { method: 'POST' });
  } finally {
    clearStoredToken();
  }
}

export async function getCurrentUser(): Promise<User> {
  return apiFetch<User>('/auth/me');
}
