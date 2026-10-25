import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  downloadFile,
  formatDate,
  formatFileSize,
  type ClassSummary,
  type FileRecord,
} from '../../lib/assignments';
import { listAllClasses } from '../../lib/classes';
import { fileTypeLabel, listAllMaterials, type Material } from '../../lib/materials';
import {
  AssignmentHeader,
  DownloadError,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/assignment/AssignmentUI';
import ClassNavTabs from '../../components/class/ClassNavTabs';

function fileMeta(file: FileRecord): string {
  return `${fileTypeLabel(file)} · ${formatFileSize(file.sizeBytes)}`;
}

export default function StudentMaterialsPage() {
  const [searchParams] = useSearchParams();
  const classId = searchParams.get('classId') ?? '';
  const [classItem, setClassItem] = useState<ClassSummary | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMaterials() {
      setLoading(true);
      setError(null);
      try {
        const classes = await listAllClasses();
        const selectedClass = classes.find((item) => item.id === classId) ?? null;
        const result = selectedClass ? await listAllMaterials(selectedClass.id) : [];
        if (cancelled) return;
        setClassItem(selectedClass);
        setMaterials(result);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được tài liệu môn học.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMaterials();
    return () => {
      cancelled = true;
    };
  }, [classId, refreshKey]);

  async function handleDownload(file: FileRecord) {
    setDownloadError(null);
    setDownloadingId(file.id);
    try {
      await downloadFile(file);
    } catch (downloadFailure: unknown) {
      setDownloadError(downloadFailure instanceof Error ? downloadFailure.message : 'Không tải được tệp.');
    } finally {
      setDownloadingId(null);
    }
  }

  function renderDownloadButton(file: FileRecord) {
    return (
      <button
        type="button"
        className="btn btn--secondary"
        disabled={downloadingId !== null}
        onClick={() => void handleDownload(file)}
      >
        {downloadingId === file.id ? 'Đang tải…' : 'Tải xuống'}
      </button>
    );
  }

  if (loading) return <LoadingState label="Đang tải tài liệu…" />;
  if (error) return <ErrorState message={error} onRetry={() => setRefreshKey((value) => value + 1)} />;

  if (!classItem) {
    return (
      <section className="assignment-page">
        <AssignmentHeader title="Tài liệu môn học" />
        <EmptyState title="Chọn một lớp để xem tài liệu">
          <p>Mở lớp học trong “Lớp của tôi” rồi bấm “Xem tài liệu”.</p>
          <Link className="btn btn--primary" to="/student/classes">Về Lớp của tôi</Link>
        </EmptyState>
      </section>
    );
  }

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title="Tài liệu môn học"
        subtitle={`${classItem.name} · ${classItem.code} · ${materials.length} tài liệu`}
      />
      <ClassNavTabs role="STUDENT" classId={classItem.id} active="materials" />

      {downloadError && <DownloadError message={downloadError} />}

      {materials.length === 0 ? (
        <EmptyState title="Lớp chưa có tài liệu nào." />
      ) : (
        <div className="assignment-card-list">
          {materials.map((material) => {
            const posted = `Đăng ngày ${formatDate(material.createdAt)}`;
            const singleFile = material.files.length === 1 ? material.files[0] : undefined;
            return (
              <article
                className={`assignment-card material-card${singleFile ? ' material-card--single' : ''}`}
                key={material.id}
              >
                <div className="assignment-card-main">
                  <h2>{material.title}</h2>
                  {material.description && <p>{material.description}</p>}
                  <p className="assignment-muted">
                    {singleFile ? `${fileMeta(singleFile)} · ${posted}` : posted}
                    {material.files.length === 0 && ' · Chưa có tệp đính kèm'}
                  </p>
                </div>
                {singleFile && renderDownloadButton(singleFile)}
                {material.files.length > 1 && (
                  <ul className="material-file-list">
                    {material.files.map((file) => (
                      <li key={file.id}>
                        <span className="assignment-muted">
                          <span className="material-file-name">{file.originalName}</span> · {fileMeta(file)}
                        </span>
                        {renderDownloadButton(file)}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
