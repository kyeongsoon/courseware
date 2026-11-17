import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';

// 교사 전용: 학생 목록 불러오기 (보안 규칙에서 교사만 허용)
export function useStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    setLoading(true);
    getDocs(query(collection(db, 'users'), orderBy('studentId')))
      .then((snap) => setStudents(snap.docs.map((d) => d.data()).filter((u) => u.role !== 'teacher')))
      .catch((err) => setError(err.code ?? err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(reload, [reload]);
  return { students, loading, error, reload };
}
