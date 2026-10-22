import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  formatDateTime,
  getAssignment,
  getMySubmission,
  isSubmissionLocked,
  type Assignment,
  type Submission,
} from '../../lib/assignments';
import {
  AssignmentHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  SubmissionStatus,
} from '../../components/assignment/AssignmentUI';

export default function SubmissionHistoryPage() {
  const { assignmentId = '' } = useParams();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setError(null);
      try {
        const [loadedAssignment, loadedSubmission] = await Promise.all([
          getAssignment(assignmentId),
          getMySubmission(assignmentId),
        ]);
        if (cancelled) return;
        setAssignment(loadedAssignment);
        setSubmission(loadedSubmission);
      } catch (loadError: unknown) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Không tải được lịch sử nộp.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  if (loading) return <LoadingState label="Đang tải lịch sử nộp…" />;
  if (error || !assignment) return <ErrorState message={error ?? 'Không tìm thấy bài tập.'} />;

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title="Lịch sử nộp bài"
        subtitle={`${assignment.title} / ${submission ? 'Bài nộp của tôi' : 'Chưa có bài nộp'}`}
      />

      {!submission || submission.versions.length === 0 ? (
        <EmptyState title="Chưa có lần nộp nào">
          <p>Các lần nộp thành công sẽ xuất hiện tại đây cùng thời gian và tệp đính kèm.</p>
          <Link className="btn btn--primary" to={`/student/assignments/${assignment.id}/submit`}>Nộp bài</Link>
          <Link className="btn btn--secondary" to={`/student/assignments/${assignment.id}`}>Về bài tập</Link>
        </EmptyState>
      ) : (
        <>
          <section className="assignment-notice">
            <strong>{submission.versions.length} lần nộp · Lần #{submission.currentVersionNumber} là bản hiện hành</strong>
            <p>Xem lại thời gian nộp, trạng thái và các tệp đã gửi trong từng lần.</p>
          </section>
          <div className="assignment-card-list">
            {[...submission.versions].sort((a, b) => b.versionNumber - a.versionNumber).map((version) => (
              <article className="assignment-card assignment-history-card" key={version.versionNumber}>
                <div className="assignment-card-main">
                  <h2>Lần nộp #{version.versionNumber}</h2>
                  <p>{formatDateTime(version.submittedAt)}</p>
                  <SubmissionStatus
                    isLate={version.isLate}
                    current={version.versionNumber === submission.currentVersionNumber}
                  />
                  <p>{version.files.length} tệp · {version.files.map((file) => file.originalName).join(' và ') || 'Không có tệp'}</p>
                </div>
                <Link
                  className="btn btn--secondary"
                  to={`/student/assignments/${assignment.id}/history/${version.versionNumber}`}
                >
                  Xem lần nộp
                </Link>
              </article>
            ))}
          </div>
          {!isSubmissionLocked(submission) && (
            <Link className="btn btn--primary" to={`/student/assignments/${assignment.id}/submit`}>Nộp lại</Link>
          )}
          <Link className="btn btn--secondary" to={`/student/assignments/${assignment.id}`}>Quay lại bài tập</Link>
        </>
      )}
    </section>
  );
}
