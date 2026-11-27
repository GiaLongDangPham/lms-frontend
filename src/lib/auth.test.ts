import { afterEach, describe, expect, it, vi } from 'vitest';
import { changePassword } from './auth';

afterEach(() => vi.unstubAllGlobals());

describe('password change', () => {
  it('posts the current and new password to the change-password endpoint', async () => {
    vi.stubGlobal('localStorage', { getItem: () => 'token' });
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      () => Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await changePassword('mat-khau-cu-123', 'mat-khau-moi-123');

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toMatch(/\/auth\/change-password$/);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ currentPassword: 'mat-khau-cu-123', newPassword: 'mat-khau-moi-123' });
  });
});
