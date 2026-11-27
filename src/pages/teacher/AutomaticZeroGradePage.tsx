import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { FormEvent } from 'react';
import {
  formatDateTime,
  getAssignment,
  type Assignment,
} from '../../lib/assignments';
import {
  getPublishedHistoryEntries,
  getTeacherGradeHistory,
  isValidGradeScore,
  saveAutomaticZeroCorrection,
  type Grade,
  type GradeHistory,
} from '../../lib/grades';
import {
  AssignmentHeader,
  ErrorState,
  LoadingState,
} from '../../components/assignment/AssignmentUI';

export default function AutomaticZeroGradePage() {
  const { assignmentId = '', studentId = '' } = useParams();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [history, setHistory] = useState<GradeHistory | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGrade() {
      setLoading(true);
      setError(null);
      try {
        const [loadedAssignment, loadedHistory] = await Promise.all([
          getAssignment(assignmentId),
          getTeacherGradeHistory(assignmentId, studentId),
        ]);
        if (cancelled) return;
        if (loadedHistory && (
          loadedHistory.assignmentId !== assignmentId
          || loadedHistory.student.id !== studentId
        )) {
          throw new Error('API trả về lịch sử điểm không thuộc sinh viên hoặc bài tập đã chọn.');
        }
        const publishedEntries = getPublishedHistoryEntries(loadedHistory);
        const automaticZeroEntry = publishedEntries
          .find((entry) => entry.source === 'AUTO_ZERO_NO_SUBMISSION');
        const latestPublished = publishedEntries[0] ?? null;

        setAssignment(loadedAssignment);
        setHistory(loadedHistory);
        if (automaticZeroEntry && latestPublished) {
          setScore(String(latestPublished.score));
          setFeedback(latestPublished.feedback ?? '');
        }
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được kết quả tự động.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadGrade();
    return () => {
      cancelled = true;
    };
  }, [assignmentId, studentId]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignment || !hasAutomaticZero) return;
    if (!isValidGradeScore(score, assignment.maxScore)) {
      setError(`Điểm phải nằm trong khoảng 0–${assignment.maxScore} và có tối đa 2 chữ số thập phân.`);
      setNotice(null);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveAutomaticZeroCorrection(assignmentId, studentId, {
        score: Number(score),
        feedback: feedback.trim() || null,
      });
      if (saved.assignmentId !== assignmentId || saved.student.id !== studentId
        || saved.status !== 'PUBLISHED' || saved.source !== 'MANUAL'
        || saved.submissionId !== null) {
        throw new Error('API lưu xong nhưng trả về kết quả không đúng hợp đồng sửa điểm 0 tự động.');
      }
      setGrade(saved);
      setScore(String(saved.score));
      setFeedback(saved.feedback ?? '');
      setNotice('Đã cập nhật kết quả đã công bố. Lịch sử điểm được giữ nguyên và sinh viên không cần nộp bài.');
      try {
        setHistory(await getTeacherGradeHistory(assignmentId, studentId));
      } catch (historyError: unknown) {
        setError(`Điểm đã được cập nhật, nhưng không tải lại được lịch sử: ${historyError instanceof Error ? historyError.message : 'Lỗi không xác định.'}`);
      }
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Không cập nhật được điểm.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Đang kiểm tra kết quả điểm 0…" />;
  if (error && !assignment) return <ErrorState message={error} />;
  if (!assignment) return <ErrorState message="Không tìm thấy bài tập." />;

  const publishedEntries = getPublishedHistoryEntries(history);
  const hasAutomaticZero = publishedEntries.some((entry) => entry.source === 'AUTO_ZERO_NO_SUBMISSION');
  const latestPublished = publishedEntries[0] ?? null;

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title="Điều chỉnh kết quả chưa nộp"
        subtitle={`${assignment.title} · ${history?.student.fullName ?? 'Sinh viên'}`}
        action={<Link className="btn btn--secondary" to={`/teacher/assignments/${assignmentId}/submissions`}>Quay lại bảng điểm</Link>}
      />

      {error && <p className="assignment-inline-error" role="alert">{error}</p>}
      {notice && <p className="assignment-notice assignment-result" role="status">{notice}</p>}

      {!hasAutomaticZero || !latestPublished ? (
        <section className="assignment-notice assignment-notice--warning">
          <strong>Không tìm thấy điểm 0 tự động để điều chỉnh</strong>
          <p>Chỉ có thể điều chỉnh kết quả đã công bố có lịch sử nguồn AUTO_ZERO_NO_SUBMISSION.</p>
        </section>
      ) : (
        <>
          <section className="assignment-card">
            <h2>Kết quả đã công bố hiện tại</h2>
            <p>{latestPublished.score} / {assignment.maxScore}</p>
            <p>Cập nhật lúc {formatDateTime(latestPublished.changedAt)}</p>
            {latestPublished.feedback && <p>Nhận xét: {latestPublished.feedback}</p>}
            <p>Hệ thống giữ lịch sử điểm 0 tự động và không tạo bài nộp giả.</p>
          </section>

          <form className="assignment-card assignment-form" onSubmit={(event) => void handleSave(event)}>
            <h2>Điểm và nhận xét điều chỉnh</h2>
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
                {saving ? 'Đang lưu…' : 'Lưu điều chỉnh'}
              </button>
            </div>
          </form>

          <section className="assignment-card">
            <h2>Lịch sử kết quả đã công bố</h2>
            <ol className="assignment-grade-history">
              {publishedEntries.map((entry) => (
                <li key={entry.version}>
                  <strong>Lần {entry.ordinal}:{entry.score} / {assignment.maxScore}</strong>
                  <span>{formatDateTime(entry.changedAt)} · {entry.changedBy.fullName} · {
                    entry.source === 'AUTO_ZERO_NO_SUBMISSION' ? 'Điểm 0 tự động' : 'Điều chỉnh thủ công'
                  }</span>
                  {entry.feedback && <p>{entry.feedback}</p>}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
      {grade && <p className="visually-hidden" role="status">Điểm hiện tại: {grade.score}</p>}
    </section>
  );
}
