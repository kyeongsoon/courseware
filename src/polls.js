import { useEffect, useState } from 'react';
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from './firebase';
import { tsMillis } from './util/dates';

/**
 * polls/{id}  { classId, title, description, options: [string], multiple, anonymous, closed,
 *               results: [number] | null (교사가 결과를 공개하면 표 수), resultsRespondents, teacherUid, createdAt }
 * polls/{id}/responses/{uid}  { choices: [번호], answeredAt, (익명이 아니면) name, studentId }
 */
export const POLL_LIMITS = { title: 100, description: 1000, option: 100, options: 20 };

export function usePolls(classId) {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!classId) {
      setPolls([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return onSnapshot(
      query(collection(db, 'polls'), where('classId', '==', classId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => Number(a.closed) - Number(b.closed) || tsMillis(b.createdAt) - tsMillis(a.createdAt));
        setPolls(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [classId]);
  return { polls, loading };
}

export function usePoll(id) {
  const [poll, setPoll] = useState(undefined); // undefined: 불러오는 중, null: 없음/권한 없음
  useEffect(
    () => onSnapshot(doc(db, 'polls', id), (s) => setPoll(s.exists() ? { id: s.id, ...s.data() } : null), () => setPoll(null)),
    [id],
  );
  return poll;
}

export function createPoll({ classId, title, description, options, multiple, anonymous }, teacherUid) {
  return addDoc(collection(db, 'polls'), {
    classId,
    title: title.trim(),
    description: description.trim(),
    options: options.map((o) => o.trim()).filter(Boolean),
    multiple: !!multiple,
    anonymous: !!anonymous,
    closed: false,
    results: null,
    teacherUid,
    createdAt: serverTimestamp(),
  });
}

export const setPollClosed = (id, closed) => updateDoc(doc(db, 'polls', id), { closed });
// 학생에게 결과 공개: 그 순간의 표 수와 응답한 사람 수 (null 이면 숨김)
export const publishResults = (id, counts, respondents = 0) =>
  updateDoc(doc(db, 'polls', id), { results: counts, resultsRespondents: counts ? respondents : 0 });

export async function deletePoll(id) {
  const res = await getDocs(collection(db, 'polls', id, 'responses'));
  await Promise.all(res.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, 'polls', id));
}

// 학생 응답 (다시 내면 바뀜)
export function submitResponse(poll, uid, choices, profile) {
  const data = { choices: [...new Set(choices)].sort((a, b) => a - b), answeredAt: serverTimestamp() };
  if (!poll.anonymous) Object.assign(data, { name: profile.displayName ?? '', studentId: profile.studentId ?? '' });
  return setDoc(doc(db, 'polls', poll.id, 'responses', uid), data);
}

// 교사: 응답 전체 / 학생: 내 응답만
export function useResponses(pollId, { uid, isTeacher }) {
  const [responses, setResponses] = useState([]);
  useEffect(() => {
    if (!pollId) return undefined;
    if (isTeacher) {
      return onSnapshot(collection(db, 'polls', pollId, 'responses'), (snap) =>
        setResponses(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
      );
    }
    return onSnapshot(doc(db, 'polls', pollId, 'responses', uid), (s) =>
      setResponses(s.exists() ? [{ uid, ...s.data() }] : []), () => setResponses([]));
  }, [pollId, uid, isTeacher]);
  return responses;
}

export function countVotes(poll, responses) {
  const counts = poll.options.map(() => 0);
  responses.forEach((r) => r.choices?.forEach((c) => {
    if (c >= 0 && c < counts.length) counts[c] += 1;
  }));
  return counts;
}
