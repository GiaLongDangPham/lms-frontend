import { ApiClientError, apiFetch } from './apiClient';
import {
  getAssignment,
  listAssignmentSubmissions,
  listEnrollments,
  pageQuery,
  type Assignment,
  type Enrollment,
  type GradeSummary,
  type Page,
  type Submission,
} from './assignments';
import type { Role } from './types';

export interface UserSummary {
  id: string;
  schoolCode: string;
  fullName: string;
  role: Role;
}

export interface Grade {
  assignmentId: string;
  student: Submission['student'];
  submissionId: string | null;
  gradedVersionNumber: number | null;
  score: number;
  feedback?: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  source: 'MANUAL' | 'AUTO_ZERO_NO_SUBMISSION';
  gradedBy: UserSummary;
  gradedAt: string;
  publishedBy: UserSummary | null;
  publishedAt: string | null;
}

export interface GradeHistoryEntry {
  version: number;
  score: number;
  feedback?: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  source: 'MANUAL' | 'AUTO_ZERO_NO_SUBMISSION';
  changedBy: UserSummary;
  changedAt: string;
}

export interface GradeHistory {
  assignmentId: string;
  student: Submission['student'];
  items: GradeHistoryEntry[];
}

export interface PublishedGrade {
  assignmentId: string;
  student: Submission['student'];
  submissionId: string | null;
  gradedVersionNumber: number | null;
  score: number;
  feedback?: string | null;
  status: 'PUBLISHED';
  source: 'MANUAL' | 'AUTO_ZERO_NO_SUBMISSION';
  publishedBy: UserSummary;
  publishedAt: string;
  gradedBy?: UserSummary | null;
}

export interface AssignmentPublicationResult {
  assignmentId: string;
  publishedCount: number;
  automaticZeroCount: number;
  publishedAt: string;
}

export interface GradebookRow {
  student: Submission['student'];
  submission: Submission | null;
  grade: GradeSummary | null;
}

export interface AssignmentGradebook {
  assignment: Assignment;
  rows: GradebookRow[];
}

export async function getSubmissionForGrading(assignmentId: string, submissionId: string): Promise<Submission> {
  const submission = await apiFetch<Submission>(`/submissions/${encodeURIComponent(submissionId)}`);
  if (submission.assignmentId !== assignmentId) {
    throw new Error('Bài nộp không thuộc bài tập đã chọn.');
  }
  return submission;
}

export function getGradeForTeacher(submissionId: string): Promise<Grade | null> {
  return apiFetch<Grade>(`/submissions/${encodeURIComponent(submissionId)}/grade`).catch((error: unknown) => {
    if (error instanceof ApiClientError && error.status === 404) return null;
    throw error;
  });
}

export function saveGrade(
  submissionId: string,
  grade: { gradedVersionNumber: number; score: number; feedback: string | null },
): Promise<Grade> {
  return apiFetch(`/submissions/${encodeURIComponent(submissionId)}/grade`, {
    method: 'PUT',
    body: JSON.stringify(grade),
  });
}

export function saveAutomaticZeroCorrection(
  assignmentId: string,
  studentId: string,
  grade: { score: number; feedback: string | null },
): Promise<Grade> {
  return apiFetch(
    `/assignments/${encodeURIComponent(assignmentId)}/grades/${encodeURIComponent(studentId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(grade),
    },
  );
}

export function publishAssignmentGrades(assignmentId: string): Promise<AssignmentPublicationResult> {
  return apiFetch(`/assignments/${encodeURIComponent(assignmentId)}/grades/publish`, {
    method: 'POST',
  });
}

export function getMyPublishedGradeHistory(assignmentId: string): Promise<GradeHistory | null> {
  return apiFetch<GradeHistory>(`/assignments/${encodeURIComponent(assignmentId)}/my-result/history`)
    .catch((error: unknown) => {
      if (error instanceof ApiClientError && error.status === 404) return null;
      throw error;
    });
}

export function getTeacherGradeHistory(
  assignmentId: string,
  studentId: string,
): Promise<GradeHistory | null> {
  return apiFetch<GradeHistory>(
    `/assignments/${encodeURIComponent(assignmentId)}/grades/${encodeURIComponent(studentId)}/history`,
  ).catch((error: unknown) => {
    if (error instanceof ApiClientError && error.status === 404) return null;
    throw error;
  });
}

async function getAllPages<T>(loadPage: (cursor?: string | null) => Promise<Page<T>>): Promise<T[]> {
  const items: T[] = [];
  const visitedCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const page = await loadPage(cursor);
    items.push(...page.items);
    cursor = page.page.nextCursor;
    if (cursor && visitedCursors.has(cursor)) {
      throw new Error('API trả về cursor phân trang bị lặp.');
    }
    if (cursor) visitedCursors.add(cursor);
  } while (cursor);

  return items;
}

export async function getAssignmentGradebook(assignmentId: string): Promise<AssignmentGradebook> {
  const assignment = await getAssignment(assignmentId);
  const [submissions, enrollments, grades] = await Promise.all([
    getAllPages((cursor) => listAssignmentSubmissions(assignmentId, cursor)),
    getAllPages((cursor) => listEnrollments(assignment.classId, cursor)),
    getAllPages((cursor) => apiFetch<Page<Grade>>(`/assignments/${encodeURIComponent(assignmentId)}/grades${pageQuery(cursor)}`)),
  ]);
  const gradesByStudent = new Map(grades.map(grade => [grade.student.id, grade]));
  const submissionsByStudent = new Map(
    submissions.map((submission) => [submission.student.id, submission]),
  );
  const activeEnrollments = enrollments.filter((enrollment) => enrollment.isActive);
  const rows: GradebookRow[] = activeEnrollments.map((enrollment: Enrollment) => {
    const submission = submissionsByStudent.get(enrollment.student.id) ?? null;
    return {
      student: enrollment.student,
      submission,
      grade: gradesByStudent.get(enrollment.student.id) ?? submission?.grade ?? null,
    };
  });
  const includedStudentIds = new Set(rows.map((row) => row.student.id));
  for (const submission of submissions) {
    if (!includedStudentIds.has(submission.student.id)) {
      rows.push({
        student: submission.student,
        submission,
        grade: gradesByStudent.get(submission.student.id) ?? submission.grade ?? null,
      });
    }
  }
  for (const grade of grades) {
    if (!rows.some(row => row.student.id === grade.student.id)) {
      rows.push({ student: grade.student, submission: null, grade });
    }
  }

  return { assignment, rows };
}

export function isValidGradeScore(value: string, maxScore: number): boolean {
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return false;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= maxScore;
}

export function isGradeReadyForPublication(grade: GradeSummary | null): boolean {
  return grade !== null;
}

export function getUnGradedRows(rows: GradebookRow[]): GradebookRow[] {
  return rows.filter((row) => row.submission !== null && !isGradeReadyForPublication(row.grade));
}
