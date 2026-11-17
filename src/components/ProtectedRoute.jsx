import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * 로그인한 사용자만 접근 가능한 라우트.
 * - requireTeacher: 교사만 접근
 * - 학번/이름이 비어 있으면 프로필 입력 페이지로 보냄
 */
export default function ProtectedRoute({ children, requireTeacher = false }) {
  const { user, profile, loading, isTeacher } = useAuth();
  const location = useLocation();

  if (loading) return <div className="center">불러오는 중…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  const needsProfile = !profile || (!isTeacher && (!profile.studentId || !profile.displayName));
  if (needsProfile && location.pathname !== '/profile-setup') {
    return <Navigate to="/profile-setup" replace />;
  }
  if (requireTeacher && !isTeacher) return <Navigate to="/" replace />;

  return children;
}
