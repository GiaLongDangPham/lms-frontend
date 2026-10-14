// [F0] 404 Not Found page
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="page-placeholder page-placeholder--center">
      <p className="page-placeholder-eyebrow">404</p>
      <h1>Không tìm thấy trang</h1>
      <p>Trang này không tồn tại hoặc bạn không có quyền truy cập.</p>
      <Link to="/" className="btn btn--primary">Về trang chủ</Link>
    </div>
  );
}
