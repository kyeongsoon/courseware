import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ClipboardList, ListChecks, Plus, Scale, Send, Shuffle, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentClass } from '../contexts/ClassContext';
import ClassGate from '../components/ClassGate';
import { useStudents } from '../useStudents';
import { dateInt, fromInput, toInput } from '../attendance';
import { addDays, shortLabel, weekday } from '../schedule';
import {
  KINDS, LEVELS, TEMPLATES, autoAssign, checkDone, createRound, currentRound, deleteRound, loadOf, saveBoard, taskOf,
  uncheck, useBoard, useChecks, useRounds, weeksOf, withIds,
} from '../duties';

const LevelTag = ({ level }) => <span className={`tag lv-${level}`}>{LEVELS[level]}</span>;
const range = (r) => `${shortLabel(r.from)} ~ ${shortLabel(r.to)}`;
const byId = (list) => [...list].sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)));

// 평일 수 (from ~ min(to, today))
function weekdaysSoFar(r, today) {
  let n = 0;
  for (let d = r.from; d <= Math.min(r.to, today); d = addDays(d, 1)) if (![0, 6].includes(weekday(d))) n++;
  return n;
}

// ── 학생 ──
function MyDuty({ kind, round, checks }) {
  const { user } = useAuth();
  const today = dateInt();
  const task = taskOf(round, user.uid);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!round) return null;
  const done = checks.some((c) => c.roundId === round.id && c.date === today);
  const toggle = async () => {
    setBusy(true);
    setErr('');
    try {
      if (done) await uncheck(round.id, today, user.uid);
      else await checkDone(round, task.id, user.uid, today);
    } catch (e) {
      setErr(`실패: ${e.code ?? e.message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`duty-mine ${done ? 'done' : ''}`}>
      <span className="muted small">{KINDS[kind].label} · {range(round)}</span>
      {task ? (
        <>
          <b className="duty-name">{task.name}</b>
          {task.desc && <span className="small muted">{task.desc}</span>}
          <button className={`btn small ${done ? '' : 'primary'}`} onClick={toggle} disabled={busy}>
            {done ? <><Check size={15} /> 오늘 했어요 (취소)</> : '오늘 했어요'}
          </button>
        </>
      ) : <span className="small">이번에는 맡은 {KINDS[kind].unit}이 없어요. 다음 배정에서 먼저 맡아요.</span>}
      {err && <span className="error small">{err}</span>}
    </div>
  );
}

// 학생 홈 카드
export function MyDutiesCard() {
  const { user } = useAuth();
  const { classId } = useCurrentClass();
  const rounds = useRounds(classId, { teacher: false }) ?? [];
  const checks = useChecks(classId, { uid: user?.uid });
  const today = dateInt();
  const role = currentRound(rounds, 'role', today);
  const clean = currentRound(rounds, 'clean', today);
  if (!role && !clean) return null;
  return (
    <section className="panel">
      <div className="panel-head"><h2><ClipboardList size={18} className="h-icon" /> 내 역할·청소</h2><Link className="small" to="/duties">전체 보기</Link></div>
      <div className="duty-mine-row">
        <MyDuty kind="role" round={role} checks={checks} />
        <MyDuty kind="clean" round={clean} checks={checks} />
      </div>
    </section>
  );
}

function RoundTable({ round, checks = [], today, showChecks, highlight }) {
  const names = round.names ?? {};
  const checked = new Set(checks.filter((c) => c.roundId === round.id && c.date === today).map((c) => c.uid));
  return (
    <div className="table-wrap">
      <table className="duty-table">
        <thead><tr><th>{KINDS[round.kind].unit}</th><th>난이도</th><th>맡은 학생</th></tr></thead>
        <tbody>
          {(round.tasks ?? []).map((x) => (
            <tr key={x.id}>
              <td><b>{x.name}</b>{x.desc && <div className="muted small">{x.desc}</div>}</td>
              <td><LevelTag level={x.level} /></td>
              <td>
                <div className="chips">
                  {(round.assign?.[x.id] ?? []).map((u) => (
                    <span key={u} className={`chip ${highlight === u ? 'me' : ''} ${showChecks && checked.has(u) ? 'checked' : ''}`}>
                      {showChecks && checked.has(u) && <Check size={13} />}{names[u] ?? '(명단에 없음)'}
                    </span>
                  ))}
                  {!(round.assign?.[x.id] ?? []).length && <span className="muted small">빈 자리</span>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudentDuties() {
  const { user } = useAuth();
  const { classId } = useCurrentClass();
  const rounds = useRounds(classId, { teacher: false });
  const checks = useChecks(classId, { uid: user.uid });
  const today = dateInt();
  if (rounds === undefined) return <div className="muted">불러오는 중…</div>;
  const cur = ['role', 'clean'].map((k) => [k, currentRound(rounds, k, today)]).filter(([, r]) => r);
  if (!cur.length) return <section className="panel empty"><ClipboardList size={32} strokeWidth={1.5} /><p>아직 공개된 역할·청소 배정이 없어요.</p></section>;
  return (
    <>
      <section className="panel">
        <h2><ClipboardList size={18} className="h-icon" /> 내 역할·청소</h2>
        <div className="duty-mine-row">{cur.map(([k, r]) => <MyDuty key={k} kind={k} round={r} checks={checks} />)}</div>
      </section>
      {cur.map(([k, r]) => (
        <section key={k} className="panel">
          <h2>{KINDS[k].label} <span className="muted small">{range(r)}</span></h2>
          <RoundTable round={r} today={today} highlight={user.uid} />
        </section>
      ))}
    </>
  );
}

// ── 교사: 역할 목록 편집 ──
function TaskEditor({ kind, board, roster }) {
  const { user } = useAuth();
  const { classId } = useCurrentClass();
  const [tasks, setTasks] = useState(null);
  const [msg, setMsg] = useState('');
  const cur = tasks ?? board?.tasks ?? [];
  const set = (i, patch) => setTasks(cur.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const seats = cur.reduce((n, x) => n + (Number(x.count) || 0), 0);
  const onSave = async () => {
    const clean = cur.filter((x) => x.name.trim());
    await saveBoard(classId, kind, withIds(clean), user.uid);
    setTasks(null);
    setMsg('저장했어요.');
  };
  const loadTemplate = () => {
    if (cur.length && !confirm(`지금 ${KINDS[kind].unit} 목록을 추천 목록으로 바꿀까요?`)) return;
    setTasks(withIds(TEMPLATES[kind]));
    setMsg('추천 목록을 불러왔어요. 우리 반에 맞게 고치고 저장하세요.');
  };
  return (
    <div className="duty-editor">
      <div className="row between">
        <h3><ListChecks size={16} /> {KINDS[kind].unit} 목록</h3>
        <button className="btn small" onClick={loadTemplate}><Sparkles size={14} /> 추천 목록 불러오기</button>
      </div>
      <p className="muted small">
        난이도는 부담 점수예요 (가벼움 1 · 보통 2 · 힘듦 3, 1주마다). 자동 배정은 점수가 적게 쌓인 학생부터 힘든 {KINDS[kind].unit}을 맡겨요.
        {kind === 'role' && ' 할 일이 많은 역할은 인원을 늘리고, 억지로 만든 역할은 지워도 돼요 — 자리가 모자란 학생은 이번엔 쉬고 다음에 먼저 맡아요.'}
      </p>
      <div className="table-wrap">
        <table className="duty-edit">
          <thead><tr><th>{KINDS[kind].unit}</th><th>설명</th><th>난이도</th><th>인원</th><th /></tr></thead>
          <tbody>
            {cur.map((x, i) => (
              <tr key={x.id ?? i}>
                <td><input value={x.name} maxLength={30} onChange={(e) => set(i, { name: e.target.value })} aria-label={`${i + 1}번 이름`} /></td>
                <td><input value={x.desc ?? ''} maxLength={80} onChange={(e) => set(i, { desc: e.target.value })} aria-label={`${i + 1}번 설명`} placeholder="(선택)" /></td>
                <td>
                  <select value={x.level} onChange={(e) => set(i, { level: Number(e.target.value) })} aria-label={`${i + 1}번 난이도`}>
                    {Object.entries(LEVELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td><input type="number" min={1} max={10} value={x.count} onChange={(e) => set(i, { count: Number(e.target.value) })} aria-label={`${i + 1}번 인원`} /></td>
                <td><button className="icon-btn" title="지우기" onClick={() => setTasks(cur.filter((_, j) => j !== i))}><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        <button className="btn small" onClick={() => setTasks([...cur, ...withIds([{ name: '', level: 2, count: 1 }])])}><Plus size={14} /> 추가</button>
        <span className={`small ${seats < roster.length ? 'warn-text' : seats > roster.length ? 'warn-text' : 'muted'}`}>
          자리 {seats}개 · 학생 {roster.length}명
          {seats < roster.length && ` → ${roster.length - seats}명은 이번엔 쉬어요 (다음 배정에서 먼저)`}
          {seats > roster.length && ` → ${seats - roster.length}자리는 비어요`}
        </span>
        <span className="live-spacer" />
        <button className="btn primary small" onClick={onSave} disabled={!tasks}>저장</button>
      </div>
      {msg && <p className="info">{msg}</p>}
    </div>
  );
}

// ── 교사: 새 배정 ──
function NewRound({ kind, board, roster, rounds, onDone }) {
  const { user } = useAuth();
  const { classId } = useCurrentClass();
  const past = rounds.filter((r) => r.kind === kind);
  const lastTo = past.at(-1)?.to;
  const start0 = lastTo && lastTo >= dateInt() ? addDays(lastTo, 1) : dateInt();
  const [from, setFrom] = useState(start0);
  const [to, setTo] = useState(addDays(start0, KINDS[kind].period - 1));
  const [draft, setDraft] = useState(null);
  const tasks = board?.tasks ?? [];
  const names = Object.fromEntries(roster.map((s) => [s.uid, s.displayName]));
  const weeks = weeksOf({ from, to });
  const before = loadOf(past);

  const shuffle = () => setDraft(autoAssign(roster, tasks, past, { weeks }));
  // 자리에 다른 학생을 고르면 서로 맞바꿈 (쉬던 학생이면 원래 학생이 쉼)
  const move = (tid, i, uid) => {
    const assign = Object.fromEntries(Object.entries(draft.assign).map(([k, l]) => [k, [...l]]));
    const old = assign[tid][i];
    if (old === uid) return;
    let found = false;
    for (const l of Object.values(assign)) {
      const j = l.indexOf(uid);
      if (j >= 0) { l[j] = old; found = true; break; }
    }
    assign[tid][i] = uid;
    setDraft({ assign, resting: found ? draft.resting : [...draft.resting.filter((u) => u !== uid), old] });
  };
  const after = draft && Object.fromEntries(roster.map((s) => {
    const tid = Object.entries(draft.assign).find(([, l]) => l.includes(s.uid))?.[0];
    const lv = tasks.find((x) => x.id === tid)?.level ?? 0;
    return [s.uid, (before[s.uid]?.points ?? 0) + lv * weeks];
  }));
  const publish = async () => {
    await createRound(classId, kind, { from, to, assign: draft.assign, tasks, names }, user.uid);
    setDraft(null);
    onDone(`${range({ from, to })} 배정을 공개했어요. 학생 홈에 보여요.`);
  };

  if (!tasks.length) return <p className="muted">먼저 아래 {KINDS[kind].unit} 목록을 만들어 저장하세요.</p>;
  return (
    <div className="duty-new">
      <div className="row">
        <label className="inline-label small">시작 <input type="date" value={toInput(from)} onChange={(e) => e.target.value && setFrom(fromInput(e.target.value))} aria-label="시작일" /></label>
        <label className="inline-label small">끝 <input type="date" value={toInput(to)} onChange={(e) => e.target.value && setTo(fromInput(e.target.value))} aria-label="종료일" /></label>
        <span className="muted small">{weeks}주</span>
        <button className="btn primary small" onClick={shuffle}><Scale size={15} /> {draft ? '다시 섞기' : '공평하게 자동 배정'}</button>
      </div>
      {draft && (
        <>
          <div className="table-wrap">
            <table className="duty-table">
              <thead><tr><th>{KINDS[kind].unit}</th><th>난이도</th><th>맡을 학생 (바꾸려면 고르세요)</th></tr></thead>
              <tbody>
                {tasks.map((x) => (
                  <tr key={x.id}>
                    <td><b>{x.name}</b></td>
                    <td><LevelTag level={x.level} /></td>
                    <td className="row">
                      {(draft.assign[x.id] ?? []).map((u, i) => (
                        <select key={`${u}-${i}`} value={u} onChange={(e) => move(x.id, i, e.target.value)} aria-label={`${x.name} ${i + 1}`}>
                          {byId(roster).map((s) => <option key={s.uid} value={s.uid}>{s.displayName} ({before[s.uid]?.points ?? 0}점)</option>)}
                        </select>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {draft.resting.length > 0 && <p className="small">이번에 쉬는 학생: {draft.resting.map((u) => names[u]).join(', ')} <span className="muted">(다음 배정에서 먼저 맡아요)</span></p>}
          <p className="muted small">
            배정 뒤 누적 부담 점수: 가장 적은 학생 {Math.min(...Object.values(after))}점 · 가장 많은 학생 {Math.max(...Object.values(after))}점
          </p>
          <div><button className="btn primary" onClick={publish}><Send size={15} /> 이대로 공개</button></div>
        </>
      )}
    </div>
  );
}

function BoardTab({ kind, roster, rounds }) {
  const { classId } = useCurrentClass();
  const board = useBoard(classId, kind);
  const today = dateInt();
  const checks = useChecks(classId, { date: today });
  const [msg, setMsg] = useState('');
  const [making, setMaking] = useState(false);
  if (board === undefined) return <div className="muted">불러오는 중…</div>;
  const cur = currentRound(rounds, kind, today);
  const list = rounds.filter((r) => r.kind === kind);
  const assigned = cur ? Object.values(cur.assign ?? {}).flat() : [];
  const doneToday = cur ? checks.filter((c) => c.roundId === cur.id).length : 0;

  return (
    <>
      {msg && <p className="info">{msg}</p>}
      <div className="duty-section">
        <div className="row between">
          <h3>지금 배정 {cur && <span className="muted small">{range(cur)}</span>}</h3>
          <button className="btn small primary" onClick={() => setMaking(!making)}><Shuffle size={14} /> {making ? '닫기' : '다음 배정 만들기'}</button>
        </div>
        {making && <NewRound kind={kind} board={board} roster={roster} rounds={rounds} onDone={(m) => { setMsg(m); setMaking(false); }} />}
        {cur ? (
          <>
            <p className="small">오늘 '했어요' {doneToday} / {assigned.length}명 {![0, 6].includes(weekday(today)) ? '' : <span className="muted">(주말)</span>}</p>
            <RoundTable round={cur} checks={checks} today={today} showChecks />
          </>
        ) : !making && <p className="muted">오늘 진행 중인 배정이 없어요. '다음 배정 만들기'로 시작하세요.</p>}
      </div>
      <div className="duty-section"><TaskEditor kind={kind} board={board} roster={roster} /></div>
      {list.length > 0 && (
        <div className="duty-section">
          <h3>지난 배정 ({list.length})</h3>
          <ul className="item-list">
            {[...list].reverse().map((r) => (
              <li key={r.id} className="row between">
                <span>{range(r)} <span className="muted small">· {weeksOf(r)}주 · {Object.values(r.assign ?? {}).flat().length}명</span></span>
                <button className="icon-btn" title="배정 삭제" onClick={() => confirm(`${range(r)} 배정을 지울까요? 부담 점수에서도 빠져요.`) && deleteRound(r.id)}><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

// ── 교사: 공평 점검 ──
function FairTab({ roster, rounds }) {
  const { classId } = useCurrentClass();
  const checks = useChecks(classId);
  const today = dateInt();
  const role = loadOf(rounds, 'role');
  const clean = loadOf(rounds, 'clean');
  // 했어요 비율: 맡은 기간의 (오늘까지) 평일 수 대비 체크 수
  const rate = useMemo(() => {
    const due = {}, got = {};
    rounds.filter((r) => r.published && r.from <= today).forEach((r) => {
      const days = weekdaysSoFar(r, today);
      Object.values(r.assign ?? {}).flat().forEach((u) => (due[u] = (due[u] ?? 0) + days));
    });
    checks.forEach((c) => (got[c.uid] = (got[c.uid] ?? 0) + 1));
    return Object.fromEntries(roster.map((s) => [s.uid, due[s.uid] ? Math.round(((got[s.uid] ?? 0) / due[s.uid]) * 100) : null]));
  }, [rounds, checks, roster, today]);
  const total = (u) => (role[u]?.points ?? 0) + (clean[u]?.points ?? 0);
  const totals = roster.map((s) => total(s.uid));
  const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  const rows = byId(roster);
  if (!rounds.length) return <p className="muted">아직 배정이 없어요.</p>;
  return (
    <>
      <p className="muted small">
        부담 점수 = 난이도(가벼움 1 · 보통 2 · 힘듦 3) × 기간(주). 평균 {avg.toFixed(1)}점.
        평균보다 많이 높거나(🔺) 낮은(🔻) 학생은 다음 자동 배정에서 저절로 맞춰져요. '했어요'는 맡은 기간 평일 대비 체크 비율이에요.
      </p>
      <div className="table-wrap">
        <table className="duty-fair">
          <thead><tr><th>학번</th><th>이름</th><th>1인 1역</th><th>청소</th><th>합계</th><th>힘듦</th><th>가벼움</th><th>했어요</th></tr></thead>
          <tbody>
            {rows.map((s) => {
              const tt = total(s.uid);
              const diff = tt - avg;
              const r = rate[s.uid];
              return (
                <tr key={s.uid}>
                  <td>{s.studentId}</td><td>{s.displayName}</td>
                  <td>{role[s.uid]?.points ?? 0}</td><td>{clean[s.uid]?.points ?? 0}</td>
                  <td><b>{tt}</b> {diff >= Math.max(3, avg * 0.3) ? '🔺' : diff <= -Math.max(3, avg * 0.3) ? '🔻' : ''}</td>
                  <td>{(role[s.uid]?.heavy ?? 0) + (clean[s.uid]?.heavy ?? 0)}회</td>
                  <td>{(role[s.uid]?.light ?? 0) + (clean[s.uid]?.light ?? 0)}회</td>
                  <td className={r !== null && r < 50 ? 'bad' : ''}>{r === null ? '-' : `${r}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TeacherDuties() {
  const { classId } = useCurrentClass();
  const { students } = useStudents();
  const roster = useMemo(() => students.filter((s) => s.classId === classId), [students, classId]);
  const rounds = useRounds(classId, { teacher: true });
  const [tab, setTab] = useState('role');
  if (rounds === undefined) return <div className="muted">불러오는 중…</div>;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2><ClipboardList size={18} className="h-icon" /> 역할·청소</h2>
        <div className="tabs" role="tablist">
          {[['role', '1인 1역'], ['clean', '청소 당번'], ['fair', '공평 점검']].map(([k, v]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{v}</button>
          ))}
        </div>
      </div>
      {roster.length === 0 ? <p className="muted">이 반에 학생이 없어요.</p>
        : tab === 'fair' ? <FairTab roster={roster} rounds={rounds} />
          : <BoardTab key={`${classId}-${tab}`} kind={tab} roster={roster} rounds={rounds} />}
    </section>
  );
}

export default function DutiesPage() {
  const { isTeacher } = useAuth();
  return <ClassGate>{isTeacher ? <TeacherDuties /> : <StudentDuties />}</ClassGate>;
}
