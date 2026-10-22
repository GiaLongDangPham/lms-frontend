import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AssignmentHeader, ErrorState, LoadingState } from '../../components/assignment/AssignmentUI';
import {
  createAssignment,
  formatFileSize,
  getAssignment,
  listClasses,
  toDateTimeInput,
  updateAssignment,
  uploadFile,
  type ClassSummary,
  type FileRecord,
} from '../../lib/assignments';

const allowedExtensions = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'zip']);

export default function AssignmentFormPage() {
  const { assignmentId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedClassId = searchParams.get('classId') ?? '';
  const navigate = useNavigate();
  const editing = Boolean(assignmentId);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [classId, setClassId] = useState(requestedClassId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadlineAt, setDeadlineAt] = useState('');
  const [maxScore, setMaxScore] = useState('10');
  const [existingFiles, setExistingFiles] = useState<FileRecord[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadForm() {
      setError(null);
      try {
        const classPage = await listClasses();
        if (cancelled) return;
        setClasses(classPage.items);

        if (assignmentId) {
          const loadedAssignment = await getAssignment(assignmentId);
          if (cancelled) return;
          setClassId(loadedAssignment.classId);
          setTitle(loadedAssignment.title);
          setDescription(loadedAssignment.description ?? '');
          setDeadlineAt(toDateTimeInput(loadedAssignment.deadlineAt));
          setMaxScore(String(loadedAssignment.maxScore));
          setExistingFiles(loadedAssignment.files);
        } else {
          const selectedClassExists = classPage.items.some((classItem) => classItem.id === requestedClassId);
          if ((!selectedClassExists || !requestedClassId) && classPage.items[0]) {
            setClassId(classPage.items[0].id);
          }
        }
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được dữ liệu biểu mẫu.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadForm();
    return () => {
      cancelled = true;
    };
  }, [assignmentId, requestedClassId]);

  function handleFileSelection(selectedFiles: FileList | null) {
    if (!selectedFiles) return;
    const unsupported = Array.from(selectedFiles).find((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      return !allowedExtensions.has(extension);
    });
    if (unsupported) {
      setError(`${unsupported.name}: chỉ hỗ trợ PDF, Word, PowerPoint hoặc file nén.`);
      return;
    }
    setError(null);
    setNewFiles((current) => [...current, ...Array.from(selectedFiles)]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const score = Number(maxScore);
    if (!classId || !title.trim() || !deadlineAt || !Number.isFinite(score) || score <= 0) {
      setError('Vui lòng nhập lớp, tiêu đề, hạn nộp và thang điểm hợp lệ.');
      return;
    }

    setSaving(true);
    try {
      const uploadedFiles: FileRecord[] = [];
      for (const file of newFiles) uploadedFiles.push(await uploadFile(file));
      const fileIds = [...existingFiles, ...uploadedFiles].map((file) => file.id);
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        deadlineAt: new Date(deadlineAt).toISOString(),
        maxScore: score,
        fileIds,
      };

      if (editing && assignmentId) {
        await updateAssignment(assignmentId, payload);
      } else {
        await createAssignment(classId, payload);
      }
      void navigate(`/teacher/assignments?classId=${encodeURIComponent(classId)}`);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu bài tập.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Đang tải biểu mẫu…" />;
  if (editing && error) return <ErrorState message={error} />;

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title={editing ? 'Sửa bài tập' : 'Tạo bài tập'}
        subtitle="Giao bài và đặt thời hạn cho sinh viên trong lớp."
      />
      {error && <ErrorState message={error} />}
      <form className="assignment-form assignment-card" onSubmit={(event) => void handleSubmit(event)}>
        {classes.length > 1 && (
          <label className="form-field">
            <span className="form-label">Lớp học</span>
            <select className="form-input" value={classId} onChange={(event) => setClassId(event.target.value)} required>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>{classItem.name} · {classItem.code}</option>
              ))}
            </select>
          </label>
        )}

        <label className="form-field">
          <span className="form-label">Tiêu đề bài tập</span>
          <input
            className="form-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
          />
        </label>

        <label className="form-field">
          <span className="form-label">Mô tả yêu cầu</span>
          <textarea
            className="form-input assignment-textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
          />
        </label>

        <div className="assignment-form-grid">
          <label className="form-field">
            <span className="form-label">Hạn nộp (giờ Việt Nam)</span>
            <input
              className="form-input"
              type="datetime-local"
              value={deadlineAt}
              onChange={(event) => setDeadlineAt(event.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span className="form-label">Thang điểm</span>
            <input
              className="form-input"
              type="number"
              min="0.01"
              step="any"
              value={maxScore}
              onChange={(event) => setMaxScore(event.target.value)}
              required
            />
          </label>
        </div>

        <section className="assignment-upload">
          <div>
            <h2>Tệp đề bài</h2>
            <p className="assignment-muted">PDF, Word, PowerPoint hoặc file nén.</p>
          </div>
          <label className="btn btn--secondary assignment-file-picker">
            Thêm tệp đề bài
            <input
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
              multiple
              disabled={saving}
              onChange={(event) => handleFileSelection(event.currentTarget.files)}
            />
          </label>
          {(existingFiles.length > 0 || newFiles.length > 0) && (
            <ul className="assignment-file-list">
              {existingFiles.map((file) => (
                <li key={file.id}>
                  <span>{file.originalName} · {formatFileSize(file.sizeBytes)}</span>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    disabled={saving}
                    onClick={() => setExistingFiles((current) => current.filter((item) => item.id !== file.id))}
                  >
                    Xóa
                  </button>
                </li>
              ))}
              {newFiles.map((file, index) => (
                <li key={`${file.name}-${file.lastModified}-${index}`}>
                  <span>{file.name} · {formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    disabled={saving}
                    onClick={() => setNewFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                  >
                    Xóa
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="assignment-form-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Đăng bài'}
          </button>
          <Link className="btn btn--secondary" to={`/teacher/assignments?classId=${encodeURIComponent(classId)}`}>
            Hủy
          </Link>
        </div>
      </form>
    </section>
  );
}
