import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Check, Download, UserX } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentClass } from '../contexts/ClassContext';
import ClassGate from '../components/ClassGate';
import { useStudents } from '../useStudents';
import {
  REASONS, STATUSES, checkIn, clearRecord, dateInt, dateLabel, downloadMonthCsv, fromInput, isAfter, kstTime, monthOf,
  setDeadline, setStatus, toInput, useClassAttendance, useMyAttendance,
} from '../attendance';

// ── 학생: 오늘 체크 카드 (홈에도 씀) ──
export function MyCheckIn({ compact = false }) {
  const { user, profile } = useAuth();
  const { classId } = useCurrentClass();
  const today = dateInt();
  const records = useMyAttendance(user?.uid, monthOf(today));
  const mine = records.find((r) => r.date === today);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onCheck = async () => {
    setBusy(true);
    setErr('');
    try {
      await checkIn(classId, user.uid, profile);
    } catch (e) {
      setErr(e.code === 'permission-denied' ? '체크할 수 없어요. 선생님이 이미 기록했을 수 있어요.' : `실패: ${e.code ?? e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`panel checkin ${mine ? 'done' : ''}`}>
      <div className="panel-head">
        <h2><CalendarCheck size={18} className="h-icon" /> 오늘 출석 <span className="muted">· {dateLabel(today)}</span></h2>
      </div>
      {mine ? (
        <p className="checkin-state">
          <Check size={20} /> <b>{STATUSES[mine.status]}</b>
          {mine.reason && <span className="muted">({mine.reason})</span>}
          {mine.checkedAt && <span className="muted">{kstTime(mine.checkedAt)}에 체크했어요</span>}
          {mine.by === 'teacher' && !mine.checkedAt && <span className="muted">선생님이 기록했어요</span>}
        </p>
      ) : (
        <button className="btn primary big" onClick={onCheck} disabled={busy}><CalendarCheck size={20} /> {busy ? '체크 중…' : '출석 체크'}</button>
      )}
      {err && <p className="error">{err}</p>}
      {!compact && records.length > 0 && (
        <ul className="my-att">
          {records.map((r) => (
            <li key={r.id}><span>{dateLabel(r.date)}</span><span className={`tag st-${r.status}`}>{STATUSES[r.status]}{r.reason ? ` · ${r.reason}` : ''}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── 교사: 오늘 현황 카드 (홈) ──
export function TodaySummary() {
  const { classId, className } = useCurrentClass();
  const { students } = useStudents();
  const roster = students.filter((s) => s.classId === classId);
  const records = useClassAttendance(classId, { date: dateInt() });
  const byStatus = (k) => records.filter((r) => r.status === k).length;
  const missing = roster.length - records.filter((r) => roster.some((s) => s.uid === r.uid)).length;
  if (!classId) return null;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2><CalendarCheck size={18} className="h-icon" /> 오늘 출석 <span className="muted">· {className}</span></h2>
      </div>
      <div className="att-sum">
        {Object.entries(STATUSES).map(([k, v]) => <span key={k} className={`tag st-${k}`}>{v} {byStatus(k)}</span>)}
        <span className={`tag ${missing ? 'warn' : 'muted-tag'}`}>미체크 {missing}</span>
      </div>
    </section>
  );
}

function StudentRow({ s, rec, date, classId, deadline }) {
  const [note, setNote] = useState(rec?.note ?? '');
  const status = rec?.status;
  const set = (patch) => setStatus(classId, date, s, { status: patch.status ?? status ?? 'present', reason: patch.reason ?? rec?.reason ?? '', note: patch.note ?? rec?.note ?? '' }, rec);
  const late = rec?.checkedAt && isAfter(rec.checkedAt, deadline);
  return (
    <tr className={!rec ? 'missing' : ''}>
      <td>{s.studentId}</td>
      <td>{s.displayName}</td>
      <td className={late ? 'late-time' : 'muted'}>{rec?.checkedAt ? `${kstTime(rec.checkedAt)}${late ? ' 늦음' : ''}` : rec ? '교사 기록' : '미체크'}</td>
      <td>
        <div className="seg" role="group" aria-label={`${s.displayName} 출결`}>
          {Object.entries(STATUSES).map(([k, v]) => (
            <button key={k} className={`seg-btn st-${k} ${status === k ? 'on' : ''}`} onClick={() => set({ status: k })} aria-pressed={status === k}>{v}</button>
          ))}
          {rec && <button className="seg-btn clear" title="기록 지우기" onClick={() => confirm(`${s.displayName} 학생의 이날 기록을 지울까요?`) && clearRecord(classId, date, s.uid)}>×</button>}
        </div>
      </td>
      <td>
        {status && status !== 'present' && (
          <select value={rec?.reason ?? ''} onChange={(e) => set({ reason: e.target.value })} aria-label="사유">
            <option value="">사유</option>
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        )}
      </td>
      <td>
        {rec && (
          <input className="note-input" value={note} maxLength={200} placeholder="메모" aria-label="메모"
            onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (rec.note ?? '') && set({ note })} />
        )}
      </td>
    </tr>
  );
}

function TeacherAttendance() {
  const { classId, classes } = useCurrentClass();
  const cls = classes.find((c) => c.id === classId);
  const { students } = useStudents();
  const roster = useMemo(() => students.filter((s) => s.classId === classId), [students, classId]);
  const [tab, setTab] = useState('day');
  const [date, setDate] = useState(dateInt());
  const [month, setMonth] = useState(monthOf(dateInt()));
  const dayRecs = useClassAttendance(classId, tab === 'day' ? { date } : { month });
  const byUid = Object.fromEntries(dayRecs.map((r) => [r.uid, r]));
  const [deadline, setDl] = useState(cls?.checkInDeadline ?? '');
  // 반을 바꾸거나 반 정보가 늦게 오면 그 반의 기준 시각으로
  useEffect(() => setDl(cls?.checkInDeadline ?? ''), [classId, cls?.checkInDeadline]);
  const missing = roster.filter((s) => !byUid[s.uid]);

  const markAbsent = async () => {
    if (!confirm(`체크하지 않은 ${missing.length}명을 결석으로 기록할까요?`)) return;
    for (const s of missing) await setStatus(classId, date, s, { status: 'absent' });
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'day'} className={`tab ${tab === 'day' ? 'on' : ''}`} onClick={() => setTab('day')}>하루</button>
          <button role="tab" aria-selected={tab === 'month'} className={`tab ${tab === 'month' ? 'on' : ''}`} onClick={() => setTab('month')}>월별 요약</button>
        </div>
        {tab === 'day' ? (
          <div className="row">
            <input type="date" value={toInput(date)} onChange={(e) => e.target.value && setDate(fromInput(e.target.value))} aria-label="날짜" />
            <label className="inline-label small">
              늦음 기준
              <input type="time" value={deadline} onChange={(e) => setDl(e.target.value)} onBlur={() => deadline !== (cls?.checkInDeadline ?? '') && setDeadline(classId, deadline)} aria-label="늦음 기준 시각" />
            </label>
          </div>
        ) : (
          <div className="row">
            <input type="month" value={`${Math.floor(month / 100)}-${String(month % 100).padStart(2, '0')}`} onChange={(e) => e.target.value && setMonth(Number(e.target.value.replace('-', '')))} aria-label="달" />
            <button className="btn small" onClick={() => downloadMonthCsv(month, roster, dayRecs)}><Download size={16} /> CSV 다운로드</button>
          </div>
        )}
      </div>

      {roster.length === 0 ? (
        <p className="muted">이 반에 학생이 없어요. 반 관리에서 학생을 넣어 주세요.</p>
      ) : tab === 'day' ? (
        <>
          <div className="att-sum">
            {Object.entries(STATUSES).map(([k, v]) => <span key={k} className={`tag st-${k}`}>{v} {dayRecs.filter((r) => r.status === k).length}</span>)}
            <span className={`tag ${missing.length ? 'warn' : 'muted-tag'}`}>미체크 {missing.length}</span>
            <span className="live-spacer" />
            {missing.length > 0 && <button className="btn small" onClick={markAbsent}><UserX size={16} /> 미체크 모두 결석</button>}
          </div>
          <div className="table-wrap">
            <table className="att-table">
              <thead><tr><th>학번</th><th>이름</th><th>체크</th><th>출결</th><th>사유</th><th>메모</th></tr></thead>
              <tbody>
                {roster.map((s) => <StudentRow key={`${s.uid}-${date}`} s={s} rec={byUid[s.uid]} date={date} classId={classId} deadline={deadline} />)}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>학번</th><th>이름</th>{Object.values(STATUSES).map((v) => <th key={v}>{v}</th>)}</tr></thead>
            <tbody>
              {roster.map((s) => {
                const rs = dayRecs.filter((r) => r.uid === s.uid);
                return (
                  <tr key={s.uid}>
                    <td>{s.studentId}</td><td>{s.displayName}</td>
                    {Object.keys(STATUSES).map((k) => <td key={k} className={k !== 'present' && rs.some((r) => r.status === k) ? 'bad-num' : ''}>{rs.filter((r) => r.status === k).length}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AttendancePage() {
  const { isTeacher } = useAuth();
  return <ClassGate>{isTeacher ? <TeacherAttendance /> : <MyCheckIn />}</ClassGate>;
}
