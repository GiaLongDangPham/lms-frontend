import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { changePassword } from '../lib/auth';
import { adminErrorMessage } from '../lib/admin';
import AuthLayout from '../layouts/AuthLayout';

const minPasswordLength = 12;

export default function ChangePasswordPage() {
  const { user, isLoading, logout, endSession } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isLoading && !user) return <Navigate to="/login" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (newPassword.length < minPasswordLength || newPassword.length > 256) {
      setError(`Mật khẩu mới cần từ ${minPasswordLength} đến 256 ký tự.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      endSession();
      void navigate('/login', {
        replace: true,
        state: { notice: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới.' },
      });
    } catch (failure: unknown) {
      setError(adminErrorMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthLayout redirectSignedIn={false}>
      <h1 className="auth-title">Đổi mật khẩu</h1>
      <p className="auth-subtitle">
        {user?.mustChangePassword
          ? 'Tài khoản dùng mật khẩu do quản trị viên cấp. Hãy đặt mật khẩu mới trước khi tiếp tục.'
          : 'Đặt mật khẩu mới cho tài khoản của bạn.'}
      </p>

      <form onSubmit={(event) => void handleSubmit(event)} noValidate aria-label="Form đổi mật khẩu">
        <label className="form-field">
          <span className="form-label">Mật khẩu hiện tại</span>
          <input
            type="password"
            className="form-input"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label className="form-field">
          <span className="form-label">Mật khẩu mới</span>
          <input
            type="password"
            className="form-input"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={minPasswordLength}
            required
          />
          <span className="form-hint">Ít nhất {minPasswordLength} ký tự.</span>
        </label>
        <label className="form-field">
          <span className="form-label">Nhập lại mật khẩu mới</span>
          <input
            type="password"
            className="form-input"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </label>

        {error && <div role="alert" className="form-error-banner">{error}</div>}

        <button type="submit" className="btn btn--primary btn--full" disabled={saving}>
          {saving ? 'Đang lưu…' : 'Đổi mật khẩu'}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--full"
          disabled={saving}
          onClick={() => void logout().finally(() => void navigate('/login', { replace: true }))}
        >
          Đăng xuất
        </button>
      </form>
    </AuthLayout>
  );
}
