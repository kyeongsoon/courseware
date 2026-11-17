import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * units/{unitId}     { title, order, teacherUid, createdAt }          단원
 * lessons/{lessonId} { unitId, title, order, summary, body, videoUrl,
 *                      links: [{ label, url }], openClassIds: [classId],
 *                      teacherUid, createdAt, updatedAt }              차시
 * 학생은 자기 반이 openClassIds 에 들어 있는 차시만 읽을 수 있음 (보안 규칙)
 */

export const LIMITS = { unitTitle: 60, title: 100, summary: 300, body: 20000, links: 20 };

export function useUnits() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'units'), orderBy('order')),
        (snap) => {
          setUnits(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        () => setLoading(false),
      ),
    [],
  );
  return { units, loading };
}

/**
 * 차시 목록 실시간 구독
 * - 교사: 전체
 * - 학생: 내 반에 공개된 차시만 (반이 없으면 빈 목록)
 */
export function useLessons({ isTeacher, classId }) {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isTeacher && !classId) {
      setLessons([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const q = isTeacher
      ? query(collection(db, 'lessons'))
      : query(collection(db, 'lessons'), where('openClassIds', 'array-contains', classId));
    return onSnapshot(
      q,
      (snap) => {
        setLessons(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        setError(err.code ?? err.message);
        setLoading(false);
      },
    );
  }, [isTeacher, classId]);

  return { lessons, loading, error };
}

// 단원 순서 → 차시 순서로 정렬, 단원별로 묶기
export function groupByUnit(units, lessons) {
  const byUnit = Object.fromEntries(units.map((u) => [u.id, []]));
  lessons.forEach((l) => byUnit[l.unitId]?.push(l));
  return units.map((u) => ({ unit: u, lessons: byUnit[u.id].sort((a, b) => a.order - b.order) }));
}

const nextOrder = (items) => (items.length ? Math.max(...items.map((i) => i.order ?? 0)) + 1 : 1);

// ── 단원 ──
export function createUnit(title, units, teacherUid) {
  return addDoc(collection(db, 'units'), {
    title: title.trim(),
    order: nextOrder(units),
    teacherUid,
    createdAt: serverTimestamp(),
  });
}
export const renameUnit = (id, title) => updateDoc(doc(db, 'units', id), { title: title.trim() });
export const deleteUnit = (id) => deleteDoc(doc(db, 'units', id));

// 목록에서 idx 번째 항목을 위(-1)/아래(+1)로: 이웃과 order 를 맞바꿈
export async function moveItem(collectionName, items, idx, dir) {
  const other = items[idx + dir];
  if (!other) return;
  const me = items[idx];
  const batch = writeBatch(db);
  batch.update(doc(db, collectionName, me.id), { order: other.order });
  batch.update(doc(db, collectionName, other.id), { order: me.order });
  await batch.commit();
}

// ── 차시 ──
export function cleanLesson(form) {
  return {
    unitId: form.unitId,
    title: form.title.trim(),
    summary: form.summary.trim(),
    body: form.body.replace(/\s+$/, ''),
    videoUrl: form.videoUrl.trim(),
    links: form.links
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.url),
    openClassIds: [...new Set(form.openClassIds)],
  };
}

export function validateLesson(data) {
  if (!data.unitId) return '단원을 골라 주세요.';
  if (!data.title) return '차시 제목을 입력해 주세요.';
  if (data.title.length > LIMITS.title) return `제목은 ${LIMITS.title}자까지 쓸 수 있어요.`;
  if (data.summary.length > LIMITS.summary) return `요약은 ${LIMITS.summary}자까지 쓸 수 있어요.`;
  if (data.body.length > LIMITS.body) return `본문은 ${LIMITS.body.toLocaleString()}자까지 쓸 수 있어요.`;
  if (data.videoUrl && !isSafeUrl(data.videoUrl)) return '영상 주소는 http:// 또는 https:// 로 시작해야 해요.';
  if (data.links.length > LIMITS.links) return `자료 링크는 ${LIMITS.links}개까지 넣을 수 있어요.`;
  const bad = data.links.find((l) => !isSafeUrl(l.url));
  if (bad) return `자료 링크 주소가 올바르지 않아요: ${bad.url}`;
  return '';
}

export function createLesson(data, lessonsInUnit, teacherUid) {
  return addDoc(collection(db, 'lessons'), {
    ...data,
    order: nextOrder(lessonsInUnit),
    teacherUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateLesson(id, data, { movedToUnitLessons } = {}) {
  const patch = { ...data, updatedAt: serverTimestamp() };
  // 다른 단원으로 옮기면 그 단원의 맨 뒤로
  if (movedToUnitLessons) patch.order = nextOrder(movedToUnitLessons);
  return updateDoc(doc(db, 'lessons', id), patch);
}

export const deleteLesson = (id) => deleteDoc(doc(db, 'lessons', id));

// ── 주소 도우미 ──
export function isSafeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

// YouTube 주소 → 영상 ID (watch?v=, youtu.be/, shorts/, embed/, live/)
export function youTubeId(url) {
  if (!isSafeUrl(url)) return '';
  const u = new URL(url);
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let id = '';
  if (host === 'youtu.be') id = u.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/) || [])[1] || '';
  }
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : '';
}
