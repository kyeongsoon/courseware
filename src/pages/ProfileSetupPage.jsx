import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Google 로그인 직후처럼 학번이 비어 있는 학생이 이름/학번을 입력하는 페이지
export default function ProfileSetupPage() {
  const { user, profile, completeProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? user?.displayName ?? '');
  const [studentId, setStudentId] = useState(profile?.studentId ?? '');
  const [error, setError] = useState('');

  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <div className="center">프로필을 준비하는 중…</div>;
  // 이미 입력이 끝났거나 교사라면 대시보드로
  if (profile.role === 'teacher' || (profile.studentId && profile.displayName)) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{4,5}$/.test(studentId)) return setError('학번은 숫자 4~5자리로 입력해 주세요. (예: 30215)');
    try {
      await completeProfile({ displayName: displayName.trim(), studentId });
      navigate('/', { replace: true });
    } catch (err) {
      setError(`저장 실패: ${err.code ?? err.message}`);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card" onSubmit={onSubmit}>
        <h1>프로필 입력</h1>
        <p className="muted">선생님이 누구인지 알 수 있도록 이름과 학번을 입력해 주세요.</p>
        <label>
          이름
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </label>
        <label>
          학번
          <input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="예: 30215" inputMode="numeric" required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" type="submit">저장하고 시작하기</button>
        <button type="button" className="link" onClick={logout}>다른 계정으로 로그인</button>
      </form>
    </div>
  );
}
