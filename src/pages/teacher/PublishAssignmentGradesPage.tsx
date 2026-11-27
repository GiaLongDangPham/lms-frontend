import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { FormEvent } from 'react';
import { ApiClientError } from '../../lib/apiClient';
import {
  getAssignmentGradebook,
  getUnGradedRows,
  publishAssignmentGrades,
  type AssignmentGradebook,
  type AssignmentPublicationResult,
} from '../../lib/grades';
import {
  AssignmentHeader,
  ErrorState,
  LoadingState,
} from '../../components/assignment/AssignmentUI';

export default function PublishAssignmentGradesPage() {
  const { assignmentId = '' } = useParams();
  const [gradebook, setGradebook] = useState<AssignmentGradebook | null>(null);
  const [publication, setPublication] = useState<AssignmentPublicationResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setLoading(true);
      setError(null);
      try {
        const result = await getAssignmentGradebook(assignmentId);
        if (!cancelled) setGradebook(result);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được thông tin công bố.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  async function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gradebook || blockers.length > 0) return;

    setPublishing(true);
    setError(null);
    try {
      setPublication(await publishAssignmentGrades(assignmentId));
    } catch (publishError: unknown) {
      if (publishError instanceof ApiClientError && publishError.code === 'UNGRADED_SUBMISSIONS') {
        setError(`${publishError.message} Bảng điểm có thể đã thay đổi; hãy kiểm tra lại các bài chưa chấm.`);
        try {
          setGradebook(await getAssignmentGradebook(assignmentId));
        } catch (reloadError: unknown) {
          setError(`${publishError.message} Không tải lại được bảng điểm: ${reloadError instanceof Error ? reloadError.message : 'Lỗi không xác định.'}`);
        }
      } else {
        setError(publishError instanceof Error ? publishError.message : 'Không công bố được điểm.');
      }
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <LoadingState label="Đang tải bản xem trước công bố…" />;
  if (error && !gradebook) return <ErrorState message={error} />;
  if (!gradebook) return <ErrorState message="Không tìm thấy bảng điểm." />;

  const blockers = getUnGradedRows(gradebook.rows);
  const submittedCount = gradebook.rows.filter((row) => row.submission !== null).length;
  const readyCount = submittedCount - blockers.length;
  const automaticZeroCount = gradebook.rows.filter((row) => row.submission === null).length;

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title="Xem trước & công bố điểm"
        subtitle={gradebook.assignment.title}
        action={<Link className="btn btn--secondary" to={`/teacher/assignments/${assignmentId}/submissions`}>Quay lại bảng điểm</Link>}
      />

      {publication ? (
        <section className="assignment-card assignment-result" role="status">
          <h2>Đã công bố điểm thành công</h2>
          <p>{publication.publishedCount} kết quả đã công bố.</p>
          <p>{publication.automaticZeroCount} sinh viên chưa nộp được ghi nhận 0 điểm.</p>
          <p>Thời gian: {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(publication.publishedAt))}</p>
          <Link className="btn btn--primary" to={`/teacher/assignments/${assignmentId}/submissions`}>Quay lại bảng điểm</Link>
        </section>
      ) : (
        <>
          <div className="assignment-stat-grid">
            <article className="assignment-stat-card"><strong>{gradebook.rows.length}</strong><span>Sinh viên đang học</span></article>
            <article className="assignment-stat-card"><strong>{submittedCount}</strong><span>Đã nộp</span></article>
            <article className="assignment-stat-card"><strong>{readyCount}/{submittedCount}</strong><span>Bài đã có điểm</span></article>
            <article className="assignment-stat-card"><strong>{automaticZeroCount}</strong><span>Sẽ nhận 0 điểm tự động</span></article>
          </div>

          {blockers.length > 0 ? (
            <section className="assignment-notice assignment-notice--warning">
              <strong>Chưa thể công bố</strong>
              <p>Cần chấm điểm cho tất cả bài đã nộp trước khi công bố. Hiện còn {blockers.length} bài chưa chấm:</p>
              <ul>
                {blockers.map((row) => (
                  <li key={row.student.id}>
                    {row.student.fullName} · {row.student.schoolCode}
                    {row.submission && (
                      <> — <Link to={`/teacher/assignments/${assignmentId}/submissions/${row.submission.id}/grade`}>Chấm bài</Link></>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="assignment-notice">
              <strong>Sẵn sàng công bố</strong>
              <p>
                Điểm của {submittedCount} bài đã nộp sẽ được công bố. {automaticZeroCount > 0
                  ? `${automaticZeroCount} sinh viên đang học chưa nộp sẽ được tự động ghi nhận 0 điểm.`
                  : 'Không có sinh viên chưa nộp cần ghi nhận 0 điểm.'}
              </p>
              <p>Thao tác này công bố toàn bộ điểm trong một lần. Điểm đã công bố có thể được chỉnh sửa và cập nhật ngay.</p>
            </section>
          )}

          {error && <p className="assignment-inline-error" role="alert">{error}</p>}
          <form className="assignment-form-actions" onSubmit={(event) => void handlePublish(event)}>
            <label className="assignment-publication-confirm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              Tôi xác nhận công bố điểm cho toàn bộ sinh viên đang học.
            </label>
            <button type="submit" className="btn btn--primary" disabled={!confirmed || blockers.length > 0 || publishing}>
              {publishing ? 'Đang công bố…' : 'Công bố điểm'}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
