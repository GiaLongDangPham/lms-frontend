import { Link } from 'react-router-dom';
import NotificationPreview from '../../components/assignment/NotificationPreview';

export default function StudentDashboardPage() {
  return (
    <section className="assignment-page">
      <header className="assignment-heading">
        <div>
          <h1>Thông báo nhanh</h1>
          <p>Theo dõi bài tập và kết quả mới từ giảng viên.</p>
        </div>
      </header>
      <div className="student-dashboard-grid">
        <section className="assignment-card">
          <h2>Theo dõi việc học</h2>
          <p>Xem bài tập, bài nộp và kết quả đã công bố.</p>
          <Link className="btn btn--secondary" to="/student/assignments">Về bài tập</Link>
        </section>
        <NotificationPreview />
      </div>
    </section>
  );
}
