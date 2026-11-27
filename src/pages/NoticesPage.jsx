import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Megaphone, Pin, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentClass } from '../contexts/ClassContext';
import ClassGate from '../components/ClassGate';
import { NOTICE_LIMITS, createNotice, useMyReads, useNotices } from '../notices';
import { timeAgo } from '../util/dates';

export function NoticeForm({ initial, onSubmit, onCancel, submitLabel = '올리기' }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setErr('제목을 입력해 주세요.');
    setBusy(true);
    setErr('');
    try {
      await onSubmit({ title, body, pinned });
    } catch (e2) {
      setErr(`저장 실패: ${e2.code ?? e2.message}`);
      setBusy(false);
    }
  };
  return (
    <form className="stack" onSubmit={submit}>
      <label>
        제목
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={NOTICE_LIMITS.title} placeholder="예: 내일 체육복 챙겨 오세요" />
      </label>
      <label>
        내용
        <textarea className="prose-input" rows={6} value={body} onChange={(e) => setBody(e.target.value)} maxLength={NOTICE_LIMITS.body}
          placeholder="빈 줄로 문단을 나누고, http로 시작하는 주소는 자동으로 링크가 돼요." />
      </label>
      <label className="check-line">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> 맨 위에 고정
      </label>
      {err && <p className="error">{err}</p>}
      <div className="row">
        <button className="btn primary" type="submit" disabled={busy}>{busy ? '저장 중…' : submitLabel}</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>취소</button>}
      </div>
    </form>
  );
}

function NoticeList() {
  const { user, isTeacher } = useAuth();
  const { classId } = useCurrentClass();
  const { notices, loading } = useNotices(classId);
  const readIds = useMyReads(isTeacher ? [] : notices.map((n) => n.id), user?.uid);
  const [writing, setWriting] = useState(false);

  return (
    <>
      {isTeacher && (
        <section className="panel">
          {writing ? (
            <>
              <h2>새 알림</h2>
              <NoticeForm
                onSubmit={async (v) => {
                  await createNotice({ ...v, classId }, user.uid);
                  setWriting(false);
                }}
                onCancel={() => setWriting(false)}
              />
            </>
          ) : (
            <div className="panel-head">
              <h2>알림장</h2>
              <button className="btn primary" onClick={() => setWriting(true)}><Plus size={18} /> 새 알림 쓰기</button>
            </div>
          )}
        </section>
      )}

      <section className="panel">
        {!loading && notices.length === 0 ? (
          <div className="empty">
            <Megaphone size={32} strokeWidth={1.5} />
            <p>{isTeacher ? '아직 올린 알림이 없어요.' : '아직 알림이 없어요.'}</p>
          </div>
        ) : (
          <ul className="item-list">
            {notices.map((n) => (
              <li key={n.id}>
                <Link to={`/notices/${n.id}`} className="item-link">
                  {n.pinned && <Pin size={16} className="pin" aria-label="고정" />}
                  <span className="item-main">
                    <span className="item-title">
                      {n.title}
                      {!isTeacher && !readIds.has(n.id) && <span className="tag new">새 글</span>}
                    </span>
                    <span className="muted small">{timeAgo(n.createdAt)}</span>
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

export default function NoticesPage() {
  return <ClassGate><NoticeList /></ClassGate>;
}

