import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  downloadFile,
  formatDateTime,
  getAssignment,
  listAssignmentSubmissions,
  listEnrollments,
  type Assignment,
  type Enrollment,
  type FileRecord,
  type Submission,
} from '../../lib/assignments';
import {
  AssignmentHeader,
  ErrorState,
  LoadingState,
} from '../../components/assignment/AssignmentUI';

type SubmissionRow = {
  student: Submission['student'];
  submission: Submission | null;
};

function currentVersion(submission: Submission | null) {
  return submission?.versions.find((version) => version.versionNumber === submission.currentVersionNumber) ?? null;
}

function rowStatus(row: SubmissionRow): 'NOT_SUBMITTED' | 'SUBMITTED' | 'LATE' | 'GRADED' {
  if (!row.submission) return 'NOT_SUBMITTED';
  if (row.submission.grade) return 'GRADED';
  return currentVersion(row.submission)?.isLate ? 'LATE' : 'SUBMITTED';
}

const statusLabels = {
  NOT_SUBMITTED: 'Chưa nộp',
  SUBMITTED: 'Đã nộp',
  LATE: 'Nộp trễ',
  GRADED: 'Đã chấm',
};

export default function AssignmentSubmissionsPage() {
  const { assignmentId = '' } = useParams();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSubmissions() {
      setLoading(true);
      setError(null);
      try {
        const loadedAssignment = await getAssignment(assignmentId);
        const [submissionPage, enrollmentPage] = await Promise.all([
          listAssignmentSubmissions(assignmentId),
          listEnrollments(loadedAssignment.classId),
        ]);
        if (cancelled) return;

        const submissionsByStudent = new Map(
          submissionPage.items.map((submission) => [submission.student.id, submission]),
        );
        const enrollmentRows = enrollmentPage.items
          .filter((enrollment) => enrollment.isActive)
          .map((enrollment: Enrollment) => ({
            student: enrollment.student,
            submission: submissionsByStudent.get(enrollment.student.id) ?? null,
          }));
        const knownStudentIds = new Set(enrollmentRows.map((row) => row.student.id));
        const remainingSubmissions = submissionPage.items
          .filter((submission) => !knownStudentIds.has(submission.student.id))
          .map((submission) => ({ student: submission.student, submission }));

        setAssignment(loadedAssignment);
        setRows([...enrollmentRows, ...remainingSubmissions]);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được danh sách bài nộp.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSubmissions();
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

  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesQuery = `${row.student.fullName} ${row.student.schoolCode}`.toLocaleLowerCase('vi')
      .includes(query.trim().toLocaleLowerCase('vi'));
    const matchesStatus = statusFilter === 'ALL' || rowStatus(row) === statusFilter;
    return matchesQuery && matchesStatus;
  }), [query, rows, statusFilter]);

  if (loading) return <LoadingState label="Đang tải danh sách bài nộp…" />;
  if (error || !assignment) return <ErrorState message={error ?? 'Không tìm thấy bài tập.'} />;

  const submittedCount = rows.filter((row) => row.submission !== null).length;
  const lateCount = rows.filter((row) => rowStatus(row) === 'LATE').length;
  const gradedCount = rows.filter((row) => rowStatus(row) === 'GRADED').length;
  const publishedCount = rows.filter((row) => row.submission?.grade?.status === 'PUBLISHED').length;

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
        <article className="assignment-stat-card"><strong>{publishedCount}</strong><span>Đã công bố</span></article>
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
                const version = currentVersion(row.submission);
                const firstFile = version?.files[0];
                const status = rowStatus(row);
                return (
                  <tr key={row.student.id}>
                    <td>{row.student.fullName} · {row.student.schoolCode}</td>
                    <td>{version ? formatDateTime(version.submittedAt) : '—'}</td>
                    <td>
                      <span className={`status-badge status-badge--${status === 'LATE' ? 'warning' : status === 'SUBMITTED' ? 'success' : 'neutral'}`}>
                        {statusLabels[status]}
                      </span>
                    </td>
                    <td>{row.submission?.grade?.score ?? '—'}</td>
                    <td>
                      {row.submission?.grade
                        ? <span className={`status-badge status-badge--${row.submission.grade.status === 'PUBLISHED' ? 'success' : 'draft'}`}>
                            {row.submission.grade.status === 'PUBLISHED' ? 'Đã công bố' : 'Bản nháp'}
                          </span>
                        : '—'}
                    </td>
                    <td>
                      {firstFile && (
                        <button
                          type="button"
                          className="btn btn--secondary"
                          onClick={() => void handleDownload(firstFile)}
                        >
                          Tải bài nộp
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
