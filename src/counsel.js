import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { tsMillis } from './util/dates';

/**
 * counsel/{id}  { classId, studentUid, name, studentId, topic, message, preferredTime,
 *                 status: 'new'|'scheduled'|'done', reply, createdAt, updatedAt }
 */
export const TOPICS = ['학교생활', '친구관계', '진로·진학', '학습', '가정', '기타'];
export const STATUS = { new: '확인 전', scheduled: '상담 예정', done: '상담 완료' };

// 교사: 반 전체 / 학생: 내 신청만
export function useCounsel({ isTeacher, classId, uid }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = isTeacher
      ? classId && query(collection(db, 'counsel'), where('classId', '==', classId))
      : uid && query(collection(db, 'counsel'), where('studentUid', '==', uid));
    if (!q) {
      setItems([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
      setItems(list);
      setLoading(false);
    }, () => setLoading(false));
  }, [isTeacher, classId, uid]);
  return { items, loading };
}

export function requestCounsel({ classId, uid, profile, topic, message, preferredTime }) {
  return addDoc(collection(db, 'counsel'), {
    classId,
    studentUid: uid,
    name: profile.displayName ?? '',
    studentId: profile.studentId ?? '',
    topic,
    message: message.trim(),
    preferredTime: preferredTime.trim(),
    status: 'new',
    reply: '',
    createdAt: serverTimestamp(),
  });
}

export const answerCounsel = (id, { status, reply }) =>
  updateDoc(doc(db, 'counsel', id), { status, reply: reply.trim(), updatedAt: serverTimestamp() });

export const cancelCounsel = (id) => deleteDoc(doc(db, 'counsel', id));
