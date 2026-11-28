import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * seating/{classId}
 *   { rows, cols, cells: [칸], locked: [칸 번호], published, front: 'top'|'bottom', teacherUid, updatedAt }
 *   칸: null(빈자리) | { blocked: true }(자리 없음) | { uid, name, studentId }
 * 학생 화면은 교탁이 위(학생 시점)로 보임
 */
export const emptyLayout = (rows = 5, cols = 6) => ({ rows, cols, cells: Array(rows * cols).fill(null), locked: [], published: false });

export function useSeating(classId) {
  const [seating, setSeating] = useState(undefined); // undefined: 불러오는 중, null: 없음·비공개
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!classId) return setSeating(null);
    let timer = null;
    const unsub = onSnapshot(
      doc(db, 'seating', classId),
      (s) => setSeating(s.exists() ? s.data() : null),
      // 학생: 아직 공개 전이면 읽기가 거부되고 구독이 끊김 → 10초마다 다시 확인해서 공개되면 바로 보이게
      () => {
        setSeating(null);
        timer = setTimeout(() => setRetry((n) => n + 1), 10_000);
      },
    );
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [classId, retry]);
  return seating;
}

export const saveSeating = (classId, layout, teacherUid) =>
  setDoc(doc(db, 'seating', classId), { ...layout, teacherUid, updatedAt: serverTimestamp() });

export const person = (s) => ({ uid: s.uid, name: s.displayName ?? '', studentId: s.studentId ?? '' });
export const isSeat = (c) => !c?.blocked;
export const isStudent = (c) => !!c?.uid;

function shuffle(arr) {
  const a = [...arr];
  const r = crypto.getRandomValues(new Uint32Array(a.length));
  for (let i = a.length - 1; i > 0; i--) {
    const j = r[i] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 줄·칸 수 바꾸기: 앞(교탁쪽)부터 왼쪽 위 기준으로 남는 자리는 유지
export function resize(layout, rows, cols) {
  const cells = Array(rows * cols).fill(null);
  const locked = [];
  for (let r = 0; r < Math.min(rows, layout.rows); r++) {
    for (let c = 0; c < Math.min(cols, layout.cols); c++) {
      const from = r * layout.cols + c, to = r * cols + c;
      cells[to] = layout.cells[from];
      if (layout.locked.includes(from)) locked.push(to);
    }
  }
  return { ...layout, rows, cols, cells, locked };
}

// 배치: 고정한 칸은 그대로, 나머지 학생을 빈 자리에 (무작위 / 학번순)
export function arrange(layout, roster, mode) {
  const cells = layout.cells.map((c, i) => (layout.locked.includes(i) ? c : isSeat(c) ? null : c));
  const fixed = new Set(cells.filter(isStudent).map((c) => c.uid));
  let pool = roster.filter((s) => !fixed.has(s.uid)).map(person);
  pool = mode === 'random' ? shuffle(pool) : pool.sort((a, b) => (a.studentId > b.studentId ? 1 : -1));
  const open = cells.map((c, i) => (c === null && !layout.locked.includes(i) ? i : -1)).filter((i) => i >= 0);
  open.forEach((i, k) => {
    cells[i] = pool[k] ?? null;
  });
  return { layout: { ...layout, cells }, leftover: pool.slice(open.length) };
}

export const swap = (layout, a, b) => {
  const cells = [...layout.cells];
  [cells[a], cells[b]] = [cells[b], cells[a]];
  const locked = layout.locked.map((i) => (i === a ? b : i === b ? a : i));
  return { ...layout, cells, locked };
};
