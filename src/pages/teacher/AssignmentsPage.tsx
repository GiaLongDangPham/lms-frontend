import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  formatDateTime,
  listAllAssignments,
  sortAssignmentsByDeadline,
  type Assignment,
  type ClassSummary,
} from '../../lib/assignments';
import { listAllClasses } from '../../lib/classes';
import {
  AssignmentHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/assignment/AssignmentUI';
import ClassNavTabs from '../../components/class/ClassNavTabs';

interface TeacherAssignment extends Assignment {
  classLabel: string;
}

export default function TeacherAssignmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get('classId') ?? '';
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadAssignments() {
      setLoading(true);
      setError(null);
      try {
        const allClasses = await listAllClasses();
        if (cancelled) return;
        setClasses(allClasses);
        if (classId && !allClasses.some((classItem) => classItem.id === classId)) {
          setSearchParams({}, { replace: true });
          return;
        }
        const targetClasses = classId
          ? allClasses.filter((classItem) => classItem.id === classId)
          : allClasses;
        const perClass = await Promise.all(targetClasses.map(async (classItem) => {
          const items = await listAllAssignments(classItem.id);
          return items.map((assignment) => ({
            ...assignment,
            classLabel: `${classItem.name} · ${classItem.code}`,
          }));
        }));
        if (!cancelled) setAssignments(sortAssignmentsByDeadline(perClass.flat()));
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được danh sách bài tập.');
        }
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
  const newAssignmentPath = selectedClass
    ? `/teacher/assignments/new?classId=${encodeURIComponent(selectedClass.id)}`
    : '/teacher/assignments/new';

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title="Bài tập"
        subtitle={selectedClass
          ? `${selectedClass.name} · ${selectedClass.code} · ${assignments.length} bài tập`
          : `Tất cả lớp · ${assignments.length} bài tập`}
        action={<Link className="btn btn--primary" to={newAssignmentPath}>Tạo bài tập</Link>}
      />

      {selectedClass && <ClassNavTabs role="TEACHER" classId={selectedClass.id} active="assignments" />}

      {classes.length > 0 && (
        <label className="assignment-filter">
          <span>Lớp học</span>
          <select
            className="form-input"
            value={classId}
            onChange={(event) => setSearchParams(event.target.value ? { classId: event.target.value } : {})}
          >
            <option value="">Tất cả lớp</option>
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
        <EmptyState title={selectedClass ? 'Lớp chưa có bài tập' : 'Chưa có bài tập nào trong các lớp bạn dạy.'}>
          <Link className="btn btn--primary" to={newAssignmentPath}>
            {selectedClass ? 'Tạo bài tập đầu tiên' : 'Tạo bài tập'}
          </Link>
        </EmptyState>
      )}

      {!loading && !error && assignments.length > 0 && (
        <div className="assignment-card-list">
          {assignments.map((assignment) => (
            <article className="assignment-card assignment-teacher-card" key={assignment.id}>
              <div className="assignment-card-main">
                <h2>{assignment.title}</h2>
                {!selectedClass && <p className="assignment-muted">{assignment.classLabel}</p>}
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
                  to={`/teacher/assignments/${assignment.id}/edit?classId=${encodeURIComponent(assignment.classId)}`}
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
