import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Pencil, Pin, Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useStudents } from '../useStudents';
import LessonBody from '../components/LessonBody';
import { NoticeForm } from './NoticesPage';
import { deleteNotice, markRead, updateNotice, useReads } from '../notices';
import { formatDateTime } from '../util/dates';

function ReadStatus({ notice }) {
  const reads = useReads(notice.id);
  const { students } = useStudents();
  const roster = students.filter((s) => s.classId === notice.classId);
  const readUids = new Set(reads.map((r) => r.uid));
  const unread = roster.filter((s) => !readUids.has(s.uid));
  const read = roster.filter((s) => readUids.has(s.uid));
  return (
    <section className="panel">
      <h2>읽음 확인 <span className="muted">· {read.length} / {roster.length}명</span></h2>
      <div className="read-cols">
        <div>
          <div className="label-like">안 읽음 ({unread.length})</div>
          <div className="chips">{unread.length ? unread.map((s) => <span key={s.uid} className="tag warn">{s.studentId} {s.displayName}</span>) : <span className="muted small">모두 읽었어요 🎉</span>}</div>
        </div>
        <div>
          <div className="label-like">읽음 ({read.length})</div>
          <div className="chips">{read.map((s) => <span key={s.uid} className="tag done">{s.studentId} {s.displayName}</span>)}</div>
        </div>
      </div>
    </section>
  );
}

export default function NoticeDetailPage() {
  const { noticeId } = useParams();
  const { user, profile, isTeacher } = useAuth();
  const [notice, setNotice] = useState(undefined);
  const [editing, setEditing] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(
    () => onSnapshot(doc(db, 'notices', noticeId), (s) => setNotice(s.exists() ? { id: s.id, ...s.data() } : null), () => setNotice(null)),
    [noticeId],
  );

  // 학생이 열어 보면 읽음 기록
  const readable = !!notice && !isTeacher;
  useEffect(() => {
    if (readable) markRead(noticeId, user.uid, profile).catch(() => {});
  }, [readable, noticeId, user?.uid, profile]);

  const created = useMemo(() => notice && formatDateTime(notice.createdAt), [notice]);

  if (gone) return <Navigate to="/notices" replace />;
  if (notice === undefined) return <div className="muted">불러오는 중…</div>;
  if (notice === null) {
    return (
      <section className="panel empty">
        <p>없는 알림이에요. 삭제되었을 수 있어요.</p>
        <Link className="btn" to="/notices">알림장으로</Link>
      </section>
    );
  }

  const onDelete = async () => {
    if (!confirm('이 알림을 삭제할까요?')) return;
    await deleteNotice(notice.id);
    setGone(true);
  };

  return (
    <>
      <Link to="/notices" className="back-link"><ArrowLeft size={16} /> 알림장</Link>
      <article className="panel">
        {editing ? (
          <NoticeForm
            initial={notice}
            submitLabel="저장"
            onSubmit={async (v) => {
              await updateNotice(notice.id, { ...v, classId: notice.classId }, user.uid);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <div className="panel-head">
              <h2 className="notice-title">{notice.pinned && <Pin size={18} className="pin" />} {notice.title}</h2>
              {isTeacher && (
                <div className="row">
                  <button className="btn small" onClick={() => setEditing(true)}><Pencil size={16} /> 수정</button>
                  <button className="btn small danger" onClick={onDelete}><Trash2 size={16} /> 삭제</button>
                </div>
              )}
            </div>
            <p className="muted small">{created}</p>
            <LessonBody text={notice.body} />
          </>
        )}
      </article>
      {isTeacher && <ReadStatus notice={notice} />}
    </>
  );
}
