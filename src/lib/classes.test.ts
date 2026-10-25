import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildClassMeta,
  filterClassCards,
  formatTermLabel,
  groupClassCardsByTerm,
  listTeacherNames,
  listTerms,
  loadMyClassCards,
  sortClassCards,
  type ClassCard,
} from './classes';

afterEach(() => vi.unstubAllGlobals());

const classItem = {
  id: 'class-1',
  code: 'L01',
  courseCode: 'CO2013',
  name: 'Cơ sở dữ liệu',
  term: '2026-HK1',
  description: null,
  createdAt: '2026-10-20T09:00:00Z',
};

const teacher = {
  id: 'teacher-1',
  schoolCode: 'GV001',
  fullName: 'Trần Minh',
  email: null,
  role: 'TEACHER',
  isActive: true,
  createdAt: '2026-10-20T09:00:00Z',
};

function enrollment(id: string, isActive: boolean) {
  return {
    id,
    classId: 'class-1',
    student: { id: `student-${id}`, schoolCode: 'SV001', fullName: 'Sinh viên', role: 'STUDENT' },
    isActive,
    createdAt: '2026-10-20T09:00:00Z',
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function stubApi(routes: (url: string) => Response) {
  vi.stubGlobal('localStorage', { getItem: () => null });
  const fetchMock = vi.fn((input: string) => Promise.resolve(routes(input)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('term label', () => {
  it('formats a semester code as a school-year label', () => {
    expect(formatTermLabel('2026-HK1')).toBe('Học kỳ 1 · 2026–2027');
    expect(formatTermLabel('2026-HK2')).toBe('Học kỳ 2 · 2026–2027');
  });

  it('keeps an unrecognised term code unchanged', () => {
    expect(formatTermLabel('Fall 2026')).toBe('Fall 2026');
  });
});

describe('class dashboard data', () => {
  it('counts active students across enrollment pages for a teacher', async () => {
    stubApi((url) => {
      if (url.includes('/enrollments') && url.includes('cursor=next')) {
        return json({ items: [enrollment('3', true), enrollment('4', false)], page: { nextCursor: null } });
      }
      if (url.includes('/enrollments')) {
        return json({ items: [enrollment('1', true), enrollment('2', true)], page: { nextCursor: 'next' } });
      }
      if (url.includes('/teachers')) return json({ items: [teacher], page: { nextCursor: null } });
      return json({ items: [classItem], page: { nextCursor: null } });
    });

    const [card] = await loadMyClassCards('TEACHER');

    expect(card).toMatchObject({
      name: 'Cơ sở dữ liệu',
      termLabel: 'Học kỳ 1 · 2026–2027',
      teacherNames: ['Trần Minh'],
      studentCount: 3,
    });
  });

  it('never requests the teacher-only enrollment list for a student', async () => {
    const fetchMock = stubApi((url) => {
      if (url.includes('/teachers')) return json({ items: [teacher], page: { nextCursor: null } });
      return json({ items: [classItem], page: { nextCursor: null } });
    });

    const [card] = await loadMyClassCards('STUDENT');

    expect(card?.studentCount).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => url.includes('/enrollments'))).toBe(false);
  });

  it('keeps the class card when its teacher list cannot be loaded', async () => {
    stubApi((url) => {
      if (url.includes('/teachers')) {
        return json({ error: { code: 'FORBIDDEN', message: 'Access is denied.' } }, 403);
      }
      return json({ items: [classItem], page: { nextCursor: null } });
    });

    const cards = await loadMyClassCards('STUDENT');

    expect(cards).toHaveLength(1);
    expect(cards[0]?.teacherNames).toEqual([]);
  });

  it('fails the whole dashboard when the class list cannot be loaded', async () => {
    stubApi(() => json({ error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' } }, 401));

    await expect(loadMyClassCards('STUDENT')).rejects.toThrow('Authentication is required.');
  });

  it('lists the newest term first', async () => {
    stubApi((url) => {
      if (url.includes('/teachers')) return json({ items: [], page: { nextCursor: null } });
      return json({
        items: [
          { ...classItem, id: 'old', name: 'Lập trình', term: '2025-HK2' },
          { ...classItem, id: 'new', term: '2026-HK1' },
        ],
        page: { nextCursor: null },
      });
    });

    const cards = await loadMyClassCards('STUDENT');

    expect(cards.map((card) => card.id)).toEqual(['new', 'old']);
  });
});

function makeCard(overrides: Partial<ClassCard>): ClassCard {
  return {
    id: 'class-1',
    name: 'Cơ sở dữ liệu',
    courseCode: 'CO2013',
    code: 'L01',
    term: '2026-HK1',
    termLabel: 'Học kỳ 1 · 2026–2027',
    description: null,
    teacherNames: ['Trần Minh'],
    studentCount: 32,
    ...overrides,
  };
}

describe('class meta line', () => {
  const card = makeCard({});

  it('joins course code, section, student count and teachers', () => {
    expect(buildClassMeta(card)).toBe('CO2013 · L01 · 32 sinh viên · Giảng viên Trần Minh');
  });

  it('omits the parts the API did not provide', () => {
    expect(buildClassMeta({ ...card, studentCount: null })).toBe('CO2013 · L01 · Giảng viên Trần Minh');
    expect(buildClassMeta({ ...card, studentCount: null, teacherNames: [] })).toBe('CO2013 · L01');
  });
});

describe('class list search, filters and grouping', () => {
  const database = makeCard({ id: 'db' });
  const networks = makeCard({
    id: 'net', name: 'Mạng máy tính', courseCode: 'CO3093', code: 'L02', teacherNames: ['Lê Hoa'],
  });
  const oldCourse = makeCard({
    id: 'old', name: 'Giải tích', courseCode: 'MT1003', code: 'L05', term: '2025-HK2',
    termLabel: 'Học kỳ 2 · 2025–2026', teacherNames: ['Trần Minh', 'Phạm Lan'],
  });
  const cards = [database, networks, oldCourse];
  const noFilter = { query: '', term: '', teacher: '' };

  it('searches course name, course code, section and teacher name case-insensitively', () => {
    const ids = (query: string) => filterClassCards(cards, { ...noFilter, query }).map((card) => card.id);
    expect(ids('co2013')).toEqual(['db']);
    expect(ids('MẠNG')).toEqual(['net']);
    expect(ids('l05')).toEqual(['old']);
    expect(ids('phạm lan')).toEqual(['old']);
  });

  it('filters by term and by teacher', () => {
    expect(filterClassCards(cards, { ...noFilter, term: '2025-HK2' }).map((card) => card.id)).toEqual(['old']);
    expect(filterClassCards(cards, { ...noFilter, teacher: 'Trần Minh' }).map((card) => card.id)).toEqual(['db', 'old']);
  });

  it('sorts by course name, course code or section', () => {
    expect(sortClassCards(cards, 'name').map((card) => card.id)).toEqual(['db', 'old', 'net']);
    expect(sortClassCards(cards, 'courseCode').map((card) => card.id)).toEqual(['db', 'net', 'old']);
    expect(sortClassCards(cards, 'code').map((card) => card.id)).toEqual(['db', 'net', 'old']);
  });

  it('groups cards by term with the newest term first', () => {
    const groups = groupClassCardsByTerm(cards);
    expect(groups.map((group) => [group.term, group.cards.map((card) => card.id)])).toEqual([
      ['2026-HK1', ['db', 'net']],
      ['2025-HK2', ['old']],
    ]);
    expect(groups[1]?.termLabel).toBe('Học kỳ 2 · 2025–2026');
  });

  it('lists distinct terms and teacher names for the filter options', () => {
    expect(listTerms(cards)).toEqual(['2026-HK1', '2025-HK2']);
    expect(listTeacherNames(cards)).toEqual(['Lê Hoa', 'Phạm Lan', 'Trần Minh']);
  });
});
