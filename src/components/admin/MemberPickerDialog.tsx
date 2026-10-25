import { useEffect, useMemo, useRef, useState } from 'react';
import type { Enrollment } from '../../lib/assignments';
import type { User } from '../../lib/types';
import {
  adminErrorMessage,
  assignTeacher,
  classifyStudentCodes,
  enrollStudent,
  listAllUsers,
  parseSchoolCodes,
  type ManagedRole,
  type StudentCodeCheck,
  type StudentCodeStatus,
} from '../../lib/admin';

interface MemberResult {
  user: User;
  ok: boolean;
  message: string;
}

const checkLabels: Record<StudentCodeStatus, string> = {
  ADD: 'Sẽ ghi danh',
  REACTIVATE: 'Sẽ ghi danh lại',
  ALREADY_ENROLLED: 'Đã trong lớp',
  INACTIVE_ACCOUNT: 'Tài khoản đã khoá',
  NOT_FOUND: 'Không tìm thấy',
};

export default function MemberPickerDialog({
  role,
  classId,
  existingIds,
  enrollments = [],
  onClose,
  onDone,
}: {
  role: ManagedRole;
  classId: string;
  existingIds: Set<string>;
  enrollments?: Enrollment[];
  onClose: () => void;
  onDone: (summary: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isStudent = role === 'STUDENT';
  const roleLabel = isStudent ? 'sinh viên' : 'giảng viên';
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<'select' | 'paste'>('select');
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pasteText, setPasteText] = useState('');
  const [checks, setChecks] = useState<StudentCodeCheck[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<MemberResult[] | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    listAllUsers(role)
      .then((loaded) => {
        if (!cancelled) setUsers(loaded.sort((a, b) => a.schoolCode.localeCompare(b.schoolCode)));
      })
      .catch((failure: unknown) => {
        if (!cancelled) setLoadError(adminErrorMessage(failure));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  const visibleUsers = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi');
    return users.filter((user) => !keyword
      || `${user.schoolCode} ${user.fullName}`.toLocaleLowerCase('vi').includes(keyword));
  }, [users, query]);

  const pasteTargets = (checks ?? [])
    .filter((check) => check.status === 'ADD' || check.status === 'REACTIVATE')
    .flatMap((check) => (check.student ? [check.student] : []));
  const selectTargets = users.filter((user) => selectedIds.has(user.id));
  const targets = mode === 'paste' ? pasteTargets : selectTargets;

  function toggle(userId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleAdd() {
    setSaving(true);
    const outcome: MemberResult[] = [];
    for (const user of targets) {
      try {
        if (isStudent) await enrollStudent(classId, user.id);
        else await assignTeacher(classId, user.id);
        outcome.push({ user, ok: true, message: isStudent ? 'Đã ghi danh' : 'Đã phân công' });
      } catch (failure: unknown) {
        outcome.push({ user, ok: false, message: adminErrorMessage(failure, 'Đã có trong lớp') });
      }
    }
    setResults(outcome);
    setSaving(false);
  }

  function finish() {
    if (results) {
      const added = results.filter((result) => result.ok).length;
      onDone(`Đã thêm ${added}/${results.length} ${roleLabel} vào lớp.`);
    } else {
      onClose();
    }
  }

  function memberNote(user: User): string | null {
    if (existingIds.has(user.id)) return 'Đã trong lớp';
    if (!user.isActive) return 'Đã khoá';
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      className="admin-dialog"
      aria-labelledby="member-picker-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) finish();
      }}
    >
      <header className="admin-dialog-header">
        <h2 id="member-picker-title">Thêm {roleLabel}</h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={finish} disabled={saving}>Đóng</button>
      </header>

      {results ? (
        <div className="admin-dialog-body">
          <ul className="admin-result-list">
            {results.map((result) => (
              <li key={result.user.id} className={result.ok ? 'admin-result--ok' : 'admin-result--fail'}>
                <span>{result.user.schoolCode} · {result.user.fullName}</span>
                <span>{result.message}</span>
              </li>
            ))}
          </ul>
          <div className="assignment-form-actions">
            <button type="button" className="btn btn--primary" onClick={finish}>Xong</button>
          </div>
        </div>
      ) : (
        <div className="admin-dialog-body">
          {isStudent && (
            <div className="class-nav-tabs" role="tablist" aria-label="Cách thêm sinh viên">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'select'}
                className={`btn ${mode === 'select' ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setMode('select')}
              >
                Chọn từ danh sách
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'paste'}
                className={`btn ${mode === 'paste' ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setMode('paste')}
              >
                Dán danh sách MSSV
              </button>
            </div>
          )}

          {loadError && <p className="assignment-inline-error" role="alert">{loadError}</p>}
          {loading && <p className="assignment-muted">Đang tải danh sách {roleLabel}…</p>}

          {!loading && !loadError && mode === 'select' && (
            <>
              <label className="form-field">
                <span className="form-label">Tìm theo mã số hoặc họ tên</span>
                <input className="form-input" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              {visibleUsers.length === 0 ? (
                <p className="assignment-muted">Không có {roleLabel} phù hợp.</p>
              ) : (
                <ul className="admin-pick-list">
                  {visibleUsers.map((user) => {
                    const note = memberNote(user);
                    return (
                      <li key={user.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(user.id)}
                            disabled={note !== null || saving}
                            onChange={() => toggle(user.id)}
                          />
                          <span>{user.schoolCode} · {user.fullName}</span>
                          {note && <span className="status-badge status-badge--neutral">{note}</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {!loading && !loadError && mode === 'paste' && (
            <>
              <label className="form-field">
                <span className="form-label">Danh sách mã số sinh viên</span>
                <textarea
                  className="form-input assignment-textarea"
                  value={pasteText}
                  onChange={(event) => {
                    setPasteText(event.target.value);
                    setChecks(null);
                  }}
                  placeholder={'SV001\nSV002, SV003'}
                  rows={5}
                />
                <span className="form-hint">Mỗi mã cách nhau bởi xuống dòng, dấu phẩy hoặc khoảng trắng.</span>
              </label>
              <div>
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={!pasteText.trim()}
                  onClick={() => setChecks(classifyStudentCodes(parseSchoolCodes(pasteText), users, enrollments))}
                >
                  Kiểm tra
                </button>
              </div>
              {checks && (
                <ul className="admin-result-list">
                  {checks.map((check) => (
                    <li
                      key={check.code}
                      className={check.status === 'ADD' || check.status === 'REACTIVATE' ? 'admin-result--ok' : 'admin-result--fail'}
                    >
                      <span>{check.code}{check.student ? ` · ${check.student.fullName}` : ''}</span>
                      <span>{checkLabels[check.status]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <div className="assignment-form-actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={targets.length === 0 || saving}
              onClick={() => void handleAdd()}
            >
              {saving ? 'Đang thêm…' : `Thêm ${targets.length} ${roleLabel}`}
            </button>
            <button type="button" className="btn btn--secondary" onClick={finish} disabled={saving}>Hủy</button>
          </div>
        </div>
      )}
    </dialog>
  );
}
