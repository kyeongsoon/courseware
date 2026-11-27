import { useState } from 'react';
import { HeartHandshake, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentClass } from '../contexts/ClassContext';
import ClassGate from '../components/ClassGate';
import { STATUS, TOPICS, answerCounsel, cancelCounsel, requestCounsel, useCounsel } from '../counsel';
import { formatDateTime } from '../util/dates';

const statusTag = (s) => <span className={`tag ${s === 'done' ? 'done' : s === 'scheduled' ? 'info-tag' : 'warn'}`}>{STATUS[s]}</span>;

function StudentCounsel() {
  const { user, profile } = useAuth();
  const { classId } = useCurrentClass();
  const { items } = useCounsel({ isTeacher: false, uid: user.uid });
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return setErr('하고 싶은 이야기를 적어 주세요.');
    setBusy(true);
    setErr('');
    try {
      await requestCounsel({ classId, uid: user.uid, profile, topic, message, preferredTime });
      setMessage('');
      setPreferredTime('');
      setMsg('신청했어요. 선생님만 볼 수 있어요.');
    } catch (e2) {
      setErr(`신청 실패: ${e2.code ?? e2.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="panel">
        <h2>상담 신청</h2>
        <p className="muted small">여기 쓴 내용은 <b>선생님만</b> 볼 수 있어요. 친구들은 볼 수 없어요.</p>
        <form className="stack" onSubmit={submit}>
          <label>
            주제
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              {TOPICS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label>
            하고 싶은 이야기
            <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} placeholder="편하게 적어 주세요." />
          </label>
          <label>
            편한 시간 <span className="muted small">(선택)</span>
            <input value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} maxLength={100} placeholder="예: 수요일 점심시간" />
          </label>
          {err && <p className="error">{err}</p>}
          {msg && <p className="info">{msg}</p>}
          <div><button className="btn primary" type="submit" disabled={busy}><Send size={18} /> {busy ? '보내는 중…' : '신청하기'}</button></div>
        </form>
      </section>
      {items.length > 0 && (
        <section className="panel">
          <h2>내 신청</h2>
          <ul className="counsel-list">
            {items.map((c) => (
              <li key={c.id} className="counsel-item">
                <div className="row"><b>{c.topic}</b>{statusTag(c.status)}<span className="muted small">{formatDateTime(c.createdAt)}</span></div>
                <p className="pre">{c.message}</p>
                {c.reply && <div className="reply"><span className="label-like">선생님 답변</span><p className="pre">{c.reply}</p></div>}
                {c.status === 'new' && (
                  <div><button className="btn small danger" onClick={() => confirm('신청을 취소할까요?') && cancelCounsel(c.id)}><Trash2 size={16} /> 신청 취소</button></div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function CounselReply({ item }) {
  const [status, setStatus] = useState(item.status);
  const [reply, setReply] = useState(item.reply ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = async () => {
    setBusy(true);
    setSaved(false);
    try {
      await answerCounsel(item.id, { status, reply });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack-sm">
      <textarea rows={3} value={reply} onChange={(e) => { setReply(e.target.value); setSaved(false); }} maxLength={2000}
        placeholder="학생에게 보일 답변 (예: 수요일 점심시간에 교무실로 와요)" aria-label="답변" />
      <div className="row">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setSaved(false); }} aria-label="상태">
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn small primary" onClick={save} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
        {saved && <span className="info small">저장했어요</span>}
      </div>
    </div>
  );
}

function TeacherCounsel() {
  const { classId } = useCurrentClass();
  const { items, loading } = useCounsel({ isTeacher: true, classId });
  const [filter, setFilter] = useState('open');
  const shown = items.filter((c) => (filter === 'open' ? c.status !== 'done' : filter === 'done' ? c.status === 'done' : true));
  const count = (f) => items.filter((c) => (f === 'open' ? c.status !== 'done' : c.status === 'done')).length;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>상담 신청함</h2>
        <div className="tabs" role="tablist">
          {[['open', `진행 중 ${count('open')}`], ['done', `완료 ${count('done')}`], ['all', '전체']].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={`tab ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
      </div>
      {!loading && shown.length === 0 ? (
        <div className="empty"><HeartHandshake size={32} strokeWidth={1.5} /><p>{filter === 'done' ? '완료한 상담이 없어요.' : '새 상담 신청이 없어요.'}</p></div>
      ) : (
        <ul className="counsel-list">
          {shown.map((c) => (
            <li key={c.id} className="counsel-item">
              <div className="row"><b>{c.studentId} {c.name}</b><span className="tag muted-tag">{c.topic}</span>{statusTag(c.status)}<span className="muted small">{formatDateTime(c.createdAt)}</span></div>
              <p className="pre">{c.message}</p>
              {c.preferredTime && <p className="muted small">편한 시간: {c.preferredTime}</p>}
              <CounselReply item={c} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function CounselPage() {
  const { isTeacher } = useAuth();
  return <ClassGate>{isTeacher ? <TeacherCounsel /> : <StudentCounsel />}</ClassGate>;
}
