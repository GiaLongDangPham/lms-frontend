import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  listAssignments,
  listClasses,
  formatDateTime,
  type Assignment,
  type ClassSummary,
} from '../../lib/assignments';
import {
  AssignmentHeader,
  AssignmentTabs,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/assignment/AssignmentUI';

export default function TeacherAssignmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get('classId') ?? '';
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadAssignments() {
      setLoading(true);
      setError(null);
      try {
        const classPage = await listClasses();
        if (cancelled) return;
        setClasses(classPage.items);

        const requestedClassId = classId || classPage.items[0]?.id;
        const selectedClassId = classPage.items.some((classItem) => classItem.id === requestedClassId)
          ? requestedClassId
          : classPage.items[0]?.id;
        if (!selectedClassId) {
          setAssignments([]);
          setLoading(false);
          return;
        }
        if (selectedClassId !== classId) {
          setSearchParams({ classId: selectedClassId }, { replace: true });
          return;
        }

        const assignmentPage = await listAssignments(selectedClassId);
        if (cancelled) return;
        setAssignments(assignmentPage.items);
      } catch (loadError: unknown) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Không tải được danh sách bài tập.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAssignments();
    return () => {
      cancelled = true;
    };
  }, [classId, refreshKey, setSearchParams]);

  const selectedClass = classes.find((classItem) => classItem.id === classId);

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title="Bài tập của lớp"
        subtitle={selectedClass ? `${selectedClass.name} · ${selectedClass.code}` : 'Quản lý bài tập'}
        action={classId
          ? <Link className="btn btn--primary" to={`/teacher/assignments/new?classId=${encodeURIComponent(classId)}`}>Tạo bài tập</Link>
          : undefined}
      />

      <AssignmentTabs selected="assignments" className={selectedClass?.code} />

      {classes.length > 1 && (
        <label className="assignment-filter">
          <span>Lớp học</span>
          <select
            className="form-input"
            value={classId}
            onChange={(event) => setSearchParams({ classId: event.target.value })}
          >
            {classes.map((classItem) => (
              <option key={classItem.id} value={classItem.id}>
                {classItem.name} · {classItem.code}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <ErrorState message={error} onRetry={() => setRefreshKey((value) => value + 1)} />}
      {loading && <LoadingState label="Đang tải bài tập…" />}
      {!loading && !error && assignments.length === 0 && (
        <EmptyState title="Lớp chưa có bài tập">
          <Link className="btn btn--primary" to={`/teacher/assignments/new?classId=${encodeURIComponent(classId)}`}>
            Tạo bài tập đầu tiên
          </Link>
        </EmptyState>
      )}

      {!loading && !error && assignments.length > 0 && (
        <div className="assignment-card-list">
          {assignments.map((assignment) => (
            <article className="assignment-card assignment-teacher-card" key={assignment.id}>
              <div className="assignment-card-main">
                <h2>{assignment.title}</h2>
                <p>Hạn nộp {formatDateTime(assignment.deadlineAt)}</p>
                <span className="status-badge status-badge--neutral">
                  {assignment.submittedCount ?? 0}/{assignment.studentCount ?? 0} sinh viên đã nộp
                </span>
              </div>
              <div className="assignment-card-actions">
                <Link
                  className="btn btn--primary"
                  to={`/teacher/assignments/${assignment.id}/submissions`}
                >
                  Xem bài nộp
                </Link>
                <Link
                  className="btn btn--secondary"
                  to={`/teacher/assignments/${assignment.id}/edit?classId=${encodeURIComponent(classId)}`}
                >
                  Sửa bài tập
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
