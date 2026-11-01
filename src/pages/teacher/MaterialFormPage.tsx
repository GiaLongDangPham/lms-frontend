import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  downloadFile,
  findUnsupportedUpload,
  formatFileSize,
  maxUploadBytes,
  uploadAccept,
  type ClassSummary,
  type FileRecord,
} from '../../lib/assignments';
import { listAllClasses } from '../../lib/classes';
import { createMaterial, createMaterialFileUploader, fileTypeLabel, getMaterial, updateMaterial } from '../../lib/materials';
import {
  AssignmentHeader,
  DownloadError,
  ErrorState,
  LoadingState,
} from '../../components/assignment/AssignmentUI';

export default function MaterialFormPage() {
  const { materialId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedClassId = searchParams.get('classId') ?? '';
  const navigate = useNavigate();
  const editing = Boolean(materialId);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [classId, setClassId] = useState('');
  const [classLocked, setClassLocked] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [existingFiles, setExistingFiles] = useState<FileRecord[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [uploadSelectedFiles] = useState(createMaterialFileUploader);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadForm() {
      setLoading(true);
      setLoadError(null);
      try {
        const allClasses = await listAllClasses();
        if (cancelled) return;
        setClasses(allClasses);

        if (materialId) {
          const material = await getMaterial(materialId);
          if (cancelled) return;
          setClassId(material.classId);
          setClassLocked(true);
          setTitle(material.title);
          setDescription(material.description ?? '');
          setExistingFiles(material.files);
        } else if (allClasses.some((classItem) => classItem.id === requestedClassId)) {
          setClassId(requestedClassId);
          setClassLocked(true);
        } else if (allClasses.length === 1 && allClasses[0]) {
          setClassId(allClasses[0].id);
          setClassLocked(true);
        }
      } catch (failure: unknown) {
        if (!cancelled) setLoadError(failure instanceof Error ? failure.message : 'Không tải được dữ liệu biểu mẫu.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadForm();
    return () => {
      cancelled = true;
    };
  }, [materialId, requestedClassId]);

  function handleFileSelection(selectedFiles: FileList | null) {
    if (!selectedFiles) return;
    const files = Array.from(selectedFiles);
    const unsupported = findUnsupportedUpload(files);
    if (unsupported) {
      setError(`${unsupported.name}: loại tệp không được hỗ trợ. Xem danh sách ở mục chọn tệp.`);
      return;
    }
    const invalidSize = files.find(file => file.size === 0 || file.size > maxUploadBytes);
    if (invalidSize) { setError(`${invalidSize.name}: tệp phải có dữ liệu và không quá 25 MiB.`); return; }
    if (existingFiles.length + newFiles.length + files.length > 10) {
      setError('Mỗi tài liệu có tối đa 10 tệp.'); return;
    }
    setError(null);
    setNewFiles((current) => [...current, ...files]);
  }

  async function handleDownload(file: FileRecord) {
    setDownloadError(null);
    setDownloadingId(file.id);
    try {
      await downloadFile(file);
    } catch (failure: unknown) {
      setDownloadError(failure instanceof Error ? failure.message : 'Không tải được tệp.');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!classId || !title.trim()) {
      setError('Vui lòng chọn lớp và nhập tên tài liệu.');
      return;
    }
    if (existingFiles.length + newFiles.length === 0) {
      setError('Tài liệu cần ít nhất một tệp.');
      return;
    }

    setSaving(true);
    try {
      const uploadedFiles = await uploadSelectedFiles(newFiles);
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        fileIds: [...existingFiles, ...uploadedFiles].map((file) => file.id),
      };
      if (editing && materialId) {
        await updateMaterial(materialId, payload);
      } else {
        await createMaterial(classId, payload);
      }
      void navigate(`/teacher/materials?classId=${encodeURIComponent(classId)}`, {
        state: { notice: editing ? `Đã lưu thay đổi cho “${payload.title}”.` : `Đã đăng tài liệu “${payload.title}”.` },
      });
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Không thể lưu tài liệu.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Đang tải biểu mẫu…" />;
  if (loadError) return <ErrorState message={loadError} />;

  const cancelPath = classId || requestedClassId
    ? `/teacher/materials?classId=${encodeURIComponent(classId || requestedClassId)}`
    : '/teacher/classes';

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title={editing ? 'Chỉnh sửa tài liệu' : 'Đăng tài liệu'}
        subtitle="Tài liệu sẽ hiển thị cho sinh viên trong lớp sau khi lưu."
      />
      {error && <ErrorState message={error} />}
      <form className="assignment-form assignment-card" onSubmit={(event) => void handleSubmit(event)}>
        {!classLocked && (
          <label className="form-field">
            <span className="form-label">Lớp học</span>
            <select className="form-input" value={classId} onChange={(event) => setClassId(event.target.value)} required>
              <option value="">— Chọn lớp —</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>{classItem.name} · {classItem.code}</option>
              ))}
            </select>
          </label>
        )}

        <label className="form-field">
          <span className="form-label">Tên tài liệu</span>
          <input
            className="form-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
          />
        </label>

        <label className="form-field">
          <span className="form-label">Mô tả</span>
          <textarea
            className="form-input assignment-textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            maxLength={10000}
          />
        </label>

        <div className="assignment-dropzone">
          <strong>Chọn tệp từ máy tính</strong>
          <p>Tối đa 10 tệp, 25 MiB/tệp. Hỗ trợ PDF, Office, văn bản, mã nguồn, ảnh và ZIP. Không nhận file thực thi hoặc Office có macro.</p>
          <label className="btn btn--secondary assignment-file-picker">
            Chọn tệp
            <input
              type="file"
              accept={uploadAccept}
              multiple
              disabled={saving}
              onChange={(event) => {
                handleFileSelection(event.currentTarget.files);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>

        {downloadError && <DownloadError message={downloadError} />}

        {(existingFiles.length > 0 || newFiles.length > 0) && (
          <ul className="assignment-file-list">
            {existingFiles.map((file) => (
              <li key={file.id}>
                <span>{fileTypeLabel(file)} · {file.originalName} · {formatFileSize(file.sizeBytes)}</span>
                <div className="assignment-card-actions">
                  <button
                    type="button"
                    className="btn btn--secondary"
                    disabled={saving || downloadingId !== null}
                    onClick={() => void handleDownload(file)}
                  >
                    {downloadingId === file.id ? 'Đang tải…' : 'Tải xuống'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    disabled={saving}
                    onClick={() => setExistingFiles((current) => current.filter((item) => item.id !== file.id))}
                  >
                    Xóa
                  </button>
                </div>
              </li>
            ))}
            {newFiles.map((file, index) => (
              <li key={`${file.name}-${file.lastModified}-${index}`}>
                <span>
                  {fileTypeLabel({ originalName: file.name, mimeType: file.type })} · {file.name} · {formatFileSize(file.size)}
                </span>
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

        <div className="assignment-form-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu tài liệu'}
          </button>
          <Link className="btn btn--secondary" to={cancelPath}>Hủy</Link>
        </div>
      </form>
    </section>
  );
}
