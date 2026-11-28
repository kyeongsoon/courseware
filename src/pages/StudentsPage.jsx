import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Search, Trash2, UserPlus } from 'lucide-react';
import { AUTH_CONSOLE_URL, FULL_DELETE, deleteStudents } from '../deleteStudents';
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
  const [picked, setPicked] = useState(() => new Set());
  const [deleting, setDeleting] = useState(null); // { done, total }
  const [delMsg, setDelMsg] = useState('');

  const k = q.trim();
  const shown = students
    .filter((u) => classFilter === 'all' || (classFilter === 'none' ? !classNameOf[u.classId] : u.classId === classFilter))
    .filter((u) => !k || u.studentId?.includes(k) || u.displayName?.includes(k));

  const shownIds = shown.map((u) => u.uid);
  const allPicked = shownIds.length > 0 && shownIds.every((id) => picked.has(id));
  const togglePick = (id) => setPicked((p) => {
    const n = new Set(p);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const toggleAll = () => setPicked((p) => {
    const n = new Set(p);
    shownIds.forEach((id) => (allPicked ? n.delete(id) : n.add(id)));
    return n;
  });

  const onDelete = async (targets) => {
    const names = targets.slice(0, 5).map((u) => `${u.studentId} ${u.displayName}`).join(', ') + (targets.length > 5 ? ` 외 ${targets.length - 5}명` : '');
    const how = FULL_DELETE
      ? '로그인 계정과 출결·설문·상담 기록이 모두 지워지고 되돌릴 수 없어요.'
      : '출결·설문·상담 기록이 지워지고, 이 아이디로는 더 이상 로그인해도 아무것도 할 수 없어요. 되돌릴 수 없어요.';
    if (!confirm(`${targets.length}명을 삭제할까요?\n${names}\n\n${how}`)) return;
    setDelMsg('');
    setDeleting({ done: 0, total: targets.length });
    const res = await deleteStudents(targets, (done, total) => setDeleting({ done, total }));
    setDeleting(null);
    setPicked(new Set());
    const failed = res.filter((r) => !r.ok);
    setDelMsg({
      text: failed.length
        ? `${res.length - failed.length}명 삭제, ${failed.length}명 실패 (${failed.map((f) => f.studentId).join(', ')})`
        : `${res.length}명을 삭제했어요.${FULL_DELETE ? '' : ' 같은 학번으로 다시 만들려면 로그인 계정도 지워 주세요:'}`,
      ids: FULL_DELETE ? [] : res.filter((r) => r.ok).map((r) => r.studentId),
    });
  };

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
          {!FULL_DELETE && (
            <a className="btn" href={AUTH_CONSOLE_URL} target="_blank" rel="noopener noreferrer" title="Firebase 콘솔의 로그인 계정 목록 (새 탭)">
              <ExternalLink size={18} /> Firebase 로그인 계정 관리
            </a>
          )}
          <Link className="btn primary" to="/teacher/accounts"><UserPlus size={18} /> 계정 만들기</Link>
        </div>
      </div>

      {error && <p className="error">불러오기 실패: {error}</p>}
      {resetError && <p className="error">{resetError}</p>}
      {delMsg && (
        <p className="info">
          {delMsg.text}
          {delMsg.ids?.length > 0 && (
            <> <a href={AUTH_CONSOLE_URL} target="_blank" rel="noopener noreferrer">Firebase 로그인 계정 관리 열기</a> (지울 아이디: {delMsg.ids.map((id) => `${id}@…`).join(', ')})</>
          )}
        </p>
      )}
      {picked.size > 0 && (
        <div className="notice">
          <b>{picked.size}명 선택</b>
          <div className="row">
            <button className="btn small" onClick={() => setPicked(new Set())}>선택 해제</button>
            <button className="btn small danger" disabled={!!deleting}
              onClick={() => onDelete(students.filter((u) => picked.has(u.uid)))}>
              <Trash2 size={16} /> {deleting ? `삭제 중… ${deleting.done}/${deleting.total}` : '선택한 학생 삭제'}
            </button>
          </div>
        </div>
      )}

      {!loading && students.length === 0 ? (
        <div className="empty">
          <p>아직 학생 계정이 없어요.</p>
          <Link className="btn primary" to="/teacher/accounts"><UserPlus size={18} /> 첫 학생 계정 만들기</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="check"><input type="checkbox" checked={allPicked} onChange={toggleAll} aria-label="보이는 학생 모두 선택" /></th>
                <th>학번</th><th>이름</th><th>반</th><th>비밀번호 변경</th>{PASSWORD_RESET_ENABLED && <th>비밀번호 초기화</th>}<th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.uid}>
                  <td className="check"><input type="checkbox" checked={picked.has(u.uid)} onChange={() => togglePick(u.uid)} aria-label={`${u.displayName} 선택`} /></td>
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
                  <td className="right">
                    <button className="btn small danger" onClick={() => onDelete([u])} disabled={!!deleting} title="학생 계정 삭제">
                      <Trash2 size={16} /> 삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!PASSWORD_RESET_ENABLED && (
        <p className="muted small">
          학생이 비밀번호를 잊었다면: 여기서 그 학생을 <b>삭제</b>하고,{' '}
          <a href={AUTH_CONSOLE_URL} target="_blank" rel="noopener noreferrer">Firebase 로그인 계정 관리</a>에서
          그 학생(<code>학번@student.invalid</code>) 계정도 지운 뒤 계정 만들기에서 다시 만들어 주세요.
        </p>
      )}
    </section>
  );
}
