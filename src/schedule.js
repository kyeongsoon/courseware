import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { dateInt } from './attendance';

/**
 * events/{id}  { classId, title, type, date(20261128), endDate(같거나 뒤), note, teacherUid, createdAt }
 * timetables/{classId}  { days(5|6), periods(1~10), times: ['09:00-09:45', …], cells: [{ s: 과목, r: 교실 } | null] (요일×교시, 요일 먼저) }
 */
export const EVENT_TYPES = ['시험', '수행평가', '행사', '과제', '기타'];
export const DAY_NAMES = ['월', '화', '수', '목', '금', '토'];

// ── 날짜 계산 (날짜 숫자 20261128 ↔ 달력) ──
export const ymd = (y, m, d) => y * 10000 + m * 100 + d;
export const parts = (n) => [Math.floor(n / 10000), Math.floor(n / 100) % 100, n % 100];
const utc = (n) => {
  const [y, m, d] = parts(n);
  return Date.UTC(y, m - 1, d);
};
export const addDays = (n, k) => {
  const t = new Date(utc(n) + k * 86400000);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
};
export const diffDays = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
export const weekday = (n) => new Date(utc(n)).getUTCDay(); // 0=일
export const shortLabel = (n) => {
  const [, m, d] = parts(n);
  return `${m}/${d}(${'일월화수목금토'[weekday(n)]})`;
};

// 달력 칸: 그 달 1일이 있는 주 일요일부터 6주
export function monthCells(year, month) {
  const first = ymd(year, month, 1);
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function useEvents(classId) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!classId) {
      setEvents([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return onSnapshot(
      query(collection(db, 'events'), where('classId', '==', classId)),
      (snap) => {
        setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.date - b.date || (a.title > b.title ? 1 : -1)));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [classId]);
  return { events, loading };
}

const clean = (e) => ({
  classId: e.classId, title: e.title.trim(), type: e.type, date: e.date,
  endDate: Math.max(e.date, e.endDate || e.date), note: (e.note ?? '').trim(),
});
export const createEvent = (e, teacherUid) => addDoc(collection(db, 'events'), { ...clean(e), teacherUid, createdAt: serverTimestamp() });
export const updateEvent = (id, e, teacherUid) => updateDoc(doc(db, 'events', id), { ...clean(e), teacherUid });
export const deleteEvent = (id) => deleteDoc(doc(db, 'events', id));

// 오늘부터 days일 안의 일정 (진행 중인 여러 날 일정 포함)
export function upcoming(events, days = 14, today = dateInt()) {
  const until = addDays(today, days);
  return events.filter((e) => e.endDate >= today && e.date <= until);
}
export const dday = (date, today = dateInt()) => {
  const n = diffDays(today, date);
  return n === 0 ? 'D-DAY' : n > 0 ? `D-${n}` : '진행 중';
};

// ── 시간표 ──
export const DEFAULT_TIMES = ['08:40-09:25', '09:35-10:20', '10:30-11:15', '11:25-12:10', '13:00-13:45', '13:55-14:40', '14:50-15:35', '15:45-16:30', '16:40-17:25', '17:35-18:20'];
export const emptyTimetable = (days = 5, periods = 7) => ({
  days, periods, times: DEFAULT_TIMES.slice(0, periods), cells: Array(days * periods).fill(null),
});

export function useTimetable(classId) {
  const [tt, setTt] = useState(undefined);
  useEffect(() => {
    if (!classId) return setTt(null);
    return onSnapshot(doc(db, 'timetables', classId), (s) => setTt(s.exists() ? s.data() : null), () => setTt(null));
  }, [classId]);
  return tt;
}

export const saveTimetable = (classId, tt, teacherUid) =>
  setDoc(doc(db, 'timetables', classId), { ...tt, teacherUid, updatedAt: serverTimestamp() });

export const cellAt = (tt, day, period) => tt.cells[day * tt.periods + period];

// 요일·교시 수 바꾸기 (남는 칸은 유지)
export function resizeTimetable(tt, days, periods) {
  const cells = Array(days * periods).fill(null);
  for (let d = 0; d < Math.min(days, tt.days); d++) {
    for (let p = 0; p < Math.min(periods, tt.periods); p++) cells[d * periods + p] = cellAt(tt, d, p);
  }
  const times = Array.from({ length: periods }, (_, i) => tt.times[i] ?? DEFAULT_TIMES[i] ?? '');
  return { ...tt, days, periods, cells, times };
}

// 지금(한국 시각) 요일 번호(월=0)와 교시 번호 (수업 시간 밖이면 -1)
export function nowSlot(tt, now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600000);
  const wd = kst.getUTCDay(); // 0=일
  const day = wd === 0 ? -1 : wd - 1;
  const hm = `${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`;
  const period = tt ? tt.times.findIndex((t) => {
    const [a, b] = (t ?? '').split('-');
    return a && b && hm >= a.trim() && hm < b.trim();
  }) : -1;
  return { day: day < (tt?.days ?? 5) ? day : -1, period };
}
