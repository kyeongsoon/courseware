import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserPlus } from 'lucide-react';
import { useStudents } from '../useStudents';
import { resetStudentPassword } from '../studentAccounts';
import { useClasses } from '../classes';

// Cloud Functions 배포(Blaze 요금제) 후 .env.local 에 VITE_ENABLE_PASSWORD_RESET=true 로 켜기
const PASSWORD_RESET_ENABLED = import.meta.env.VITE_ENABLE_PASSWORD_RESET === 'true';

export default function StudentsPage() {
  const { students, loading, error, reload } = useStudents();
  const { classes } = useClasses();
  const classNameOf = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes]);
  const [q, setQ] = useState('');
  const [classFilter, setClassFilter] = useState('all'); // 'all' | 'none' | classId
  const [resetting, setResetting] = useState(null);
  const [resetDone, setResetDone] = useState({});
  const [resetError, setResetError] = useState('');

  const k = q.trim();
  const shown = students
    .filter((u) => classFilter === 'all' || (classFilter === 'none' ? !classNameOf[u.classId] : u.classId === classFilter))
    .filter((u) => !k || u.studentId?.includes(k) || u.displayName?.includes(k));

  const onReset = async (u) => {
    if (!confirm(`${u.studentId} ${u.displayName} 학생의 비밀번호를 초기화할까요?`)) return;
    setResetError('');
    setResetting(u.uid);
    try {
      const password = await resetStudentPassword(u.uid);
      setResetDone((prev) => ({ ...prev, [u.uid]: password }));
      reload();
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetting(null);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{shown.length === students.length ? `전체 ${students.length}명` : `${shown.length}명 / 전체 ${students.length}명`}</h2>
        <div className="row">
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="반 필터">
            <option value="all">모든 반</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="none">반 없음</option>
          </select>
          <label className="search inline">
            <Search size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="학번·이름 검색" />
          </label>
          <Link className="btn primary" to="/teacher/accounts"><UserPlus size={18} /> 계정 만들기</Link>
        </div>
      </div>

      {error && <p className="error">불러오기 실패: {error}</p>}
      {resetError && <p className="error">{resetError}</p>}

      {!loading && students.length === 0 ? (
        <div className="empty">
          <p>아직 학생 계정이 없어요.</p>
          <Link className="btn primary" to="/teacher/accounts"><UserPlus size={18} /> 첫 학생 계정 만들기</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>학번</th><th>이름</th><th>반</th><th>비밀번호 변경</th>{PASSWORD_RESET_ENABLED && <th>비밀번호 초기화</th>}</tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.uid}>
                  <td>{u.studentId ?? '-'}</td>
                  <td>{u.displayName}</td>
                  <td>{classNameOf[u.classId] ?? <span className="muted">반 없음</span>}</td>
                  <td>
                    {u.mustChangePassword
                      ? <span className="tag warn">아직 안 함</span>
                      : <span className="tag done">완료</span>}
                  </td>
                  {PASSWORD_RESET_ENABLED && (
                    <td>
                      {resetDone[u.uid] ? (
                        <span>새 비밀번호: <code className="pw">{resetDone[u.uid]}</code></span>
                      ) : (
                        <button className="btn small" onClick={() => onReset(u)} disabled={resetting === u.uid}>
                          {resetting === u.uid ? '초기화 중…' : '초기화'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!PASSWORD_RESET_ENABLED && (
        <p className="muted small">
          학생이 비밀번호를 잊었다면: Firebase 콘솔 → Authentication 에서 그 학생(<code>학번@…</code>)을 삭제하고,
          Firestore <code>users</code> 에서도 문서를 삭제한 뒤 계정 만들기에서 다시 만들어 주세요.
        </p>
      )}
    </section>
  );
}
