import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, BookOpen, Check, Eye, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useClasses } from '../classes';
import { LIMITS, createUnit, deleteUnit, groupByUnit, moveItem, renameUnit, useLessons, useUnits } from '../lessons';

function ClassChips({ ids, classNameOf }) {
  const names = ids.map((id) => classNameOf[id]).filter(Boolean);
  if (!names.length) return <span className="tag muted-tag">비공개</span>;
  return (
    <span className="chips">
      {names.map((n) => <span key={n} className="tag done">{n}</span>)}
    </span>
  );
}

function UnitPanel({ unit, lessons, index, units, classNameOf, busy, run }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(unit.title);

  const onRename = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    run(async () => {
      await renameUnit(unit.id, title);
      setEditing(false);
    });
  };

  const onDelete = () => {
    if (!confirm(`'${unit.title}' 단원을 삭제할까요?`)) return;
    run(() => deleteUnit(unit.id));
  };

  return (
    <section className="panel unit-panel">
      <div className="panel-head">
        {editing ? (
          <form className="row" onSubmit={onRename}>
            <input className="input-inline" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.unitTitle} autoFocus aria-label="단원 이름" />
            <button className="btn primary small" type="submit"><Check size={16} /> 저장</button>
            <button className="btn small" type="button" onClick={() => { setTitle(unit.title); setEditing(false); }}><X size={16} /> 취소</button>
          </form>
        ) : (
          <h2 className="unit-title">
            <span className="unit-no">{index + 1}단원</span> {unit.title}
          </h2>
        )}
        {!editing && (
          <div className="row">
            <button className="icon-btn" title="단원 위로" onClick={() => run(() => moveItem('units', units, index, -1))} disabled={busy || index === 0}><ArrowUp size={18} /></button>
            <button className="icon-btn" title="단원 아래로" onClick={() => run(() => moveItem('units', units, index, 1))} disabled={busy || index === units.length - 1}><ArrowDown size={18} /></button>
            <button className="btn small" onClick={() => setEditing(true)}><Pencil size={16} /> 이름</button>
            <button
              className="btn small danger"
              onClick={onDelete}
              disabled={busy || lessons.length > 0}
              title={lessons.length ? '차시가 있는 단원은 지울 수 없어요. 차시를 먼저 지우거나 옮기세요.' : '단원 삭제'}
            >
              <Trash2 size={16} /> 삭제
            </button>
          </div>
        )}
      </div>

      {lessons.length > 0 && (
        <ol className="lesson-list">
          {lessons.map((l, i) => (
            <li key={l.id} className="lesson-row">
              <span className="lesson-no">{i + 1}차시</span>
              <div className="lesson-main">
                <Link to={`/lessons/${l.id}`} className="lesson-title">{l.title}</Link>
                <ClassChips ids={l.openClassIds ?? []} classNameOf={classNameOf} />
              </div>
              <div className="row nowrap">
                <button className="icon-btn" title="위로" onClick={() => run(() => moveItem('lessons', lessons, i, -1))} disabled={busy || i === 0}><ArrowUp size={18} /></button>
                <button className="icon-btn" title="아래로" onClick={() => run(() => moveItem('lessons', lessons, i, 1))} disabled={busy || i === lessons.length - 1}><ArrowDown size={18} /></button>
                <Link className="btn small" to={`/lessons/${l.id}`}><Eye size={16} /> 보기</Link>
                <Link className="btn small" to={`/teacher/lessons/${l.id}/edit`}><Pencil size={16} /> 수정</Link>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div>
        <Link className="btn small" to={`/teacher/lessons/new?unit=${unit.id}`}><Plus size={16} /> 차시 추가</Link>
      </div>
    </section>
  );
}

export default function TeacherLessonsPage() {
  const { user } = useAuth();
  const { units, loading } = useUnits();
  const { lessons } = useLessons({ isTeacher: true });
  const { classes } = useClasses();
  const classNameOf = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes]);
  const groups = groupByUnit(units, lessons);

  const [newUnit, setNewUnit] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

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

  const onCreateUnit = (e) => {
    e.preventDefault();
    const value = newUnit;
    if (!value.trim()) return;
    // 바로 비워서 다음 이름을 이어서 입력할 수 있게 하고, 실패하면 되돌림
    setNewUnit('');
    run(async () => {
      try {
        await createUnit(value, units, user.uid);
      } catch (e2) {
        setNewUnit(value);
        throw e2;
      }
    });
  };

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <h2>단원 {units.length}개 · 차시 {lessons.length}개</h2>
          <form className="row" onSubmit={onCreateUnit}>
            <input
              className="input-inline"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="새 단원 이름 (예: 자료와 정보)"
              maxLength={LIMITS.unitTitle}
              aria-label="새 단원 이름"
            />
            <button className="btn primary" type="submit" disabled={!newUnit.trim() || busy}><Plus size={18} /> 단원 만들기</button>
          </form>
        </div>
        <p className="muted small">차시마다 <b>공개할 반</b>을 고르면 그 반 학생에게만 보여요. 아무 반도 고르지 않으면 비공개(교사만 보기)예요.</p>
        {err && <p className="error">{err}</p>}
      </section>

      {!loading && units.length === 0 ? (
        <section className="panel empty">
          <BookOpen size={32} strokeWidth={1.5} />
          <p>아직 단원이 없어요. 위에서 첫 단원을 만들어 보세요.</p>
        </section>
      ) : (
        groups.map((g, i) => (
          <UnitPanel key={g.unit.id} unit={g.unit} lessons={g.lessons} index={i} units={units} classNameOf={classNameOf} busy={busy} run={run} />
        ))
      )}
    </>
  );
}
