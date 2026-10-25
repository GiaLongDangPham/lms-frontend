import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  type ClassCardSort,
  type ClassViewerRole,
} from '../../lib/classes';
import { AssignmentHeader, EmptyState, ErrorState, LoadingState } from '../assignment/AssignmentUI';

const defaultDescription = 'Tài liệu, bài tập và kết quả của lớp được tổng hợp tại đây.';

const sortOptions: { value: ClassCardSort; label: string }[] = [
  { value: 'name', label: 'Tên môn (A–Z)' },
  { value: 'courseCode', label: 'Mã môn' },
  { value: 'code', label: 'Mã lớp' },
];

export default function MyClassesView({ role }: { role: ClassViewerRole }) {
  const basePath = role === 'TEACHER' ? '/teacher' : '/student';
  const [cards, setCards] = useState<ClassCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState('');
  const [termChoice, setTermChoice] = useState<string | null>(null);
  const [teacherFilter, setTeacherFilter] = useState('');
  const [sortKey, setSortKey] = useState<ClassCardSort>('name');

  useEffect(() => {
    let cancelled = false;

    async function loadCards() {
      setLoading(true);
      setError(null);
      try {
        const result = await loadMyClassCards(role);
        if (!cancelled) setCards(result);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được danh sách lớp học.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCards();
    return () => {
      cancelled = true;
    };
  }, [role, refreshKey]);

  const terms = useMemo(() => listTerms(cards), [cards]);
  const teacherNames = useMemo(() => listTeacherNames(cards), [cards]);
  const termFilter = termChoice ?? terms[0] ?? '';
  const groups = useMemo(
    () => groupClassCardsByTerm(sortClassCards(
      filterClassCards(cards, { query, term: termFilter, teacher: role === 'STUDENT' ? teacherFilter : '' }),
      sortKey,
    )),
    [cards, query, termFilter, teacherFilter, sortKey, role],
  );
  const visibleCount = groups.reduce((total, group) => total + group.cards.length, 0);

  function clearFilters() {
    setQuery('');
    setTeacherFilter('');
    setTermChoice('');
  }

  const subtitle = loading
    ? undefined
    : `${termFilter ? formatTermLabel(termFilter) : 'Tất cả học kỳ'} · ${visibleCount} lớp`;

  return (
    <section className="assignment-page">
      <AssignmentHeader title="Lớp học của tôi" subtitle={subtitle} />

      {!loading && !error && cards.length > 0 && (
        <div className="assignment-filters">
          <label className="assignment-filter">
            <span>Tìm lớp</span>
            <input
              className="form-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tên môn, mã môn, mã lớp hoặc giảng viên"
            />
          </label>
          <label className="assignment-filter">
            <span>Học kỳ</span>
            <select className="form-input" value={termFilter} onChange={(event) => setTermChoice(event.target.value)}>
              <option value="">Tất cả học kỳ</option>
              {terms.map((term) => (
                <option key={term} value={term}>{formatTermLabel(term)}</option>
              ))}
            </select>
          </label>
          {role === 'STUDENT' && (
            <label className="assignment-filter">
              <span>Giảng viên</span>
              <select className="form-input" value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)}>
                <option value="">Tất cả giảng viên</option>
                {teacherNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="assignment-filter">
            <span>Sắp xếp</span>
            <select className="form-input" value={sortKey} onChange={(event) => setSortKey(event.target.value as ClassCardSort)}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={() => setRefreshKey((value) => value + 1)} />}
      {loading && <LoadingState label="Đang tải lớp học…" />}
      {!loading && !error && cards.length === 0 && (
        <EmptyState
          title={role === 'TEACHER' ? 'Bạn chưa được phân công lớp nào.' : 'Bạn chưa được xếp vào lớp học nào.'}
        />
      )}
      {!loading && !error && cards.length > 0 && visibleCount === 0 && (
        <EmptyState title="Không tìm thấy lớp phù hợp.">
          <button type="button" className="btn btn--secondary" onClick={clearFilters}>Xoá bộ lọc</button>
        </EmptyState>
      )}
      {!loading && !error && groups.map((group, index) => (
        <section key={group.term} className="class-term-group" aria-labelledby={`class-term-${index}`}>
          <h2
            id={`class-term-${index}`}
            className={groups.length > 1 ? 'class-term-heading' : 'visually-hidden'}
          >
            {group.termLabel} · {group.cards.length} lớp
          </h2>
          <div className="assignment-card-list">
            {group.cards.map((card) => (
              <article className="assignment-card class-card" key={card.id}>
                <div className="assignment-card-main">
                  <span className="status-badge status-badge--success">Đang học</span>
                  <h3>{card.name}</h3>
                  <p className="assignment-muted">{buildClassMeta(card)}</p>
                  <p>{card.description ?? defaultDescription}</p>
                  <div className="assignment-card-actions">
                    <Link
                      className="btn btn--primary"
                      to={`${basePath}/assignments?classId=${encodeURIComponent(card.id)}`}
                    >
                      Xem bài tập
                    </Link>
                    <Link
                      className="btn btn--secondary"
                      to={`${basePath}/materials?classId=${encodeURIComponent(card.id)}`}
                    >
                      Xem tài liệu
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
