import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { FEATURES } from '../features';
import {
  HEARTBEAT_MS, endLive, isOnline, isPageFocused, lowerAllHands, lowerHand, memberStatus, startLive, touchMember, updateLive,
} from '../live';

const LiveContext = createContext(null);
const lessonIdFromPath = (pathname) => (pathname.match(/^\/lessons\/([^/]+)$/) || [])[1] ?? null;

// ── 교사: 내가 진행 중인 실시간 수업 (한 번에 하나) ──
function useTeacherLive(enabled, uid) {
  const [session, setSession] = useState(null);
  const [members, setMembers] = useState([]);
  const [now, setNow] = useState(Date.now());
  const { pathname } = useLocation();

  useEffect(() => {
    if (!enabled) return setSession(null);
    return onSnapshot(
      query(collection(db, 'live'), where('teacherUid', '==', uid), where('active', '==', true)),
      (snap) => setSession(snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null),
      () => setSession(null),
    );
  }, [enabled, uid]);

  const classId = session?.id;
  useEffect(() => {
    if (!classId) return setMembers([]);
    return onSnapshot(collection(db, 'live', classId, 'members'), (snap) =>
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => (a.studentId > b.studentId ? 1 : -1))),
    );
  }, [classId]);

  // 접속 여부를 주기적으로 다시 계산
  useEffect(() => {
    if (!classId) return undefined;
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, [classId]);

  // 교사가 다른 차시로 가면 학생 화면도 그 차시로
  const viewing = lessonIdFromPath(pathname);
  useEffect(() => {
    if (classId && viewing && session.lessonId !== viewing) {
      updateLive(classId, { lessonId: viewing, video: null, slide: 0 }).catch(() => {});
    }
  }, [classId, viewing, session?.lessonId]);

  const online = members.filter((m) => isOnline(m, now));
  return {
    session,
    members: members.map((m) => ({ ...m, online: isOnline(m, now), status: memberStatus(m, now) })),
    onlineCount: online.length,
    awayCount: members.filter((m) => memberStatus(m, now) === 'away').length,
    hands: members.filter((m) => m.hand),
    doneCount: session ? members.filter((m) => m.doneLessonId && m.doneLessonId === session.lessonId).length : 0,
  };
}

// ── 학생: 내 반의 실시간 수업 ──
function useStudentLive(enabled, uid, classId, profile) {
  const [live, setLive] = useState(null);
  const [me, setMe] = useState({ hand: false, doneLessonId: '', focused: true, awayCount: 0 });
  const [joinedKey, setJoinedKey] = useState(null);
  const meRef = useRef(me);
  meRef.current = me;

  useEffect(() => {
    if (!enabled) return setLive(null);
    return onSnapshot(
      doc(db, 'live', classId),
      (snap) => setLive(snap.exists() && snap.data().active ? snap.data() : null),
      () => setLive(null),
    );
  }, [enabled, classId]);

  const active = !!live;
  const sessionKey = live?.startedAt?.toMillis?.() ?? (active ? 'pending' : null);

  // 내 기록 (교사가 손을 내려 주면 반영)
  useEffect(() => {
    if (!active) return undefined;
    return onSnapshot(doc(db, 'live', classId, 'members', uid), (snap) => {
      const d = snap.data();
      // 손들기·다 했어요는 교사가 바꿀 수 있어서 서버 값을 따르고, 화면 보기 상태는 이 기기 값이 기준
      setMe((m) => ({ ...m, hand: !!d?.hand, doneLessonId: d?.doneLessonId ?? '' }));
    }, () => {});
  }, [active, classId, uid]);

  // 새 수업이 시작되면 다른 화면 횟수를 0부터
  useEffect(() => {
    setMe((m) => ({ ...m, awayCount: 0, focused: isPageFocused() }));
  }, [sessionKey]);

  const write = useCallback(
    (patch) => {
      const next = { ...meRef.current, ...patch };
      setMe(next);
      return touchMember(classId, uid, { name: profile?.displayName, studentId: profile?.studentId, ...next }).catch(() => {});
    },
    [classId, uid, profile?.displayName, profile?.studentId],
  );

  // 다른 탭·앱으로 가거나 돌아오면 바로 알림
  useEffect(() => {
    if (!active) return undefined;
    let timer = null;
    const check = () => {
      // blur 직후에는 activeElement 가 아직 안 바뀌어서, 한 박자 뒤에 확인
      clearTimeout(timer);
      timer = setTimeout(() => {
        const focused = isPageFocused();
        if (focused === meRef.current.focused) return;
        write({ focused, awayCount: meRef.current.awayCount + (focused ? 0 : 1) });
      }, 50);
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('blur', check);
    window.addEventListener('focus', check);
    check();
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('blur', check);
      window.removeEventListener('focus', check);
    };
  }, [active, sessionKey, write]);

  // 접속 신호: 들어올 때 + 1분마다
  useEffect(() => {
    if (!active) return undefined;
    write({});
    const t = setInterval(() => write({}), HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [active, sessionKey, write]);

  return {
    live,
    joined: active && joinedKey === sessionKey,
    join: () => setJoinedKey(sessionKey),
    hand: me.hand,
    done: !!live && me.doneLessonId === live.lessonId,
    toggleHand: () => write({ hand: !meRef.current.hand }),
    toggleDone: () => write({ doneLessonId: meRef.current.doneLessonId === live?.lessonId ? '' : live?.lessonId ?? '' }),
  };
}

export function LiveProvider({ children }) {
  const { user, profile, isTeacher } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // 수업 기능을 꺼 두면 실시간 수업도 완전히 멈춤 (예전에 시작한 수업이 남아 있어도 학생이 끌려가지 않음)
  const ready = FEATURES.lessons && !!user && !!profile && !profile.mustChangePassword;

  const teacher = useTeacherLive(ready && isTeacher, user?.uid);
  const student = useStudentLive(ready && !isTeacher && !!profile?.classId, user?.uid, profile?.classId, profile);

  // 따라오기: 학생이 다른 화면에 있으면 선생님이 띄운 차시로
  const live = student.live;
  useEffect(() => {
    if (!live?.follow || !live.lessonId) return;
    if (pathname !== `/lessons/${live.lessonId}`) navigate(`/lessons/${live.lessonId}`, { replace: true });
  }, [live?.follow, live?.lessonId, pathname, navigate]);

  const value = useMemo(
    () => ({
      isTeacher,
      teacher: {
        ...teacher,
        start: (args) => startLive({ ...args, teacherUid: user.uid }),
        end: () => teacher.session && endLive(teacher.session.id),
        set: (patch) => teacher.session && updateLive(teacher.session.id, patch),
        lowerHand: (uid) => lowerHand(teacher.session.id, uid),
        lowerAll: () => lowerAllHands(teacher.session.id, teacher.members),
      },
      student,
    }),
    [isTeacher, teacher, student, user?.uid],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  return useContext(LiveContext);
}
