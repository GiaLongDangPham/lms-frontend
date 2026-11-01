import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  formatDateTime,
  getAssignment,
  getLockMessage,
  getMySubmission,
  isSubmissionLocked,
  submitAssignment,
  uploadFile,
  type Assignment,
  type Submission,
} from '../../lib/assignments';
import { AssignmentHeader, ErrorState, LoadingState } from '../../components/assignment/AssignmentUI';
import { useConfirm } from '../../hooks/useConfirm';

const allowedExtensions = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'zip']);

export default function SubmissionFormPage() {
  const { assignmentId = '' } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  useEffect(() => {
    let cancelled = false;

    async function loadForm() {
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
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Không tải được bài tập.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadForm();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  function handleFileSelection(selectedFiles: FileList | null) {
    if (!selectedFiles) return;
    const incomingFiles = Array.from(selectedFiles);
    const unsupported = incomingFiles.find((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      return !allowedExtensions.has(extension);
    });
    if (unsupported) {
      setError(`${unsupported.name}: chỉ hỗ trợ PDF, Word, PowerPoint hoặc file nén.`);
      return;
    }
    setError(null);
    setFiles((current) => [...current, ...incomingFiles]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!assignment || files.length === 0) {
      setError('Vui lòng chọn ít nhất một tệp trước khi gửi bài.');
      return;
    }
    if (isSubmissionLocked(submission)) {
      setError(submission ? getLockMessage(submission) : 'Bài tập đã khóa nhận bài.');
      return;
    }
    const late = Date.now() > new Date(assignment.deadlineAt).getTime();
    const confirmed = await confirm(late
      ? {
          title: 'Nộp bài trễ hạn?',
          message: 'Đã quá hạn nộp. Bài sẽ được đánh dấu nộp trễ. Bạn vẫn muốn gửi?',
          confirmLabel: 'Nộp bài',
          tone: 'primary',
        }
      : {
          title: 'Xác nhận nộp bài?',
          message: 'Các tệp chỉ được tính là đã nộp khi hệ thống xác nhận thành công.',
          confirmLabel: 'Nộp bài',
          tone: 'primary',
        });
    if (!confirmed) return;

    setSending(true);
    try {
      const uploadedFiles = [];
      for (const file of files) uploadedFiles.push(await uploadFile(file));
      await submitAssignment(assignment.id, uploadedFiles.map((file) => file.id));
      void navigate(`/student/assignments/${assignment.id}/history`);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể gửi bài.');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <LoadingState label="Đang tải trang nộp bài…" />;
  if (error && !assignment) return <ErrorState message={error} />;
  if (!assignment) return <ErrorState message="Không tìm thấy bài tập." />;
  const locked = isSubmissionLocked(submission);

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title={submission ? 'Nộp lại bài tập' : 'Nộp bài tập'}
        subtitle={`${assignment.title} / Hạn nộp ${formatDateTime(assignment.deadlineAt)}`}
      />
      {confirmDialog}

      {locked ? (
        <section className="assignment-notice assignment-notice--warning">
          <strong>Đã khóa nộp bài</strong>
          <p>{submission ? getLockMessage(submission) : 'Bài tập hiện không nhận bài nộp.'}</p>
          <Link className="btn btn--secondary" to={`/student/assignments/${assignment.id}`}>Về bài tập</Link>
        </section>
      ) : (
        <form className="assignment-form" onSubmit={(event) => void handleSubmit(event)}>
          {error && <ErrorState message={error} />}
          <section className="assignment-card">
            <h2>Tệp đính kèm</h2>
            <div className="assignment-dropzone">
              <strong>Kéo thả tệp vào đây</strong>
              <p>PDF, Word, PowerPoint hoặc tệp nén · Có thể chọn nhiều tệp</p>
              <label className="btn btn--secondary assignment-file-picker">
                Chọn tệp
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
                  multiple
                  disabled={sending}
                  onChange={(event) => handleFileSelection(event.currentTarget.files)}
                />
              </label>
            </div>
            {files.length > 0 && (
              <ul className="assignment-file-list">
                {files.map((file, index) => (
                  <li key={`${file.name}-${file.lastModified}-${index}`}>
                    <span>{file.name} · {(file.size / 1024).toFixed(0)} KB · Sẵn sàng</span>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      disabled={sending}
                      onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                    >
                      Xóa
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="assignment-notice">
            <strong>Kiểm tra trước khi gửi</strong>
            <p>Các tệp chỉ được tính là đã nộp khi hệ thống xác nhận thành công.</p>
          </section>
          <div className="assignment-form-actions">
            <button type="submit" className="btn btn--primary" disabled={sending}>
              {sending ? 'Đang gửi…' : 'Xác nhận nộp bài'}
            </button>
            <Link className="btn btn--secondary" to={`/student/assignments/${assignment.id}`}>Hủy</Link>
          </div>
        </form>
      )}
    </section>
  );
}
