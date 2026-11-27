import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { ClassSummary } from '../../lib/assignments';
import { countActiveStudents, formatTermLabel, listAllClasses, listClassTeachers } from '../../lib/classes';
import { noticeFrom } from '../../lib/notice';
import {
  AssignmentHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  SuccessNotice,
} from '../../components/assignment/AssignmentUI';

interface MemberCounts {
  teachers: number | null;
  students: number | null;
}

async function loadMemberCounts(classId: string): Promise<MemberCounts> {
  const [teachers, students] = await Promise.allSettled([listClassTeachers(classId), countActiveStudents(classId)]);
  return {
    teachers: teachers.status === 'fulfilled' ? teachers.value.items.length : null,
    students: students.status === 'fulfilled' ? students.value : null,
  };
}

function countLabel(counts: MemberCounts | undefined, key: keyof MemberCounts): string {
  if (!counts) return '…';
  return counts[key] === null ? '—' : String(counts[key]);
}

export default function AdminClassesPage() {
  const location = useLocation();
  const notice = noticeFrom(location.state);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [counts, setCounts] = useState<Record<string, MemberCounts>>({});
  const [query, setQuery] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadClasses() {
      setLoading(true);
      setError(null);
      setCounts({});
      try {
        const result = await listAllClasses();
        if (cancelled) return;
        setClasses(result.sort((a, b) => b.term.localeCompare(a.term)
          || a.courseCode.localeCompare(b.courseCode)
          || a.code.localeCompare(b.code)));
        setLoading(false);
        const entries = await Promise.all(result.map(async (item) => [item.id, await loadMemberCounts(item.id)] as const));
        if (!cancelled) setCounts(Object.fromEntries(entries));
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được danh sách lớp.');
          setLoading(false);
        }
      }
    }

    void loadClasses();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const terms = useMemo(
    () => [...new Set(classes.map((item) => item.term))].sort((a, b) => b.localeCompare(a)),
    [classes],
  );

  const filteredClasses = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi');
    return classes.filter((item) => {
      const matchesTerm = !termFilter || item.term === termFilter;
      const haystack = `${item.courseCode} ${item.name} ${item.code}`.toLocaleLowerCase('vi');
      return matchesTerm && (!keyword || haystack.includes(keyword));
    });
  }, [classes, query, termFilter]);

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title="Lớp học"
        subtitle={loading ? 'Đang tải…' : `${filteredClasses.length}/${classes.length} lớp`}
        action={<Link className="btn btn--primary" to="/admin/classes/new">Tạo lớp</Link>}
      />

      {notice && <SuccessNotice message={notice} />}

      <div className="assignment-filters">
        <label className="assignment-filter">
          <span>Tìm lớp</span>
          <input
            className="form-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Mã môn, tên môn hoặc mã lớp"
          />
        </label>
        <label className="assignment-filter">
          <span>Học kỳ</span>
          <select className="form-input" value={termFilter} onChange={(event) => setTermFilter(event.target.value)}>
            <option value="">Tất cả học kỳ</option>
            {terms.map((term) => (
              <option key={term} value={term}>{formatTermLabel(term)}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <ErrorState message={error} onRetry={() => setRefreshKey((value) => value + 1)} />}
      {loading && <LoadingState label="Đang tải danh sách lớp…" />}
      {!loading && !error && classes.length === 0 && (
        <EmptyState title="Chưa có lớp học nào.">
          <Link className="btn btn--primary" to="/admin/classes/new">Tạo lớp đầu tiên</Link>
        </EmptyState>
      )}
      {!loading && !error && classes.length > 0 && filteredClasses.length === 0 && (
        <EmptyState title="Không tìm thấy lớp phù hợp." />
      )}
      {!loading && !error && filteredClasses.length > 0 && (
        <div className="assignment-table-wrap">
          <table className="assignment-table">
            <thead>
              <tr>
                <th scope="col">Mã môn</th>
                <th scope="col">Tên môn</th>
                <th scope="col">Mã lớp</th>
                <th scope="col">Học kỳ</th>
                <th scope="col">GV</th>
                <th scope="col">SV</th>
                <th scope="col"><span className="visually-hidden">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredClasses.map((item) => (
                <tr key={item.id}>
                  <td>{item.courseCode}</td>
                  <td>{item.name}</td>
                  <td>{item.code}</td>
                  <td>{formatTermLabel(item.term)}</td>
                  <td>{countLabel(counts[item.id], 'teachers')}</td>
                  <td>{countLabel(counts[item.id], 'students')}</td>
                  <td>
                    <Link className="btn btn--secondary btn--sm" to={`/admin/classes/${item.id}`}>Xem</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
