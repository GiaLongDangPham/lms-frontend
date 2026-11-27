import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getNotificationTarget,
  listAllMyNotifications,
  markNotificationRead,
  type Notification,
} from '../../lib/notifications';
import {
  AssignmentHeader,
  ErrorState,
  LoadingState,
} from '../../components/assignment/AssignmentUI';

type NotificationFilter = 'ALL' | 'UNREAD';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshNotifications() {
    setNotifications(await listAllMyNotifications());
  }

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      setLoading(true);
      setError(null);
      try {
        const loaded = await listAllMyNotifications();
        if (!cancelled) setNotifications(loaded);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được thông báo.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadNotifications();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleMarkRead(notificationId: string) {
    setUpdating(true);
    setError(null);
    try {
      const updated = await markNotificationRead(notificationId);
      setNotifications((current) => current.map((notification) => (
        notification.id === updated.id ? updated : notification
      )));
    } catch (updateError: unknown) {
      setError(updateError instanceof Error ? updateError.message : 'Không cập nhật được trạng thái thông báo.');
    } finally {
      setUpdating(false);
    }
  }

  async function handleMarkAllRead() {
    const unread = notifications.filter((notification) => notification.readAt === null);
    if (unread.length === 0) return;

    setUpdating(true);
    setError(null);
    try {
      for (const notification of unread) {
        await markNotificationRead(notification.id);
      }
      await refreshNotifications();
    } catch (updateError: unknown) {
      const message = updateError instanceof Error ? updateError.message : 'Lỗi không xác định.';
      try {
        await refreshNotifications();
      } catch (refreshError: unknown) {
        setError(`Không đánh dấu được toàn bộ thông báo: ${message}. Tải lại trạng thái cũng thất bại: ${refreshError instanceof Error ? refreshError.message : 'Lỗi không xác định.'}`);
        setUpdating(false);
        return;
      }
      setError(`Không đánh dấu được toàn bộ thông báo: ${message}. Danh sách đã được đồng bộ lại.`);
    } finally {
      setUpdating(false);
    }
  }

  const unreadCount = notifications.filter((notification) => notification.readAt === null).length;
  const visibleNotifications = useMemo(
    () => filter === 'UNREAD'
      ? notifications.filter((notification) => notification.readAt === null)
      : notifications,
    [filter, notifications],
  );

  if (loading) return <LoadingState label="Đang tải thông báo…" />;
  if (error && notifications.length === 0) return <ErrorState message={error} />;

  return (
    <section className="assignment-page">
      <AssignmentHeader title="Thông báo" subtitle="Cập nhật bài tập và kết quả học tập" />
      {error && <p className="assignment-inline-error" role="alert">{error}</p>}
      <div className="assignment-form-actions">
        <button
          type="button"
          className={`btn ${filter === 'ALL' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => setFilter('ALL')}
        >
          Tất cả ({notifications.length})
        </button>
        <button
          type="button"
          className={`btn ${filter === 'UNREAD' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => setFilter('UNREAD')}
        >
          Chưa đọc ({unreadCount})
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => void handleMarkAllRead()}
          disabled={updating || unreadCount === 0}
        >
          {updating ? 'Đang cập nhật…' : 'Đánh dấu tất cả đã đọc'}
        </button>
      </div>

      {visibleNotifications.length === 0 ? (
        <section className="assignment-card assignment-empty">
          <h2>{filter === 'UNREAD' ? 'Bạn đã đọc hết thông báo.' : 'Bạn chưa có thông báo.'}</h2>
        </section>
      ) : (
        <div className="assignment-notification-list">
          {visibleNotifications.map((notification) => {
            const target = getNotificationTarget(notification);
            return (
              <article
                key={notification.id}
                className={`assignment-card assignment-notification${notification.readAt === null ? ' assignment-notification--unread' : ''}`}
              >
                <div className="assignment-notification-heading">
                  <h2>{notification.title}</h2>
                  {notification.readAt === null && <span className="status-badge status-badge--draft">Chưa đọc</span>}
                </div>
                <p>{notification.body}</p>
                <span className="assignment-muted">
                  {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notification.createdAt))}
                </span>
                <div className="assignment-form-actions">
                  {target ? (
                    <Link
                      className="btn btn--secondary"
                      to={target}
                      onClick={() => {
                        if (notification.readAt === null) void handleMarkRead(notification.id);
                      }}
                    >
                      Xem chi tiết
                    </Link>
                  ) : <span className="assignment-muted">Không có nội dung liên kết.</span>}
                  {notification.readAt === null && (
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => void handleMarkRead(notification.id)}
                      disabled={updating}
                    >
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
