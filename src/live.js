import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * live/{classId}  반마다 하나
 *   { active, classId, className, lessonId, follow, videoMode: 'sync'|'teacher',
 *     video: { videoId, state: 'playing'|'paused', time, at } | null,
 *     teacherUid, startedAt, updatedAt }
 * live/{classId}/members/{uid}  학생 본인이 씀
 *   { name, studentId, lastSeen, hand, doneLessonId }
 */

export const HEARTBEAT_MS = 60_000; // 학생 접속 신호 간격
export const ONLINE_WINDOW_MS = 150_000; // 이 안에 신호가 있으면 '접속 중'

const liveRef = (classId) => doc(db, 'live', classId);
const memberRef = (classId, uid) => doc(db, 'live', classId, 'members', uid);

// 새 수업 시작: 지난 수업의 손들기·다 했어요 기록을 지우고 시작
export async function startLive({ classId, className, lessonId, teacherUid }) {
  const old = await getDocs(collection(db, 'live', classId, 'members'));
  for (let i = 0; i < old.docs.length; i += 450) {
    const batch = writeBatch(db);
    old.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await setDoc(liveRef(classId), {
    active: true,
    classId,
    className,
    lessonId,
    follow: true,
    videoMode: 'sync',
    video: null,
    teacherUid,
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export const updateLive = (classId, patch) => updateDoc(liveRef(classId), { ...patch, updatedAt: serverTimestamp() });
export const endLive = (classId) => updateLive(classId, { active: false, video: null });

// 교사 영상 상태 공유. at 은 교사 기기 시각(ms) — 학생은 지난 시간만큼 앞으로 맞춤
export const publishVideo = (classId, video) =>
  updateLive(classId, { video: video && { ...video, time: Math.max(0, Math.round(video.time * 10) / 10), at: Date.now() } });

// ── 학생 ──
export function touchMember(classId, uid, { name, studentId, hand, doneLessonId }) {
  return setDoc(memberRef(classId, uid), {
    name: name ?? '',
    studentId: studentId ?? '',
    lastSeen: serverTimestamp(),
    hand: !!hand,
    doneLessonId: doneLessonId ?? '',
  });
}

// ── 교사 ──
export const lowerHand = (classId, uid) => updateDoc(memberRef(classId, uid), { hand: false });
export async function lowerAllHands(classId, members) {
  const batch = writeBatch(db);
  members.filter((m) => m.hand).forEach((m) => batch.update(memberRef(classId, m.uid), { hand: false }));
  await batch.commit();
}
export const removeMember = (classId, uid) => deleteDoc(memberRef(classId, uid));

export function isOnline(member, now = Date.now()) {
  const t = member.lastSeen?.toMillis?.();
  return t ? now - t < ONLINE_WINDOW_MS : true; // 방금 쓴 값(서버 시각 확정 전)은 접속 중으로
}

// 학생 영상이 지금 있어야 할 위치(초)
export function expectedVideoTime(video, now = Date.now()) {
  if (!video) return 0;
  return video.state === 'playing' ? video.time + Math.max(0, now - video.at) / 1000 : video.time;
}
