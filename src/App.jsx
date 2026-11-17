import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import TeacherAccountsPage from './pages/TeacherAccountsPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import HelpPage from './pages/HelpPage';
import ClassesPage from './pages/ClassesPage';
import ClassDetailPage from './pages/ClassDetailPage';
import TeacherLessonsPage from './pages/TeacherLessonsPage';
import LessonEditorPage from './pages/LessonEditorPage';
import LessonViewPage from './pages/LessonViewPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetupPage /></ProtectedRoute>} />

          {/* 로그인 후 화면: 왼쪽 사이드바 + 본문 */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/lessons/:lessonId" element={<LessonViewPage />} />
            <Route path="/teacher/lessons" element={<ProtectedRoute requireTeacher><TeacherLessonsPage /></ProtectedRoute>} />
            <Route path="/teacher/lessons/new" element={<ProtectedRoute requireTeacher><LessonEditorPage /></ProtectedRoute>} />
            <Route path="/teacher/lessons/:lessonId/edit" element={<ProtectedRoute requireTeacher><LessonEditorPage key="edit" /></ProtectedRoute>} />
            <Route path="/teacher/classes" element={<ProtectedRoute requireTeacher><ClassesPage /></ProtectedRoute>} />
            <Route path="/teacher/classes/:classId" element={<ProtectedRoute requireTeacher><ClassDetailPage /></ProtectedRoute>} />
            <Route path="/teacher/students" element={<ProtectedRoute requireTeacher><StudentsPage /></ProtectedRoute>} />
            <Route path="/teacher/accounts" element={<ProtectedRoute requireTeacher><TeacherAccountsPage /></ProtectedRoute>} />
            <Route path="/teacher" element={<Navigate to="/teacher/students" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
