import { useEffect, useState } from 'react';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from './firebase';
import { tsMillis } from './util/dates';

/**
 * notices/{id}  { classId, title, body, pinned, teacherUid, createdAt, updatedAt }
 * notices/{id}/reads/{uid}  { name, studentId, readAt }   학생이 열어 보면 기록
 */
export const NOTICE_LIMITS = { title: 100, body: 5000 };

// 반의 알림장 (고정 글 먼저, 그다음 최신순). 색인 설정이 필요 없도록 정렬은 화면에서
export function useNotices(classId) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!classId) {
      setNotices([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return onSnapshot(
      query(collection(db, 'notices'), where('classId', '==', classId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || tsMillis(b.createdAt) - tsMillis(a.createdAt));
        setNotices(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [classId]);
  return { notices, loading };
}

export function createNotice({ classId, title, body, pinned }, teacherUid) {
  return addDoc(collection(db, 'notices'), {
    classId, title: title.trim(), body: body.trim(), pinned: !!pinned, teacherUid,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export function updateNotice(id, { classId, title, body, pinned }, teacherUid) {
  return updateDoc(doc(db, 'notices', id), {
    classId, title: title.trim(), body: body.trim(), pinned: !!pinned, teacherUid, updatedAt: serverTimestamp(),
  });
}

export async function deleteNotice(id) {
  const reads = await getDocs(collection(db, 'notices', id, 'reads'));
  await Promise.all(reads.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, 'notices', id));
}

// 학생: 읽음 기록 (이미 있으면 그대로)
export async function markRead(noticeId, uid, profile) {
  const ref = doc(db, 'notices', noticeId, 'reads', uid);
  if ((await getDoc(ref)).exists()) return;
  await setDoc(ref, { name: profile.displayName ?? '', studentId: profile.studentId ?? '', readAt: serverTimestamp() });
}

// 학생: 내가 읽은 공지 id 목록
export function useMyReads(noticeIds, uid) {
  const [readIds, setReadIds] = useState(() => new Set());
  const key = noticeIds.join(',');
  useEffect(() => {
    if (!uid || !noticeIds.length) return setReadIds(new Set());
    let cancelled = false;
    Promise.all(noticeIds.map((id) => getDoc(doc(db, 'notices', id, 'reads', uid)).then((s) => (s.exists() ? id : null)).catch(() => null)))
      .then((ids) => !cancelled && setReadIds(new Set(ids.filter(Boolean))));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, uid]);
  return readIds;
}

// 교사: 공지별 읽음 목록 실시간
export function useReads(noticeId) {
  const [reads, setReads] = useState([]);
  useEffect(() => {
    if (!noticeId) return undefined;
    return onSnapshot(collection(db, 'notices', noticeId, 'reads'), (snap) =>
      setReads(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    );
  }, [noticeId]);
  return reads;
}
