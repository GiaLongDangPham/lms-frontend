import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { FormEvent } from 'react';
import {
  downloadFile,
  formatDateTime,
  getAssignment,
  type Assignment,
  type FileRecord,
  type Submission,
} from '../../lib/assignments';
import {
  getGradeForTeacher,
  getPublishedHistoryEntries,
  getSubmissionForGrading,
  getTeacherGradeHistory,
  isValidGradeScore,
  saveGrade,
  StaleSubmissionVersionError,
  type Grade,
  type GradeHistory,
} from '../../lib/grades';
import {
  AssignmentFiles,
  AssignmentHeader,
  ErrorState,
  LoadingState,
} from '../../components/assignment/AssignmentUI';

async function loadGradeData(assignmentId: string, submissionId: string) {
  const [assignment, submission] = await Promise.all([
    getAssignment(assignmentId),
    getSubmissionForGrading(assignmentId, submissionId),
  ]);
  const [grade, history] = await Promise.all([
    getGradeForTeacher(submissionId),
    getTeacherGradeHistory(assignmentId, submission.student.id),
  ]);
  return { assignment, submission, grade, history };
}

export default function GradeSubmissionPage() {
  const { assignmentId = '', submissionId = '' } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [history, setHistory] = useState<GradeHistory | null>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGradeForm() {
      setLoading(true);
      setError(null);
      try {
        const {
          assignment: loadedAssignment,
          submission: loadedSubmission,
          grade: loadedGrade,
          history: loadedHistory,
        } = await loadGradeData(assignmentId, submissionId);
        if (cancelled) return;
        setAssignment(loadedAssignment);
        setSubmission(loadedSubmission);
        setGrade(loadedGrade);
        setHistory(loadedHistory);
        setScore(loadedGrade ? String(loadedGrade.score) : '');
        setFeedback(loadedGrade?.feedback ?? '');
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được bài cần chấm.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadGradeForm();
    return () => {
      cancelled = true;
    };
  }, [assignmentId, submissionId]);

  async function handleDownload(file: FileRecord) {
    setDownloadError(null);
    try {
      await downloadFile(file);
    } catch (downloadFailure: unknown) {
      setDownloadError(downloadFailure instanceof Error ? downloadFailure.message : 'Không tải được tệp.');
    }
  }

  // The student submitted a newer version while this form was open: refresh the
  // submission and grade data but keep the score and feedback the teacher typed.
  async function reloadAfterNewVersion() {
    try {
      const reloaded = await loadGradeData(assignmentId, submissionId);
      setAssignment(reloaded.assignment);
      setSubmission(reloaded.submission);
      setGrade(reloaded.grade);
      setHistory(reloaded.history);
      setError(`Sinh viên vừa nộp phiên bản mới (#${reloaded.submission.currentVersionNumber.toString()}). `
        + 'Bài nộp đã được tải lại — hãy kiểm tra lại rồi bấm Lưu. Điểm và nhận xét bạn đã nhập vẫn được giữ.');
    } catch {
      setError('Sinh viên vừa nộp phiên bản mới nên điểm chưa được lưu, và không tải lại được bài nộp. Hãy tải lại trang.');
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignment || !submission) return;

    if (!isValidGradeScore(score, assignment.maxScore)) {
      setError(`Điểm phải nằm trong khoảng 0–${assignment.maxScore} và có tối đa 2 chữ số thập phân.`);
      setNotice(null);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveGrade(submission.id, {
        gradedVersionNumber: grade?.gradedVersionNumber ?? submission.currentVersionNumber,
        score: Number(score),
        feedback: feedback.trim() || null,
      });
      setGrade(saved);
      setScore(String(saved.score));
      setFeedback(saved.feedback ?? '');
      setNotice(saved.status === 'PUBLISHED'
        ? 'Điểm đã công bố được cập nhật ngay và đã lưu vào lịch sử.'
        : 'Đã lưu điểm nháp. Sinh viên không xem được điểm hoặc nhận xét cho đến khi công bố.');
      try {
        setHistory(await getTeacherGradeHistory(assignmentId, submission.student.id));
      } catch (historyError: unknown) {
        setError(`Điểm đã được lưu, nhưng không tải lại được lịch sử: ${historyError instanceof Error ? historyError.message : 'Lỗi không xác định.'}`);
      }
    } catch (saveError: unknown) {
      if (saveError instanceof StaleSubmissionVersionError) {
        await reloadAfterNewVersion();
      } else {
        setError(saveError instanceof Error ? saveError.message : 'Không lưu được điểm.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Đang tải bài cần chấm…" />;
  if (error && (!assignment || !submission)) return <ErrorState message={error} />;
  if (!assignment || !submission) return <ErrorState message="Không tìm thấy bài cần chấm." />;

  const currentVersion = submission.versions.find(
    (version) => version.versionNumber === submission.currentVersionNumber,
  );
  const publishedHistory = getPublishedHistoryEntries(history);

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title="Chấm bài"
        subtitle={`${assignment.title} · ${submission.student.fullName} · ${submission.student.schoolCode}`}
        action={<Link className="btn btn--secondary" to={`/teacher/assignments/${assignmentId}/submissions`}>Quay lại bảng điểm</Link>}
      />

      <section className="assignment-card">
        <h2>Bài nộp hiện hành</h2>
        <p>
          Phiên bản #{submission.currentVersionNumber}
          {currentVersion && ` · ${formatDateTime(currentVersion.submittedAt)}`}
          {currentVersion?.isLate ? ' · Nộp trễ' : ''}
        </p>
        <AssignmentFiles
          files={currentVersion?.files ?? []}
          onDownload={(file) => void handleDownload(file)}
          emptyLabel="Phiên bản này không có tệp đính kèm."
        />
        {downloadError && <p className="assignment-inline-error" role="alert">{downloadError}</p>}
      </section>
      <section className="assignment-card">
        <h2>Lịch sử nộp bài · {submission.versions.length} lần nộp</h2>
        {submission.versions.map(version => <article key={version.versionNumber}>
          <h3>Phiên bản #{version.versionNumber}{version.versionNumber === submission.currentVersionNumber ? ' · Hiện hành' : ''}</h3>
          <p>{formatDateTime(version.submittedAt)} · {version.isLate ? 'Nộp trễ' : 'Đúng hạn'}</p>
          <AssignmentFiles files={version.files} onDownload={file => void handleDownload(file)} emptyLabel="Không có tệp." />
        </article>)}
      </section>

      <form className="assignment-card assignment-form" onSubmit={(event) => void handleSave(event)}>
        <h2>Điểm và nhận xét</h2>
        {grade && (
          <div className={`assignment-notice${grade.status === 'PUBLISHED' ? ' assignment-result' : ''}`}>
            <strong>{grade.status === 'PUBLISHED' ? 'Điểm đã công bố' : 'Điểm nháp'}</strong>
            <p>
              {grade.status === 'PUBLISHED'
                ? 'Lưu chỉnh sửa sẽ cập nhật kết quả sinh viên thấy ngay; lịch sử các lần chấm vẫn được giữ.'
                : 'Điểm nháp chỉ giảng viên xem được cho đến khi công bố.'}
            </p>
          </div>
        )}
        {error && <p className="assignment-inline-error" role="alert">{error}</p>}
        {notice && <p className="assignment-notice assignment-result" role="status">{notice}</p>}
        <label className="assignment-filter">
          <span>Điểm (0–{assignment.maxScore})</span>
          <input
            className="form-input"
            type="number"
            min="0"
            max={assignment.maxScore}
            step="0.01"
            required
            value={score}
            onChange={(event) => setScore(event.target.value)}
          />
        </label>
        <label className="assignment-filter">
          <span>Nhận xét</span>
          <textarea
            className="form-input assignment-textarea"
            rows={5}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </label>
        <div className="assignment-form-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : grade?.status === 'PUBLISHED' ? 'Lưu chỉnh sửa điểm' : 'Lưu điểm nháp'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => void navigate(-1)}>
            Hủy
          </button>
        </div>
      </form>

      {publishedHistory.length > 0 && (
        <section className="assignment-card">
          <h2>Lịch sử điểm đã công bố</h2>
          <ol className="assignment-grade-history">
            {publishedHistory.map((entry) => (
              <li key={entry.version}>
                <strong>Lần {entry.ordinal}:{entry.score} / {assignment.maxScore}</strong>
                <span>{formatDateTime(entry.changedAt)} · {entry.changedBy.fullName}</span>
                {entry.feedback && <p>{entry.feedback}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}
