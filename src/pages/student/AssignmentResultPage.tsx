import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  formatDateTime,
  getAssignment,
  getMyPublishedResult,
  type Assignment,
  type PublishedResult,
} from '../../lib/assignments';
import {
  getMyPublishedGradeHistory,
  type GradeHistory,
} from '../../lib/grades';
import {
  AssignmentHeader,
  ErrorState,
  LoadingState,
} from '../../components/assignment/AssignmentUI';

export default function AssignmentResultPage() {
  const { assignmentId = '' } = useParams();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [result, setResult] = useState<PublishedResult | null>(null);
  const [history, setHistory] = useState<GradeHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadResult() {
      setLoading(true);
      setError(null);
      try {
        const [loadedAssignment, loadedResult, loadedHistory] = await Promise.all([
          getAssignment(assignmentId),
          getMyPublishedResult(assignmentId),
          getMyPublishedGradeHistory(assignmentId),
        ]);
        if (cancelled) return;
        setAssignment(loadedAssignment);
        setResult(loadedResult);
        setHistory(loadedHistory);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được kết quả bài tập.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadResult();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  if (loading) return <LoadingState label="Đang tải kết quả…" />;
  if (error || !assignment) return <ErrorState message={error ?? 'Không tìm thấy bài tập.'} />;

  const publishedHistory = history?.items.filter((item) => item.status === 'PUBLISHED') ?? [];

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title="Kết quả bài tập"
        subtitle={assignment.title}
        action={<Link className="btn btn--secondary" to={`/student/assignments/${assignmentId}`}>Quay lại bài tập</Link>}
      />

      {result ? (
        <section className="assignment-card assignment-result">
          <span className="status-badge status-badge--success">Đã công bố</span>
          <h2>{result.score} / {assignment.maxScore}</h2>
          <p>Thời gian công bố: {formatDateTime(result.publishedAt)}</p>
          {result.gradedBy && <p>Giảng viên chấm: {result.gradedBy.fullName}</p>}
          {result.source === 'AUTO_ZERO_NO_SUBMISSION' ? (
            <p>Kết quả 0 điểm được ghi nhận tự động vì bạn chưa nộp bài tại thời điểm công bố.</p>
          ) : (
            <>
              {result.feedback && <p><strong>Nhận xét:</strong> {result.feedback}</p>}
              <p>Phiên bản được chấm: #{result.gradedVersionNumber ?? '—'}</p>
            </>
          )}
        </section>
      ) : (
        <section className="assignment-notice">
          <strong>Kết quả chưa được công bố</strong>
          <p>Điểm và nhận xét sẽ hiển thị tại đây sau khi giảng viên công bố.</p>
        </section>
      )}

      {publishedHistory.length > 0 && (
        <section className="assignment-card">
          <h2>Lịch sử kết quả đã công bố</h2>
          <ol className="assignment-grade-history">
            {[...publishedHistory].sort((left, right) => left.version - right.version).map((entry, index) => (
              <li key={entry.version}>
                <strong>Lần {index + 1}: {entry.score} / {assignment.maxScore}</strong>
                <span>{formatDateTime(entry.changedAt)}</span>
                {entry.feedback && <p>{entry.feedback}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}
