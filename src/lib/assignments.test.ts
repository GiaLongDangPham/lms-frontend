import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  findUnsupportedUpload,
  formatFileSize,
  getLockMessage,
  getMyPublishedResult,
  isSubmissionLocked,
  listAllAssignments,
  listAssignmentSubmissions,
  sortAssignmentsByDeadline,
  uploadFile,
  maxUploadBytes,
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

  it('locks a submission whose deadline has passed and explains how to reopen it', () => {
    const lateSubmission = { ...submission, canSubmit: false, lockedReason: 'DEADLINE_PASSED' as const };
    expect(isSubmissionLocked(lateSubmission)).toBe(true);
    expect(getLockMessage(lateSubmission)).toBe('Đã quá hạn nộp. Bạn chỉ có thể nộp lại khi giảng viên gia hạn.');
  });

  it('accepts deadline-locked submissions in the teacher submission list', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ ...submission, canSubmit: false, lockedReason: 'DEADLINE_PASSED' }],
      page: { nextCursor: null },
    }))));

    const page = await listAssignmentSubmissions('assignment-1');

    expect(page.items[0]?.lockedReason).toBe('DEADLINE_PASSED');
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

  it('does not expose a draft result through the student result endpoint', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      assignmentId: 'assignment-1',
      score: 8,
      status: 'DRAFT',
    }))));

    await expect(getMyPublishedResult('assignment-1'))
      .rejects.toThrow('kết quả chưa công bố');
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

describe('upload file types', () => {
  it('accepts Q08 source, spreadsheet and image extensions and rejects extensionless files', () => {
    expect(findUnsupportedUpload(['answer.ts', 'data.xlsx', 'photo.JPG', 'notes.md'].map(name => new File(['x'], name))))
      .toBeUndefined();
    const extensionless = new File(['x'], 'pdf');
    expect(findUnsupportedUpload([extensionless])).toBe(extensionless);
  });
  it('rejects empty and oversized files before sending a request', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(uploadFile(new File([], 'empty.txt'))).rejects.toThrow('25 MiB');
    await expect(uploadFile(new File([new Uint8Array(maxUploadBytes + 1)], 'huge.txt'))).rejects.toThrow('25 MiB');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('accepts supported extensions regardless of case', () => {
    expect(findUnsupportedUpload([new File(['x'], 'Chuong1.PDF'), new File(['x'], 'slides.pptx')])).toBeUndefined();
  });

  it('returns the first unsupported file', () => {
    const script = new File(['x'], 'setup.exe');
    expect(findUnsupportedUpload([new File(['x'], 'a.docx'), script])).toBe(script);
  });
});

describe('file size', () => {
  it('uses Vietnamese decimal formatting', () => {
    expect(formatFileSize(2_400_000)).toBe('2,3 MB');
    expect(formatFileSize(850 * 1024)).toBe('850 KB');
  });
});
