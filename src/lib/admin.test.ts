import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assignTeacher,
  buildTerm,
  classifyStudentCodes,
  createClass,
  createUser,
  enrollStudent,
  listAllUsers,
  parseSchoolCodes,
  parseTerm,
  removeTeacher,
  resetPassword,
  setEnrollmentActive,
  updateClass,
  updateUser,
} from './admin';
import type { Enrollment } from './assignments';
import type { User } from './types';

afterEach(() => vi.unstubAllGlobals());

type FetchMock = ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

function stubFetch(routes: (url: string) => Response = () => new Response(null, { status: 204 })): FetchMock {
  vi.stubGlobal('localStorage', { getItem: () => null });
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    (url) => Promise.resolve(routes(url)),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: FetchMock) {
  const [url, init] = fetchMock.mock.calls.at(-1) ?? [];
  return { url, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) as unknown : undefined };
}

function user(schoolCode: string, overrides: Partial<User> = {}): User {
  return {
    id: `id-${schoolCode}`,
    schoolCode,
    fullName: `Tên ${schoolCode}`,
    email: null,
    role: 'STUDENT',
    isActive: true,
    createdAt: '2026-10-20T09:00:00Z',
    ...overrides,
  };
}

function enrollment(student: User, isActive: boolean): Enrollment {
  return {
    id: `enrollment-${student.schoolCode}`,
    classId: 'class-1',
    student: { id: student.id, schoolCode: student.schoolCode, fullName: student.fullName, role: 'STUDENT' },
    isActive,
    createdAt: '2026-10-20T09:00:00Z',
  };
}

describe('term codes', () => {
  it('builds and parses the school-year semester format', () => {
    expect(buildTerm(2026, 1)).toBe('2026-HK1');
    expect(parseTerm('2026-HK3')).toEqual({ startYear: 2026, semester: 3 });
  });

  it('rejects free-text terms', () => {
    expect(parseTerm('Fall 2026')).toBeNull();
    expect(parseTerm('2026-HK4')).toBeNull();
  });
});

describe('pasted student codes', () => {
  it('splits on new lines, commas and spaces, upper-cases and removes duplicates', () => {
    expect(parseSchoolCodes('sv001\nSV002, sv003 ;sv001\n\n')).toEqual(['SV001', 'SV002', 'SV003']);
  });

  it('classifies every pasted code against accounts and current enrollments', () => {
    const active = user('SV001');
    const withdrawn = user('SV002');
    const fresh = user('SV003');
    const locked = user('SV004', { isActive: false });
    const checks = classifyStudentCodes(
      ['SV001', 'SV002', 'SV003', 'SV004', 'SV999'],
      [active, withdrawn, fresh, locked],
      [enrollment(active, true), enrollment(withdrawn, false)],
    );

    expect(checks.map((check) => [check.code, check.status])).toEqual([
      ['SV001', 'ALREADY_ENROLLED'],
      ['SV002', 'REACTIVATE'],
      ['SV003', 'ADD'],
      ['SV004', 'INACTIVE_ACCOUNT'],
      ['SV999', 'NOT_FOUND'],
    ]);
  });
});

describe('admin API requests', () => {
  it('follows the cursor and keeps the role filter when listing users', async () => {
    const fetchMock = stubFetch((url) => new Response(JSON.stringify(url.includes('cursor=next')
      ? { items: [user('SV002')], page: { nextCursor: null } }
      : { items: [user('SV001')], page: { nextCursor: 'next' } })));

    const users = await listAllUsers('STUDENT');

    expect(users.map((item) => item.schoolCode)).toEqual(['SV001', 'SV002']);
    expect(fetchMock.mock.calls.every(([url]) => url.includes('role=STUDENT'))).toBe(true);
  });

  it('sends the documented method, path and body for account changes', async () => {
    const fetchMock = stubFetch(() => new Response(JSON.stringify(user('SV004'))));

    await createUser({ schoolCode: 'SV004', fullName: 'An', email: null, role: 'STUDENT', initialPassword: 'mat-khau-12-ky' });
    expect(lastCall(fetchMock)).toMatchObject({ method: 'POST', body: { schoolCode: 'SV004', initialPassword: 'mat-khau-12-ky' } });
    expect(lastCall(fetchMock).url).toMatch(/\/users$/);

    await updateUser('u-1', { isActive: false });
    expect(lastCall(fetchMock)).toMatchObject({ method: 'PATCH', body: { isActive: false } });
    expect(lastCall(fetchMock).url).toMatch(/\/users\/u-1$/);
  });

  it('resets a password with the admin-chosen initial password', async () => {
    const fetchMock = stubFetch();

    await resetPassword('u-1', 'mat-khau-moi-12');

    expect(lastCall(fetchMock)).toMatchObject({ method: 'POST', body: { initialPassword: 'mat-khau-moi-12' } });
    expect(lastCall(fetchMock).url).toMatch(/\/users\/u-1\/reset-password$/);
  });

  it('creates and updates classes', async () => {
    const fetchMock = stubFetch(() => new Response(JSON.stringify({ id: 'class-1' })));
    const input = { courseCode: 'CO2013', name: 'Cơ sở dữ liệu', code: 'L01', term: '2026-HK1', description: null };

    await createClass(input);
    expect(lastCall(fetchMock)).toMatchObject({ method: 'POST', body: input });
    expect(lastCall(fetchMock).url).toMatch(/\/classes$/);

    await updateClass('class-1', input);
    expect(lastCall(fetchMock)).toMatchObject({ method: 'PATCH', body: input });
    expect(lastCall(fetchMock).url).toMatch(/\/classes\/class-1$/);
  });

  it('assigns and removes teachers, enrolls and withdraws students', async () => {
    const fetchMock = stubFetch((url) => (url.includes('/teachers/') ? new Response(null, { status: 204 }) : new Response('{}')));

    await assignTeacher('class-1', 't-1');
    expect(lastCall(fetchMock)).toMatchObject({ method: 'POST', body: { teacherId: 't-1' } });

    await removeTeacher('class-1', 't-1');
    expect(lastCall(fetchMock)).toMatchObject({ method: 'DELETE', body: undefined });
    expect(lastCall(fetchMock).url).toMatch(/\/classes\/class-1\/teachers\/t-1$/);

    await enrollStudent('class-1', 's-1');
    expect(lastCall(fetchMock)).toMatchObject({ method: 'POST', body: { studentId: 's-1' } });

    await setEnrollmentActive('class-1', 'e-1', false);
    expect(lastCall(fetchMock)).toMatchObject({ method: 'PATCH', body: { isActive: false } });
    expect(lastCall(fetchMock).url).toMatch(/\/classes\/class-1\/enrollments\/e-1$/);
  });
});
