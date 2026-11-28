import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Armchair, Lock, Maximize, Minimize, Printer, RotateCcw, Save, Shuffle, SortAsc } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentClass } from '../contexts/ClassContext';
import ClassGate from '../components/ClassGate';
import { useStudents } from '../useStudents';
import { dateLabel, dateInt } from '../attendance';
import { arrange, emptyLayout, isSeat, isStudent, person, resize, saveSeating, swap, useSeating } from '../seating';

/**
 * 자리표 그리기
 * view 'student': 교탁이 위 (학생이 앉아서 보는 방향)
 * view 'teacher': 교탁이 아래 (교사가 교탁에서 보는 방향, 180도 돌림)
 */
function Grid({ layout, view, selected, myUid, onCell, editable }) {
  const order = [...Array(layout.rows * layout.cols).keys()];
  const shown = view === 'teacher' ? order.reverse() : order;
  const desk = <div className="desk">교탁</div>;
  return (
    <div className="seat-board">
      {view === 'student' && desk}
      <div className="seat-grid" style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}>
        {shown.map((i) => {
          const c = layout.cells[i];
          const cls = ['seat', !isSeat(c) && 'blocked', isStudent(c) && 'taken', selected === i && 'selected',
            layout.locked.includes(i) && 'locked', c?.uid && c.uid === myUid && 'mine', editable && 'editable'].filter(Boolean).join(' ');
          return (
            <button key={i} type="button" className={cls} onClick={() => onCell?.(i)} disabled={!editable && !c?.uid}
              aria-label={!isSeat(c) ? '자리 없음' : c ? `${c.studentId} ${c.name}` : '빈자리'}>
              {layout.locked.includes(i) && <Lock size={12} className="lock-ic" />}
              {!isSeat(c) ? '' : c ? <><span className="seat-name">{c.name}</span><span className="seat-id">{c.studentId}</span></> : <span className="seat-empty">빈자리</span>}
            </button>
          );
        })}
      </div>
      {view === 'teacher' && desk}
    </div>
  );
}

// 인쇄용 자리표: body 바로 아래에 그려 두고, 인쇄할 때만 이것만 보이게 (styles.css @media print)
function PrintSheet({ layout, view, className }) {
  return createPortal(
    <div className="print-sheet">
      <div className="print-head">
        <h1>{className} 자리 배치표</h1>
        <span>{dateLabel(dateInt())} · {view === 'teacher' ? '교사 시점 (교탁이 아래)' : '학생 시점 (교탁이 위)'}</span>
      </div>
      <Grid layout={{ ...layout, locked: [] }} view={view} />
    </div>,
    document.body,
  );
}

function useFullscreen(ref) {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, [ref]);
  const toggle = () => (document.fullscreenElement ? document.exitFullscreen?.() : ref.current?.requestFullscreen?.());
  return [full, toggle];
}

function TeacherSeating() {
  const { user } = useAuth();
  const { classId, className } = useCurrentClass();
  const saved = useSeating(classId);
  const { students } = useStudents();
  const roster = useMemo(() => students.filter((s) => s.classId === classId), [students, classId]);
  const [layout, setLayout] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState('swap'); // swap | block | lock
  const [selected, setSelected] = useState(null); // 칸 번호 또는 'u:uid'(아직 앉지 않은 학생)
  const [view, setView] = useState('teacher');
  const [msg, setMsg] = useState('');
  const box = useRef(null);
  const [full, toggleFull] = useFullscreen(box);

  // 저장본을 처음 받거나 반을 바꾸면 편집본을 새로
  useEffect(() => {
    if (saved === undefined) return;
    setLayout(saved ? { rows: saved.rows, cols: saved.cols, cells: saved.cells, locked: saved.locked ?? [], published: !!saved.published } : emptyLayout());
    setDirty(false);
    setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, saved === undefined]);

  if (!layout) return <div className="muted">불러오는 중…</div>;

  // 반에서 빠진 학생은 자리에서도 빼서 보여 줌
  const rosterIds = new Set(roster.map((s) => s.uid));
  const seated = new Set(layout.cells.filter(isStudent).map((c) => c.uid));
  const unseated = roster.filter((s) => !seated.has(s.uid));
  const ghosts = layout.cells.filter((c) => isStudent(c) && !rosterIds.has(c.uid)).length;

  const change = (next) => {
    setLayout(next);
    setDirty(true);
    setMsg('');
  };

  const onCell = (i) => {
    const c = layout.cells[i];
    if (mode === 'block') {
      if (isStudent(c)) return setMsg('학생이 앉은 자리는 막을 수 없어요. 먼저 비워 주세요.');
      const cells = [...layout.cells];
      cells[i] = isSeat(c) ? { blocked: true } : null;
      return change({ ...layout, cells, locked: layout.locked.filter((x) => x !== i) });
    }
    if (mode === 'lock') {
      if (!isStudent(c)) return setMsg('학생이 앉은 자리만 고정할 수 있어요.');
      return change({ ...layout, locked: layout.locked.includes(i) ? layout.locked.filter((x) => x !== i) : [...layout.locked, i] });
    }
    if (!isSeat(c)) return;
    if (typeof selected === 'string') {
      // 아직 앉지 않은 학생을 이 자리에 (있던 학생은 자리에서 빠짐)
      const s = roster.find((x) => x.uid === selected.slice(2));
      const cells = [...layout.cells];
      cells[i] = person(s);
      setSelected(null);
      return change({ ...layout, cells });
    }
    if (selected === null) return setSelected(i);
    if (selected === i) return setSelected(null);
    setSelected(null);
    change(swap(layout, selected, i));
  };

  const doArrange = (how) => {
    const { layout: next, leftover } = arrange(layout, roster, how);
    change(next);
    setMsg(leftover.length ? `자리가 ${leftover.length}개 모자라요. 줄이나 칸을 늘려 주세요.` : how === 'random' ? '무작위로 배치했어요. 고정한 자리는 그대로예요.' : '학번순으로 배치했어요.');
  };

  const save = async (publish = layout.published) => {
    const next = { ...layout, published: publish };
    setLayout(next); // 공개 상자는 누르자마자 바뀌게
    await saveSeating(classId, next, user.uid);
    setDirty(false);
    setMsg(publish ? '저장했어요. 학생들도 볼 수 있어요.' : '저장했어요. 아직 학생에게는 안 보여요.');
  };

  const seatsCount = layout.cells.filter(isSeat).length;
  return (
    <>
      <section className="panel">
        <div className="seat-toolbar">
          <label className="inline-label small">줄 <input type="number" min={1} max={12} value={layout.rows} onChange={(e) => change(resize(layout, Math.min(12, Math.max(1, +e.target.value || 1)), layout.cols))} aria-label="줄 수" /></label>
          <label className="inline-label small">칸 <input type="number" min={1} max={12} value={layout.cols} onChange={(e) => change(resize(layout, layout.rows, Math.min(12, Math.max(1, +e.target.value || 1))))} aria-label="칸 수" /></label>
          <span className="muted small">자리 {seatsCount}개 · 학생 {roster.length}명</span>
          <span className="live-spacer" />
          <button className="btn small" onClick={() => doArrange('random')}><Shuffle size={16} /> 무작위 배치</button>
          <button className="btn small" onClick={() => doArrange('number')}><SortAsc size={16} /> 학번순</button>
          <button className="btn small" onClick={() => change({ ...layout, cells: layout.cells.map((c, i) => (layout.locked.includes(i) || !isSeat(c) ? c : null)) })}><RotateCcw size={16} /> 비우기</button>
        </div>
        <div className="seat-toolbar">
          <div className="tabs" role="tablist" aria-label="누르면">
            {[['swap', '자리 바꾸기'], ['block', '자리 없음 칸'], ['lock', '고정']].map(([k, v]) => (
              <button key={k} role="tab" aria-selected={mode === k} className={`tab ${mode === k ? 'on' : ''}`} onClick={() => { setMode(k); setSelected(null); }}>{v}</button>
            ))}
          </div>
          <div className="tabs" role="tablist" aria-label="보는 방향">
            <button role="tab" aria-selected={view === 'teacher'} className={`tab ${view === 'teacher' ? 'on' : ''}`} onClick={() => setView('teacher')}>교사 시점</button>
            <button role="tab" aria-selected={view === 'student'} className={`tab ${view === 'student' ? 'on' : ''}`} onClick={() => setView('student')}>학생 시점</button>
          </div>
          <span className="live-spacer" />
          <label className="check-line small"><input type="checkbox" checked={layout.published} onChange={(e) => save(e.target.checked)} /> 학생에게 공개</label>
          <button className="btn small primary" onClick={() => save()} disabled={!dirty}><Save size={16} /> {dirty ? '저장' : '저장됨'}</button>
        </div>
        <p className="muted small">
          {mode === 'swap' && '자리를 두 번 누르면 서로 바뀌어요. 아래 "아직 자리가 없는 학생"을 누른 뒤 자리를 누르면 그 자리에 앉혀요.'}
          {mode === 'block' && '누르면 그 칸을 "자리 없음"으로 바꾸거나 되돌려요 (기둥, 통로 등).'}
          {mode === 'lock' && '누른 자리는 무작위 배치 때 움직이지 않아요 (시력, 짝 지정 등).'}
        </p>
        {msg && <p className="info">{msg}</p>}
      </section>

      <section className={`panel seat-panel ${full ? 'is-full' : ''}`} ref={box}>
        <div className="panel-head">
          <h2><Armchair size={18} className="h-icon" /> 자리표 {layout.published ? <span className="tag done">공개 중</span> : <span className="tag muted-tag">비공개</span>}</h2>
          <div className="row">
            <button className="btn small" onClick={() => window.print()} title="지금 보는 방향(교사/학생 시점)으로 A4 가로 한 장에 인쇄"><Printer size={16} /> 인쇄</button>
            <button className="icon-btn" onClick={toggleFull} title={full ? '전체 화면 끝내기' : '전체 화면 (프로젝터)'}>{full ? <Minimize size={20} /> : <Maximize size={20} />}</button>
          </div>
        </div>
        <Grid layout={layout} view={view} selected={typeof selected === 'number' ? selected : null} onCell={onCell} editable />
      </section>
      <PrintSheet layout={layout} view={view} className={className} />

      {(unseated.length > 0 || ghosts > 0) && (
        <section className="panel">
          <h2>아직 자리가 없는 학생 ({unseated.length})</h2>
          <div className="chips">
            {unseated.map((s) => (
              <button key={s.uid} className={`chip-btn ${selected === `u:${s.uid}` ? 'on' : ''}`} onClick={() => { setMode('swap'); setSelected(selected === `u:${s.uid}` ? null : `u:${s.uid}`); }}>
                {s.studentId} {s.displayName}
              </button>
            ))}
          </div>
          {ghosts > 0 && <p className="muted small">반에서 빠진 학생 {ghosts}명이 자리에 남아 있어요. 비우기나 다시 배치로 정리하세요.</p>}
        </section>
      )}
    </>
  );
}

function StudentSeating() {
  const { user } = useAuth();
  const { classId } = useCurrentClass();
  const seating = useSeating(classId);
  const box = useRef(null);
  const [full, toggleFull] = useFullscreen(box);
  if (seating === undefined) return <div className="muted">불러오는 중…</div>;
  if (!seating) {
    return <section className="panel empty"><Armchair size={32} strokeWidth={1.5} /><p>아직 자리표가 없어요. 선생님이 공개하면 보여요.</p></section>;
  }
  const i = seating.cells.findIndex((c) => c?.uid === user.uid);
  const where = i >= 0 ? `앞에서 ${Math.floor(i / seating.cols) + 1}번째 줄, 왼쪽에서 ${(i % seating.cols) + 1}번째` : '';
  return (
    <section className={`panel seat-panel ${full ? 'is-full' : ''}`} ref={box}>
      <div className="panel-head">
        <h2><Armchair size={18} className="h-icon" /> 우리 반 자리표</h2>
        <button className="icon-btn" onClick={toggleFull} title="전체 화면">{full ? <Minimize size={20} /> : <Maximize size={20} />}</button>
      </div>
      <p className={where ? 'info' : 'muted'}>{where ? `내 자리: ${where}` : '자리표에 내 자리가 아직 없어요.'}</p>
      <Grid layout={{ ...seating, locked: [] }} view="student" myUid={user.uid} />
    </section>
  );
}

export default function SeatingPage() {
  const { isTeacher } = useAuth();
  return <ClassGate>{isTeacher ? <TeacherSeating /> : <StudentSeating />}</ClassGate>;
}
