import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toKoreanMessage } from '../authErrors';

export default function LoginPage() {
  const { user, loginWithGoogle, loginWithId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? '/';

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const run = async (fn) => {
    setError('');
    setBusy(true);
    try {
      await fn();
      navigate(from, { replace: true });
    } catch (err) {
      setError(toKoreanMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    run(() => loginWithId(loginId, password));
  };

  return (
    <div className="auth-wrap">
      <div className="card">
        <h1>정보 코스웨어</h1>
        <p className="muted">선생님께 받은 아이디와 비밀번호로 로그인하세요.</p>

        <form onSubmit={onSubmit}>
          <label>
            아이디 (학번)
            <input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="예: 30215"
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? '처리 중…' : '로그인'}
          </button>
        </form>

        <p className="muted small">비밀번호를 잊었다면 선생님께 말씀해 주세요.</p>

        <div className="divider"><span>선생님</span></div>
        <button className="btn google" onClick={() => run(loginWithGoogle)} disabled={busy}>
          Google 계정으로 로그인
        </button>
      </div>
    </div>
  );
}
