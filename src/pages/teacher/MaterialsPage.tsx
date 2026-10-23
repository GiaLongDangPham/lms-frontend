import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { formatDate, type ClassSummary } from '../../lib/assignments';
import { listAllClasses } from '../../lib/classes';
import { listAllMaterials, summarizeMaterialFiles, type Material } from '../../lib/materials';
import {
  AssignmentHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/assignment/AssignmentUI';
import ClassNavTabs from '../../components/class/ClassNavTabs';

function noticeFrom(state: unknown): string | null {
  if (typeof state === 'object' && state !== null && 'notice' in state && typeof state.notice === 'string') {
    return state.notice;
  }
  return null;
}

export default function TeacherMaterialsPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const classId = searchParams.get('classId') ?? '';
  const notice = noticeFrom(location.state);
  const [classItem, setClassItem] = useState<ClassSummary | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  if (loading) return <LoadingState label="Đang tải tài liệu…" />;
  if (error) return <ErrorState message={error} onRetry={() => setRefreshKey((value) => value + 1)} />;

  if (!classItem) {
    return (
      <section className="assignment-page">
        <AssignmentHeader title="Tài liệu môn học" />
        <EmptyState title="Chọn một lớp để xem tài liệu">
          <p>Mở lớp học trong “Lớp của tôi” rồi bấm “Xem tài liệu”.</p>
          <Link className="btn btn--primary" to="/teacher/classes">Về Lớp của tôi</Link>
        </EmptyState>
      </section>
    );
  }

  const newMaterialPath = `/teacher/materials/new?classId=${encodeURIComponent(classItem.id)}`;

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title="Tài liệu môn học"
        subtitle={`${classItem.name} · ${classItem.code}`}
        action={<Link className="btn btn--primary" to={newMaterialPath}>Đăng tài liệu</Link>}
      />
      <ClassNavTabs role="TEACHER" classId={classItem.id} active="materials" />

      {notice && (
        <section className="assignment-notice assignment-result" role="status">
          <p>{notice}</p>
        </section>
      )}

      {materials.length === 0 ? (
        <EmptyState title="Lớp chưa có tài liệu nào.">
          <Link className="btn btn--primary" to={newMaterialPath}>Đăng tài liệu đầu tiên</Link>
        </EmptyState>
      ) : (
        <div className="assignment-table-wrap">
          <table className="assignment-table">
            <thead>
              <tr>
                <th scope="col">Tài liệu</th>
                <th scope="col">Loại</th>
                <th scope="col">Ngày đăng</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((material) => (
                <tr key={material.id}>
                  <td>{material.title}</td>
                  <td>{summarizeMaterialFiles(material.files)}</td>
                  <td>{formatDate(material.createdAt)}</td>
                  <td>
                    <Link
                      className="btn btn--secondary"
                      to={`/teacher/materials/${material.id}/edit?classId=${encodeURIComponent(classItem.id)}`}
                    >
                      Chỉnh sửa
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="assignment-notice">
        <strong>Tài liệu dùng chung trong lớp</strong>
        <p>Các giảng viên được phân công có quyền quản lý nội dung ngang nhau.</p>
      </section>
    </section>
  );
}
