import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHealth, getReadiness } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('infrastructure API client', () => {
  it('does not treat an HTML fallback or wrong JSON shape as a healthy API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ page: 'fallback' }))));
    await expect(getHealth()).rejects.toThrow('trạng thái hợp lệ');
  });

  it('distinguishes a running API with unavailable DB from a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'unavailable', database: 'disconnected',
    }), { status: 503 })));
    await expect(getReadiness()).resolves.toEqual({ status: 'unavailable', database: 'disconnected' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(getReadiness()).rejects.toThrow('Failed to fetch');
  });

  it('rejects an unsuccessful response even if its body claims to be healthy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'ok', service: 'lms-backend',
    }), { status: 500 })));
    await expect(getHealth()).rejects.toThrow();
  });
});
