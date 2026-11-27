import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAssignmentComment, listAllAssignmentComments } from './comments';

afterEach(() => vi.unstubAllGlobals());

const comment = {
  id: 'comment-1',
  author: {
    id: 'student-1',
    schoolCode: 'SV001',
    fullName: 'Sinh viên Demo',
    role: 'STUDENT' as const,
  },
  assignmentId: 'assignment-1',
  submissionId: null,
  body: 'Em có thể nộp hai file không ạ?',
  createdAt: '2026-11-12T10:00:00Z',
};

describe('assignment comments', () => {
  it('reads all pages from assignment discussion', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [comment],
        page: { nextCursor: null },
      })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listAllAssignmentComments('assignment-1')).resolves.toEqual([comment]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/assignments\/assignment-1\/comments\?limit=100$/),
      expect.any(Object),
    );
  });

  it('posts the trimmed text as an assignment-level comment', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(comment), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await createAssignmentComment('assignment-1', comment.body);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/assignments\/assignment-1\/comments$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ body: comment.body }),
      }),
    );
  });
});
