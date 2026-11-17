import { useEffect, useRef, useState } from 'react';
import { MonitorPlay, Volume2 } from 'lucide-react';
import { useLive } from '../contexts/LiveContext';
import { YT_STATE, loadYouTubeApi } from '../youtube';
import { expectedVideoTime, publishVideo } from '../live';

/**
 * 수업 영상
 * - 평소: 일반 YouTube 임베드
 * - 실시간 수업 중 교사: 재생/일시정지/위치를 학생에게 보냄
 * - 실시간 수업 중 학생: 교사 영상 상태를 그대로 따라감 (조작 버튼 숨김)
 */
export default function LessonVideo({ videoId, lessonId, title }) {
  const live = useLive();
  const teacherSession = live?.isTeacher ? live.teacher.session : null;
  const studentLive = !live?.isTeacher ? live?.student.live : null;

  const publishing = !!teacherSession && teacherSession.lessonId === lessonId;
  const following = !!studentLive && studentLive.lessonId === lessonId;

  if (following && studentLive.videoMode === 'teacher') {
    return (
      <div className="video video-placeholder">
        <MonitorPlay size={36} strokeWidth={1.5} />
        <p>영상은 선생님 화면(앞 화면)으로 함께 봐요.</p>
      </div>
    );
  }
  if (publishing || following) {
    return (
      <SyncedPlayer
        key={`${publishing ? 'pub' : 'sub'}-${videoId}`}
        mode={publishing ? 'publish' : 'follow'}
        videoId={videoId}
        title={title}
        classId={teacherSession?.id}
        remote={studentLive?.video}
        joined={live.student.joined}
        onJoin={live.student.join}
      />
    );
  }
  return <PlainVideo videoId={videoId} title={title} />;
}

function PlainVideo({ videoId, title }) {
  return (
    <div className="video">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title={`${title} 영상`}
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

function SyncedPlayer({ mode, videoId, title, classId, remote, joined, onJoin }) {
  const holder = useRef(null);
  const player = useRef(null);
  const last = useRef(null); // 교사: 마지막으로 보낸 상태
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState('');

  // 플레이어 만들기
  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !holder.current) return;
        const el = document.createElement('div');
        holder.current.appendChild(el);
        player.current = new YT.Player(el, {
          videoId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            rel: 0,
            playsinline: 1,
            // 학생은 조작 버튼을 숨겨서 선생님 영상과 어긋나지 않게
            controls: mode === 'follow' ? 0 : 1,
            disablekb: mode === 'follow' ? 1 : 0,
          },
          events: {
            onReady: () => !cancelled && setReady(true),
            onStateChange: (e) => mode === 'publish' && onTeacherState(e.data),
          },
        });
      })
      .catch((e) => !cancelled && setFailed(e.message));
    return () => {
      cancelled = true;
      try {
        player.current?.destroy();
      } catch {
        /* 이미 사라진 플레이어 */
      }
      player.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, mode]);

  // ── 교사: 상태 보내기 ──
  const send = (state) => {
    const time = player.current?.getCurrentTime?.() ?? 0;
    last.current = { videoId, state, time, at: Date.now() };
    publishVideo(classId, { videoId, state, time }).catch(() => {});
  };
  function onTeacherState(s) {
    if (s === YT_STATE.PLAYING) send('playing');
    else if (s === YT_STATE.PAUSED || s === YT_STATE.ENDED) send('paused');
  }
  // 일시정지 중 위치를 옮기거나, 재생 중 건너뛴 경우도 알림
  useEffect(() => {
    if (mode !== 'publish' || !ready) return undefined;
    const t = setInterval(() => {
      const p = player.current;
      if (!p?.getCurrentTime || !last.current) return;
      const drift = Math.abs(p.getCurrentTime() - expectedVideoTime(last.current));
      if (drift > 1.5) send(p.getPlayerState() === YT_STATE.PLAYING ? 'playing' : 'paused');
    }, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ready]);

  // ── 학생: 교사 상태 따라가기 ──
  useEffect(() => {
    if (mode !== 'follow' || !ready) return undefined;
    const apply = () => {
      const p = player.current;
      if (!p?.getCurrentTime) return;
      if (!remote || remote.videoId !== videoId) {
        if (p.getPlayerState() === YT_STATE.PLAYING) p.pauseVideo();
        return;
      }
      const target = expectedVideoTime(remote);
      if (Math.abs(p.getCurrentTime() - target) > 1.5) p.seekTo(target, true);
      if (remote.state === 'playing') {
        // 학생이 화면을 한 번 눌러 '참여'했으면 소리 켜고, 아니면 브라우저 정책상 소리 없이 재생
        if (joined) p.unMute();
        else p.mute();
        if (p.getPlayerState() !== YT_STATE.PLAYING) p.playVideo();
      } else if (p.getPlayerState() === YT_STATE.PLAYING) {
        p.pauseVideo();
      }
    };
    apply();
    const t = remote?.state === 'playing' ? setInterval(apply, 5000) : null;
    return () => t && clearInterval(t);
  }, [mode, ready, remote, joined, videoId]);

  const onSoundOn = () => {
    onJoin();
    player.current?.unMute?.();
  };

  if (failed) {
    return (
      <>
        <PlainVideo videoId={videoId} title={title} />
        <p className="muted small">{failed} (영상 맞춤 없이 보여요)</p>
      </>
    );
  }
  return (
    <div className="video-wrap">
      <div className="video" ref={holder} aria-label={`${title} 영상`} />
      {mode === 'follow' && !joined && remote?.state === 'playing' && (
        <button className="btn primary sound-btn" onClick={onSoundOn}><Volume2 size={18} /> 소리 켜기</button>
      )}
      {mode === 'publish' && <p className="muted small">실시간 수업 중: 이 영상을 재생·일시정지·이동하면 학생 화면도 똑같이 움직여요.</p>}
      {mode === 'follow' && <p className="muted small">선생님 영상에 맞춰 재생돼요.</p>}
    </div>
  );
}
