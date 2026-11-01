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
import ChangePasswordPage from './pages/ChangePasswordPage';
import AdminClassesPage from './pages/admin/ClassesPage';
import AdminClassFormPage from './pages/admin/ClassFormPage';
import AdminClassDetailPage from './pages/admin/ClassDetailPage';
import AdminUsersPage from './pages/admin/UsersPage';
import AdminUserFormPage from './pages/admin/UserFormPage';
import TeacherDashboardPage from './pages/teacher/DashboardPage';
import StudentDashboardPage from './pages/student/DashboardPage';
import TeacherAssignmentsPage from './pages/teacher/AssignmentsPage';
import TeacherAssignmentFormPage from './pages/teacher/AssignmentFormPage';
import TeacherAssignmentSubmissionsPage from './pages/teacher/AssignmentSubmissionsPage';
import TeacherMaterialsPage from './pages/teacher/MaterialsPage';
import TeacherMaterialFormPage from './pages/teacher/MaterialFormPage';
import GradeSubmissionPage from './pages/teacher/GradeSubmissionPage';
import PublishAssignmentGradesPage from './pages/teacher/PublishAssignmentGradesPage';
import StudentAssignmentsPage from './pages/student/AssignmentsPage';
import StudentAssignmentDetailPage from './pages/student/AssignmentDetailPage';
import StudentAssignmentResultPage from './pages/student/AssignmentResultPage';
import StudentSubmissionFormPage from './pages/student/SubmissionFormPage';
import StudentSubmissionHistoryPage from './pages/student/SubmissionHistoryPage';
import StudentSubmissionVersionPage from './pages/student/SubmissionVersionPage';
import StudentMaterialsPage from './pages/student/MaterialsPage';

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
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
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
          <Route path="/change-password" element={<ChangePasswordPage />} />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRole="ADMIN">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="classes" replace />} />
            <Route path="classes" element={<AdminClassesPage />} />
            <Route path="classes/new" element={<AdminClassFormPage />} />
            <Route path="classes/:classId" element={<AdminClassDetailPage />} />
            <Route path="classes/:classId/edit" element={<AdminClassFormPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/new" element={<AdminUserFormPage />} />
            <Route path="users/:userId/edit" element={<AdminUserFormPage />} />
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
            <Route path="materials" element={<TeacherMaterialsPage />} />
            <Route path="materials/new" element={<TeacherMaterialFormPage />} />
            <Route path="materials/:materialId/edit" element={<TeacherMaterialFormPage />} />
            <Route path="assignments" element={<TeacherAssignmentsPage />} />
            <Route path="assignments/new" element={<TeacherAssignmentFormPage />} />
            <Route path="assignments/:assignmentId/edit" element={<TeacherAssignmentFormPage />} />
            <Route path="assignments/:assignmentId/submissions" element={<TeacherAssignmentSubmissionsPage />} />
            <Route path="assignments/:assignmentId/submissions/:submissionId/grade" element={<GradeSubmissionPage />} />
            <Route path="assignments/:assignmentId/publish" element={<PublishAssignmentGradesPage />} />
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
            <Route path="materials" element={<StudentMaterialsPage />} />
            <Route path="assignments" element={<StudentAssignmentsPage />} />
            <Route path="assignments/:assignmentId" element={<StudentAssignmentDetailPage />} />
            <Route path="assignments/:assignmentId/result" element={<StudentAssignmentResultPage />} />
            <Route path="assignments/:assignmentId/submit" element={<StudentSubmissionFormPage />} />
            <Route path="assignments/:assignmentId/history" element={<StudentSubmissionHistoryPage />} />
            <Route path="assignments/:assignmentId/history/:versionNumber" element={<StudentSubmissionVersionPage />} />
            <Route path="notifications" element={<StudentDashboardPage />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
