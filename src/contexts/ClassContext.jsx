import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useClasses } from '../classes';

/**
 * 학급운영 기능이 어느 반을 대상으로 하는지
 * - 교사: 화면 위 '반 선택'으로 고른 반 (이 기기에 기억)
 * - 학생: 내 소속 반
 */
const ClassContext = createContext(null);
const KEY = 'cw-current-class';

const load = () => {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
};

export function ClassProvider({ children }) {
  const { user, profile, isTeacher } = useAuth();
  const { classes, loading } = useClasses(!!user);
  const [picked, setPicked] = useState(load);

  const classId = isTeacher
    ? (classes.some((c) => c.id === picked) ? picked : classes[0]?.id) ?? ''
    : profile?.classId ?? '';
  const className = classes.find((c) => c.id === classId)?.name ?? '';

  useEffect(() => {
    if (!isTeacher || !classId) return;
    try {
      localStorage.setItem(KEY, classId);
    } catch {
      /* 저장 못 해도 동작에는 문제 없음 */
    }
  }, [isTeacher, classId]);

  const value = useMemo(
    () => ({ classId, className, classes, loading, setClassId: setPicked }),
    [classId, className, classes, loading],
  );
  return <ClassContext.Provider value={value}>{children}</ClassContext.Provider>;
}

export function useCurrentClass() {
  return useContext(ClassContext);
}
