import type { ReactNode } from 'react';
import type { Assignment, FileRecord } from '../../lib/assignments';
import { formatFileSize } from '../../lib/assignments';

export function LoadingState({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return (
    <div className="assignment-state" role="status">
      <span className="loading-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="form-error-banner assignment-error" role="alert">
      <span>{message}</span>
      {onRetry && <button type="button" className="btn btn--secondary" onClick={onRetry}>Thử lại</button>}
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className="assignment-card assignment-empty">
      <h2>{title}</h2>
      {children && <div>{children}</div>}
    </section>
  );
}

export function AssignmentHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="assignment-heading">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="assignment-heading-action">{action}</div>}
    </header>
  );
}

export function AssignmentTabs({
  selected,
  className,
}: {
  selected: string;
  className?: string;
}) {
  return (
    <nav className="assignment-tabs" aria-label="Thông tin lớp học">
      <span>Tổng quan</span>
      <span>Tài liệu</span>
      <span className={selected === 'assignments' ? 'assignment-tab--active' : undefined}>Bài tập</span>
      {className && <span className="assignment-tabs-context">{className}</span>}
    </nav>
  );
}

export function AssignmentFiles({
  files,
  onDownload,
  emptyLabel = 'Không có tệp đính kèm.',
}: {
  files: FileRecord[];
  onDownload?: (file: FileRecord) => void;
  emptyLabel?: string;
}) {
  if (files.length === 0) return <p className="assignment-muted">{emptyLabel}</p>;

  return (
    <ul className="assignment-file-list">
      {files.map((file) => (
        <li key={file.id}>
          <div className="assignment-file-meta">
            <span className="assignment-file-name">{file.originalName}</span>
            <span>{file.mimeType} · {formatFileSize(file.sizeBytes)}</span>
          </div>
          {onDownload && (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => onDownload(file)}
            >
              Tải xuống
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AssignmentStatus({ assignment }: { assignment: Assignment }) {
  const status = assignment.mySubmissionStatus;
  const labels: Record<NonNullable<Assignment['mySubmissionStatus']>, string> = {
    NOT_SUBMITTED: 'Chưa nộp',
    SUBMITTED: 'Đã nộp đúng hạn',
    LATE: 'Đã nộp trễ',
    GRADED: 'Đã chấm',
  };
  if (!status) return <span className="status-badge status-badge--neutral">Chưa có trạng thái</span>;
  const modifier = status === 'LATE'
    ? 'warning'
    : status === 'SUBMITTED' || status === 'GRADED' ? 'success' : 'neutral';
  return <span className={`status-badge status-badge--${modifier}`}>{labels[status]}</span>;
}

export function SubmissionStatus({
  isLate,
  current,
}: {
  isLate: boolean;
  current?: boolean;
}) {
  return (
    <div className="assignment-badges">
      {current && <span className="status-badge status-badge--success">Bản hiện hành</span>}
      <span className={`status-badge status-badge--${isLate ? 'warning' : 'success'}`}>
        {isLate ? 'Nộp trễ' : 'Đúng hạn'}
      </span>
    </div>
  );
}

export function DownloadError({ message }: { message: string }) {
  return <p className="assignment-inline-error" role="alert">{message}</p>;
}
