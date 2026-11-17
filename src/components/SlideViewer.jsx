import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize, Minimize, Radio } from 'lucide-react';
import { useLive } from '../contexts/LiveContext';
import { useSlides } from '../slides';

/**
 * 슬라이드 보기
 * - 평소: 누구나 혼자 넘겨 봄
 * - 실시간 수업 중 교사: 넘기면 학생 화면도 같은 장으로
 * - 실시간 수업 중 학생(따라오기 켬): 선생님이 넘기는 장을 보여 줌
 * 키보드 ← → ↑ ↓, PageUp/PageDown, 스페이스(발표용 리모컨) 지원
 */
export default function SlideViewer({ lessonId, count }) {
  const { slides, error } = useSlides(lessonId, count);
  const live = useLive();
  const box = useRef(null);
  const [local, setLocal] = useState(0);
  const [full, setFull] = useState(false);

  const session = live?.isTeacher ? live.teacher.session : null;
  const studentLive = !live?.isTeacher ? live?.student.live : null;
  const teacherDriving = !!session && session.lessonId === lessonId;
  const following = !!studentLive && studentLive.lessonId === lessonId && studentLive.follow;

  const total = slides.length;
  const clamp = (i) => Math.max(0, Math.min(i, Math.max(total - 1, 0)));

  // 교사가 실시간 수업 중일 때도 화면은 바로 넘기고(저장은 뒤따라감),
  // 리모컨을 빠르게 연달아 눌러도 한 장씩 빠짐없이 넘어가도록 마지막 위치를 ref 로 기억
  const [driven, setDriven] = useState(session?.slide ?? 0);
  const serverSlide = session?.slide ?? 0;
  useEffect(() => {
    if (teacherDriving) setDriven(serverSlide);
  }, [teacherDriving, serverSlide]);

  const raw = teacherDriving ? driven : following ? studentLive.slide ?? 0 : local;
  const index = clamp(raw);
  const indexRef = useRef(index);
  indexRef.current = index;

  // 따라오는 동안 본 마지막 장 (따라오기를 끄면 거기서 이어서)
  const lastLive = useRef(0);
  if (following) lastLive.current = index;
  useEffect(() => {
    if (!following && studentLive && studentLive.lessonId === lessonId) setLocal(lastLive.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [following]);

  const go = useCallback(
    (next) => {
      if (following || !total) return;
      const i = Math.max(0, Math.min(next, total - 1));
      if (i === indexRef.current) return;
      indexRef.current = i;
      if (teacherDriving) {
        setDriven(i);
        live.teacher.set({ slide: i });
      } else setLocal(i);
    },
    [following, total, teacherDriving, live],
  );
  const step = useCallback((d) => go(indexRef.current + d), [go]);

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault();
        step(1);
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        step(-1);
      } else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(total - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, step, total]);

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else box.current?.requestFullscreen?.();
  };

  if (error) return <p className="error">슬라이드를 불러오지 못했어요 ({error})</p>;
  if (!total) return <div className="slides slides-loading" aria-busy="true">슬라이드 불러오는 중…</div>;

  const s = slides[index];
  return (
    <div className={`slides ${full ? 'is-full' : ''}`} ref={box}>
      <div className="slide-stage" onClick={(e) => {
        // 화면 오른쪽 절반을 누르면 다음, 왼쪽은 이전 (전체 화면·태블릿에서 편하게)
        if (following) return;
        const r = e.currentTarget.getBoundingClientRect();
        step(e.clientX - r.left > r.width / 2 ? 1 : -1);
      }}>
        <img src={s.image} alt={`슬라이드 ${index + 1} / ${total}`} width={s.w} height={s.h} draggable={false} />
      </div>
      <div className="slide-bar">
        <button className="icon-btn" onClick={() => step(-1)} disabled={following || index === 0} title="이전 슬라이드 (←)"><ChevronLeft size={22} /></button>
        <span className="slide-count" aria-live="polite">{index + 1} / {total}</span>
        <button className="icon-btn" onClick={() => step(1)} disabled={following || index === total - 1} title="다음 슬라이드 (→)"><ChevronRight size={22} /></button>
        {teacherDriving && <span className="slide-live"><Radio size={14} /> 넘기면 학생 화면도 넘어가요</span>}
        {following && <span className="slide-live"><Radio size={14} /> 선생님이 넘기는 화면이에요</span>}
        <span className="live-spacer" />
        <button className="icon-btn" onClick={toggleFull} title={full ? '전체 화면 끝내기 (Esc)' : '전체 화면'}>
          {full ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
      </div>
    </div>
  );
}
