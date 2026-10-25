// [F0] LoginPage — form đăng nhập với schoolCode + password
// Gọi mock D2: POST /api/auth/login → token → redirect theo role
import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ApiClientError } from '../lib/apiClient';
import AuthLayout from '../layouts/AuthLayout';
import { noticeFrom } from '../lib/notice';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [schoolCode, setSchoolCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // URL trước đó muốn vào (nếu bị ProtectedRoute chặn)
  const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  const notice = noticeFrom(location.state);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(schoolCode, password);
      // Sau khi login(), user đã được set trong context.
      // Redirect về fromPath hoặc root (RootRedirect sẽ xử lý theo role).
      const target = fromPath ?? '/';
      void navigate(target, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          setError('Mã số hoặc mật khẩu không đúng. Vui lòng thử lại.');
        } else if (err.code === 'UNKNOWN' || err.message.toLowerCase().includes('fetch')) {
          setError('Không thể kết nối máy chủ. Kiểm tra backend đang chạy.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="auth-title">Đăng nhập</h1>
      <p className="auth-subtitle">Hệ thống Quản lý Học tập · Nhóm 2</p>
      {notice && <p className="auth-notice" role="status">{notice}</p>}

      <form
        id="login-form"
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
        aria-label="Form đăng nhập"
      >
        <div className="form-field">
          <label htmlFor="login-school-code" className="form-label">
            Mã số (schoolCode)
          </label>
          <input
            id="login-school-code"
            type="text"
            className="form-input"
            value={schoolCode}
            onChange={(e) => setSchoolCode(e.target.value)}
            placeholder="VD: SV001"
            autoComplete="username"
            autoFocus
            required
            aria-required="true"
            aria-describedby={error ? 'login-error' : undefined}
          />
        </div>

        <div className="form-field">
          <label htmlFor="login-password" className="form-label">
            Mật khẩu
          </label>
          <input
            id="login-school-password"
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu"
            autoComplete="current-password"
            required
            aria-required="true"
            aria-describedby={error ? 'login-error' : undefined}
          />
        </div>

        {error && (
          <div id="login-error" role="alert" className="form-error-banner">
            {error}
          </div>
        )}

        <button
          id="login-submit-btn"
          type="submit"
          className="btn btn--primary btn--full"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>

      <p className="auth-hint">
        Tài khoản được cấp sẵn. Không có chức năng tự đăng ký.
        Demo: ADMIN001 (mock: AD001) / GV001 / SV001 — mật khẩu <code>local-demo-password</code>.
      </p>
    </AuthLayout>
  );
}
