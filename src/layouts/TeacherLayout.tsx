// [F0] Layout Teacher (GV) — sidebar navigation + main content area
import AppShell from '../components/layout/AppShell';

const NAV_ITEMS = [
  { to: '/teacher/classes', label: 'Lớp của tôi', icon: '🏫' },
  { to: '/teacher/assignments', label: 'Bài tập', icon: '📝' },
];

export default function TeacherLayout() {
  return (
    <AppShell
      navItems={NAV_ITEMS}
      roleLabel="Giảng viên"
      roleClass="teacher"
      menuLabel="Menu giảng viên"
      logoutButtonId="teacher-logout-btn"
    />
  );
}
