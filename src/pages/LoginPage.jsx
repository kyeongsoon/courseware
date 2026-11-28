import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toKoreanMessage } from '../authErrors';

export default function LoginPage() {
  const { user, loginWithGoogle, loginWithId } = useAuth();
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
      // 이동은 위의 `if (user) <Navigate>` 가 맡음. 여기서 또 이동하면 로그인 직후 다른 메뉴를 눌렀을 때
      // 늦게 끝난 로그인 처리가 화면을 홈으로 되돌려 버림
      await fn();
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
        <div className="card-brand">
          <div className="logo" aria-hidden="true">👋</div>
          <h1>Hello, Class!</h1>
        </div>
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
