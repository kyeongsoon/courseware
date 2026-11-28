import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LiveProvider } from './contexts/LiveContext';
import { ClassProvider } from './contexts/ClassContext';
import { FEATURES } from './features';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import TeacherAccountsPage from './pages/TeacherAccountsPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import HelpPage from './pages/HelpPage';
import NoticesPage from './pages/NoticesPage';
import NoticeDetailPage from './pages/NoticeDetailPage';
import PollsPage from './pages/PollsPage';
import PollDetailPage from './pages/PollDetailPage';
import CounselPage from './pages/CounselPage';
import CheckInLinkPage from './pages/CheckInLinkPage';
import AttendancePage from './pages/AttendancePage';
import SeatingPage from './pages/SeatingPage';
import CalendarPage from './pages/CalendarPage';
import TimetablePage from './pages/TimetablePage';
import SchoolSettingsPage from './pages/SchoolSettingsPage';
import ClassesPage from './pages/ClassesPage';
import ClassDetailPage from './pages/ClassDetailPage';
import TeacherLessonsPage from './pages/TeacherLessonsPage';
import LessonEditorPage from './pages/LessonEditorPage';
import LessonViewPage from './pages/LessonViewPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ClassProvider>
        <LiveProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetupPage /></ProtectedRoute>} />

          {/* 로그인 후 화면: 왼쪽 사이드바 + 본문 */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/help" element={<HelpPage />} />
            {/* 학급운영: 소통 */}
            <Route path="/notices" element={<NoticesPage />} />
            <Route path="/notices/:noticeId" element={<NoticeDetailPage />} />
            <Route path="/polls" element={<PollsPage />} />
            <Route path="/polls/:pollId" element={<PollDetailPage />} />
            <Route path="/counsel" element={<CounselPage />} />
            {/* 학급운영: 생활 */}
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/checkin" element={<CheckInLinkPage />} />
            <Route path="/seating" element={<SeatingPage />} />
            {/* 학급운영: 일정 */}
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/timetable" element={<TimetablePage />} />
            {/* 수업·슬라이드·실시간 수업: FEATURES.lessons 가 꺼져 있으면 주소로 들어와도 홈으로 */}
            {FEATURES.lessons && (
              <>
                <Route path="/lessons/:lessonId" element={<LessonViewPage />} />
                <Route path="/teacher/lessons" element={<ProtectedRoute requireTeacher><TeacherLessonsPage /></ProtectedRoute>} />
                <Route path="/teacher/lessons/new" element={<ProtectedRoute requireTeacher><LessonEditorPage /></ProtectedRoute>} />
                <Route path="/teacher/lessons/:lessonId/edit" element={<ProtectedRoute requireTeacher><LessonEditorPage key="edit" /></ProtectedRoute>} />
              </>
            )}
            <Route path="/teacher/school" element={<ProtectedRoute requireTeacher><SchoolSettingsPage /></ProtectedRoute>} />
            <Route path="/teacher/classes" element={<ProtectedRoute requireTeacher><ClassesPage /></ProtectedRoute>} />
            <Route path="/teacher/classes/:classId" element={<ProtectedRoute requireTeacher><ClassDetailPage /></ProtectedRoute>} />
            <Route path="/teacher/students" element={<ProtectedRoute requireTeacher><StudentsPage /></ProtectedRoute>} />
            <Route path="/teacher/accounts" element={<ProtectedRoute requireTeacher><TeacherAccountsPage /></ProtectedRoute>} />
            <Route path="/teacher" element={<Navigate to="/teacher/students" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </LiveProvider>
        </ClassProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
