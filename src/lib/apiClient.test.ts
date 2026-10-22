import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './apiClient';

afterEach(() => vi.unstubAllGlobals());

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
});
