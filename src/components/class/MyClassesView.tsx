import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildClassMeta, loadMyClassCards, type ClassCard, type ClassViewerRole } from '../../lib/classes';
import { AssignmentHeader, EmptyState, ErrorState, LoadingState } from '../assignment/AssignmentUI';

const defaultDescription = 'Tài liệu, bài tập và kết quả của lớp được tổng hợp tại đây.';

export default function MyClassesView({ role }: { role: ClassViewerRole }) {
  const basePath = role === 'TEACHER' ? '/teacher' : '/student';
  const [cards, setCards] = useState<ClassCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const currentTermLabel = cards[0]?.termLabel;

  return (
    <section className="assignment-page">
      <AssignmentHeader title="Lớp học của tôi" subtitle={currentTermLabel} />

      {error && <ErrorState message={error} onRetry={() => setRefreshKey((value) => value + 1)} />}
      {loading && <LoadingState label="Đang tải lớp học…" />}
      {!loading && !error && cards.length === 0 && (
        <EmptyState
          title={role === 'TEACHER' ? 'Bạn chưa được phân công lớp nào.' : 'Bạn chưa được xếp vào lớp học nào.'}
        />
      )}
      {!loading && !error && cards.length > 0 && (
        <div className="assignment-card-list">
          {cards.map((card) => (
            <article className="assignment-card class-card" key={card.id}>
              <div className="assignment-card-main">
                <span className="status-badge status-badge--success">Đang học</span>
                <h2>{card.name}</h2>
                <p className="assignment-muted">
                  {buildClassMeta(card)}
                  {card.termLabel !== currentTermLabel && ` · ${card.termLabel}`}
                </p>
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
      )}
    </section>
  );
}
