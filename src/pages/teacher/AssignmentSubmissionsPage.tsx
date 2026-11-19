import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  downloadFile,
  formatDateTime,
  type FileRecord,
} from '../../lib/assignments';
import {
  getAssignmentGradebook,
  type AssignmentGradebook,
  type GradebookRow,
} from '../../lib/grades';
import {
  AssignmentHeader,
  ErrorState,
  LoadingState,
} from '../../components/assignment/AssignmentUI';
import AssignmentComments from '../../components/assignment/AssignmentComments';

type RowStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'LATE' | 'GRADED';

function currentVersion(row: GradebookRow) {
  return row.submission?.versions.find(
    (version) => version.versionNumber === row.submission?.currentVersionNumber,
  ) ?? null;
}

function rowStatus(row: GradebookRow): RowStatus {
  if (!row.submission) return 'NOT_SUBMITTED';
  if (row.grade) return 'GRADED';
  return currentVersion(row)?.isLate ? 'LATE' : 'SUBMITTED';
}

const statusLabels: Record<RowStatus, string> = {
  NOT_SUBMITTED: 'Chưa nộp',
  SUBMITTED: 'Đã nộp',
  LATE: 'Nộp trễ',
  GRADED: 'Đã chấm',
};

export default function AssignmentSubmissionsPage() {
  const { assignmentId = '' } = useParams();
  const [gradebook, setGradebook] = useState<AssignmentGradebook | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGradebook() {
      setLoading(true);
      setError(null);
      try {
        const result = await getAssignmentGradebook(assignmentId);
        if (!cancelled) setGradebook(result);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được bảng điểm.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadGradebook();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  async function handleDownload(file: FileRecord) {
    setDownloadError(null);
    try {
      await downloadFile(file);
    } catch (downloadFailure: unknown) {
      setDownloadError(downloadFailure instanceof Error ? downloadFailure.message : 'Không tải được tệp.');
    }
  }

  const filteredRows = useMemo(() => gradebook?.rows.filter((row) => {
    const matchesQuery = `${row.student.fullName} ${row.student.schoolCode}`.toLocaleLowerCase('vi')
      .includes(query.trim().toLocaleLowerCase('vi'));
    return matchesQuery && (statusFilter === 'ALL' || rowStatus(row) === statusFilter);
  }) ?? [], [gradebook, query, statusFilter]);

  if (loading) return <LoadingState label="Đang tải bảng điểm…" />;
  if (error || !gradebook) return <ErrorState message={error ?? 'Không tìm thấy bài tập.'} />;

  const { assignment, rows } = gradebook;
  const submittedCount = rows.filter((row) => row.submission !== null).length;
  const lateCount = rows.filter((row) => rowStatus(row) === 'LATE').length;
  const gradedCount = rows.filter((row) => row.grade !== null).length;
  const publishedCount = rows.filter((row) => row.grade?.status === 'PUBLISHED').length;

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title="Bài nộp & bảng điểm"
        subtitle={`${assignment.title} · ${rows.length} sinh viên`}
        action={<Link className="btn btn--secondary" to="/teacher/assignments">Quay lại bài tập</Link>}
      />

      <div className="assignment-stat-grid">
        <article className="assignment-stat-card"><strong>{submittedCount}/{rows.length}</strong><span>Đã nộp</span></article>
        <article className="assignment-stat-card"><strong>{lateCount}</strong><span>Nộp trễ</span></article>
        <article className="assignment-stat-card"><strong>{gradedCount}</strong><span>Đã chấm</span></article>
        <article className="assignment-stat-card"><strong>{publishedCount}</strong><span>Bài nộp đã công bố</span></article>
      </div>

      <div className="assignment-filters">
        <label className="assignment-filter">
          <span>Tìm sinh viên</span>
          <input
            className="form-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tên hoặc mã sinh viên"
          />
        </label>
        <label className="assignment-filter">
          <span>Trạng thái</span>
          <select className="form-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">Tất cả bài nộp</option>
            <option value="NOT_SUBMITTED">Chưa nộp</option>
            <option value="SUBMITTED">Đã nộp</option>
            <option value="LATE">Nộp trễ</option>
            <option value="GRADED">Đã chấm</option>
          </select>
        </label>
      </div>

      {downloadError && <p className="assignment-inline-error" role="alert">{downloadError}</p>}
      {rows.length === 0 ? (
        <section className="assignment-card assignment-empty"><h2>Lớp chưa có sinh viên ghi danh.</h2></section>
      ) : filteredRows.length === 0 ? (
        <section className="assignment-card assignment-empty"><h2>Không tìm thấy sinh viên phù hợp.</h2></section>
      ) : (
        <div className="assignment-table-wrap">
          <table className="assignment-table">
            <thead>
              <tr>
                <th>Sinh viên</th>
                <th>Lần nộp gần nhất</th>
                <th>Nộp bài</th>
                <th>Điểm / {assignment.maxScore}</th>
                <th>Kết quả</th>
                <th><span className="visually-hidden">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const version = currentVersion(row);
                const firstFile = version?.files[0];
                const status = rowStatus(row);
                const gradeStatus = row.grade?.status;
                return (
                  <tr key={row.student.id}>
                    <td>{row.student.fullName} · {row.student.schoolCode}</td>
                    <td>{version ? formatDateTime(version.submittedAt) : '—'}</td>
                    <td>
                      <span className={`status-badge status-badge--${status === 'LATE' ? 'warning' : status === 'SUBMITTED' ? 'success' : 'neutral'}`}>
                        {statusLabels[status]}
                      </span>
                    </td>
                    <td>
                      {row.grade?.score ?? '—'}
                    </td>
                    <td>
                      {gradeStatus
                        ? <span className={`status-badge status-badge--${gradeStatus === 'PUBLISHED' ? 'success' : 'draft'}`}>
                            {gradeStatus === 'PUBLISHED' ? 'Đã công bố' : 'Bản nháp'}
                          </span>
                        : row.submission ? 'Chưa chấm' : '—'}
                    </td>
                    <td>
                      {row.submission && (
                        <div className="assignment-row-actions">
                          <Link
                            className="btn btn--secondary btn--sm"
                            to={`/teacher/assignments/${assignment.id}/submissions/${row.submission.id}/grade`}
                          >
                            {row.grade ? 'Sửa điểm' : 'Chấm bài'}
                          </Link>
                          {firstFile && (
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              onClick={() => void handleDownload(firstFile)}
                            >
                              Tải bài nộp
                            </button>
                          )}
                        </div>
                      )}
                      {!row.submission && (
                        <Link
                          className="btn btn--secondary"
                          to={`/teacher/assignments/${assignment.id}/grades/${row.student.id}/edit`}
                        >
                          Kiểm tra điểm 0
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="assignment-form-actions">
        <Link className="btn btn--primary" to={`/teacher/assignments/${assignment.id}/publish`}>
          Xem trước & công bố điểm
        </Link>
      </div>
      <AssignmentComments assignmentId={assignment.id} />
    </section>
  );
}
