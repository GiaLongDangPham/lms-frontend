// [F0] API client — HTTP wrapper với Bearer token
// Baseurl từ VITE_API_BASE_URL (.env). Mock D2: http://localhost:4010/api
// Không đặt secret trong biến VITE_*

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000/api';
const TOKEN_KEY = 'lms_access_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { skipAuth = false, ...rest } = options;
  const headers = new Headers(rest.headers);

  headers.set('Content-Type', 'application/json');

  if (!skipAuth) {
    const token = getStoredToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...rest, headers });

  if (!res.ok) {
    let code = 'UNKNOWN';
    let message = `HTTP ${res.status.toString()}`;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // ignorar erro de parse
    }
    throw new ApiClientError(res.status, code, message);
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
