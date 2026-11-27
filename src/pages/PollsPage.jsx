import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus, Vote, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentClass } from '../contexts/ClassContext';
import ClassGate from '../components/ClassGate';
import { POLL_LIMITS, createPoll, usePolls } from '../polls';
import { timeAgo } from '../util/dates';

function PollForm({ onDone }) {
  const { user } = useAuth();
  const { classId } = useCurrentClass();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const setOpt = (i, v) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  const submit = async (e) => {
    e.preventDefault();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!title.trim()) return setErr('질문을 입력해 주세요.');
    if (opts.length < 2) return setErr('선택지를 2개 이상 입력해 주세요.');
    if (new Set(opts).size !== opts.length) return setErr('같은 선택지가 두 번 있어요.');
    setBusy(true);
    setErr('');
    try {
      await createPoll({ classId, title, description, options: opts, multiple, anonymous }, user.uid);
      onDone();
    } catch (e2) {
      setErr(`저장 실패: ${e2.code ?? e2.message}`);
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <h2>새 설문·투표</h2>
      <label>
        질문
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={POLL_LIMITS.title} placeholder="예: 체험학습 장소는 어디가 좋을까요?" />
      </label>
      <label>
        설명 <span className="muted small">(선택)</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={POLL_LIMITS.description} />
      </label>
      <div className="stack-sm">
        <div className="label-like">선택지</div>
        {options.map((o, i) => (
          <div key={i} className="row nowrap">
            <input className="grow" value={o} onChange={(e) => setOpt(i, e.target.value)} maxLength={POLL_LIMITS.option} placeholder={`선택지 ${i + 1}`} aria-label={`선택지 ${i + 1}`} />
            {options.length > 2 && (
              <button type="button" className="icon-btn" title="선택지 빼기" onClick={() => setOptions((x) => x.filter((_, j) => j !== i))}><X size={18} /></button>
            )}
          </div>
        ))}
        {options.length < POLL_LIMITS.options && (
          <button type="button" className="btn small" onClick={() => setOptions((x) => [...x, ''])}><Plus size={16} /> 선택지 추가</button>
        )}
      </div>
      <label className="check-line"><input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} /> 여러 개 고를 수 있음</label>
      <label className="check-line"><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> 익명 (누가 무엇을 골랐는지 이름을 저장하지 않음)</label>
      {err && <p className="error">{err}</p>}
      <div className="row">
        <button className="btn primary" type="submit" disabled={busy}>{busy ? '올리는 중…' : '올리기'}</button>
        <button className="btn" type="button" onClick={onDone}>취소</button>
      </div>
    </form>
  );
}

function PollList() {
  const { isTeacher } = useAuth();
  const { classId } = useCurrentClass();
  const { polls, loading } = usePolls(classId);
  const [writing, setWriting] = useState(false);

  return (
    <>
      {isTeacher && (
        <section className="panel">
          {writing ? <PollForm onDone={() => setWriting(false)} /> : (
            <div className="panel-head">
              <h2>설문·투표</h2>
              <button className="btn primary" onClick={() => setWriting(true)}><Plus size={18} /> 새 설문 만들기</button>
            </div>
          )}
        </section>
      )}
      <section className="panel">
        {!loading && polls.length === 0 ? (
          <div className="empty"><Vote size={32} strokeWidth={1.5} /><p>아직 설문이 없어요.</p></div>
        ) : (
          <ul className="item-list">
            {polls.map((p) => (
              <li key={p.id}>
                <Link to={`/polls/${p.id}`} className="item-link">
                  <span className="item-main">
                    <span className="item-title">
                      {p.title}
                      {p.closed ? <span className="tag muted-tag">마감</span> : <span className="tag done">진행 중</span>}
                      {p.anonymous && <span className="tag muted-tag">익명</span>}
                    </span>
                    <span className="muted small">{timeAgo(p.createdAt)} · 선택지 {p.options.length}개{p.multiple ? ' · 여러 개 선택' : ''}</span>
                  </span>
                  <ChevronRight size={18} className="chev" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function PollsPage() {
  return <ClassGate><PollList /></ClassGate>;
}
