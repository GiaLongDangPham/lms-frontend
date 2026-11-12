import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getNotificationTarget,
  listAllMyNotifications,
  markNotificationRead,
} from './notifications';

afterEach(() => vi.unstubAllGlobals());

const notification = {
  id: 'notification-1',
  kind: 'GRADE_PUBLISHED' as const,
  assignmentId: 'assignment-1',
  title: 'Điểm đã công bố',
  body: 'Kết quả bài tập đã được công bố.',
  readAt: null,
  createdAt: '2026-11-12T10:00:00Z',
};

describe('notifications', () => {
  it('links published-grade notifications to the student-safe result route', () => {
    expect(getNotificationTarget(notification)).toBe('/student/assignments/assignment-1/result');
    expect(getNotificationTarget({ ...notification, assignmentId: null })).toBeNull();
  });

  it('loads all notification pages without repeating a cursor', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [notification],
        page: { nextCursor: 'page-2' },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ ...notification, id: 'notification-2', kind: 'ASSIGNMENT_CREATED' }],
        page: { nextCursor: null },
      })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listAllMyNotifications()).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:4010/api/notifications?limit=100&cursor=page-2',
      expect.any(Object),
    );
  });

  it('marks a notification read with its dedicated endpoint', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ...notification,
      readAt: '2026-11-12T11:00:00Z',
    })));
    vi.stubGlobal('fetch', fetchMock);

    await markNotificationRead('notification-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4010/api/notifications/notification-1/read',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});
