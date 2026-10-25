import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  listAllAssignments,
  formatDateTime,
  sortAssignmentsByDeadline,
  type Assignment,
  type ClassSummary,
} from '../../lib/assignments';
import { listAllClasses } from '../../lib/classes';
import {
  AssignmentHeader,
  AssignmentStatus,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/assignment/AssignmentUI';
import ClassNavTabs from '../../components/class/ClassNavTabs';

interface StudentAssignment extends Assignment {
  classLabel: string;
}

export default function StudentAssignmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get('classId') ?? '';
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
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
  const filteredAssignments = useMemo(() => assignments.filter((assignment) => {
    const matchesQuery = assignment.title.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'));
    const matchesStatus = statusFilter === 'ALL' || assignment.mySubmissionStatus === statusFilter;
    return matchesQuery && matchesStatus;
  }), [assignments, query, statusFilter]);

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title="Bài tập của tôi"
        subtitle={selectedClass
          ? `${selectedClass.name} · ${selectedClass.code} · ${assignments.length} bài tập`
          : `Tất cả lớp · ${assignments.length} bài tập`}
        action={
          classes.length > 0
            ? <label className="assignment-top-select">
                <span className="visually-hidden">Chọn lớp học</span>
                <select
                  className="form-input"
                  value={classId}
                  onChange={(event) => setSearchParams(event.target.value ? { classId: event.target.value } : {})}
                >
                  <option value="">Tất cả lớp</option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>{classItem.name} · {classItem.code}</option>
                  ))}
                </select>
              </label>
            : undefined
        }
      />

      {selectedClass && <ClassNavTabs role="STUDENT" classId={selectedClass.id} active="assignments" />}

      <div className="assignment-filters">
        <label className="assignment-filter">
          <span>Lọc trạng thái</span>
          <select className="form-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">Tất cả</option>
            <option value="NOT_SUBMITTED">Chưa nộp</option>
            <option value="SUBMITTED">Đã nộp đúng hạn</option>
            <option value="LATE">Đã nộp trễ</option>
            <option value="GRADED">Đã chấm</option>
          </select>
        </label>
        <label className="assignment-filter">
          <span>Tìm bài tập</span>
          <input
            className="form-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nhập tên bài tập"
          />
        </label>
      </div>

      {error && <ErrorState message={error} onRetry={() => setRefreshKey((value) => value + 1)} />}
      {loading && <LoadingState label="Đang tải bài tập…" />}
      {!loading && !error && assignments.length === 0 && (
        <EmptyState title={selectedClass ? 'Chưa có bài tập nào trong lớp này.' : 'Bạn chưa có bài tập nào.'} />
      )}
      {!loading && !error && assignments.length > 0 && filteredAssignments.length === 0 && (
        <EmptyState title="Không tìm thấy bài tập phù hợp." />
      )}
      {!loading && !error && filteredAssignments.length > 0 && (
        <div className="assignment-card-list">
          {filteredAssignments.map((assignment) => (
            <article className="assignment-card assignment-student-card" key={assignment.id}>
              <div className="assignment-card-main">
                <h2>{assignment.title}</h2>
                {!selectedClass && <p className="assignment-muted">{assignment.classLabel}</p>}
                <p>Hạn nộp: {formatDateTime(assignment.deadlineAt)}</p>
                <AssignmentStatus assignment={assignment} />
              </div>
              <Link className="btn btn--secondary" to={`/student/assignments/${assignment.id}`}>
                Xem bài tập
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
