import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getLockMessage,
  isSubmissionLocked,
  listAssignmentSubmissions,
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
