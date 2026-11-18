import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Lock, Pencil } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useClasses } from '../classes';
import { groupByUnit, isSafeUrl, useLessons, useUnits, youTubeId } from '../lessons';
import LessonBody from '../components/LessonBody';
import LessonVideo from '../components/LessonVideo';
import SlideViewer from '../components/SlideViewer';
import { LiveStart } from '../components/LiveBar';

export default function LessonViewPage() {
  const { lessonId } = useParams();
  const { profile, isTeacher } = useAuth();
  const { units } = useUnits();
  const { lessons } = useLessons({ isTeacher, classId: profile?.classId });
  const { classes } = useClasses();

  const [lesson, setLesson] = useState(null);
  const [state, setState] = useState('loading'); // loading | ok | closed | missing

  useEffect(() => {
    setState('loading');
    return onSnapshot(
      doc(db, 'lessons', lessonId),
      (snap) => {
        if (!snap.exists()) return setState('missing');
        setLesson({ id: snap.id, ...snap.data() });
        setState('ok');
      },
      // 학생에게 공개되지 않은 차시는 보안 규칙이 막음
      () => setState('closed'),
    );
  }, [lessonId]);

  // 이전/다음 차시 (보이는 차시만, 단원 순서 → 차시 순서)
  const flat = useMemo(() => groupByUnit(units, lessons).flatMap((g) => g.lessons), [units, lessons]);
  const pos = flat.findIndex((l) => l.id === lessonId);
  const prev = pos > 0 ? flat[pos - 1] : null;
  const next = pos >= 0 && pos < flat.length - 1 ? flat[pos + 1] : null;

  const unitIndex = units.findIndex((u) => u.id === lesson?.unitId);
  const unit = units[unitIndex];
  const lessonNo = lesson ? groupByUnit(units, lessons).find((g) => g.unit.id === lesson.unitId)?.lessons.findIndex((l) => l.id === lesson.id) : -1;

  const back = isTeacher ? '/teacher/lessons' : '/';

  if (state === 'loading') return <div className="muted">불러오는 중…</div>;
  if (state !== 'ok') {
    return (
      <section className="panel empty">
        <Lock size={32} strokeWidth={1.5} />
        <p>{state === 'missing' ? '없는 수업이에요. 삭제되었을 수 있어요.' : '아직 열리지 않은 수업이에요. 선생님이 열어 주면 볼 수 있어요.'}</p>
        <Link className="btn" to={back}>돌아가기</Link>
      </section>
    );
  }

  const videoId = youTubeId(lesson.videoUrl ?? '');
  const otherVideo = !videoId && isSafeUrl(lesson.videoUrl ?? '') ? lesson.videoUrl : '';
  const links = (lesson.links ?? []).filter((l) => isSafeUrl(l.url));
  const classNameOf = Object.fromEntries(classes.map((c) => [c.id, c.name]));
  const openNames = (lesson.openClassIds ?? []).map((id) => classNameOf[id]).filter(Boolean);

  return (
    <>
      <Link to={back} className="back-link"><ArrowLeft size={16} /> {isTeacher ? '수업 관리' : '홈'}</Link>

      <article className="panel lesson-view">
        <div className="lesson-meta">
          {unit && <span>{unitIndex + 1}단원. {unit.title}</span>}
          {lessonNo >= 0 && <span>· {lessonNo + 1}차시</span>}
        </div>
        <div className="panel-head">
          <h2 className="lesson-heading">{lesson.title}</h2>
          {isTeacher && <Link className="btn small" to={`/teacher/lessons/${lesson.id}/edit`}><Pencil size={16} /> 수정</Link>}
        </div>
        {isTeacher && (
          <p className="muted small">
            {openNames.length ? `공개: ${openNames.join(', ')}` : '비공개 (학생에게 안 보임)'}
          </p>
        )}
        {lesson.summary && <p className="lesson-summary">{lesson.summary}</p>}

        {isTeacher && <LiveStart lesson={lesson} classes={classes} />}

        {lesson.slideCount > 0 && <SlideViewer lessonId={lesson.id} count={lesson.slideCount} version={lesson.slidesVersion} />}

        {videoId && <LessonVideo videoId={videoId} lessonId={lesson.id} title={lesson.title} />}

        <LessonBody text={lesson.body} />

        {(links.length > 0 || otherVideo) && (
          <div className="lesson-links">
            <div className="label-like">자료</div>
            <div className="row">
              {otherVideo && (
                <a className="btn" href={otherVideo} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> 영상 보기</a>
              )}
              {links.map((l, i) => (
                <a key={i} className="btn" href={l.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={16} /> {l.label || new URL(l.url).hostname}
                </a>
              ))}
            </div>
          </div>
        )}
      </article>

      {(prev || next) && (
        <nav className="pager" aria-label="차시 이동">
          {prev ? <Link to={`/lessons/${prev.id}`} className="pager-link"><ChevronLeft size={18} /> <span><small>이전</small>{prev.title}</span></Link> : <span />}
          {next ? <Link to={`/lessons/${next.id}`} className="pager-link next"><span><small>다음</small>{next.title}</span> <ChevronRight size={18} /></Link> : <span />}
        </nav>
      )}
    </>
  );
}
