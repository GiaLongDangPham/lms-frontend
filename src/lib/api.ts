export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4010/api')
  .replace(/\/+$/, '');

interface Health {
  status: 'ok';
  service: string;
}

interface Readiness {
  status: 'ok' | 'unavailable';
  database: 'connected' | 'disconnected';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function getJson(path: string, signal?: AbortSignal): Promise<{ response: Response; body: unknown }> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
  });
  const body: unknown = await response.json();
  return { response, body };
}

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const { response, body } = await getJson('/health', signal);
  if (!response.ok || !isObject(body) || body.status !== 'ok' || typeof body.service !== 'string') {
    throw new Error('Backend chưa trả về trạng thái hợp lệ. Kiểm tra API và VITE_API_BASE_URL.');
  }
  return { status: 'ok', service: body.service };
}

export async function getReadiness(signal?: AbortSignal): Promise<Readiness> {
  const { response, body } = await getJson('/ready', signal);
  if (isObject(body) && response.ok && body.status === 'ok' && body.database === 'connected') {
    return { status: 'ok', database: 'connected' };
  }
  if (response.status === 503 && isObject(body) && body.status === 'unavailable' && body.database === 'disconnected') {
    return { status: 'unavailable', database: 'disconnected' };
  }
  throw new Error('Không đọc được trạng thái PostgreSQL từ backend.');
}
