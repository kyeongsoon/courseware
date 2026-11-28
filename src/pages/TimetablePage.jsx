import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Clock, Download, Pencil, Save, X } from 'lucide-react';
import { NeisError, fetchTimetable, mergeNeisTimetable, mondayOf, parseGradeClass, useSchoolSettings } from '../neis';
import { dateInt, fromInput, toInput } from '../attendance';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentClass } from '../contexts/ClassContext';
import ClassGate from '../components/ClassGate';
import { DAY_NAMES, cellAt, emptyTimetable, nowSlot, resizeTimetable, saveTimetable, useEvents, useTimetable } from '../schedule';
import { UpcomingList } from './CalendarPage';

// 1분마다 '지금 교시' 다시 계산
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function TableView({ tt }) {
  const { day, period } = nowSlot(tt, useNow());
  return (
    <div className="table-wrap">
      <table className="tt">
        <thead>
          <tr><th className="tt-p">교시</th>{DAY_NAMES.slice(0, tt.days).map((d, i) => <th key={d} className={i === day ? 'today' : ''}>{d}{i === day ? ' (오늘)' : ''}</th>)}</tr>
        </thead>
        <tbody>
          {Array.from({ length: tt.periods }, (_, p) => (
            <tr key={p} className={p === period && day >= 0 ? 'now-row' : ''}>
              <th className="tt-p"><b>{p + 1}</b><span className="muted small">{tt.times[p]}</span></th>
              {Array.from({ length: tt.days }, (_, d) => {
                const c = cellAt(tt, d, p);
                return (
                  <td key={d} className={`${d === day ? 'today' : ''} ${d === day && p === period ? 'now' : ''}`}>
                    {c?.s ? <><span className="tt-s">{c.s}</span>{c.r && <span className="muted small">{c.r}</span>}</> : <span className="muted">-</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableEdit({ initial, onSave, onCancel }) {
  const [tt, setTt] = useState(initial);
  const [busy, setBusy] = useState(false);
  const setCell = (d, p, key, v) => setTt((t) => {
    const cells = [...t.cells];
    const i = d * t.periods + p;
    const next = { s: cells[i]?.s ?? '', r: cells[i]?.r ?? '', [key]: v.slice(0, 20) };
    cells[i] = next.s || next.r ? next : null;
    return { ...t, cells };
  });
  const save = async () => {
    setBusy(true);
    try {
      await onSave(tt);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="seat-toolbar">
        <label className="inline-label small">요일
          <select value={tt.days} onChange={(e) => setTt(resizeTimetable(tt, +e.target.value, tt.periods))} aria-label="요일 수">
            <option value={5}>월~금</option><option value={6}>월~토</option>
          </select>
        </label>
        <label className="inline-label small">교시 <input type="number" min={1} max={10} value={tt.periods}
          onChange={(e) => setTt(resizeTimetable(tt, tt.days, Math.min(10, Math.max(1, +e.target.value || 1))))} aria-label="교시 수" /></label>
        <span className="live-spacer" />
        <button className="btn small" onClick={onCancel}><X size={16} /> 취소</button>
        <button className="btn small primary" onClick={save} disabled={busy}><Save size={16} /> {busy ? '저장 중…' : '저장'}</button>
      </div>
      <div className="table-wrap">
        <table className="tt edit">
          <thead><tr><th className="tt-p">교시 / 시간</th>{DAY_NAMES.slice(0, tt.days).map((d) => <th key={d}>{d}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: tt.periods }, (_, p) => (
              <tr key={p}>
                <th className="tt-p">
                  <b>{p + 1}</b>
                  <input value={tt.times[p] ?? ''} maxLength={11} placeholder="09:00-09:45" aria-label={`${p + 1}교시 시간`}
                    onChange={(e) => setTt((t) => ({ ...t, times: t.times.map((x, i) => (i === p ? e.target.value : x)) }))} />
                </th>
                {Array.from({ length: tt.days }, (_, d) => {
                  const c = cellAt(tt, d, p);
                  return (
                    <td key={d}>
                      <input value={c?.s ?? ''} placeholder="과목" aria-label={`${DAY_NAMES[d]} ${p + 1}교시 과목`} onChange={(e) => setCell(d, p, 's', e.target.value)} />
                      <input className="tt-room" value={c?.r ?? ''} placeholder="교실" aria-label={`${DAY_NAMES[d]} ${p + 1}교시 교실`} onChange={(e) => setCell(d, p, 'r', e.target.value)} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">시간은 "09:00-09:45"처럼 쓰면 그 시간에 '지금 수업'이 강조돼요. 교실은 비워도 돼요.</p>
    </>
  );
}

function NeisTimetable({ base, onLoaded, onClose }) {
  const { className } = useCurrentClass();
  const settings = useSchoolSettings();
  const parsed = parseGradeClass(className);
  const [grade, setGrade] = useState(parsed.grade || 1);
  const [classNo, setClassNo] = useState(parsed.classNo || 1);
  const [day, setDay] = useState(dateInt());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (settings === undefined) return <p className="muted">불러오는 중…</p>;
  if (!settings) {
    return <p className="muted">먼저 <Link to="/teacher/school">학교 설정</Link>에서 우리 학교와 나이스 키를 저장해 주세요.</p>;
  }
  const onFetch = async () => {
    setBusy(true);
    setErr('');
    try {
      const got = await fetchTimetable(settings, { grade, classNo, monday: mondayOf(day) });
      if (!got) return setErr('그 주에는 나이스 시간표가 없어요. 다른 주(학기 중 평일)를 골라 보세요.');
      // 교시별 시간은 지금 시간표 것을 그대로 쓰고, 과목만 나이스 것으로 (과목이 같은 칸은 교실도 유지)
      onLoaded(mergeNeisTimetable(base, got), got.limited);
    } catch (e) {
      setErr(e instanceof NeisError ? e.message : `실패: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="neis-box">
      <div className="row">
        <b>나이스에서 가져오기</b><span className="muted small">{settings.schoolName}</span>
        <span className="live-spacer" /><button className="icon-btn" onClick={onClose} title="닫기"><X size={18} /></button>
      </div>
      <div className="row">
        <label className="inline-label small">학년 <input type="number" min={1} max={6} value={grade} onChange={(e) => setGrade(+e.target.value || 1)} aria-label="학년" /></label>
        <label className="inline-label small">반 <input type="number" min={1} max={30} value={classNo} onChange={(e) => setClassNo(+e.target.value || 1)} aria-label="반" /></label>
        <label className="inline-label small">이 날짜가 있는 주 <input type="date" value={toInput(day)} onChange={(e) => e.target.value && setDay(fromInput(e.target.value))} aria-label="가져올 주" /></label>
        <button className="btn small primary" onClick={onFetch} disabled={busy}><Download size={16} /> {busy ? '가져오는 중…' : '불러오기'}</button>
      </div>
      <p className="muted small">불러온 과목이 아래 편집 칸에 채워져요. 확인하고 저장하세요. (교시별 시간은 그대로 둬요)</p>
      {err && <p className="error">{err}</p>}
    </div>
  );
}

function Timetable() {
  const { user, isTeacher } = useAuth();
  const { classId } = useCurrentClass();
  const tt = useTimetable(classId);
  const [editing, setEditing] = useState(false);
  const [neisOpen, setNeisOpen] = useState(false);
  const [draft, setDraft] = useState(null); // 나이스에서 불러온 편집본
  const [note, setNote] = useState('');
  if (tt === undefined) return <div className="muted">불러오는 중…</div>;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2><Clock size={18} className="h-icon" /> 시간표</h2>
        {isTeacher && !editing && (
          <div className="row">
            <button className="btn small" onClick={() => setNeisOpen(true)}><Download size={16} /> 나이스에서 가져오기</button>
            <button className="btn small" onClick={() => setEditing(true)}><Pencil size={16} /> {tt ? '고치기' : '시간표 만들기'}</button>
          </div>
        )}
      </div>
      {isTeacher && neisOpen && !editing && (
        <NeisTimetable base={tt} onClose={() => setNeisOpen(false)}
          onLoaded={(next, limited) => { setDraft(next); setNote(limited ? 'API 키가 없어 일부 칸만 받아졌어요.' : '나이스에서 불러왔어요. 확인하고 저장하세요.'); setNeisOpen(false); setEditing(true); }} />
      )}
      {editing && note && <p className="info">{note}</p>}
      {editing ? (
        <TableEdit key={draft ? 'neis' : 'plain'} initial={draft ?? tt ?? emptyTimetable()} onCancel={() => { setEditing(false); setDraft(null); setNote(''); }}
          onSave={async (next) => { await saveTimetable(classId, next, user.uid); setEditing(false); setDraft(null); setNote(''); }} />
      ) : tt ? <TableView tt={tt} /> : (
        <p className="muted">{isTeacher ? '아직 시간표가 없어요. "시간표 만들기"를 눌러 입력하세요.' : '아직 시간표가 없어요.'}</p>
      )}
    </section>
  );
}

export default function TimetablePage() {
  return <ClassGate><Timetable /></ClassGate>;
}

// ── 홈: 오늘 시간표 + 다가오는 일정 ──
export function TodayBoard() {
  const { classId } = useCurrentClass();
  const tt = useTimetable(classId);
  const { events } = useEvents(classId);
  const now = useNow();
  if (!classId) return null;
  const { day, period } = nowSlot(tt, now);
  return (
    <div className="feed">
      <section className="panel">
        <div className="panel-head">
          <h2><Clock size={18} className="h-icon" /> 오늘 시간표</h2>
          <Link to="/timetable" className="more">전체 <ChevronRight size={16} /></Link>
        </div>
        {!tt ? <p className="muted small">아직 시간표가 없어요.</p> : day < 0 ? <p className="muted small">오늘은 수업이 없는 날이에요.</p> : (
          <ol className="today-tt">
            {Array.from({ length: tt.periods }, (_, p) => {
              const c = cellAt(tt, day, p);
              return (
                <li key={p} className={p === period ? 'now' : ''}>
                  <span className="tt-n">{p + 1}</span><span className="grow">{c?.s || '-'}</span>
                  {p === period && <span className="tag done">지금</span>}
                  <span className="muted small">{tt.times[p]}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2><CalendarDays size={18} className="h-icon" /> 다가오는 일정</h2>
          <Link to="/calendar" className="more">달력 <ChevronRight size={16} /></Link>
        </div>
        <UpcomingList events={events} days={14} limit={5} />
      </section>
    </div>
  );
}
