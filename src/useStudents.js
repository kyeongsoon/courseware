import { useCallback, useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';

// 교사 전용: 학생 목록 실시간 구독 (보안 규칙에서 교사만 허용)
// 반 배정 등을 바꾸면 화면이 자동으로 갱신됨
export function useStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'users'), orderBy('studentId')),
        (snap) => {
          // 삭제된 학생(무료 요금제에서 정지만 된 계정)은 명단에서 뺌
          setStudents(snap.docs.map((d) => d.data()).filter((u) => u.role !== 'teacher' && !u.deleted));
          setLoading(false);
        },
        (err) => {
          setError(err.code ?? err.message);
          setLoading(false);
        },
      ),
    [],
  );

  // 실시간 구독이라 다시 불러올 필요 없음 (기존 호출부 호환용)
  const reload = useCallback(() => {}, []);
  return { students, loading, error, reload };
}
