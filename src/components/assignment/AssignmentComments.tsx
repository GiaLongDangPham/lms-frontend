import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  createAssignmentComment,
  listAllAssignmentComments,
  type AssignmentComment,
} from '../../lib/comments';
import { formatDateTime } from '../../lib/assignments';

export default function AssignmentComments({ assignmentId }: { assignmentId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<AssignmentComment[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadComments() {
      setLoading(true);
      setError(null);
      try {
        const loadedComments = await listAllAssignmentComments(assignmentId);
        if (loadedComments.some((comment) => (
          comment.assignmentId !== assignmentId || comment.submissionId !== null
        ))) {
          throw new Error('API trả về bình luận không thuộc bài tập này.');
        }
        if (!cancelled) {
          setComments(loadedComments.sort(
            (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
          ));
        }
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được thảo luận.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadComments();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setError('Vui lòng nhập nội dung bình luận.');
      return;
    }

    setSending(true);
    setError(null);
    try {
      const comment = await createAssignmentComment(assignmentId, trimmedBody);
      if (comment.assignmentId !== assignmentId || comment.submissionId !== null) {
        throw new Error('API trả về bình luận không thuộc bài tập này.');
      }
      setComments((current) => [...current, comment].sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      ));
      setBody('');
    } catch (sendError: unknown) {
      setError(sendError instanceof Error ? sendError.message : 'Không gửi được bình luận.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="assignment-card assignment-comments">
      <h2>Thảo luận bài tập</h2>
      <p className="assignment-muted">Trao đổi theo bài tập; không hỗ trợ chat thời gian thực.</p>
      {error && <p className="assignment-inline-error" role="alert">{error}</p>}
      {loading ? (
        <p role="status">Đang tải bình luận…</p>
      ) : comments.length === 0 ? (
        <p className="assignment-muted">Chưa có bình luận nào.</p>
      ) : (
        <ol className="assignment-comment-list">
          {comments.map((comment) => (
            <li key={comment.id} className={comment.author.id === user?.id ? 'assignment-comment--mine' : undefined}>
              <div>
                <strong>{comment.author.fullName}</strong>
                <span>{comment.author.role === 'TEACHER' ? 'Giảng viên' : 'Sinh viên'} · {formatDateTime(comment.createdAt)}</span>
              </div>
              <p>{comment.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form className="assignment-comment-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="assignment-filter">
          <span>Viết bình luận</span>
          <textarea
            className="form-input assignment-textarea"
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn btn--primary" disabled={sending || !body.trim()}>
          {sending ? 'Đang gửi…' : 'Gửi bình luận'}
        </button>
      </form>
    </section>
  );
}
