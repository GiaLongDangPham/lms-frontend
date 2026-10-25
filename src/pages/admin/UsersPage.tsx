import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { adminErrorMessage, listAllUsers, resetPassword, updateUser } from '../../lib/admin';
import { noticeFrom } from '../../lib/notice';
import type { Role, User } from '../../lib/types';
import {
  AssignmentHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  SuccessNotice,
} from '../../components/assignment/AssignmentUI';

const roleLabels: Record<Role, string> = { ADMIN: 'Quản trị', TEACHER: 'Giảng viên', STUDENT: 'Sinh viên' };
const roleOrder: Record<Role, number> = { ADMIN: 0, TEACHER: 1, STUDENT: 2 };

function StatusBadge({ user }: { user: User }) {
  if (!user.isActive) return <span className="status-badge status-badge--neutral">Đã khoá</span>;
  if (user.mustChangePassword) return <span className="status-badge status-badge--warning">Chờ đổi mật khẩu</span>;
  return <span className="status-badge status-badge--success">Hoạt động</span>;
}

function ResetPasswordDialog({
  user,
  onClose,
  onDone,
}: {
  user: User;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 12 || password.length > 256) {
      setError('Mật khẩu cần từ 12 đến 256 ký tự.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await resetPassword(user.id, password);
      onDone(`Đã đặt lại mật khẩu cho ${user.schoolCode}. Người dùng phải đổi mật khẩu ở lần đăng nhập tới.`);
    } catch (failure: unknown) {
      setError(adminErrorMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="admin-dialog"
      aria-labelledby="reset-password-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <header className="admin-dialog-header">
        <h2 id="reset-password-title">Đặt lại mật khẩu</h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} disabled={saving}>Đóng</button>
      </header>
      <form className="admin-dialog-body" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <p className="assignment-muted">
          {user.schoolCode} · {user.fullName}. Mọi phiên đăng nhập hiện tại của tài khoản sẽ bị đăng xuất.
        </p>
        <label className="form-field">
          <span className="form-label">Mật khẩu mới</span>
          <input
            type={showPassword ? 'text' : 'password'}
            className="form-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={12}
            required
          />
          <span className="form-hint">Ít nhất 12 ký tự. Hãy gửi mật khẩu này cho người dùng.</span>
        </label>
        <label className="admin-checkbox">
          <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
          Hiện mật khẩu
        </label>
        {error && <p className="assignment-inline-error" role="alert">{error}</p>}
        <div className="assignment-form-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Đặt lại mật khẩu'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>Hủy</button>
        </div>
      </form>
    </dialog>
  );
}

export default function AdminUsersPage() {
  const location = useLocation();
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'ACTIVE' | 'LOCKED'>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(noticeFrom(location.state));
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setError(null);
      try {
        const result = await listAllUsers();
        if (!cancelled) {
          setUsers(result.sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.schoolCode.localeCompare(b.schoolCode)));
        }
      } catch (failure: unknown) {
        if (!cancelled) setError(adminErrorMessage(failure));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi');
    return users.filter((user) => {
      const matchesQuery = !keyword || `${user.schoolCode} ${user.fullName}`.toLocaleLowerCase('vi').includes(keyword);
      const matchesRole = !roleFilter || user.role === roleFilter;
      const matchesStatus = !statusFilter || (statusFilter === 'ACTIVE') === user.isActive;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [users, query, roleFilter, statusFilter]);

  async function toggleActive(user: User) {
    const locking = user.isActive;
    const confirmation = locking
      ? `Khoá tài khoản ${user.schoolCode}? Người dùng bị đăng xuất và không đăng nhập được cho tới khi mở khoá.`
      : `Mở khoá tài khoản ${user.schoolCode}?`;
    if (!window.confirm(confirmation)) return;
    setBusyId(user.id);
    setActionError(null);
    setNotice(null);
    try {
      await updateUser(user.id, { isActive: !locking });
      setNotice(locking ? `Đã khoá tài khoản ${user.schoolCode}.` : `Đã mở khoá tài khoản ${user.schoolCode}.`);
      setRefreshKey((value) => value + 1);
    } catch (failure: unknown) {
      setActionError(adminErrorMessage(failure));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title="Tài khoản"
        subtitle={loading ? 'Đang tải…' : `${filteredUsers.length}/${users.length} tài khoản`}
        action={<Link className="btn btn--primary" to="/admin/users/new">Tạo tài khoản</Link>}
      />

      {notice && <SuccessNotice message={notice} />}
      {actionError && <ErrorState message={actionError} />}

      <div className="assignment-filters">
        <label className="assignment-filter">
          <span>Tìm tài khoản</span>
          <input
            className="form-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Mã số hoặc họ tên"
          />
        </label>
        <label className="assignment-filter">
          <span>Vai trò</span>
          <select className="form-input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as Role | '')}>
            <option value="">Tất cả vai trò</option>
            <option value="ADMIN">Quản trị</option>
            <option value="TEACHER">Giảng viên</option>
            <option value="STUDENT">Sinh viên</option>
          </select>
        </label>
        <label className="assignment-filter">
          <span>Trạng thái</span>
          <select
            className="form-input"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as '' | 'ACTIVE' | 'LOCKED')}
          >
            <option value="">Tất cả</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="LOCKED">Đã khoá</option>
          </select>
        </label>
      </div>

      {error && <ErrorState message={error} onRetry={() => setRefreshKey((value) => value + 1)} />}
      {loading && <LoadingState label="Đang tải danh sách tài khoản…" />}
      {!loading && !error && filteredUsers.length === 0 && <EmptyState title="Không tìm thấy tài khoản phù hợp." />}
      {!loading && !error && filteredUsers.length > 0 && (
        <div className="assignment-table-wrap">
          <table className="assignment-table">
            <thead>
              <tr>
                <th scope="col">Mã số</th>
                <th scope="col">Họ tên</th>
                <th scope="col">Email</th>
                <th scope="col">Vai trò</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.schoolCode}</td>
                  <td>{user.fullName}</td>
                  <td>{user.email ?? '—'}</td>
                  <td>
                    <span className={`role-badge role-badge--${user.role.toLowerCase()}`}>{roleLabels[user.role]}</span>
                  </td>
                  <td><StatusBadge user={user} /></td>
                  <td>
                    {user.role === 'ADMIN' ? (
                      <span className="assignment-muted">—</span>
                    ) : (
                      <div className="admin-row-actions">
                        <Link className="btn btn--secondary btn--sm" to={`/admin/users/${user.id}/edit`}>Sửa</Link>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          disabled={busyId !== null}
                          onClick={() => void toggleActive(user)}
                        >
                          {busyId === user.id ? 'Đang lưu…' : user.isActive ? 'Khoá' : 'Mở khoá'}
                        </button>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          disabled={busyId !== null}
                          onClick={() => setResetTarget(user)}
                        >
                          Đặt lại mật khẩu
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resetTarget && (
        <ResetPasswordDialog
          key={resetTarget.id}
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={(message) => {
            setResetTarget(null);
            setActionError(null);
            setNotice(message);
            setRefreshKey((value) => value + 1);
          }}
        />
      )}
    </section>
  );
}
