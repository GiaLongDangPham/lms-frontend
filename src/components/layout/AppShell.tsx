import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
}

export default function AppShell({
  navItems,
  roleLabel,
  roleClass,
  menuLabel,
  logoutButtonId,
}: {
  navItems: NavItem[];
  roleLabel: string;
  roleClass: 'admin' | 'teacher' | 'student';
  menuLabel: string;
  logoutButtonId: string;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  function closeMenu(returnFocus = true) {
    setMenuOpen(false);
    if (returnFocus) openButtonRef.current?.focus();
  }

  useEffect(() => {
    if (!menuOpen) return;
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      openButtonRef.current?.focus();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  async function handleLogout() {
    await logout();
    void navigate('/login');
  }

  const roleBadge = <span className={`role-badge role-badge--${roleClass}`}>{roleLabel}</span>;

  return (
    <div className={`app-layout${menuOpen ? ' app-layout--menu-open' : ''}`}>
      <header className="app-topbar">
        <button
          ref={openButtonRef}
          type="button"
          className="app-menu-button"
          aria-label="Mở menu"
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          onClick={() => setMenuOpen(true)}
        >
          <span aria-hidden="true">☰</span>
        </button>
        <span className="sidebar-brand-name">LMS</span>
        {roleBadge}
      </header>

      <aside id="app-sidebar" className="sidebar" aria-label={menuLabel}>
        <div className="sidebar-header">
          <span className="sidebar-brand-icon" aria-hidden="true">🎓</span>
          <span className="sidebar-brand-name">LMS</span>
          {roleBadge}
          <button
            ref={closeButtonRef}
            type="button"
            className="app-menu-close"
            aria-label="Đóng menu"
            onClick={() => closeMenu()}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <nav>
          <ul className="nav-list" role="list">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
                  onClick={() => closeMenu(false)}
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
            id={logoutButtonId}
            className="btn btn--ghost btn--sm"
            onClick={() => void handleLogout()}
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="app-sidebar-backdrop" aria-hidden="true" onClick={() => closeMenu()} />

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
