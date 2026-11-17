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
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * classes/{classId}
 * { name: '2학년 3반', teacherUid, createdAt }
 * 학생의 소속 반은 users/{uid}.classId 에 저장 (학생 한 명은 한 반에만 속함)
 */

// 반 목록 실시간 구독 (이름순)
export function useClasses() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'classes'), orderBy('name')),
        (snap) => {
          setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        (err) => {
          setError(err.code ?? err.message);
          setLoading(false);
        },
      ),
    [],
  );

  return { classes, loading, error };
}

export function normalizeClassName(name) {
  return name.trim().replace(/\s+/g, ' ');
}

export async function createClass(name, teacherUid) {
  const ref = await addDoc(collection(db, 'classes'), {
    name: normalizeClassName(name),
    teacherUid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function renameClass(classId, name) {
  return updateDoc(doc(db, 'classes', classId), { name: normalizeClassName(name) });
}

// 여러 학생의 소속 반을 한 번에 변경 (classId 가 null 이면 반에서 빼기)
// Firestore 일괄 쓰기는 한 번에 500건까지라 나눠서 처리
export async function assignStudents(uids, classId) {
  for (let i = 0; i < uids.length; i += 450) {
    const batch = writeBatch(db);
    uids.slice(i, i + 450).forEach((uid) => batch.update(doc(db, 'users', uid), { classId: classId ?? null }));
    await batch.commit();
  }
}

// 반 삭제: 소속 학생들을 먼저 '반 없음'으로 돌린 뒤 반 문서 삭제 (학생 계정은 그대로)
export async function deleteClass(classId, memberUids) {
  await assignStudents(memberUids, null);
  await deleteDoc(doc(db, 'classes', classId));
}

// 학번 앞자리로 반 이름 추천: 30215 → '3학년 2반', 2103 → '2학년 1반'
export function suggestClassName(studentId = '') {
  const m = /^(\d)(\d{2})\d{2}$/.exec(studentId) || /^(\d)(\d)\d{2}$/.exec(studentId);
  return m ? `${Number(m[1])}학년 ${Number(m[2])}반` : '';
}
