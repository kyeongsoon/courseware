import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import {
  HEARTBEAT_MS, endLive, isOnline, lowerAllHands, lowerHand, startLive, touchMember, updateLive,
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
      updateLive(classId, { lessonId: viewing, video: null }).catch(() => {});
    }
  }, [classId, viewing, session?.lessonId]);

  const online = members.filter((m) => isOnline(m, now));
  return {
    session,
    members: members.map((m) => ({ ...m, online: isOnline(m, now) })),
    onlineCount: online.length,
    hands: members.filter((m) => m.hand),
    doneCount: session ? members.filter((m) => m.doneLessonId && m.doneLessonId === session.lessonId).length : 0,
  };
}

// ── 학생: 내 반의 실시간 수업 ──
function useStudentLive(enabled, uid, classId, profile) {
  const [live, setLive] = useState(null);
  const [me, setMe] = useState({ hand: false, doneLessonId: '' });
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
      setMe({ hand: !!d?.hand, doneLessonId: d?.doneLessonId ?? '' });
    }, () => {});
  }, [active, classId, uid]);

  const write = useCallback(
    (patch) => {
      const next = { ...meRef.current, ...patch };
      setMe(next);
      return touchMember(classId, uid, { name: profile?.displayName, studentId: profile?.studentId, ...next }).catch(() => {});
    },
    [classId, uid, profile?.displayName, profile?.studentId],
  );

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
  const ready = !!user && !!profile && !profile.mustChangePassword;

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
