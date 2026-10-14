// [F0] Layout Student (SV) — sidebar navigation + main content area
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/student/classes', label: 'Lớp của tôi', icon: '🏫' },
  { to: '/student/assignments', label: 'Bài tập', icon: '📝' },
  { to: '/student/notifications', label: 'Thông báo', icon: '🔔' },
];

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    void navigate('/login');
  }

  return (
    <div className="app-layout">
      <aside className="sidebar" aria-label="Menu sinh viên">
        <div className="sidebar-header">
          <span className="sidebar-brand-icon" aria-hidden="true">🎓</span>
          <span className="sidebar-brand-name">LMS</span>
          <span className="role-badge role-badge--student">Sinh viên</span>
        </div>
        <nav>
          <ul className="nav-list" role="list">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">{user?.fullName ?? '—'}</span>
            <span className="user-code">{user?.schoolCode ?? ''}</span>
          </div>
          <button
            type="button"
            id="student-logout-btn"
            className="btn btn--ghost btn--sm"
            onClick={() => void handleLogout()}
          >
            Đăng xuất
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
