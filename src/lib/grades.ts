import { ApiClientError, apiFetch } from './apiClient';
import {
  getAssignment,
  listAssignmentSubmissions,
  listEnrollments,
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
  autoZeroPublished: boolean;
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

async function findPublishedAutomaticZero(
  assignmentId: string,
  studentId: string,
): Promise<boolean> {
  const history = await getTeacherGradeHistory(assignmentId, studentId);
  const latestPublished = history?.items
    .filter((item) => item.status === 'PUBLISHED')
    .sort((left, right) => right.version - left.version)[0];
  return latestPublished?.source === 'AUTO_ZERO_NO_SUBMISSION';
}

export async function getAssignmentGradebook(assignmentId: string): Promise<AssignmentGradebook> {
  const assignment = await getAssignment(assignmentId);
  const [submissions, enrollments] = await Promise.all([
    getAllPages((cursor) => listAssignmentSubmissions(assignmentId, cursor)),
    getAllPages((cursor) => listEnrollments(assignment.classId, cursor)),
  ]);
  const submissionsByStudent = new Map(
    submissions.map((submission) => [submission.student.id, submission]),
  );
  const activeEnrollments = enrollments.filter((enrollment) => enrollment.isActive);
  const rows: GradebookRow[] = activeEnrollments.map((enrollment: Enrollment) => {
    const submission = submissionsByStudent.get(enrollment.student.id) ?? null;
    return {
      student: enrollment.student,
      submission,
      grade: submission?.grade ?? null,
      autoZeroPublished: false,
    };
  });
  const includedStudentIds = new Set(rows.map((row) => row.student.id));
  for (const submission of submissions) {
    if (!includedStudentIds.has(submission.student.id)) {
      rows.push({
        student: submission.student,
        submission,
        grade: submission.grade ?? null,
        autoZeroPublished: false,
      });
    }
  }

  const missingSubmissionRows = rows.filter((row) => !row.submission);
  for (let index = 0; index < missingSubmissionRows.length; index += 8) {
    const batch = missingSubmissionRows.slice(index, index + 8);
    const publicationStates = await Promise.all(batch.map((row) => (
      findPublishedAutomaticZero(assignmentId, row.student.id)
    )));
    batch.forEach((row, rowIndex) => {
      row.autoZeroPublished = publicationStates[rowIndex] ?? false;
    });
  }

  return { assignment, rows };
}

export function isGradeReadyForPublication(grade: GradeSummary | null): boolean {
  return grade !== null;
}

export function getUnGradedRows(rows: GradebookRow[]): GradebookRow[] {
  return rows.filter((row) => row.submission !== null && !isGradeReadyForPublication(row.grade));
}
