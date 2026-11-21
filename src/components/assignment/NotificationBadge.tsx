import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { listAllMyNotifications } from '../../lib/notifications';

export default function NotificationBadge() {
  const { user } = useAuth();
  const userId = user?.id;
  const role = user?.role;
  const { pathname } = useLocation();
  const [snapshot, setSnapshot] = useState<{ userId: string; count: number } | null>(null);
  useEffect(() => {
    if (!userId || role !== 'STUDENT') return;
    const recipientId = userId;
    let active = true;
    let generation = 0;
    async function refresh() {
      const current = ++generation;
      try {
        const items = await listAllMyNotifications();
        if (active && current === generation) setSnapshot({ userId: recipientId,
          count: items.filter(item => item.readAt === null).length });
      } catch { /* Keep last confirmed count; never report a failed fetch as zero. */ }
    }
    void refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('lms-notifications-changed', refresh);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('lms-notifications-changed', refresh);
    };
  }, [userId, role, pathname]);
  if (!user || snapshot?.userId !== user.id) return null;
  return <span className="status-badge status-badge--draft" aria-label={`${snapshot.count} thông báo chưa đọc`}>
    {snapshot.count}
  </span>;
}
