// [F0] Layout Admin — sidebar navigation + main content area
import AppShell from '../components/layout/AppShell';

const NAV_ITEMS = [
  { to: '/admin/classes', label: 'Lớp học', icon: '🏫' },
  { to: '/admin/users', label: 'Tài khoản', icon: '👤' },
];

export default function AdminLayout() {
  return (
    <AppShell
      navItems={NAV_ITEMS}
      roleLabel="Admin"
      roleClass="admin"
      menuLabel="Menu quản trị viên"
      logoutButtonId="admin-logout-btn"
    />
  );
}
