import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { ChevronRight, HeartHandshake, Megaphone, Pin, Vote } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentClass } from '../contexts/ClassContext';
import { useMyReads, useNotices } from '../notices';
import { usePolls } from '../polls';
import { useCounsel } from '../counsel';
import { timeAgo } from '../util/dates';

// 학생: 아직 응답하지 않은 진행 중 설문
function useUnanswered(polls, uid, enabled) {
  const [ids, setIds] = useState(() => new Set());
  const key = polls.map((p) => p.id).join(',');
  useEffect(() => {
    if (!enabled || !uid) return setIds(new Set());
    let cancelled = false;
    Promise.all(polls.map((p) => getDoc(doc(db, 'polls', p.id, 'responses', uid)).then((s) => (s.exists() ? null : p.id)).catch(() => null)))
      .then((r) => !cancelled && setIds(new Set(r.filter(Boolean))));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, uid, enabled]);
  return ids;
}

/** 홈 화면의 '우리 반 소식': 최근 알림장, 진행 중 설문, (교사) 확인 전 상담 */
export default function ClassFeed() {
  const { user, isTeacher } = useAuth();
  const { classId, className } = useCurrentClass();
  const { notices } = useNotices(classId);
  const { polls } = usePolls(classId);
  const { items: counsel } = useCounsel({ isTeacher, classId, uid: user?.uid });
  const recent = notices.slice(0, 4);
  const readIds = useMyReads(isTeacher ? [] : recent.map((n) => n.id), user?.uid);
  const open = polls.filter((p) => !p.closed);
  const unanswered = useUnanswered(open, user?.uid, !isTeacher);
  const newCounsel = counsel.filter((c) => c.status === 'new').length;

  if (!classId) return null;
  return (
    <div className="feed">
      <section className="panel">
        <div className="panel-head">
          <h2><Megaphone size={18} className="h-icon" /> 알림장{isTeacher && className ? <span className="muted"> · {className}</span> : null}</h2>
          <Link to="/notices" className="more">전체 보기 <ChevronRight size={16} /></Link>
        </div>
        {recent.length === 0 ? (
          <p className="muted small">{isTeacher ? '아직 올린 알림이 없어요.' : '새 알림이 없어요.'}</p>
        ) : (
          <ul className="item-list compact">
            {recent.map((n) => (
              <li key={n.id}>
                <Link to={`/notices/${n.id}`} className="item-link">
                  {n.pinned && <Pin size={14} className="pin" />}
                  <span className="item-main"><span className="item-title">{n.title}{!isTeacher && !readIds.has(n.id) && <span className="tag new">새 글</span>}</span></span>
                  <span className="muted small">{timeAgo(n.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2><Vote size={18} className="h-icon" /> 진행 중인 설문</h2>
          <Link to="/polls" className="more">전체 보기 <ChevronRight size={16} /></Link>
        </div>
        {open.length === 0 ? (
          <p className="muted small">진행 중인 설문이 없어요.</p>
        ) : (
          <ul className="item-list compact">
            {open.slice(0, 4).map((p) => (
              <li key={p.id}>
                <Link to={`/polls/${p.id}`} className="item-link">
                  <span className="item-main"><span className="item-title">{p.title}{!isTeacher && unanswered.has(p.id) && <span className="tag warn">참여해 주세요</span>}</span></span>
                  <ChevronRight size={16} className="chev" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2><HeartHandshake size={18} className="h-icon" /> 상담</h2>
          <Link to="/counsel" className="more">{isTeacher ? '신청함' : '신청하기'} <ChevronRight size={16} /></Link>
        </div>
        {isTeacher ? (
          <p className={newCounsel ? 'info' : 'muted small'}>{newCounsel ? `확인 전 상담 신청 ${newCounsel}건이 있어요.` : '확인 전 상담 신청이 없어요.'}</p>
        ) : (
          <p className="muted small">선생님께 하고 싶은 이야기가 있으면 언제든 신청하세요. 선생님만 볼 수 있어요.</p>
        )}
      </section>
    </div>
  );
}
