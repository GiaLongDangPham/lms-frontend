// [F0] Layout cho trang đăng nhập (không có sidebar)
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../lib/types';

const dashboardByRole: Record<Role, string> = {
  ADMIN: '/admin',
  TEACHER: '/teacher',
  STUDENT: '/student',
};

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const { user, isLoading } = useAuth();

  // Nếu đã đăng nhập, redirect về dashboard đúng role
  if (!isLoading && user) {
    return <Navigate to={dashboardByRole[user.role]} replace />;
  }

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-icon" aria-hidden="true">🎓</span>
          <span className="auth-brand-name">LMS Nhóm 2</span>
        </div>
        {children}
      </div>
    </div>
  );
}
