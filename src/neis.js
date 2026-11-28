import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { diffNeisEvents } from './neisCore';

/**
 * 나이스 연동 — Firestore 쪽 (나이스 호출 자체는 neisCore.js)
 * settings/school { atptCode, schoolCode, schoolName, kind, region, apiKey, autoSync, updatedAt } — 교사만 읽고 씀
 * settings/neisSync { at, ok, message, classes } — 매일 아침 자동 갱신 결과 (GitHub Actions 가 씀)
 */
export * from './neisCore';

// ── 학교 설정 ──
export function useSchoolSettings(enabled = true) {
  const [settings, setSettings] = useState(undefined);
  useEffect(() => {
    if (!enabled) return setSettings(null);
    return onSnapshot(doc(db, 'settings', 'school'), (s) => setSettings(s.exists() ? s.data() : null), () => setSettings(null));
  }, [enabled]);
  return settings;
}

export const saveSchoolSettings = (s) => setDoc(doc(db, 'settings', 'school'), { ...s, updatedAt: serverTimestamp() });

export function useNeisSyncStatus(enabled = true) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    return onSnapshot(doc(db, 'settings', 'neisSync'), (s) => setStatus(s.exists() ? s.data() : null), () => setStatus(null));
  }, [enabled]);
  return status;
}

// 그 기간에 예전에 나이스에서 가져온 일정과 비교해 바뀐 것만 지우고 더함. 직접 만든 일정은 그대로
export async function importSchedule(classId, events, { from, to }, teacherUid) {
  const snap = await getDocs(query(collection(db, 'events'), where('classId', '==', classId)));
  const old = snap.docs
    .filter((d) => d.data().source === 'neis' && d.data().date >= from && d.data().date <= to)
    .map((d) => ({ ...d.data(), ref: d.ref }));
  const { toDelete, toAdd } = diffNeisEvents(old, events);
  await Promise.all(toDelete.map((e) => deleteDoc(e.ref)));
  for (const e of toAdd) {
    await addDoc(collection(db, 'events'), {
      classId, title: e.title, type: e.type, date: e.date, endDate: e.endDate, note: '',
      source: 'neis', teacherUid, createdAt: serverTimestamp(),
    });
  }
  return { removed: toDelete.length, added: toAdd.length, kept: old.length - toDelete.length };
}
