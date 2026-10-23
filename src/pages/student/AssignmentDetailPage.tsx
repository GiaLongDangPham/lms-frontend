import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  downloadFile,
  formatDateTime,
  formatFileSize,
  getAssignment,
  getLockMessage,
  getMyPublishedResult,
  getMySubmission,
  isSubmissionLocked,
  type Assignment,
  type PublishedResult,
  type Submission,
  type FileRecord,
} from '../../lib/assignments';
import {
  AssignmentFiles,
  AssignmentHeader,
  ErrorState,
  LoadingState,
  SubmissionStatus,
} from '../../components/assignment/AssignmentUI';
import ClassNavTabs from '../../components/class/ClassNavTabs';

export default function AssignmentDetailPage() {
  const { assignmentId = '' } = useParams();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [result, setResult] = useState<PublishedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      setLoading(true);
      setError(null);
      try {
        const [loadedAssignment, loadedSubmission, loadedResult] = await Promise.all([
          getAssignment(assignmentId),
          getMySubmission(assignmentId),
          getMyPublishedResult(assignmentId),
        ]);
        if (cancelled) return;
        setAssignment(loadedAssignment);
        setSubmission(loadedSubmission);
        setResult(loadedResult);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được chi tiết bài tập.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  async function handleDownload(file: FileRecord) {
    setDownloadError(null);
    try {
      await downloadFile(file);
    } catch (downloadError: unknown) {
      setDownloadError(downloadError instanceof Error ? downloadError.message : 'Không tải được tệp.');
    }
  }

  if (loading) return <LoadingState label="Đang tải chi tiết bài tập…" />;
  if (error || !assignment) {
    return <ErrorState message={error ?? 'Không tìm thấy bài tập.'} />;
  }

  const locked = isSubmissionLocked(submission);
  const currentVersion = submission?.versions.find(
    (version) => version.versionNumber === submission.currentVersionNumber,
  );

  return (
    <section className="assignment-page">
      <AssignmentHeader title={assignment.title} subtitle="Bài tập của tôi" />
      <ClassNavTabs classId={assignment.classId} active="assignments" />

      <div className="assignment-badges">
        {submission && currentVersion
          ? <SubmissionStatus isLate={currentVersion.isLate} current />
          : <span className="status-badge status-badge--neutral">Chưa nộp</span>}
        <span className="status-badge status-badge--draft">Hạn: {formatDateTime(assignment.deadlineAt)}</span>
      </div>

      <section className="assignment-card">
        <h2>Yêu cầu bài tập</h2>
        <p className="assignment-description">{assignment.description || 'Giảng viên chưa thêm mô tả.'}</p>
        <p className="assignment-muted">Thang điểm: {assignment.maxScore}</p>
        <AssignmentFiles files={assignment.files} onDownload={(file) => void handleDownload(file)} emptyLabel="Không có tệp đề bài." />
        {downloadError && <p className="assignment-inline-error" role="alert">{downloadError}</p>}
      </section>

      <section className="assignment-card">
        <h2>{submission ? 'Bài nộp hiện tại' : 'Bạn chưa nộp bài'}</h2>
        {submission && currentVersion ? (
          <>
            <p>
              Lần nộp #{currentVersion.versionNumber} · {formatDateTime(currentVersion.submittedAt)}
              {' · '}{currentVersion.files.length} tệp · {currentVersion.files.reduce((total, file) => total + file.sizeBytes, 0) > 0
                ? formatFileSize(currentVersion.files.reduce((total, file) => total + file.sizeBytes, 0))
                : '0 KB'}
            </p>
            {locked && <div className="assignment-notice"><strong>Đã khóa nộp bài</strong><p>{getLockMessage(submission)}</p></div>}
            <AssignmentFiles
              files={currentVersion.files}
              onDownload={(file) => void handleDownload(file)}
              emptyLabel="Phiên bản này không có tệp."
            />
          </>
        ) : (
          <p>Có thể nộp nhiều tệp. Hệ thống lưu lịch sử các lần nộp.</p>
        )}
        {submission && (
          <Link className="btn btn--secondary" to={`/student/assignments/${assignment.id}/history`}>
            Lịch sử nộp
          </Link>
        )}
        {!locked && (
          <Link
            className="btn btn--primary"
            to={`/student/assignments/${assignment.id}/submit`}
          >
            {submission ? 'Nộp lại' : 'Nộp bài'}
          </Link>
        )}
      </section>

      {result ? (
        <section className="assignment-notice assignment-result">
          <strong>Kết quả đã công bố</strong>
          <p>Điểm: {result.score} / {assignment.maxScore}</p>
          {result.feedback && <p>Nhận xét: {result.feedback}</p>}
        </section>
      ) : (
        <section className="assignment-notice">
          <strong>Kết quả chưa được công bố</strong>
          <p>Điểm và nhận xét sẽ xuất hiện sau khi giảng viên công bố.</p>
        </section>
      )}
    </section>
  );
}
