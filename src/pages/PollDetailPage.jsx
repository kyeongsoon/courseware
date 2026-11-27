import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Eye, EyeOff, Lock, Trash2, Unlock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStudents } from '../useStudents';
import { countVotes, deletePoll, publishResults, setPollClosed, submitResponse, usePoll, useResponses } from '../polls';

function Bars({ options, counts, total, mine = [] }) {
  return (
    <ul className="bars">
      {options.map((o, i) => {
        const pct = total ? Math.round((counts[i] / total) * 100) : 0;
        return (
          <li key={i} className={mine.includes(i) ? 'mine' : ''}>
            <div className="bar-label"><span>{o}{mine.includes(i) && <Check size={14} className="mine-check" />}</span><span className="muted">{counts[i]}표 · {pct}%</span></div>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
          </li>
        );
      })}
    </ul>
  );
}

function TeacherView({ poll }) {
  const responses = useResponses(poll.id, { isTeacher: true });
  const { students } = useStudents();
  const roster = students.filter((s) => s.classId === poll.classId);
  const counts = countVotes(poll, responses);
  const answered = new Set(responses.map((r) => r.uid));
  const notYet = roster.filter((s) => !answered.has(s.uid));
  const [gone, setGone] = useState(false);
  const published = Array.isArray(poll.results);

  if (gone) return <Navigate to="/polls" replace />;
  const onDelete = async () => {
    if (!confirm('이 설문과 모든 응답을 삭제할까요?')) return;
    await deletePoll(poll.id);
    setGone(true);
  };

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <h2>결과 <span className="muted">· {responses.length} / {roster.length}명 응답</span></h2>
          <div className="row">
            <button className="btn small" onClick={() => setPollClosed(poll.id, !poll.closed)}>
              {poll.closed ? <><Unlock size={16} /> 다시 열기</> : <><Lock size={16} /> 마감하기</>}
            </button>
            <button className="btn small" onClick={() => publishResults(poll.id, published ? null : counts, responses.length)}>
              {published ? <><EyeOff size={16} /> 결과 숨기기</> : <><Eye size={16} /> 학생에게 결과 공개</>}
            </button>
            <button className="btn small danger" onClick={onDelete}><Trash2 size={16} /> 삭제</button>
          </div>
        </div>
        <Bars options={poll.options} counts={counts} total={responses.length} />
        {published && <p className="muted small">학생에게 공개된 결과는 공개 버튼을 누른 순간의 결과예요. 새 응답을 반영하려면 숨겼다가 다시 공개하세요.</p>}
      </section>
      <section className="panel">
        <h2>응답 현황</h2>
        {!poll.anonymous && (
          <div className="stack-sm">
            {responses.map((r) => (
              <div key={r.uid} className="resp-row"><span>{r.studentId} {r.name}</span><span className="muted">{r.choices.map((c) => poll.options[c]).join(', ')}</span></div>
            ))}
          </div>
        )}
        {poll.anonymous && <p className="muted small">익명 설문이라 누가 무엇을 골랐는지는 보이지 않아요.</p>}
        <div className="label-like">아직 안 한 학생 ({notYet.length})</div>
        <div className="chips">{notYet.length ? notYet.map((s) => <span key={s.uid} className="tag warn">{s.studentId} {s.displayName}</span>) : <span className="muted small">모두 응답했어요 🎉</span>}</div>
      </section>
    </>
  );
}

function StudentView({ poll }) {
  const { user, profile } = useAuth();
  const [mine] = useResponses(poll.id, { uid: user.uid, isTeacher: false });
  const [picked, setPicked] = useState([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (mine) setPicked(mine.choices);
  }, [mine]);

  const toggle = (i) =>
    setPicked((p) => (poll.multiple ? (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]) : [i]));

  const submit = async () => {
    if (!picked.length) return setErr('하나 이상 골라 주세요.');
    setBusy(true);
    setErr('');
    try {
      await submitResponse(poll, user.uid, picked, profile);
      setEditing(false);
    } catch (e) {
      setErr(poll.closed ? '마감된 설문이에요.' : `제출 실패: ${e.code ?? e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const showForm = !poll.closed && (!mine || editing);
  return (
    <section className="panel">
      {showForm ? (
        <>
          <div className="choice-list" role={poll.multiple ? 'group' : 'radiogroup'}>
            {poll.options.map((o, i) => (
              <label key={i} className={`check-card ${picked.includes(i) ? 'on' : ''}`}>
                <input type={poll.multiple ? 'checkbox' : 'radio'} name="choice" checked={picked.includes(i)} onChange={() => toggle(i)} />
                {o}
              </label>
            ))}
          </div>
          {poll.multiple && <p className="muted small">여러 개 고를 수 있어요.</p>}
          {err && <p className="error">{err}</p>}
          <div className="row">
            <button className="btn primary" onClick={submit} disabled={busy}>{busy ? '보내는 중…' : mine ? '다시 제출' : '제출하기'}</button>
            {editing && <button className="btn" onClick={() => { setEditing(false); setPicked(mine.choices); }}>취소</button>}
          </div>
        </>
      ) : (
        <>
          {mine ? (
            <p className="info">✓ 제출했어요: <b>{mine.choices.map((c) => poll.options[c]).join(', ')}</b></p>
          ) : (
            <p className="muted">마감된 설문이에요. 응답하지 않았어요.</p>
          )}
          {!poll.closed && mine && <button className="btn small" onClick={() => setEditing(true)}>답 바꾸기</button>}
        </>
      )}
      {Array.isArray(poll.results) && (
        <>
          <div className="label-like">결과</div>
          <Bars options={poll.options} counts={poll.results} total={poll.resultsRespondents || poll.results.reduce((a, b) => a + b, 0)} mine={mine?.choices ?? []} />
          {poll.multiple && <p className="muted small">여러 개를 고를 수 있어서 비율을 더하면 100%가 넘을 수 있어요.</p>}
        </>
      )}
    </section>
  );
}

export default function PollDetailPage() {
  const { pollId } = useParams();
  const { isTeacher } = useAuth();
  const poll = usePoll(pollId);
  if (poll === undefined) return <div className="muted">불러오는 중…</div>;
  if (poll === null) {
    return <section className="panel empty"><p>없는 설문이에요.</p><Link className="btn" to="/polls">설문·투표로</Link></section>;
  }
  return (
    <>
      <Link to="/polls" className="back-link"><ArrowLeft size={16} /> 설문·투표</Link>
      <section className="panel">
        <h2 className="notice-title">
          {poll.title}
          {poll.closed ? <span className="tag muted-tag">마감</span> : <span className="tag done">진행 중</span>}
          {poll.anonymous && <span className="tag muted-tag">익명</span>}
        </h2>
        {poll.description && <p className="pre">{poll.description}</p>}
      </section>
      {isTeacher ? <TeacherView poll={poll} /> : <StudentView poll={poll} />}
    </>
  );
}
