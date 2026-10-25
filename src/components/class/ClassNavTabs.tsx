import { Link } from 'react-router-dom';
import type { ClassViewerRole } from '../../lib/classes';

const tabs = [
  { key: 'materials', label: 'Tài liệu', path: 'materials' },
  { key: 'assignments', label: 'Bài tập', path: 'assignments' },
] as const;

export default function ClassNavTabs({
  role,
  classId,
  active,
}: {
  role: ClassViewerRole;
  classId: string;
  active: (typeof tabs)[number]['key'];
}) {
  const basePath = role === 'TEACHER' ? '/teacher' : '/student';
  return (
    <nav className="class-nav-tabs" aria-label="Điều hướng lớp học">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          className={`btn ${tab.key === active ? 'btn--primary' : 'btn--secondary'}`}
          to={`${basePath}/${tab.path}?classId=${encodeURIComponent(classId)}`}
          aria-current={tab.key === active ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
