// [F0] API client — HTTP wrapper with bearer auth.
// Base URL comes from VITE_API_BASE_URL. Never put secrets in VITE_* variables.

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4010/api';
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function errorFromResponse(response: Response): Promise<ApiClientError> {
  let code = 'UNKNOWN';
  let message = `HTTP ${response.status.toString()}`;
  const text = await response.text();

  if (text) {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch (error: unknown) {
      if (!(error instanceof SyntaxError)) throw error;
    }

    if (isObject(body) && isObject(body.error)) {
      if (typeof body.error.code === 'string') code = body.error.code;
      if (typeof body.error.message === 'string') message = body.error.message;
    }
  }

  return new ApiClientError(response.status, code, message);
}

function requestHeaders(options: FetchOptions): Headers {
  const headers = new Headers(options.headers);
  if (options.body instanceof FormData) {
    headers.delete('Content-Type');
  } else if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!options.skipAuth) {
    const token = getStoredToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { skipAuth = false, ...rest } = options;
  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: requestHeaders({ ...rest, skipAuth }),
  });

  if (!response.ok) throw await errorFromResponse(response);
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) {
    throw new ApiClientError(response.status, 'EMPTY_RESPONSE', 'API không trả về nội dung như mong đợi.');
  }

  try {
    return JSON.parse(text) as T;
  } catch (error: unknown) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new ApiClientError(response.status, 'INVALID_RESPONSE', 'API trả về JSON không hợp lệ.');
  }
}

export async function apiFetchBlob(path: string): Promise<Blob> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: requestHeaders({}),
  });
  if (!response.ok) throw await errorFromResponse(response);
  return response.blob();
}
