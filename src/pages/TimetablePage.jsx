import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Clock, Pencil, Save, X } from 'lucide-react';
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

function Timetable() {
  const { user, isTeacher } = useAuth();
  const { classId } = useCurrentClass();
  const tt = useTimetable(classId);
  const [editing, setEditing] = useState(false);
  if (tt === undefined) return <div className="muted">불러오는 중…</div>;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2><Clock size={18} className="h-icon" /> 시간표</h2>
        {isTeacher && !editing && <button className="btn small" onClick={() => setEditing(true)}><Pencil size={16} /> {tt ? '고치기' : '시간표 만들기'}</button>}
      </div>
      {editing ? (
        <TableEdit initial={tt ?? emptyTimetable()} onCancel={() => setEditing(false)}
          onSave={async (next) => { await saveTimetable(classId, next, user.uid); setEditing(false); }} />
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
