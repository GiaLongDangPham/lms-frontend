import { ApiClientError, apiFetch } from './apiClient';
import { listEnrollments, type ClassSummary, type Enrollment, type Page } from './assignments';
import type { Role, User } from './types';

export type ManagedRole = Exclude<Role, 'ADMIN'>;

export interface ClassInput {
  courseCode: string;
  name: string;
  code: string;
  term: string;
  description: string | null;
}

export interface NewUserInput {
  schoolCode: string;
  fullName: string;
  email: string | null;
  role: ManagedRole;
  initialPassword: string;
}

export interface UserUpdate {
  fullName?: string;
  email?: string | null;
  isActive?: boolean;
}

const json = (method: string, body?: unknown) => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

async function collectPages<T>(fetchPage: (cursor: string | null) => Promise<Page<T>>): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  do {
    const page: Page<T> = await fetchPage(cursor);
    items.push(...page.items);
    cursor = page.page.nextCursor;
  } while (cursor);
  return items;
}

export function listAllUsers(role?: Role): Promise<User[]> {
  return collectPages((cursor) => {
    const params = new URLSearchParams({ limit: '100' });
    if (role) params.set('role', role);
    if (cursor) params.set('cursor', cursor);
    return apiFetch<Page<User>>(`/users?${params.toString()}`);
  });
}

export function getUser(userId: string): Promise<User> {
  return apiFetch(`/users/${encodeURIComponent(userId)}`);
}

export function createUser(input: NewUserInput): Promise<User> {
  return apiFetch('/users', json('POST', input));
}

export function updateUser(userId: string, update: UserUpdate): Promise<User> {
  return apiFetch(`/users/${encodeURIComponent(userId)}`, json('PATCH', update));
}

export function resetPassword(userId: string, initialPassword: string): Promise<void> {
  return apiFetch(`/users/${encodeURIComponent(userId)}/reset-password`, json('POST', { initialPassword }));
}

export function getClass(classId: string): Promise<ClassSummary> {
  return apiFetch(`/classes/${encodeURIComponent(classId)}`);
}

export function createClass(input: ClassInput): Promise<ClassSummary> {
  return apiFetch('/classes', json('POST', input));
}

export function updateClass(classId: string, input: ClassInput): Promise<ClassSummary> {
  return apiFetch(`/classes/${encodeURIComponent(classId)}`, json('PATCH', input));
}

export function listAllEnrollments(classId: string): Promise<Enrollment[]> {
  return collectPages((cursor) => listEnrollments(classId, cursor));
}

export function assignTeacher(classId: string, teacherId: string): Promise<unknown> {
  return apiFetch(`/classes/${encodeURIComponent(classId)}/teachers`, json('POST', { teacherId }));
}

export function removeTeacher(classId: string, teacherId: string): Promise<void> {
  return apiFetch(
    `/classes/${encodeURIComponent(classId)}/teachers/${encodeURIComponent(teacherId)}`,
    json('DELETE'),
  );
}

export function enrollStudent(classId: string, studentId: string): Promise<Enrollment> {
  return apiFetch(`/classes/${encodeURIComponent(classId)}/enrollments`, json('POST', { studentId }));
}

export function setEnrollmentActive(classId: string, enrollmentId: string, isActive: boolean): Promise<Enrollment> {
  return apiFetch(
    `/classes/${encodeURIComponent(classId)}/enrollments/${encodeURIComponent(enrollmentId)}`,
    json('PATCH', { isActive }),
  );
}

export const semesters = [1, 2, 3] as const;
export type Semester = (typeof semesters)[number];

export function buildTerm(startYear: number, semester: Semester): string {
  return `${startYear}-HK${semester}`;
}

export function parseTerm(term: string): { startYear: number; semester: Semester } | null {
  const match = /^(\d{4})-HK([1-3])$/.exec(term);
  if (!match) return null;
  return { startYear: Number(match[1]), semester: Number(match[2]) as Semester };
}

export function parseSchoolCodes(text: string): string[] {
  const codes = text.split(/[\s,;]+/).map((code) => code.trim().toUpperCase()).filter(Boolean);
  return [...new Set(codes)];
}

export type StudentCodeStatus = 'ADD' | 'REACTIVATE' | 'ALREADY_ENROLLED' | 'INACTIVE_ACCOUNT' | 'NOT_FOUND';

export interface StudentCodeCheck {
  code: string;
  status: StudentCodeStatus;
  student?: User;
}

export function classifyStudentCodes(
  codes: string[],
  students: User[],
  enrollments: Enrollment[],
): StudentCodeCheck[] {
  const studentsByCode = new Map(students.map((student) => [student.schoolCode.toUpperCase(), student]));
  return codes.map((code) => {
    const student = studentsByCode.get(code);
    if (!student) return { code, status: 'NOT_FOUND' };
    const enrollment = enrollments.find((item) => item.student.id === student.id);
    if (enrollment?.isActive) return { code, status: 'ALREADY_ENROLLED', student };
    if (!student.isActive) return { code, status: 'INACTIVE_ACCOUNT', student };
    return { code, status: enrollment ? 'REACTIVATE' : 'ADD', student };
  });
}

export function adminErrorMessage(error: unknown, conflictMessage?: string): string {
  if (error instanceof ApiClientError) {
    if (error.status === 409) return conflictMessage ?? 'Dữ liệu bị trùng hoặc xung đột với dữ liệu hiện có.';
    if (error.code === 'INVALID_MEMBER') return 'Tài khoản đã bị khoá hoặc không đúng vai trò.';
    if (error.code === 'INVALID_CURRENT_PASSWORD') return 'Mật khẩu hiện tại không đúng.';
    if (error.code === 'VALIDATION_ERROR') return 'Dữ liệu chưa hợp lệ. Kiểm tra lại các trường đã nhập.';
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (error.status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
    if (error.status === 404) return 'Không tìm thấy dữ liệu; có thể nó đã bị thay đổi. Hãy tải lại trang.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'Đã có lỗi xảy ra.';
}
