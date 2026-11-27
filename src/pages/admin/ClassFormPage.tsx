import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  adminErrorMessage,
  buildTerm,
  createClass,
  getClass,
  parseTerm,
  semesters,
  updateClass,
  type Semester,
} from '../../lib/admin';
import { AssignmentHeader, ErrorState, LoadingState } from '../../components/assignment/AssignmentUI';

const codePattern = /^[A-Za-z0-9_-]+$/;

function currentAcademicTerm(now = new Date()): { startYear: number; semester: Semester } {
  const month = now.getMonth() + 1;
  const startYear = month >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const semester: Semester = month >= 8 ? 1 : month <= 5 ? 2 : 3;
  return { startYear, semester };
}

export default function ClassFormPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(classId);
  const defaultTerm = currentAcademicTerm();
  const [courseCode, setCourseCode] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [startYear, setStartYear] = useState(defaultTerm.startYear);
  const [semester, setSemester] = useState<Semester>(defaultTerm.semester);
  const [freeTerm, setFreeTerm] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;

    async function loadClass(id: string) {
      try {
        const loaded = await getClass(id);
        if (cancelled) return;
        setCourseCode(loaded.courseCode);
        setName(loaded.name);
        setCode(loaded.code);
        setDescription(loaded.description ?? '');
        const parsed = parseTerm(loaded.term);
        if (parsed) {
          setStartYear(parsed.startYear);
          setSemester(parsed.semester);
        } else {
          setFreeTerm(loaded.term);
        }
      } catch (failure: unknown) {
        if (!cancelled) setLoadError(adminErrorMessage(failure));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadClass(classId);
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const yearOptions = [...new Set([
    ...Array.from({ length: 5 }, (_, index) => defaultTerm.startYear - 2 + index),
    startYear,
  ])].sort((a, b) => a - b);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const trimmedCourseCode = courseCode.trim().toUpperCase();
    const term = freeTerm === null ? buildTerm(startYear, semester) : freeTerm.trim();
    if (!codePattern.test(trimmedCourseCode) || trimmedCourseCode.length > 50) {
      setError('Mã môn chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới (tối đa 50 ký tự).');
      return;
    }
    if (!name.trim() || !code.trim() || !term) {
      setError('Vui lòng nhập tên môn, mã lớp và học kỳ.');
      return;
    }

    const input = {
      courseCode: trimmedCourseCode,
      name: name.trim(),
      code: code.trim(),
      term,
      description: description.trim() || null,
    };
    setSaving(true);
    try {
      if (classId) {
        await updateClass(classId, input);
        void navigate(`/admin/classes/${classId}`, { state: { notice: 'Đã lưu thông tin lớp.' } });
      } else {
        const created = await createClass(input);
        void navigate(`/admin/classes/${created.id}`, {
          state: {
            notice: `Đã tạo lớp ${created.courseCode} · ${created.code}. Tiếp theo: phân công giảng viên và ghi danh sinh viên.`,
          },
        });
      }
    } catch (failure: unknown) {
      setError(adminErrorMessage(failure, 'Đã có lớp cùng mã môn, mã lớp và học kỳ.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Đang tải thông tin lớp…" />;
  if (loadError) return <ErrorState message={loadError} />;

  return (
    <section className="assignment-page">
      <AssignmentHeader
        title={editing ? 'Sửa thông tin lớp' : 'Tạo lớp'}
        subtitle={editing ? undefined : 'Sau khi tạo, bạn có thể phân công giảng viên và ghi danh sinh viên.'}
      />
      {error && <ErrorState message={error} />}
      <form className="assignment-form assignment-card" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className="assignment-form-grid">
          <label className="form-field">
            <span className="form-label">Tên môn</span>
            <input
              className="form-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={200}
              placeholder="Cơ sở dữ liệu"
              required
            />
          </label>
          <label className="form-field">
            <span className="form-label">Mã môn</span>
            <input
              className="form-input"
              value={courseCode}
              onChange={(event) => setCourseCode(event.target.value.toUpperCase())}
              maxLength={50}
              placeholder="CO2013"
              required
            />
            <span className="form-hint">Ví dụ: CO2013. Chỉ gồm chữ, số, - hoặc _.</span>
          </label>
        </div>

        <div className="assignment-form-grid">
          <label className="form-field">
            <span className="form-label">Mã lớp</span>
            <input
              className="form-input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={50}
              placeholder="L01"
              required
            />
          </label>
          {freeTerm === null ? (
            <div className="admin-term-fields">
              <label className="form-field">
                <span className="form-label">Năm học</span>
                <select className="form-input" value={startYear} onChange={(event) => setStartYear(Number(event.target.value))}>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>{year}–{year + 1}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="form-label">Học kỳ</span>
                <select
                  className="form-input"
                  value={semester}
                  onChange={(event) => setSemester(Number(event.target.value) as Semester)}
                >
                  {semesters.map((item) => (
                    <option key={item} value={item}>HK{item}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <label className="form-field">
              <span className="form-label">Học kỳ</span>
              <input
                className="form-input"
                value={freeTerm}
                onChange={(event) => setFreeTerm(event.target.value)}
                maxLength={50}
                required
              />
              <span className="form-hint">Học kỳ cũ không theo dạng 2026-HK1 nên được giữ nguyên.</span>
            </label>
          )}
        </div>

        <label className="form-field">
          <span className="form-label">Mô tả (không bắt buộc)</span>
          <textarea
            className="form-input assignment-textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={5000}
            rows={3}
          />
        </label>

        <div className="assignment-form-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo lớp'}
          </button>
          <Link className="btn btn--secondary" to={classId ? `/admin/classes/${classId}` : '/admin/classes'}>
            Hủy
          </Link>
        </div>
      </form>
    </section>
  );
}
