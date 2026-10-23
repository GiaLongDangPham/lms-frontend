import { Link } from 'react-router-dom';

const tabs = [
  { key: 'materials', label: 'Tài liệu', path: '/student/materials' },
  { key: 'assignments', label: 'Bài tập', path: '/student/assignments' },
] as const;

export default function ClassNavTabs({
  classId,
  active,
}: {
  classId: string;
  active: (typeof tabs)[number]['key'];
}) {
  return (
    <nav className="class-nav-tabs" aria-label="Điều hướng lớp học">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          className={`btn ${tab.key === active ? 'btn--primary' : 'btn--secondary'}`}
          to={`${tab.path}?classId=${encodeURIComponent(classId)}`}
          aria-current={tab.key === active ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
