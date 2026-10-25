// [F0] API client — HTTP wrapper with bearer auth.
// Base URL comes from VITE_API_BASE_URL. Never put secrets in VITE_* variables.

const BASE_URL = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000/api').replace(/\/+$/, '');
let accessToken: string | null = null;
let refreshInFlight: Promise<void> | null = null;
let authGeneration = 0;

export function getStoredToken(): string | null {
  return accessToken;
}

export function setStoredToken(token: string): void {
  authGeneration++;
  accessToken = token;
}

export function clearStoredToken(): void {
  authGeneration++;
  accessToken = null;
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

async function refreshAccess(): Promise<void> {
  if (!refreshInFlight) {
    const generation = authGeneration;
    refreshInFlight = (async () => {
      const response = await fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!response.ok) throw await errorFromResponse(response);
      const result: unknown = await response.json();
      if (!isObject(result) || typeof result.accessToken !== 'string') {
        throw new ApiClientError(502, 'INVALID_RESPONSE', 'Không làm mới được phiên đăng nhập.');
      }
      if (generation === authGeneration) accessToken = result.accessToken;
    })().catch((error: unknown) => {
      if (generation === authGeneration) clearStoredToken();
      throw error;
    }).finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function authenticatedRequest(path: string, options: FetchOptions): Promise<Response> {
  const { skipAuth = false, ...rest } = options;
  if (skipAuth && path === '/auth/login') {
    // Finish any old cookie rotation before a new login can replace that cookie.
    clearStoredToken();
    try { await refreshInFlight; } catch { /* The new credentials establish their own session. */ }
  }
  const tokenAtStart = accessToken;
  const generationAtStart = authGeneration;
  let response = await fetch(`${BASE_URL}${path}`, {
    ...rest, credentials: 'include', headers: requestHeaders(options),
  });
  if (response.status === 401 && !skipAuth && path !== '/auth/logout') {
    // A request belongs to its original session, even if another user signs in meanwhile.
    if (authGeneration !== generationAtStart) return response;
    // Concurrent 401s share one rotation; a late 401 reuses the already refreshed token.
    if (accessToken === tokenAtStart) await refreshAccess();
    if (authGeneration !== generationAtStart) return response;
    response = await fetch(`${BASE_URL}${path}`, {
      ...rest, credentials: 'include', headers: requestHeaders(options),
    });
  }
  return response;
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const response = await authenticatedRequest(path, options);

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
  const response = await authenticatedRequest(path, {});
  if (!response.ok) throw await errorFromResponse(response);
  return response.blob();
}
