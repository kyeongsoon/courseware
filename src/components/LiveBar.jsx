import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, ChevronDown, ChevronUp, EyeOff, Hand, Radio, Square, Users, Volume2 } from 'lucide-react';
import { useLive } from '../contexts/LiveContext';

function TeacherBar({ t }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const s = t.session;
  const onLesson = pathname === `/lessons/${s.lessonId}`;

  const onEnd = () => {
    if (confirm(`${s.className} 실시간 수업을 끝낼까요? 학생들은 다시 자유롭게 볼 수 있어요.`)) t.end();
  };

  return (
    <div className="live-bar teacher" role="region" aria-label="실시간 수업">
      <div className="live-row">
        <span className="live-dot" aria-hidden /> <b>{s.className}</b> 실시간 수업 중
        <span className="live-stat"><Users size={16} /> 접속 {t.onlineCount}명</span>
        <span className={`live-stat ${t.awayCount ? 'away' : ''}`} title="다른 탭이나 다른 앱을 보고 있는 학생">
          <EyeOff size={16} /> 다른 화면 {t.awayCount}명
        </span>
        <span className={`live-stat ${t.hands.length ? 'hot' : ''}`}><Hand size={16} /> {t.hands.length}</span>
        <span className="live-stat"><Check size={16} /> 다 했어요 {t.doneCount}/{t.onlineCount}</span>
        <span className="live-spacer" />
        {!onLesson && s.lessonId && <Link className="btn small" to={`/lessons/${s.lessonId}`}>띄운 차시로</Link>}
        <label className="switch" title="켜면 학생 화면이 선생님 화면을 따라와요">
          <input type="checkbox" checked={s.follow} onChange={(e) => t.set({ follow: e.target.checked })} />
          따라오기
        </label>
        <select value={s.videoMode} onChange={(e) => t.set({ videoMode: e.target.value })} aria-label="영상 보는 방법">
          <option value="sync">영상: 학생 화면에서도 함께</option>
          <option value="teacher">영상: 교사 화면(앞 화면)만</option>
        </select>
        <button className="btn small" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          학생 {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button className="btn small danger" onClick={onEnd}><Square size={14} /> 끝내기</button>
      </div>

      {open && (
        <div className="live-panel">
          {t.members.length === 0 ? (
            <p className="muted small">아직 들어온 학생이 없어요. 학생이 로그인하면 자동으로 이 차시가 열려요.</p>
          ) : (
            <>
              <div className="row">
                <span className="legend"><span className="presence on" /> 보는 중 <span className="presence away" /> 다른 탭·앱 <span className="presence off" /> 연결 끊김</span>
                <span className="live-spacer" />
                {t.hands.length > 0 && <button className="btn small" onClick={t.lowerAll}>손 모두 내리기</button>}
              </div>
              <ul className="member-grid">
                {t.members.map((m) => (
                  <li key={m.uid} className={`member ${m.status}`}>
                    <span
                      className={`presence ${m.status}`}
                      title={{ on: '수업 화면을 보고 있어요', away: '다른 탭이나 앱을 보고 있어요', off: '연결이 끊겼어요' }[m.status]}
                    />
                    <span className="member-name">{m.studentId} {m.name}</span>
                    {m.status === 'away' && <span className="tag away">다른 화면</span>}
                    {m.awayCount > 0 && <span className="away-count" title="이번 수업에서 다른 화면으로 간 횟수">{m.awayCount}회</span>}
                    {m.doneLessonId === s.lessonId && <span className="tag done">다 했어요</span>}
                    {m.hand && (
                      <button className="tag hand" onClick={() => t.lowerHand(m.uid)} title="손 내려 주기">✋ 내리기</button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StudentBar({ st }) {
  const { pathname } = useLocation();
  const l = st.live;
  const onLesson = pathname === `/lessons/${l.lessonId}`;
  return (
    <div className="live-bar student" role="region" aria-label="실시간 수업">
      <div className="live-row">
        <span className="live-dot" aria-hidden /> <b>실시간 수업 중</b>
        <span className="muted small">{l.follow ? '선생님 화면을 따라가요' : '지금은 자유롭게 볼 수 있어요'}</span>
        <span className="live-spacer" />
        {!l.follow && !onLesson && l.lessonId && <Link className="btn small" to={`/lessons/${l.lessonId}`}>선생님 화면으로</Link>}
        {!st.joined && (
          <button className="btn small primary" onClick={st.join} title="눌러 두면 선생님이 영상을 틀 때 소리도 함께 나와요">
            <Volume2 size={16} /> 수업 참여
          </button>
        )}
        <button className={`btn small ${st.hand ? 'on-hand' : ''}`} onClick={st.toggleHand} aria-pressed={st.hand}>
          <Hand size={16} /> {st.hand ? '손 내리기' : '손들기'}
        </button>
        <button className={`btn small ${st.done ? 'on-done' : ''}`} onClick={st.toggleDone} aria-pressed={st.done}>
          <Check size={16} /> {st.done ? '다 했어요 ✓' : '다 했어요'}
        </button>
      </div>
    </div>
  );
}

export default function LiveBar() {
  const live = useLive();
  if (!live) return null;
  if (live.isTeacher) return live.teacher.session ? <TeacherBar t={live.teacher} /> : null;
  return live.student.live ? <StudentBar st={live.student} /> : null;
}

// 교사 수업 화면의 '실시간 수업 시작' 버튼
export function LiveStart({ lesson, classes }) {
  const live = useLive();
  const [classId, setClassId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!live?.isTeacher) return null;
  const s = live.teacher.session;

  if (s) {
    return (
      <p className="live-note">
        <Radio size={16} /> {s.lessonId === lesson.id ? `${s.className} 학생 화면에 이 차시가 보이고 있어요.` : `${s.className} 실시간 수업 중이에요.`}
      </p>
    );
  }
  if (!classes.length) return null;

  const chosen = classId || (lesson.openClassIds ?? []).find((id) => classes.some((c) => c.id === id)) || classes[0].id;
  const onStart = async () => {
    const c = classes.find((x) => x.id === chosen);
    setBusy(true);
    setErr('');
    try {
      await live.teacher.start({ classId: c.id, className: c.name, lessonId: lesson.id });
    } catch (e) {
      setErr(`시작 실패: ${e.code ?? e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="live-start">
      <select value={chosen} onChange={(e) => setClassId(e.target.value)} aria-label="실시간 수업할 반">
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button className="btn primary small" onClick={onStart} disabled={busy}><Radio size={16} /> 실시간 수업 시작</button>
      <span className="muted small">학생 화면이 이 차시로 넘어오고, 선생님이 넘기면 함께 넘어가요. 공개하지 않은 차시도 수업 중에는 보여요.</span>
      {err && <span className="error">{err}</span>}
    </div>
  );
}
