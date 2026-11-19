import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getNotificationTarget,
  listAllMyNotifications,
  type Notification,
} from '../../lib/notifications';

export default function NotificationPreview() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      try {
        const allNotifications = await listAllMyNotifications();
        if (!cancelled) setNotifications(allNotifications);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được thông báo.');
        }
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, []);

  const unreadCount = notifications.filter((notification) => notification.readAt === null).length;

  return (
    <section className="assignment-card assignment-notification-preview">
      <div className="assignment-notification-heading">
        <h2>Thông báo</h2>
        <Link className="btn btn--secondary" to="/student/notifications">Thông báo</Link>
      </div>
      {error ? (
        <p className="assignment-inline-error" role="alert">{error}</p>
      ) : (
        <>
          <span className="status-badge status-badge--draft">{unreadCount} chưa đọc</span>
          {notifications.length === 0 ? (
            <p className="assignment-muted">Bạn chưa có thông báo.</p>
          ) : (
            <ul className="assignment-notification-preview-list">
              {notifications.slice(0, 3).map((notification) => {
                const target = getNotificationTarget(notification);
                return (
                  <li key={notification.id}>
                    <strong>{notification.title}</strong>
                    <p>{notification.body}</p>
                    <span>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notification.createdAt))}</span>
                    {target && <Link to={target}>Xem chi tiết</Link>}
                  </li>
                );
              })}
            </ul>
          )}
          <Link className="btn btn--secondary" to="/student/notifications">Xem tất cả thông báo</Link>
        </>
      )}
    </section>
  );
}
