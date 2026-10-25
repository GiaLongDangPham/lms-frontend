import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { formatDate, type ClassSummary, type Enrollment } from '../../lib/assignments';
import { formatTermLabel, listClassTeachers } from '../../lib/classes';
import {
  adminErrorMessage,
  getClass,
  listAllEnrollments,
  removeTeacher,
  setEnrollmentActive,
  type ManagedRole,
} from '../../lib/admin';
import { noticeFrom } from '../../lib/notice';
import type { User } from '../../lib/types';
import {
  AssignmentHeader,
  ErrorState,
  LoadingState,
  SuccessNotice,
} from '../../components/assignment/AssignmentUI';
import MemberPickerDialog from '../../components/admin/MemberPickerDialog';
import { useConfirm } from '../../hooks/useConfirm';

export default function AdminClassDetailPage() {
  const { classId = '' } = useParams();
  const location = useLocation();
  const [classItem, setClassItem] = useState<ClassSummary | null>(null);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(noticeFrom(location.state));
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickerRole, setPickerRole] = useState<ManagedRole | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { confirm, confirmDialog } = useConfirm();

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      setLoadError(null);
      try {
        const [loadedClass, teacherPage, loadedEnrollments] = await Promise.all([
          getClass(classId),
          listClassTeachers(classId),
          listAllEnrollments(classId),
        ]);
        if (cancelled) return;
        setClassItem(loadedClass);
        setTeachers(teacherPage.items);
        setEnrollments(loadedEnrollments);
      } catch (failure: unknown) {
        if (!cancelled) setLoadError(adminErrorMessage(failure));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [classId, refreshKey]);

  async function runAction(id: string, action: () => Promise<unknown>, successMessage: string) {
    setBusyId(id);
    setActionError(null);
    setNotice(null);
    try {
      await action();
      setNotice(successMessage);
      setRefreshKey((value) => value + 1);
    } catch (failure: unknown) {
      setActionError(adminErrorMessage(failure));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemoveTeacher(teacher: User) {
    const confirmed = await confirm({
      title: 'Gỡ giảng viên khỏi lớp?',
      message: `${teacher.fullName} (${teacher.schoolCode}) sẽ không còn quản lý lớp ${classItem?.courseCode ?? ''} · ${classItem?.code ?? ''}.`,
      confirmLabel: 'Gỡ',
    });
    if (!confirmed) return;
    void runAction(teacher.id, () => removeTeacher(classId, teacher.id), `Đã gỡ ${teacher.fullName} khỏi lớp.`);
  }

  async function handleDeactivate(enrollment: Enrollment) {
    const confirmed = await confirm({
      title: 'Ngừng ghi danh sinh viên?',
      message: `${enrollment.student.fullName} (${enrollment.student.schoolCode}) sẽ không còn thấy lớp; bài nộp và điểm cũ vẫn được giữ.`,
      confirmLabel: 'Ngừng ghi danh',
    });
    if (!confirmed) return;
    void runAction(
      enrollment.id,
      () => setEnrollmentActive(classId, enrollment.id, false),
      `Đã ngừng ghi danh ${enrollment.student.fullName}.`,
    );
  }

  function handleReactivate(enrollment: Enrollment) {
    void runAction(
      enrollment.id,
      () => setEnrollmentActive(classId, enrollment.id, true),
      `Đã ghi danh lại ${enrollment.student.fullName}.`,
    );
  }

  if (loading) return <LoadingState label="Đang tải thông tin lớp…" />;
  if (loadError || !classItem) {
    return <ErrorState message={loadError ?? 'Không tìm thấy lớp.'} onRetry={() => setRefreshKey((value) => value + 1)} />;
  }

  const activeEnrollments = enrollments.filter((enrollment) => enrollment.isActive);
  const inactiveEnrollments = enrollments.filter((enrollment) => !enrollment.isActive);

  return (
    <section className="assignment-page">
      <Link className="admin-back-link" to="/admin/classes">← Danh sách lớp</Link>
      <AssignmentHeader
        title={classItem.name}
        subtitle={`${classItem.courseCode} · ${classItem.code} · ${formatTermLabel(classItem.term)}`}
        action={<Link className="btn btn--secondary" to={`/admin/classes/${classItem.id}/edit`}>Sửa thông tin lớp</Link>}
      />

      {notice && <SuccessNotice message={notice} />}
      {actionError && <ErrorState message={actionError} />}
      {classItem.description && <p className="admin-class-description">{classItem.description}</p>}

      <section className="assignment-card admin-section">
        <header className="admin-section-header">
          <h2>Giảng viên ({teachers.length})</h2>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setPickerRole('TEACHER')}>
            Thêm giảng viên
          </button>
        </header>
        {teachers.length === 0 ? (
          <p className="assignment-muted">Chưa phân công giảng viên nào.</p>
        ) : (
          <div className="assignment-table-wrap">
            <table className="assignment-table">
              <thead>
                <tr>
                  <th scope="col">Mã số</th>
                  <th scope="col">Họ tên</th>
                  <th scope="col"><span className="visually-hidden">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td>{teacher.schoolCode}</td>
                    <td>{teacher.fullName}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        disabled={busyId !== null}
                        onClick={() => void handleRemoveTeacher(teacher)}
                      >
                        {busyId === teacher.id ? 'Đang gỡ…' : 'Gỡ'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="assignment-card admin-section">
        <header className="admin-section-header">
          <h2>Sinh viên đang học ({activeEnrollments.length})</h2>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setPickerRole('STUDENT')}>
            Thêm sinh viên
          </button>
        </header>
        {activeEnrollments.length === 0 ? (
          <p className="assignment-muted">Chưa có sinh viên nào được ghi danh.</p>
        ) : (
          <div className="assignment-table-wrap">
            <table className="assignment-table">
              <thead>
                <tr>
                  <th scope="col">Mã số</th>
                  <th scope="col">Họ tên</th>
                  <th scope="col">Ghi danh</th>
                  <th scope="col"><span className="visually-hidden">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {activeEnrollments.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td>{enrollment.student.schoolCode}</td>
                    <td>{enrollment.student.fullName}</td>
                    <td>{formatDate(enrollment.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        disabled={busyId !== null}
                        onClick={() => void handleDeactivate(enrollment)}
                      >
                        {busyId === enrollment.id ? 'Đang xử lý…' : 'Ngừng ghi danh'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {inactiveEnrollments.length > 0 && (
          <details className="admin-inactive">
            <summary>Sinh viên đã ngừng ghi danh ({inactiveEnrollments.length})</summary>
            <ul className="admin-result-list">
              {inactiveEnrollments.map((enrollment) => (
                <li key={enrollment.id}>
                  <span>{enrollment.student.schoolCode} · {enrollment.student.fullName}</span>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={busyId !== null}
                    onClick={() => handleReactivate(enrollment)}
                  >
                    {busyId === enrollment.id ? 'Đang xử lý…' : 'Ghi danh lại'}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {confirmDialog}

      {pickerRole && (
        <MemberPickerDialog
          key={pickerRole}
          role={pickerRole}
          classId={classItem.id}
          existingIds={new Set(pickerRole === 'TEACHER'
            ? teachers.map((teacher) => teacher.id)
            : activeEnrollments.map((enrollment) => enrollment.student.id))}
          enrollments={enrollments}
          onClose={() => setPickerRole(null)}
          onDone={(summary) => {
            setPickerRole(null);
            setActionError(null);
            setNotice(summary);
            setRefreshKey((value) => value + 1);
          }}
        />
      )}
    </section>
  );
}
