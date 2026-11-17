import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus, School, Wand2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStudents } from '../useStudents';
import { assignStudents, createClass, normalizeClassName, suggestClassName, useClasses } from '../classes';

export default function ClassesPage() {
  const { user } = useAuth();
  const { classes, loading, error } = useClasses();
  const { students } = useStudents();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const counts = useMemo(() => {
    const c = {};
    students.forEach((s) => {
      if (s.classId) c[s.classId] = (c[s.classId] ?? 0) + 1;
    });
    return c;
  }, [students]);

  const classIds = new Set(classes.map((c) => c.id));
  const unassigned = students.filter((s) => !s.classId || !classIds.has(s.classId));

  // 반이 없는 학생을 학번 앞자리로 묶어 보기: { '3학년 2반': [학생...] }
  const autoGroups = useMemo(() => {
    const g = {};
    unassigned.forEach((s) => {
      const n = suggestClassName(s.studentId);
      if (n) (g[n] ??= []).push(s);
    });
    return g;
  }, [unassigned]);
  const autoNames = Object.keys(autoGroups).sort();

  const run = async (fn) => {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(`실패: ${e.code ?? e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const onCreate = (e) => {
    e.preventDefault();
    const n = normalizeClassName(name);
    if (!n) return;
    if (classes.some((c) => c.name === n)) return setErr(`'${n}' 반이 이미 있어요.`);
    // 바로 비워서 다음 반 이름을 이어서 입력할 수 있게 하고, 실패하면 되돌림
    setName('');
    run(async () => {
      try {
        await createClass(n, user.uid);
      } catch (e2) {
        setName(n);
        throw e2;
      }
      setMsg(`'${n}' 반을 만들었어요.`);
    });
  };

  const onAuto = () => {
    const summary = autoNames.map((n) => `${n} ${autoGroups[n].length}명`).join(', ');
    if (!confirm(`학번 앞자리로 반을 나눠 배정할까요?\n\n${summary}\n\n같은 이름의 반이 있으면 그 반에 넣고, 없으면 새로 만듭니다.`)) return;
    run(async () => {
      for (const n of autoNames) {
        const existing = classes.find((c) => c.name === n);
        const id = existing ? existing.id : await createClass(n, user.uid);
        await assignStudents(autoGroups[n].map((s) => s.uid), id);
      }
      setMsg(`${autoNames.length}개 반에 ${autoNames.reduce((a, n) => a + autoGroups[n].length, 0)}명을 배정했어요.`);
    });
  };

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <h2>반 {classes.length}개</h2>
          <form className="row" onSubmit={onCreate}>
            <input
              className="input-inline"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="새 반 이름 (예: 3학년 2반)"
              maxLength={30}
              aria-label="새 반 이름"
            />
            <button className="btn primary" type="submit" disabled={!name.trim() || busy}>
              <Plus size={18} /> 반 만들기
            </button>
          </form>
        </div>

        {error && <p className="error">불러오기 실패: {error}</p>}
        {err && <p className="error">{err}</p>}
        {msg && <p className="info">{msg}</p>}

        {unassigned.length > 0 && (
          <div className="notice">
            <div>
              <b>반이 없는 학생 {unassigned.length}명</b>
              {autoNames.length > 0 && (
                <span className="muted"> · 학번으로 나누면 {autoNames.map((n) => `${n}(${autoGroups[n].length})`).join(', ')}</span>
              )}
            </div>
            {autoNames.length > 0 && (
              <button className="btn" onClick={onAuto} disabled={busy}>
                <Wand2 size={18} /> 학번으로 자동 배정
              </button>
            )}
          </div>
        )}

        {!loading && classes.length === 0 ? (
          <div className="empty">
            <School size={32} strokeWidth={1.5} />
            <p>아직 반이 없어요. 위에서 반을 만들거나, 학번으로 자동 배정해 보세요.</p>
          </div>
        ) : (
          <div className="class-grid">
            {classes.map((c) => (
              <Link key={c.id} to={`/teacher/classes/${c.id}`} className="class-card">
                <span className="stat-icon"><School size={20} /></span>
                <div className="class-card-body">
                  <div className="class-name">{c.name}</div>
                  <div className="muted small">학생 {counts[c.id] ?? 0}명</div>
                </div>
                <ChevronRight size={18} className="chev" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
