import { ApiClientError, apiFetch, apiFetchBlob } from './apiClient';

export interface ClassSummary {
  id: string;
  code: string;
  courseCode: string;
  name: string;
  term: string;
  description?: string | null;
}

export interface FileRecord {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export type StudentAssignmentStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'LATE' | 'GRADED' | null;

export interface Assignment {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  deadlineAt: string;
  maxScore: number;
  files: FileRecord[];
  submittedCount?: number;
  studentCount?: number;
  mySubmissionStatus?: StudentAssignmentStatus;
  createdAt: string;
}

export interface SubmissionVersion {
  versionNumber: number;
  submittedAt: string;
  deadlineAtSubmission: string;
  isLate: boolean;
  files: FileRecord[];
}

export interface GradeSummary {
  status: 'DRAFT' | 'PUBLISHED';
  source: 'MANUAL' | 'AUTO_ZERO_NO_SUBMISSION';
  score?: number;
}

export interface Submission {
  id: string;
  assignmentId: string;
  student: {
    id: string;
    schoolCode: string;
    fullName: string;
    role: 'STUDENT';
  };
  currentVersionNumber: number;
  versions: SubmissionVersion[];
  canSubmit: boolean;
  lockedReason: 'GRADED' | null;
  createdAt: string;
  grade?: GradeSummary | null;
}

export interface Enrollment {
  id: string;
  classId: string;
  student: Submission['student'];
  isActive: boolean;
  createdAt: string;
}

export interface PublishedResult {
  assignmentId: string;
  student: Submission['student'];
  submissionId: string | null;
  gradedVersionNumber: number | null;
  score: number;
  feedback: string | null;
  status: 'PUBLISHED';
  source: 'MANUAL' | 'AUTO_ZERO_NO_SUBMISSION';
  publishedAt: string;
}

export interface Page<T> {
  items: T[];
  page: {
    nextCursor: string | null;
  };
}

const listLimit = 100;

function pageQuery(cursor?: string | null): string {
  const params = new URLSearchParams({ limit: String(listLimit) });
  if (cursor) params.set('cursor', cursor);
  return `?${params.toString()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSubmission(value: unknown): value is Submission {
  if (!isRecord(value) || !isRecord(value.student) || !Array.isArray(value.versions)) return false;
  return typeof value.id === 'string'
    && typeof value.assignmentId === 'string'
    && typeof value.student.id === 'string'
    && typeof value.student.fullName === 'string'
    && typeof value.student.schoolCode === 'string'
    && typeof value.currentVersionNumber === 'number'
    && typeof value.canSubmit === 'boolean'
    && (value.lockedReason === null || value.lockedReason === 'GRADED')
    && typeof value.createdAt === 'string'
    && value.versions.every((version) => isRecord(version)
      && typeof version.versionNumber === 'number'
      && typeof version.submittedAt === 'string'
      && typeof version.deadlineAtSubmission === 'string'
      && typeof version.isLate === 'boolean'
      && Array.isArray(version.files));
}

function parseSubmissionPage(value: unknown): Page<Submission> {
  if (!isRecord(value) || !Array.isArray(value.items) || !isRecord(value.page)
    || !(value.page.nextCursor === null || typeof value.page.nextCursor === 'string')
    || !value.items.every(isSubmission)) {
    throw new Error('API trả về danh sách bài nộp không đúng cấu trúc OpenAPI. Kiểm tra phiên bản mock/API.');
  }
  return {
    items: value.items,
    page: { nextCursor: value.page.nextCursor },
  };
}

export function isSubmissionLocked(submission: Submission | null): boolean {
  return submission !== null && (!submission.canSubmit || submission.lockedReason === 'GRADED');
}

export function getLockMessage(submission: Submission): string {
  if (submission.lockedReason === 'GRADED') {
    return 'Bài đã được chấm. Bạn không thể nộp lại.';
  }
  return 'Hiện tại bạn không thể nộp hoặc nộp lại bài này.';
}

export function listClasses(cursor?: string | null): Promise<Page<ClassSummary>> {
  return apiFetch(`/classes${pageQuery(cursor)}`);
}

export function listAssignments(
  classId: string,
  cursor?: string | null,
): Promise<Page<Assignment>> {
  return apiFetch(`/classes/${encodeURIComponent(classId)}/assignments${pageQuery(cursor)}`);
}

export function getAssignment(assignmentId: string): Promise<Assignment> {
  return apiFetch(`/assignments/${encodeURIComponent(assignmentId)}`);
}

export function createAssignment(
  classId: string,
  assignment: {
    title: string;
    description: string | null;
    deadlineAt: string;
    maxScore: number;
    fileIds: string[];
  },
): Promise<Assignment> {
  return apiFetch(`/classes/${encodeURIComponent(classId)}/assignments`, {
    method: 'POST',
    body: JSON.stringify(assignment),
  });
}

export function updateAssignment(
  assignmentId: string,
  assignment: {
    title: string;
    description: string | null;
    deadlineAt: string;
    maxScore: number;
    fileIds: string[];
  },
): Promise<Assignment> {
  return apiFetch(`/assignments/${encodeURIComponent(assignmentId)}`, {
    method: 'PATCH',
    body: JSON.stringify(assignment),
  });
}

export function uploadFile(file: File): Promise<FileRecord> {
  const body = new FormData();
  body.set('file', file);
  return apiFetch('/files', { method: 'POST', body });
}

export async function downloadFile(file: FileRecord): Promise<void> {
  const blob = await apiFetchBlob(`/files/${encodeURIComponent(file.id)}/download`);
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = file.originalName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

export function listAssignmentSubmissions(
  assignmentId: string,
  cursor?: string | null,
): Promise<Page<Submission>> {
  return apiFetch<unknown>(`/assignments/${encodeURIComponent(assignmentId)}/submissions${pageQuery(cursor)}`)
    .then(parseSubmissionPage);
}

export function listEnrollments(
  classId: string,
  cursor?: string | null,
): Promise<Page<Enrollment>> {
  return apiFetch(`/classes/${encodeURIComponent(classId)}/enrollments${pageQuery(cursor)}`);
}

export async function getMySubmission(assignmentId: string): Promise<Submission | null> {
  try {
    return await apiFetch(`/assignments/${encodeURIComponent(assignmentId)}/my-submission`);
  } catch (error: unknown) {
    if (error instanceof ApiClientError && error.status === 404) return null;
    throw error;
  }
}

export async function getMyPublishedResult(assignmentId: string): Promise<PublishedResult | null> {
  try {
    return await apiFetch(`/assignments/${encodeURIComponent(assignmentId)}/my-result`);
  } catch (error: unknown) {
    if (error instanceof ApiClientError && error.status === 404) return null;
    throw error;
  }
}

export function submitAssignment(assignmentId: string, fileIds: string[]): Promise<Submission> {
  return apiFetch(`/assignments/${encodeURIComponent(assignmentId)}/submissions`, {
    method: 'POST',
    body: JSON.stringify({ fileIds }),
  });
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function toDateTimeInput(value: string): string {
  const date = new Date(value);
  const offsetMinutes = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offsetMinutes * 60_000);
  return localDate.toISOString().slice(0, 16);
}
