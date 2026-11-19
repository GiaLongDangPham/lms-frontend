import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GradebookRow } from './grades';
import {
  getMyPublishedGradeHistory,
  getAssignmentGradebook,
  getUnGradedRows,
  isValidGradeScore,
  publishAssignmentGrades,
  saveAutomaticZeroCorrection,
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
      { student, submission: null, grade: null },
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

  it.each([
    ['0', true],
    ['8.1', true],
    ['8.12', true],
    ['8.125', false],
    ['10.01', false],
    ['-0.1', false],
    ['1e1', false],
    ['', false],
  ])('validates grade score %s', (value, expected) => {
    expect(isValidGradeScore(value, 10)).toBe(expected);
  });

  it('updates an automatic zero through the assignment/student correction endpoint', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      assignmentId: 'assignment-1',
      student,
      submissionId: null,
      score: 0,
      feedback: 'Đã trao đổi với sinh viên',
      status: 'PUBLISHED',
      source: 'MANUAL',
    })));
    vi.stubGlobal('fetch', fetchMock);

    await saveAutomaticZeroCorrection('assignment-1', 'student-1', {
      score: 0,
      feedback: 'Đã trao đổi với sinh viên',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4010/api/assignments/assignment-1/grades/student-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ score: 0, feedback: 'Đã trao đổi với sinh viên' }),
      }),
    );
  });

  it('does not request per-student grade histories while loading the gradebook', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'assignment-1',
        classId: 'class-1',
        title: 'Bài kiểm tra',
        deadlineAt: '2026-11-20T10:00:00Z',
        maxScore: 10,
        files: [],
        createdAt: '2026-11-01T10:00:00Z',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [],
        page: { nextCursor: null },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          { id: 'enrollment-1', classId: 'class-1', student, isActive: true, createdAt: '2026-11-01T10:00:00Z' },
          {
            id: 'enrollment-2',
            classId: 'class-1',
            student: { ...student, id: 'student-2', schoolCode: 'SV002' },
            isActive: true,
            createdAt: '2026-11-01T10:00:00Z',
          },
        ],
        page: { nextCursor: null },
      })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getAssignmentGradebook('assignment-1')).resolves.toMatchObject({
      rows: [{ submission: null }, { submission: null }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/grades/'),
      expect.anything(),
    );
  });
});
