// [F0] Layout Teacher (GV) — sidebar navigation + main content area
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/teacher/classes', label: 'Lớp của tôi', icon: '🏫' },
  { to: '/teacher/assignments', label: 'Bài tập', icon: '📝' },
];

export default function TeacherLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    void navigate('/login');
  }

  return (
    <div className="app-layout">
      <aside className="sidebar" aria-label="Menu giảng viên">
        <div className="sidebar-header">
          <span className="sidebar-brand-icon" aria-hidden="true">🎓</span>
          <span className="sidebar-brand-name">LMS</span>
          <span className="role-badge role-badge--teacher">Giảng viên</span>
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
            id="teacher-logout-btn"
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
