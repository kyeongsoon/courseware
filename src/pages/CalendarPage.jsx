import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Plus, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NeisError, fetchSchedule, importSchedule, parseGradeClass, schoolYearRange, useSchoolSettings } from '../neis';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentClass } from '../contexts/ClassContext';
import ClassGate from '../components/ClassGate';
import { dateInt, fromInput, toInput } from '../attendance';
import {
  EVENT_TYPES, createEvent, dday, deleteEvent, monthCells, parts, shortLabel, upcoming, updateEvent, useEvents, weekday,
} from '../schedule';

const typeClass = (t) => `ev-${EVENT_TYPES.indexOf(t)}`;

function EventForm({ initial, onClose }) {
  const { user } = useAuth();
  const { classId } = useCurrentClass();
  const [title, setTitle] = useState(initial.title ?? '');
  const [type, setType] = useState(initial.type ?? '행사');
  const [date, setDate] = useState(initial.date);
  const [endDate, setEndDate] = useState(initial.endDate ?? initial.date);
  const [note, setNote] = useState(initial.note ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setErr('일정 이름을 입력해 주세요.');
    if (endDate < date) return setErr('끝나는 날이 시작하는 날보다 빨라요.');
    setBusy(true);
    try {
      const data = { classId, title, type, date, endDate, note };
      if (initial.id) await updateEvent(initial.id, data, user.uid);
      else await createEvent(data, user.uid);
      onClose();
    } catch (e2) {
      setErr(`저장 실패: ${e2.code ?? e2.message}`);
      setBusy(false);
    }
  };
  const onDelete = async () => {
    if (!confirm(`'${initial.title}' 일정을 지울까요?`)) return;
    await deleteEvent(initial.id);
    onClose();
  };

  return (
    <form className="stack ev-form" onSubmit={submit}>
      <div className="panel-head">
        <h2>{initial.id ? '일정 수정' : '새 일정'}</h2>
        <button type="button" className="icon-btn" onClick={onClose} title="닫기"><X size={18} /></button>
      </div>
      <label>일정 이름<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="예: 2학기 기말고사" autoFocus /></label>
      <div className="row">
        <label className="grow">종류
          <select value={type} onChange={(e) => setType(e.target.value)}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label className="grow">시작<input type="date" value={toInput(date)} onChange={(e) => e.target.value && setDate(fromInput(e.target.value))} /></label>
        <label className="grow">끝<input type="date" value={toInput(endDate)} onChange={(e) => e.target.value && setEndDate(fromInput(e.target.value))} /></label>
      </div>
      <label>메모 <span className="muted small">(선택: 범위, 준비물 등)</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} /></label>
      {err && <p className="error">{err}</p>}
      <div className="row">
        <button className="btn primary" type="submit" disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
        {initial.id && <button className="btn danger push-right" type="button" onClick={onDelete}><Trash2 size={16} /> 삭제</button>}
      </div>
    </form>
  );
}

function EventDetail({ ev, onClose }) {
  return (
    <div className="stack ev-form">
      <div className="panel-head">
        <h2><span className={`ev-dot ${typeClass(ev.type)}`} /> {ev.title}</h2>
        <button className="icon-btn" onClick={onClose} title="닫기"><X size={18} /></button>
      </div>
      <p className="muted">{ev.source === 'neis' && <span className="tag info-tag">나이스</span>} {ev.type} · {shortLabel(ev.date)}{ev.endDate > ev.date ? ` ~ ${shortLabel(ev.endDate)}` : ''} · {dday(ev.date)}</p>
      {ev.note && <p className="pre">{ev.note}</p>}
    </div>
  );
}

export function UpcomingList({ events, days = 14, limit = 8 }) {
  const list = upcoming(events, days).slice(0, limit);
  if (!list.length) return <p className="muted small">{days}일 안에 일정이 없어요.</p>;
  return (
    <ul className="up-list">
      {list.map((e) => (
        <li key={e.id}>
          <span className={`dday ${e.date <= dateInt() ? 'now' : ''}`}>{dday(e.date)}</span>
          <span className={`ev-dot ${typeClass(e.type)}`} />
          <span className="grow">{e.title}</span>
          <span className="muted small">{shortLabel(e.date)}{e.endDate > e.date ? `~${shortLabel(e.endDate)}` : ''}</span>
        </li>
      ))}
    </ul>
  );
}

function NeisSchedulePanel({ onClose }) {
  const { user } = useAuth();
  const { classId, className } = useCurrentClass();
  const settings = useSchoolSettings();
  const range0 = schoolYearRange(dateInt());
  const [from, setFrom] = useState(range0.from);
  const [to, setTo] = useState(range0.to);
  const [skipSat, setSkipSat] = useState(true);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const { grade } = parseGradeClass(className);

  if (settings === undefined) return <p className="muted">불러오는 중…</p>;
  if (!settings) {
    return (
      <div className="stack ev-form">
        <div className="panel-head"><h2>나이스 학사일정</h2><button className="icon-btn" onClick={onClose} title="닫기"><X size={18} /></button></div>
        <p className="muted">먼저 우리 학교와 나이스 키를 설정해 주세요.</p>
        <Link className="btn primary" to="/teacher/school">학교 설정으로 가기</Link>
      </div>
    );
  }
  const run = async (fn) => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof NeisError ? e.message : `실패: ${e.code ?? e.message}`);
    } finally {
      setBusy(false);
    }
  };
  const onFetch = () => run(async () => setPreview(await fetchSchedule(settings, { from, to, grade, skipSaturday: skipSat })));
  const onImport = () => run(async () => {
    const r = await importSchedule(classId, preview.events, { from, to }, user.uid);
    setMsg(r.added || r.removed
      ? `반영했어요: 새로 ${r.added}개${r.removed ? `, 바뀌거나 없어진 ${r.removed}개 지움` : ''}${r.kept ? `, 그대로 ${r.kept}개` : ''}.`
      : `달라진 게 없어요. (이미 ${r.kept}개가 들어 있어요)`);
    setPreview(null);
  });

  return (
    <div className="stack ev-form">
      <div className="panel-head"><h2>나이스 학사일정</h2><button className="icon-btn" onClick={onClose} title="닫기"><X size={18} /></button></div>
      <p className="muted small">{settings.schoolName} · {className}{grade ? ` (${grade}학년 일정만)` : ''}</p>
      <div className="row">
        <label className="grow">부터<input type="date" value={toInput(from)} onChange={(e) => e.target.value && setFrom(fromInput(e.target.value))} /></label>
        <label className="grow">까지<input type="date" value={toInput(to)} onChange={(e) => e.target.value && setTo(fromInput(e.target.value))} /></label>
      </div>
      <label className="check-line small"><input type="checkbox" checked={skipSat} onChange={(e) => setSkipSat(e.target.checked)} /> 토요휴업일 빼기</label>
      {!preview ? (
        <div><button className="btn primary" onClick={onFetch} disabled={busy}><Download size={16} /> {busy ? '가져오는 중…' : '나이스에서 불러오기'}</button></div>
      ) : (
        <>
          <p className="info">{preview.events.length}개 일정을 찾았어요.{preview.limited ? ' (API 키가 없어 일부만 받아졌어요)' : ''}</p>
          <ul className="up-list neis-preview">
            {preview.events.slice(0, 30).map((e, i) => (
              <li key={i}><span className={`ev-dot ${typeClass(e.type)}`} /><span className="grow">{e.title}</span><span className="muted small">{shortLabel(e.date)}{e.endDate > e.date ? `~${shortLabel(e.endDate)}` : ''}</span></li>
            ))}
            {preview.events.length > 30 && <li className="muted small">…외 {preview.events.length - 30}개</li>}
          </ul>
          <p className="muted small">넣으면 이 기간에 예전에 나이스에서 가져온 일정은 새것으로 바뀌어요. 직접 만든 일정은 그대로예요.</p>
          <div className="row">
            <button className="btn primary" onClick={onImport} disabled={busy || !preview.events.length}>{busy ? '넣는 중…' : `달력에 ${preview.events.length}개 넣기`}</button>
            <button className="btn" onClick={() => setPreview(null)}>다시 고르기</button>
          </div>
        </>
      )}
      {err && <p className="error">{err}</p>}
      {msg && <p className="info">{msg}</p>}
    </div>
  );
}

function Calendar() {
  const { isTeacher } = useAuth();
  const { classId } = useCurrentClass();
  const { events } = useEvents(classId);
  const today = dateInt();
  const [[y, m], setYm] = useState(() => parts(today).slice(0, 2));
  const [open, setOpen] = useState(null); // { mode: 'new'|'edit'|'view', ev }
  const cells = monthCells(y, m);
  const move = (k) => setYm(([yy, mm]) => {
    const t = mm + k;
    return t < 1 ? [yy - 1, 12] : t > 12 ? [yy + 1, 1] : [yy, t];
  });
  const on = (d) => events.filter((e) => e.date <= d && e.endDate >= d);

  return (
    <div className="cal-layout">
      <section className="panel">
        <div className="panel-head">
          <div className="row nowrap">
            <button className="icon-btn" onClick={() => move(-1)} title="이전 달"><ChevronLeft size={20} /></button>
            <h2 className="cal-title">{y}년 {m}월</h2>
            <button className="icon-btn" onClick={() => move(1)} title="다음 달"><ChevronRight size={20} /></button>
            <button className="btn small" onClick={() => setYm(parts(today).slice(0, 2))}>오늘</button>
          </div>
          {isTeacher && (
            <div className="row">
              <button className="btn" onClick={() => setOpen({ mode: 'neis' })}><Download size={18} /> 나이스 학사일정</button>
              <button className="btn primary" onClick={() => setOpen({ mode: 'new', ev: { date: today } })}><Plus size={18} /> 일정 추가</button>
            </div>
          )}
        </div>
        <div className="cal-legend">{EVENT_TYPES.map((t) => <span key={t}><span className={`ev-dot ${typeClass(t)}`} /> {t}</span>)}</div>
        <div className="cal-grid">
          {'일월화수목금토'.split('').map((d, i) => <div key={d} className={`cal-head ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>{d}</div>)}
          {cells.map((d) => {
            const [, mm, dd] = parts(d);
            const evs = on(d);
            return (
              <div key={d} className={`cal-cell ${mm !== m ? 'other' : ''} ${d === today ? 'today' : ''} ${isTeacher ? 'clickable' : ''}`}
                onClick={() => isTeacher && setOpen({ mode: 'new', ev: { date: d } })} role={isTeacher ? 'button' : undefined}
                aria-label={isTeacher ? `${mm}월 ${dd}일에 일정 추가` : undefined}>
                <span className={`cal-day ${['sun', '', '', '', '', '', 'sat'][weekday(d)]}`}>{dd}</span>
                {evs.slice(0, 3).map((e) => (
                  <button key={e.id} className={`cal-ev ${typeClass(e.type)}`} title={e.title}
                    onClick={(ev) => { ev.stopPropagation(); setOpen({ mode: isTeacher ? 'edit' : 'view', ev: e }); }}>{e.title}</button>
                ))}
                {evs.length > 3 && <span className="muted small">+{evs.length - 3}</span>}
              </div>
            );
          })}
        </div>
      </section>
      <div className="cal-side">
        {open && (
          <section className="panel">
            {open.mode === 'neis' ? <NeisSchedulePanel onClose={() => setOpen(null)} /> : open.mode === 'view' ? <EventDetail ev={open.ev} onClose={() => setOpen(null)} /> : (
              <EventForm key={open.ev.id ?? `new-${open.ev.date}`} initial={open.ev} onClose={() => setOpen(null)} />
            )}
          </section>
        )}
        <section className="panel">
          <h2><CalendarDays size={18} className="h-icon" /> 다가오는 일정</h2>
          <UpcomingList events={events} days={30} limit={12} />
        </section>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return <ClassGate><Calendar /></ClassGate>;
}
