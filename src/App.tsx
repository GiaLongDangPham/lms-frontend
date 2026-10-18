// [F0] App root — routing SPA theo 3 role (Admin, Teacher, Student)
// react-router-dom v7 · AuthContext · ProtectedRoute theo role
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import TeacherLayout from './layouts/TeacherLayout';
import StudentLayout from './layouts/StudentLayout';

// Pages
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminDashboardPage from './pages/admin/DashboardPage';
import TeacherDashboardPage from './pages/teacher/DashboardPage';
import StudentDashboardPage from './pages/student/DashboardPage';

// ProtectedRoute
import ProtectedRoute from './components/ProtectedRoute';
import type { Role } from './lib/types';

// Root redirect theo role của người dùng đang đăng nhập
function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="loading-screen" aria-label="Đang tải…">
        <div className="loading-spinner" aria-hidden="true" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  const dashboardByRole: Record<Role, string> = {
    ADMIN: '/admin',
    TEACHER: '/teacher',
    STUDENT: '/student',
  };
  return <Navigate to={dashboardByRole[user.role]} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Trang gốc — redirect theo role */}
          <Route path="/" element={<RootRedirect />} />

          {/* Đăng nhập */}
          <Route path="/login" element={<LoginPage />} />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRole="ADMIN">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminDashboardPage />} />
            <Route path="classes" element={<AdminDashboardPage />} />
          </Route>

          {/* Teacher routes */}
          <Route
            path="/teacher"
            element={
              <ProtectedRoute allowedRole="TEACHER">
                <TeacherLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<TeacherDashboardPage />} />
            <Route path="classes" element={<TeacherDashboardPage />} />
            <Route path="assignments" element={<TeacherDashboardPage />} />
          </Route>

          {/* Student routes */}
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRole="STUDENT">
                <StudentLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<StudentDashboardPage />} />
            <Route path="classes" element={<StudentDashboardPage />} />
            <Route path="assignments" element={<StudentDashboardPage />} />
            <Route path="notifications" element={<StudentDashboardPage />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
