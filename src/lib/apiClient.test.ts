import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, apiFetchBlob, clearStoredToken, getStoredToken, setStoredToken } from './apiClient';
import { login } from './auth';

afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });

describe('API client', () => {
  it('lets the browser set the multipart boundary for file uploads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'file-1',
      originalName: 'report.pdf',
    }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const body = new FormData();
    body.set('file', new File(['report'], 'report.pdf', { type: 'application/pdf' }));

    await expect(apiFetch('/files', { method: 'POST', body, skipAuth: true })).resolves.toEqual({
      id: 'file-1',
      originalName: 'report.pdf',
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(new Headers(request?.headers).has('Content-Type')).toBe(false);
  });

  it('preserves API error codes for a locked submission response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'GRADE_LOCKS_SUBMISSION', message: 'Bài đã được chấm.' },
    }), { status: 409 })));

    await expect(apiFetch('/assignments/a/submissions', {
      method: 'POST',
      body: JSON.stringify({ fileIds: ['file-1'] }),
      skipAuth: true,
    })).rejects.toMatchObject({
      status: 409,
      code: 'GRADE_LOCKS_SUBMISSION',
      message: 'Bài đã được chấm.',
    });
  });

  it('keeps access tokens in memory and sends refresh cookies on login and API calls', async () => {
    const setItem = vi.fn(); vi.stubGlobal('localStorage', { setItem });
    setStoredToken('memory-only'); expect(getStoredToken()).toBe('memory-only'); expect(setItem).not.toHaveBeenCalled();
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/classes');
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(options.credentials).toBe('include');
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer memory-only');
  });

  it('shares one refresh across concurrent 401 responses, then retries with the new bearer', async () => {
    setStoredToken('expired');
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return new Response(JSON.stringify({ accessToken: 'renewed' }));
      if (new Headers(options.headers).get('Authorization') !== 'Bearer renewed') {
        return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 });
      }
      return new Response(JSON.stringify({ ok: true }));
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(Promise.all([apiFetch('/classes'), apiFetch('/materials/a')])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(getStoredToken()).toBe('renewed');
  });

  it('restores a session from the HttpOnly cookie and also refreshes private downloads', async () => {
    clearStoredToken();
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return new Response(JSON.stringify({ accessToken: 'restored' }));
      return new Headers(options.headers).get('Authorization') === 'Bearer restored'
        ? new Response('file bytes') : new Response('{}', { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await (await apiFetchBlob('/files/a/download')).text()).toBe('file bytes');
    expect(getStoredToken()).toBe('restored');
  });

  it('stops after a failed refresh and never refreshes failed login credentials', async () => {
    setStoredToken('expired');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }), { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiFetch('/classes')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2); expect(getStoredToken()).toBeNull();
    fetchMock.mockClear();
    await expect(apiFetch('/auth/login', { method: 'POST', skipAuth: true })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not replay an old write as a newly signed-in user', async () => {
    setStoredToken('first-user');
    let respond!: (response: Response) => void;
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { respond = resolve; }))
      .mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const request = apiFetch('/classes/a/materials', { method: 'POST', body: JSON.stringify({ title: 'Old request', fileIds: [] }) });
    setStoredToken('second-user');
    respond(new Response('{}', { status: 401 }));
    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getStoredToken()).toBe('second-user');
  });

  it('does not retry after logout while refresh is still pending', async () => {
    setStoredToken('expired');
    let finishRefresh!: (response: Response) => void;
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finishRefresh = resolve; }))
      .mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const request = apiFetch('/classes');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    clearStoredToken();
    finishRefresh(new Response(JSON.stringify({ accessToken: 'stale-refresh' })));
    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getStoredToken()).toBeNull();
  });

  it('finishes an old cookie rotation before sending new login credentials', async () => {
    let finishRefresh!: (response: Response) => void;
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finishRefresh = resolve; }))
      .mockResolvedValue(new Response(JSON.stringify({ accessToken: 'new-login', user: { id: 'new-user' } })));
    vi.stubGlobal('fetch', fetchMock);
    const oldSession = apiFetch('/auth/me').catch((error: unknown) => error);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const newSession = login('GV001', 'ValidPassword2026!');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    finishRefresh(new Response(JSON.stringify({ accessToken: 'old-refresh' })));
    await newSession;
    expect(await oldSession).toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[0]).toMatch(/\/auth\/login$/);
    expect(getStoredToken()).toBe('new-login');
  });
});
