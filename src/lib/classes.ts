import { apiFetch } from './apiClient';
import { listClasses, listEnrollments, type ClassSummary, type Enrollment, type Page } from './assignments';
import type { User } from './types';

export type ClassViewerRole = 'TEACHER' | 'STUDENT';

export interface ClassCard {
  id: string;
  name: string;
  courseCode: string;
  code: string;
  term: string;
  termLabel: string;
  description: string | null;
  teacherNames: string[];
  studentCount: number | null;
}

const termPattern = /^(\d{4})-HK(\d)$/;

export function formatTermLabel(term: string): string {
  const match = termPattern.exec(term);
  if (!match) return term;
  const startYear = Number(match[1]);
  return `Học kỳ ${match[2]} · ${startYear}–${startYear + 1}`;
}

export function listClassTeachers(classId: string): Promise<Page<User>> {
  return apiFetch(`/classes/${encodeURIComponent(classId)}/teachers`);
}

export async function countActiveStudents(classId: string): Promise<number> {
  let count = 0;
  let cursor: string | null = null;
  do {
    const page: Page<Enrollment> = await listEnrollments(classId, cursor);
    count += page.items.filter((enrollment) => enrollment.isActive).length;
    cursor = page.page.nextCursor;
  } while (cursor);
  return count;
}

export async function listAllClasses(): Promise<ClassSummary[]> {
  const classes: ClassSummary[] = [];
  let cursor: string | null = null;
  do {
    const page: Page<ClassSummary> = await listClasses(cursor);
    classes.push(...page.items);
    cursor = page.page.nextCursor;
  } while (cursor);
  return classes;
}

async function toClassCard(classItem: ClassSummary, role: ClassViewerRole): Promise<ClassCard> {
  const [teachers, studentCount] = await Promise.allSettled([
    listClassTeachers(classItem.id),
    role === 'TEACHER' ? countActiveStudents(classItem.id) : Promise.resolve(null),
  ]);
  return {
    id: classItem.id,
    name: classItem.name,
    courseCode: classItem.courseCode,
    code: classItem.code,
    term: classItem.term,
    termLabel: formatTermLabel(classItem.term),
    description: classItem.description ?? null,
    teacherNames: teachers.status === 'fulfilled' ? teachers.value.items.map((teacher) => teacher.fullName) : [],
    studentCount: studentCount.status === 'fulfilled' ? studentCount.value : null,
  };
}

export async function loadMyClassCards(role: ClassViewerRole): Promise<ClassCard[]> {
  const classes = await listAllClasses();
  const cards = await Promise.all(classes.map((classItem) => toClassCard(classItem, role)));
  return cards.sort((a, b) => b.term.localeCompare(a.term) || a.name.localeCompare(b.name, 'vi'));
}

export function buildClassMeta(card: ClassCard): string {
  const parts = [card.courseCode, card.code].filter(Boolean);
  if (card.studentCount !== null) parts.push(`${card.studentCount} sinh viên`);
  if (card.teacherNames.length > 0) parts.push(`Giảng viên ${card.teacherNames.join(', ')}`);
  return parts.join(' · ');
}

export interface ClassCardFilters {
  query: string;
  term: string;
  teacher: string;
}

export type ClassCardSort = 'name' | 'courseCode' | 'code';

export interface ClassTermGroup {
  term: string;
  termLabel: string;
  cards: ClassCard[];
}

const normalize = (text: string) => text.toLocaleLowerCase('vi');

export function filterClassCards(cards: ClassCard[], { query, term, teacher }: ClassCardFilters): ClassCard[] {
  const keyword = normalize(query.trim());
  return cards.filter((card) => {
    if (term && card.term !== term) return false;
    if (teacher && !card.teacherNames.includes(teacher)) return false;
    if (!keyword) return true;
    return normalize(`${card.name} ${card.courseCode} ${card.code} ${card.teacherNames.join(' ')}`).includes(keyword);
  });
}

export function sortClassCards(cards: ClassCard[], sortKey: ClassCardSort): ClassCard[] {
  return [...cards].sort((a, b) => a[sortKey].localeCompare(b[sortKey], 'vi') || a.name.localeCompare(b.name, 'vi'));
}

export function groupClassCardsByTerm(cards: ClassCard[]): ClassTermGroup[] {
  const groups = new Map<string, ClassCard[]>();
  for (const card of cards) groups.set(card.term, [...(groups.get(card.term) ?? []), card]);
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([term, groupCards]) => ({ term, termLabel: formatTermLabel(term), cards: groupCards }));
}

export function listTerms(cards: ClassCard[]): string[] {
  return [...new Set(cards.map((card) => card.term))].sort((a, b) => b.localeCompare(a));
}

export function listTeacherNames(cards: ClassCard[]): string[] {
  return [...new Set(cards.flatMap((card) => card.teacherNames))].sort((a, b) => a.localeCompare(b, 'vi'));
}
