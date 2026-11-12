import { apiFetch } from './apiClient';
import type { Page } from './assignments';

export type NotificationKind = 'ASSIGNMENT_CREATED' | 'DEADLINE_REMINDER' | 'GRADE_PUBLISHED';

export interface Notification {
  id: string;
  kind: NotificationKind;
  assignmentId: string | null;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function getNotificationTarget(notification: Notification): string | null {
  if (!notification.assignmentId) return null;
  if (notification.kind === 'GRADE_PUBLISHED') {
    return `/student/assignments/${notification.assignmentId}/result`;
  }
  return `/student/assignments/${notification.assignmentId}`;
}

function pageQuery(cursor?: string | null, limit = 20): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return `?${params.toString()}`;
}

export function listMyNotifications(
  cursor?: string | null,
  limit = 20,
): Promise<Page<Notification>> {
  return apiFetch(`/notifications${pageQuery(cursor, limit)}`);
}

export function markNotificationRead(notificationId: string): Promise<Notification> {
  return apiFetch(`/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
  });
}

export async function listAllMyNotifications(): Promise<Notification[]> {
  const notifications: Notification[] = [];
  const visitedCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const page = await listMyNotifications(cursor, 100);
    notifications.push(...page.items);
    cursor = page.page.nextCursor;
    if (cursor && visitedCursors.has(cursor)) {
      throw new Error('API trả về cursor phân trang thông báo bị lặp.');
    }
    if (cursor) visitedCursors.add(cursor);
  } while (cursor);

  return notifications;
}
