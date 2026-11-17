import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardPage() {
  const { user, profile, isTeacher, logout } = useAuth();
  const hasPassword = user?.providerData.some((p) => p.providerId === 'password');

  return (
    <div className="page">
      <header className="topbar">
        <strong>정보 코스웨어</strong>
        <div>
          <span className="badge">{isTeacher ? '교사' : '학생'}</span>
          <span>{profile?.displayName}{profile?.studentId && ` (${profile.studentId})`}</span>
          {hasPassword && <Link to="/change-password">비밀번호 변경</Link>}
          <button className="btn small" onClick={logout}>로그아웃</button>
        </div>
      </header>
      <main>
        <h2>안녕하세요, {profile?.displayName}님 👋</h2>
        <p className="muted">로그인에 성공했습니다. 다음 단계에서 수업(단원) 목록이 이곳에 표시됩니다.</p>
        {isTeacher && (
          <p>
            <Link to="/teacher">교사용 페이지 (학생 계정 만들기 · 명단) →</Link>
          </p>
        )}
      </main>
    </div>
  );
}
