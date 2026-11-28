import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function DeletedAccount() {
  const { logout } = useAuth();
  return (
    <div className="auth-wrap">
      <div className="card">
        <h1>삭제된 계정이에요</h1>
        <p className="muted">선생님이 이 계정을 삭제했어요. 새 계정이 필요하면 선생님께 말씀해 주세요.</p>
        <button className="btn primary" onClick={logout}>로그아웃</button>
      </div>
    </div>
  );
}

/**
 * 로그인한 사용자만 접근 가능한 라우트.
 * - requireTeacher: 교사만 접근
 * - 학번/이름이 비어 있으면 프로필 입력 페이지로 보냄
 * - 교사가 준 초기 비밀번호를 그대로 쓰고 있으면 비밀번호 변경 페이지로 보냄
 */
export default function ProtectedRoute({ children, requireTeacher = false }) {
  const { user, profile, loading, isTeacher } = useAuth();
  const location = useLocation();

  if (loading) return <div className="center">불러오는 중…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  // 교사가 삭제한 학생 계정: 아무 화면도 열지 않고 안내만
  if (profile?.deleted) return <DeletedAccount />;

  const needsProfile = !profile || (!isTeacher && (!profile.studentId || !profile.displayName));
  if (needsProfile && location.pathname !== '/profile-setup') {
    return <Navigate to="/profile-setup" replace />;
  }
  if (!needsProfile && profile.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  if (requireTeacher && !isTeacher) return <Navigate to="/" replace />;

  return children;
}
