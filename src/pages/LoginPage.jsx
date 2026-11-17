import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toKoreanMessage } from '../authErrors';

export default function LoginPage() {
  const { user, loginWithGoogle, loginWithEmail, signupWithEmail, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? '/';

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ email: '', password: '', displayName: '', studentId: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const run = async (fn) => {
    setError('');
    setInfo('');
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
    if (mode === 'login') {
      run(() => loginWithEmail(form.email, form.password));
    } else {
      if (!/^\d{4,5}$/.test(form.studentId)) {
        setError('학번은 숫자 4~5자리로 입력해 주세요. (예: 30215)');
        return;
      }
      run(() => signupWithEmail(form));
    }
  };

  const onReset = async () => {
    if (!form.email) return setError('비밀번호를 재설정할 이메일을 먼저 입력해 주세요.');
    try {
      await resetPassword(form.email);
      setError('');
      setInfo('비밀번호 재설정 메일을 보냈어요. 메일함을 확인해 주세요.');
    } catch (err) {
      setError(toKoreanMessage(err));
    }
  };

  return (
    <div className="auth-wrap">
      <div className="card">
        <h1>정보 코스웨어</h1>
        <p className="muted">{mode === 'login' ? '수업에 참여하려면 로그인하세요.' : '처음이라면 계정을 만들어 주세요.'}</p>

        <button className="btn google" onClick={() => run(loginWithGoogle)} disabled={busy}>
          Google 계정으로 계속하기
        </button>

        <div className="divider"><span>또는 이메일</span></div>

        <form onSubmit={onSubmit}>
          {mode === 'signup' && (
            <>
              <label>
                이름
                <input name="displayName" value={form.displayName} onChange={onChange} required />
              </label>
              <label>
                학번
                <input name="studentId" value={form.studentId} onChange={onChange} placeholder="예: 30215" inputMode="numeric" required />
              </label>
            </>
          )}
          <label>
            이메일
            <input type="email" name="email" value={form.email} onChange={onChange} autoComplete="email" required />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={onChange}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </label>

          {error && <p className="error">{error}</p>}
          {info && <p className="info">{info}</p>}

          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? '처리 중…' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>

        <div className="links">
          {mode === 'login' ? (
            <>
              <button className="link" onClick={() => setMode('signup')}>회원가입</button>
              <button className="link" onClick={onReset}>비밀번호 찾기</button>
            </>
          ) : (
            <button className="link" onClick={() => setMode('login')}>이미 계정이 있어요</button>
          )}
        </div>
      </div>
    </div>
  );
}
