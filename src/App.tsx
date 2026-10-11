import { useEffect, useState } from 'react';
import { getHealth, getReadiness } from './lib/api';

type Status = 'idle' | 'loading' | 'connected' | 'disconnected';
const labels: Record<Status, string> = {
  idle: 'Chưa kiểm tra', loading: 'Đang kiểm tra…', connected: 'Đã kết nối', disconnected: 'Chưa kết nối',
};

export default function App() {
  const [attempt, setAttempt] = useState(0);
  const [backend, setBackend] = useState<Status>('idle');
  const [database, setDatabase] = useState<Status>('idle');

  useEffect(() => {
    const controller = new AbortController();
    async function check() {
      setBackend('loading');
      setDatabase('loading');
      const results = await Promise.allSettled([
        getHealth(controller.signal), getReadiness(controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setBackend(results[0].status === 'fulfilled' ? 'connected' : 'disconnected');
      setDatabase(results[1].status === 'fulfilled' && results[1].value.database === 'connected'
        ? 'connected' : 'disconnected');
    }
    void check();
    return () => controller.abort();
  }, [attempt]);

  const checking = backend === 'loading' || database === 'loading';
  return (
    <main className="workspace">
      <p className="eyebrow">LMS NHÓM 2 · S1</p>
      <h1>Môi trường phát triển</h1>
      <p className="intro">Khung dự án đã sẵn sàng để nhóm bắt đầu xây dựng hệ thống quản lý học tập.</p>
      <section className="panel" aria-labelledby="connection-title">
        <h2 id="connection-title">Kiểm tra kết nối</h2>
        <div role="status" aria-live="polite" aria-atomic="true" aria-busy={checking}>
          <dl>
            <div><dt>Frontend React</dt><dd className="connected">Đang chạy</dd></div>
            <div><dt>Backend Express</dt><dd className={backend}>{labels[backend]}</dd></div>
            <div><dt>PostgreSQL</dt><dd className={database}>{labels[database]}</dd></div>
          </dl>
        </div>
        <button type="button" disabled={checking} onClick={() => setAttempt((value) => value + 1)}>
          {checking ? 'Đang kiểm tra…' : 'Kiểm tra lại'}
        </button>
        {(backend === 'disconnected' || database === 'disconnected') && (
          <p className="hint">Mở README để kiểm tra cấu hình môi trường, backend và PostgreSQL, rồi thử lại.</p>
        )}
      </section>
      <p className="footnote">Bước tiếp theo: chốt thiết kế, dựng giao diện theo UI kit và phát triển các module.</p>
    </main>
  );
}
