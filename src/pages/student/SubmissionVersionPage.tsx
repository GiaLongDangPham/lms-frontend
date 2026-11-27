import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  downloadFile,
  formatDateTime,
  getAssignment,
  getMySubmission,
  isSubmissionLocked,
  type Assignment,
  type FileRecord,
  type Submission,
  type SubmissionVersion,
} from '../../lib/assignments';
import {
  AssignmentFiles,
  AssignmentHeader,
  ErrorState,
  LoadingState,
  SubmissionStatus,
} from '../../components/assignment/AssignmentUI';

export default function SubmissionVersionPage() {
  const { assignmentId = '', versionNumber = '' } = useParams();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [version, setVersion] = useState<SubmissionVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVersion() {
      setLoading(true);
      setError(null);
      try {
        const [loadedAssignment, loadedSubmission] = await Promise.all([
          getAssignment(assignmentId),
          getMySubmission(assignmentId),
        ]);
        if (cancelled) return;
        const requestedVersion = Number(versionNumber);
        const selectedVersion = loadedSubmission?.versions.find(
          (item) => item.versionNumber === requestedVersion,
        ) ?? null;
        if (!selectedVersion) {
          setError('Không tìm thấy phiên bản bài nộp này.');
          return;
        }
        setAssignment(loadedAssignment);
        setSubmission(loadedSubmission);
        setVersion(selectedVersion);
      } catch (loadError: unknown) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Không tải được chi tiết lần nộp.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadVersion();
    return () => {
      cancelled = true;
    };
  }, [assignmentId, versionNumber]);

  async function handleDownload(file: FileRecord) {
    setDownloadError(null);
    try {
      await downloadFile(file);
    } catch (downloadError: unknown) {
      setDownloadError(downloadError instanceof Error ? downloadError.message : 'Không tải được tệp.');
    }
  }

  if (loading) return <LoadingState label="Đang tải chi tiết lần nộp…" />;
  if (error || !assignment || !submission || !version) {
    return <ErrorState message={error ?? 'Không tìm thấy phiên bản bài nộp.'} />;
  }

  const isCurrent = version.versionNumber === submission.currentVersionNumber;

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title={`Chi tiết lần nộp #${version.versionNumber}`}
        subtitle={`${assignment.title} / Bài nộp của tôi`}
      />
      <SubmissionStatus isLate={version.isLate} current={isCurrent} />
      <p className="assignment-muted">
        {formatDateTime(version.submittedAt)} · Hạn bài: {formatDateTime(version.deadlineAtSubmission)}
      </p>

      <section className="assignment-notice">
        <strong>{isCurrent ? 'Đây là lần nộp hiện hành' : 'Bạn đang xem một lần nộp trước'}</strong>
        <p>
          {isCurrent
            ? 'Lần nộp mới nhất được dùng làm bài nộp hiện hành.'
            : `Các tệp của lần nộp #${version.versionNumber} được giữ nguyên để đối chiếu.`}
        </p>
      </section>

      <section className="assignment-card">
        <h2>Tệp trong lần nộp này</h2>
        <AssignmentFiles
          files={version.files}
          onDownload={(file) => void handleDownload(file)}
          emptyLabel="Không có tệp trong phiên bản này."
        />
        {downloadError && <p className="assignment-inline-error" role="alert">{downloadError}</p>}
      </section>

      <div className="assignment-form-actions">
        <Link className="btn btn--secondary" to={`/student/assignments/${assignment.id}/history`}>Về lịch sử nộp</Link>
        {isCurrent && !isSubmissionLocked(submission) && (
          <Link className="btn btn--secondary" to={`/student/assignments/${assignment.id}/submit`}>Nộp lại</Link>
        )}
        <Link className="btn btn--secondary" to={`/student/assignments/${assignment.id}`}>Về bài tập</Link>
      </div>
    </section>
  );
}
