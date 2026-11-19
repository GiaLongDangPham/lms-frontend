// [F0] Layout Student (SV) — sidebar navigation + main content area
import AppShell from '../components/layout/AppShell';

const NAV_ITEMS = [
  { to: '/student/classes', label: 'Lớp của tôi', icon: '🏫' },
  { to: '/student/assignments', label: 'Bài tập', icon: '📝' },
  { to: '/student/notifications', label: 'Thông báo', icon: '🔔' },
];

export default function StudentLayout() {
  return (
    <AppShell
      navItems={NAV_ITEMS}
      roleLabel="Sinh viên"
      roleClass="student"
      menuLabel="Menu sinh viên"
      logoutButtonId="student-logout-btn"
    />
  );
}
