// [F0] ProtectedRoute — bảo vệ route theo role
// Redirect về /login nếu chưa xác thực; redirect nếu sai role
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../lib/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: Role;
}

export default function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="loading-screen" aria-label="Đang xác thực…">
        <div className="loading-spinner" aria-hidden="true" />
        <p>Đang tải…</p>
      </div>
    );
  }

  if (!user) {
    // Lưu lại URL để redirect sau khi đăng nhập
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  if (user.role !== allowedRole) {
    // Chuyển về dashboard đúng role
    const dashboardByRole: Record<Role, string> = {
      ADMIN: '/admin',
      TEACHER: '/teacher',
      STUDENT: '/student',
    };
    return <Navigate to={dashboardByRole[user.role]} replace />;
  }

  return <>{children}</>;
}
