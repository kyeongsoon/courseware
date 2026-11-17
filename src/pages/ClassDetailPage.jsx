import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Pencil, Search, Trash2, UserMinus, UserPlus, X } from 'lucide-react';
import { useStudents } from '../useStudents';
import { assignStudents, deleteClass, normalizeClassName, renameClass, useClasses } from '../classes';

export default function ClassDetailPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { classes, loading: classesLoading } = useClasses();
  const { students, loading } = useStudents();

  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const cls = classes.find((c) => c.id === classId);
  const classNameOf = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes]);

  const members = students.filter((s) => s.classId === classId);
  const others = students.filter((s) => s.classId !== classId);
  const k = q.trim();
  const candidates = (k ? others.filter((s) => s.studentId?.includes(k) || s.displayName?.includes(k)) : others)
    // 반이 없는 학생을 위로
    .sort((a, b) => Number(!!classNameOf[a.classId]) - Number(!!classNameOf[b.classId]));

  if (!classesLoading && !cls) return <Navigate to="/teacher/classes" replace />;
  if (!cls) return <div className="muted">불러오는 중…</div>;

  const run = async (fn) => {
    setErr('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(`실패: ${e.code ?? e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (uid) =>
    setPicked((prev) => {
      const n = new Set(prev);
      n.has(uid) ? n.delete(uid) : n.add(uid);
      return n;
    });

  const allShownPicked = candidates.length > 0 && candidates.every((s) => picked.has(s.uid));
  const toggleAll = () =>
    setPicked((prev) => {
      const n = new Set(prev);
      candidates.forEach((s) => (allShownPicked ? n.delete(s.uid) : n.add(s.uid)));
      return n;
    });

  const onAdd = () => {
    const uids = [...picked];
    const moving = students.filter((s) => picked.has(s.uid) && classNameOf[s.classId]).length;
    if (moving && !confirm(`선택한 학생 중 ${moving}명은 다른 반에서 옮겨집니다. 계속할까요?`)) return;
    run(async () => {
      await assignStudents(uids, classId);
      setPicked(new Set());
    });
  };

  const onRemove = (s) => {
    if (!confirm(`${s.studentId} ${s.displayName} 학생을 ${cls.name}에서 뺄까요? (계정은 그대로 남아요)`)) return;
    run(() => assignStudents([s.uid], null));
  };

  const onRename = (e) => {
    e.preventDefault();
    const n = normalizeClassName(newName);
    if (!n || n === cls.name) return setEditing(false);
    if (classes.some((c) => c.name === n)) return setErr(`'${n}' 반이 이미 있어요.`);
    run(async () => {
      await renameClass(classId, n);
      setEditing(false);
    });
  };

  const onDelete = () => {
    if (!confirm(`'${cls.name}' 반을 삭제할까요?\n소속 학생 ${members.length}명은 '반 없음'이 되고, 학생 계정은 지워지지 않아요.`)) return;
    run(async () => {
      await deleteClass(classId, members.map((s) => s.uid));
      navigate('/teacher/classes', { replace: true });
    });
  };

  return (
    <>
      <Link to="/teacher/classes" className="back-link"><ArrowLeft size={16} /> 반 목록</Link>

      <section className="panel">
        <div className="panel-head">
          {editing ? (
            <form className="row" onSubmit={onRename}>
              <input className="input-inline" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={30} autoFocus aria-label="반 이름" />
              <button className="btn primary small" type="submit" disabled={busy}><Check size={16} /> 저장</button>
              <button className="btn small" type="button" onClick={() => setEditing(false)}><X size={16} /> 취소</button>
            </form>
          ) : (
            <h2 className="class-title">
              {cls.name} <span className="muted">· {members.length}명</span>
            </h2>
          )}
          {!editing && (
            <div className="row">
              <button className="btn small" onClick={() => { setNewName(cls.name); setEditing(true); }}><Pencil size={16} /> 이름 바꾸기</button>
              <button className="btn small danger" onClick={onDelete} disabled={busy}><Trash2 size={16} /> 반 삭제</button>
            </div>
          )}
        </div>
        {err && <p className="error">{err}</p>}

        {!loading && members.length === 0 ? (
          <div className="empty"><p>아직 이 반에 학생이 없어요. 아래에서 학생을 추가하세요.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>학번</th><th>이름</th><th>비밀번호 변경</th><th></th></tr></thead>
              <tbody>
                {members.map((s) => (
                  <tr key={s.uid}>
                    <td>{s.studentId}</td>
                    <td>{s.displayName}</td>
                    <td>{s.mustChangePassword ? <span className="tag warn">아직 안 함</span> : <span className="tag done">완료</span>}</td>
                    <td className="right">
                      <button className="btn small" onClick={() => onRemove(s)} disabled={busy}><UserMinus size={16} /> 빼기</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>학생 추가</h2>
          <div className="row">
            <label className="search inline">
              <Search size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="학번·이름 검색 (예: 302)" />
            </label>
            <button className="btn primary" onClick={onAdd} disabled={!picked.size || busy}>
              <UserPlus size={18} /> 선택한 {picked.size}명 추가
            </button>
          </div>
        </div>

        {others.length === 0 ? (
          <p className="muted">추가할 수 있는 학생이 없어요. 모든 학생이 이 반에 있거나, 아직 학생 계정이 없어요.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="check"><input type="checkbox" checked={allShownPicked} onChange={toggleAll} aria-label="보이는 학생 모두 선택" /></th>
                  <th>학번</th><th>이름</th><th>현재 반</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((s) => (
                  <tr key={s.uid} className="pickable" onClick={() => toggle(s.uid)}>
                    <td className="check">
                      <input type="checkbox" checked={picked.has(s.uid)} onChange={() => toggle(s.uid)} onClick={(e) => e.stopPropagation()} aria-label={`${s.displayName} 선택`} />
                    </td>
                    <td>{s.studentId}</td>
                    <td>{s.displayName}</td>
                    <td>{classNameOf[s.classId] ?? <span className="muted">반 없음</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
