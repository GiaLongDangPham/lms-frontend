import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GradebookRow } from './grades';
import {
  getMyPublishedGradeHistory,
  getUnGradedRows,
  publishAssignmentGrades,
  saveGrade,
} from './grades';

afterEach(() => vi.unstubAllGlobals());

const student = {
  id: 'student-1',
  schoolCode: 'SV001',
  fullName: 'Sinh viên Demo',
  role: 'STUDENT' as const,
};

describe('grade workflows', () => {
  it('only treats submitted work without a grade as a publication blocker', () => {
    const rows: GradebookRow[] = [
      { student, submission: null, grade: null, autoZeroPublished: false },
      {
        student: { ...student, id: 'student-2' },
        submission: {
          id: 'submission-1',
          assignmentId: 'assignment-1',
          student: { ...student, id: 'student-2' },
          currentVersionNumber: 1,
          versions: [],
          canSubmit: true,
          lockedReason: null,
          createdAt: '2026-10-20T09:00:00Z',
        },
        grade: null,
        autoZeroPublished: false,
      },
    ];

    expect(getUnGradedRows(rows)).toEqual([rows[1]]);
  });

  it('saves grades against the current submitted version', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      assignmentId: 'assignment-1',
      submissionId: 'submission-1',
      gradedVersionNumber: 2,
      score: 8.5,
      status: 'DRAFT',
    })));
    vi.stubGlobal('fetch', fetchMock);

    await saveGrade('submission-1', {
      gradedVersionNumber: 2,
      score: 8.5,
      feedback: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/submissions\/submission-1\/grade$/),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ gradedVersionNumber: 2, score: 8.5, feedback: null }),
      }),
    );
  });

  it('uses the assignment-wide publication endpoint', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      assignmentId: 'assignment-1',
      publishedCount: 4,
      automaticZeroCount: 1,
      publishedAt: '2026-10-20T11:00:00Z',
    }))));

    await expect(publishAssignmentGrades('assignment-1')).resolves.toMatchObject({
      publishedCount: 4,
      automaticZeroCount: 1,
    });
  });

  it('treats a missing student result history as an empty history', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(getMyPublishedGradeHistory('assignment-1')).resolves.toBeNull();
  });
});
