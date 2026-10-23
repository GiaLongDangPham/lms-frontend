import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatFileSize,
  getLockMessage,
  isSubmissionLocked,
  listAllAssignments,
  listAssignmentSubmissions,
  sortAssignmentsByDeadline,
  type Submission,
} from './assignments';

afterEach(() => vi.unstubAllGlobals());

const submission: Submission = {
  id: 'submission-1',
  assignmentId: 'assignment-1',
  student: {
    id: 'student-1',
    schoolCode: 'SV001',
    fullName: 'Sinh viên Demo',
    role: 'STUDENT',
  },
  currentVersionNumber: 1,
  versions: [],
  canSubmit: true,
  lockedReason: null,
  createdAt: '2026-10-20T09:00:00Z',
};

describe('submission lock state', () => {
  it('allows a first submission when the API has no existing submission', () => {
    expect(isSubmissionLocked(null)).toBe(false);
  });

  it('allows resubmission only while the API says the submission is open', () => {
    expect(isSubmissionLocked(submission)).toBe(false);
    expect(isSubmissionLocked({ ...submission, canSubmit: false })).toBe(true);
  });

  it('locks a graded submission even if a stale canSubmit flag is true', () => {
    const gradedSubmission = { ...submission, lockedReason: 'GRADED' as const };
    expect(isSubmissionLocked(gradedSubmission)).toBe(true);
    expect(getLockMessage(gradedSubmission)).toBe('Bài đã được chấm. Bạn không thể nộp lại.');
  });

  it('surfaces malformed static mock submissions instead of rendering fake rows', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [''],
      page: { nextCursor: null },
    }))));

    await expect(listAssignmentSubmissions('assignment-1'))
      .rejects.toThrow('không đúng cấu trúc OpenAPI');
  });
});

describe('assignment deadline order', () => {
  const now = Date.parse('2026-10-20T00:00:00Z');
  const item = (id: string, deadlineAt: string) => ({ id, deadlineAt });

  it('lists upcoming deadlines nearest first, then overdue ones most recent first', () => {
    const sorted = sortAssignmentsByDeadline([
      item('long-overdue', '2026-09-01T00:00:00Z'),
      item('later', '2026-11-30T00:00:00Z'),
      item('just-overdue', '2026-10-19T00:00:00Z'),
      item('soon', '2026-10-21T00:00:00Z'),
    ], now);

    expect(sorted.map((assignment) => assignment.id)).toEqual(['soon', 'later', 'just-overdue', 'long-overdue']);
  });
});

describe('assignment list across pages', () => {
  it('follows the cursor until the last page', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    const fetchMock = vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(
      url.includes('cursor=next')
        ? { items: [{ id: 'second' }], page: { nextCursor: null } }
        : { items: [{ id: 'first' }], page: { nextCursor: 'next' } },
    ))));
    vi.stubGlobal('fetch', fetchMock);

    const assignments = await listAllAssignments('class-1');

    expect(assignments.map((assignment) => assignment.id)).toEqual(['first', 'second']);
  });
});

describe('file size', () => {
  it('uses Vietnamese decimal formatting', () => {
    expect(formatFileSize(2_400_000)).toBe('2,3 MB');
    expect(formatFileSize(850 * 1024)).toBe('850 KB');
  });
});
