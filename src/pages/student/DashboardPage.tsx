import MyClassesView from '../../components/class/MyClassesView';
import NotificationPreview from '../../components/assignment/NotificationPreview';

export default function StudentDashboardPage() {
  return (
    <>
      <MyClassesView role="STUDENT" />
      <NotificationPreview />
    </>
  );
}
