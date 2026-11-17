import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toKoreanMessage } from '../authErrors';

export default function ChangePasswordPage() {
  const { profile, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const forced = profile?.mustChangePassword;

  // 변경 완료가 프로필에 반영된 뒤에 이동해야, 아직 true 인 값 때문에 다시 이 페이지로 돌아오지 않음
  if (done && !forced) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (next.length < 6) return setError('새 비밀번호는 6자 이상이어야 해요.');
    if (next !== confirm) return setError('새 비밀번호가 서로 달라요.');
    if (next === current) return setError('지금과 다른 비밀번호를 입력해 주세요.');
    setBusy(true);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (err) {
      setError(toKoreanMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card" onSubmit={onSubmit}>
        <h1>비밀번호 변경</h1>
        <p className="muted">
          {forced ? '처음 로그인했어요. 선생님이 준 비밀번호를 나만 아는 비밀번호로 바꿔 주세요.' : '새 비밀번호를 입력해 주세요.'}
        </p>
        <label>
          현재 비밀번호
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </label>
        <label>
          새 비밀번호 (6자 이상)
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
        </label>
        <label>
          새 비밀번호 확인
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? '변경 중…' : '변경하기'}</button>
        {forced ? (
          <button type="button" className="link" onClick={logout}>로그아웃</button>
        ) : (
          <button type="button" className="link" onClick={() => navigate('/')}>취소</button>
        )}
      </form>
    </div>
  );
}
