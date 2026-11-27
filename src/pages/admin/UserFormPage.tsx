import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminErrorMessage, createUser, getUser, updateUser, type ManagedRole } from '../../lib/admin';
import type { User } from '../../lib/types';
import { AssignmentHeader, ErrorState, LoadingState } from '../../components/assignment/AssignmentUI';

const schoolCodePattern = /^[A-Za-z0-9_-]+$/;
const roleLabels: Record<User['role'], string> = { ADMIN: 'Quản trị', TEACHER: 'Giảng viên', STUDENT: 'Sinh viên' };

export default function UserFormPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(userId);
  const [existing, setExisting] = useState<User | null>(null);
  const [schoolCode, setSchoolCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ManagedRole>('STUDENT');
  const [initialPassword, setInitialPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function loadUser(id: string) {
      try {
        const loaded = await getUser(id);
        if (cancelled) return;
        setExisting(loaded);
        setFullName(loaded.fullName);
        setEmail(loaded.email ?? '');
      } catch (failure: unknown) {
        if (!cancelled) setLoadError(adminErrorMessage(failure));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadUser(userId);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError('Vui lòng nhập họ tên.');
      return;
    }
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Email chưa đúng định dạng.');
      return;
    }

    setSaving(true);
    try {
      if (userId) {
        await updateUser(userId, { fullName: trimmedName, email: trimmedEmail || null });
        void navigate('/admin/users', { state: { notice: `Đã lưu thông tin ${trimmedName}.` } });
        return;
      }
      const code = schoolCode.trim().toUpperCase();
      if (!schoolCodePattern.test(code) || code.length > 50) {
        setError('Mã số chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới (tối đa 50 ký tự).');
        return;
      }
      if (initialPassword.length < 12 || initialPassword.length > 256) {
        setError('Mật khẩu ban đầu cần từ 12 đến 256 ký tự.');
        return;
      }
      const created = await createUser({
        schoolCode: code,
        fullName: trimmedName,
        email: trimmedEmail || null,
        role,
        initialPassword,
      });
      void navigate('/admin/users', {
        state: {
          notice: `Đã tạo tài khoản ${created.schoolCode}. Hãy gửi mật khẩu ban đầu cho người dùng; họ phải đổi mật khẩu khi đăng nhập lần đầu.`,
        },
      });
    } catch (failure: unknown) {
      setError(adminErrorMessage(failure, 'Mã số này đã tồn tại.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Đang tải tài khoản…" />;
  if (loadError) return <ErrorState message={loadError} />;
  if (existing?.role === 'ADMIN') {
    return <ErrorState message="Tài khoản quản trị được quản lý ngoài hệ thống, không sửa được ở đây." />;
  }

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title={editing ? 'Sửa tài khoản' : 'Tạo tài khoản'}
        subtitle={editing ? undefined : 'Không có tự đăng ký; quản trị viên cấp tài khoản cho giảng viên và sinh viên.'}
      />
      {error && <ErrorState message={error} />}
      <form className="assignment-form assignment-card" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className="assignment-form-grid">
          <label className="form-field">
            <span className="form-label">Mã số</span>
            {editing ? (
              <input className="form-input" value={existing?.schoolCode ?? ''} disabled />
            ) : (
              <input
                className="form-input"
                value={schoolCode}
                onChange={(event) => setSchoolCode(event.target.value.toUpperCase())}
                maxLength={50}
                placeholder="SV004"
                autoComplete="off"
                required
              />
            )}
          </label>
          <label className="form-field">
            <span className="form-label">Vai trò</span>
            {editing ? (
              <input className="form-input" value={existing ? roleLabels[existing.role] : ''} disabled />
            ) : (
              <select className="form-input" value={role} onChange={(event) => setRole(event.target.value as ManagedRole)}>
                <option value="STUDENT">Sinh viên</option>
                <option value="TEACHER">Giảng viên</option>
              </select>
            )}
          </label>
        </div>

        <div className="assignment-form-grid">
          <label className="form-field">
            <span className="form-label">Họ tên</span>
            <input
              className="form-input"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={200}
              required
            />
          </label>
          <label className="form-field">
            <span className="form-label">Email (không bắt buộc)</span>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
            />
          </label>
        </div>

        {!editing && (
          <>
            <label className="form-field">
              <span className="form-label">Mật khẩu ban đầu</span>
              <input
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                value={initialPassword}
                onChange={(event) => setInitialPassword(event.target.value)}
                autoComplete="new-password"
                minLength={12}
                required
              />
              <span className="form-hint">
                Ít nhất 12 ký tự. Hệ thống không hiển thị lại mật khẩu này; người dùng phải đổi khi đăng nhập lần đầu.
              </span>
            </label>
            <label className="admin-checkbox">
              <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
              Hiện mật khẩu
            </label>
          </>
        )}

        <div className="assignment-form-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </button>
          <Link className="btn btn--secondary" to="/admin/users">Hủy</Link>
        </div>
      </form>
    </section>
  );
}
