import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';

/**
 * attendance/{반_날짜_학생}
 *   { classId, uid, date(20261128), month(202611), name, studentId,
 *     status: 'present'|'late'|'early'|'absent', reason: ''|'질병'|'미인정'|'기타'|'출석인정',
 *     note, by: 'self'|'teacher', checkedAt(학생이 체크한 시각), updatedAt }
 * classes/{id}.checkInDeadline  '08:30' 같은 "이 시각 이후 체크는 늦음" 표시 기준 (교사 설정)
 */
export const STATUSES = { present: '출석', late: '지각', early: '조퇴', absent: '결석' };
export const REASONS = ['질병', '미인정', '기타', '출석인정'];

// 한국 시각 기준 날짜 숫자: 20261128
const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
export const dateInt = (d = new Date()) => Number(ymdFmt.format(d).replaceAll('-', ''));
export const monthOf = (date) => Math.floor(date / 100);
export const dateLabel = (date) => {
  const y = Math.floor(date / 10000), m = Math.floor(date / 100) % 100, d = date % 100;
  const wd = '일월화수목금토'[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${wd})`;
};
export const toInput = (date) => `${Math.floor(date / 10000)}-${String(Math.floor(date / 100) % 100).padStart(2, '0')}-${String(date % 100).padStart(2, '0')}`;
export const fromInput = (v) => Number(v.replaceAll('-', ''));
export const kstTime = (ts) => {
  const d = ts?.toDate?.();
  return d ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(d) : '';
};
const docId = (classId, date, uid) => `${classId}_${date}_${uid}`;

// 교사: 반의 하루 / 한 달
export function useClassAttendance(classId, { date, month }) {
  const [records, setRecords] = useState([]);
  useEffect(() => {
    if (!classId) return setRecords([]);
    const q = date
      ? query(collection(db, 'attendance'), where('classId', '==', classId), where('date', '==', date))
      : query(collection(db, 'attendance'), where('classId', '==', classId), where('month', '==', month));
    // 방금 체크해서 서버 시각이 아직 안 정해진 기록도 시각이 바로 보이게 (estimate)
    return onSnapshot(q, (snap) => setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))), () => setRecords([]));
  }, [classId, date, month]);
  return records;
}

// 학생: 내 기록 (이번 달)
export function useMyAttendance(uid, month) {
  const [records, setRecords] = useState([]);
  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(
      query(collection(db, 'attendance'), where('uid', '==', uid), where('month', '==', month)),
      (snap) => setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })).sort((a, b) => b.date - a.date)),
      () => setRecords([]),
    );
  }, [uid, month]);
  return records;
}

// 학생: 오늘 출석 체크
export function checkIn(classId, uid, profile) {
  const date = dateInt();
  return setDoc(doc(db, 'attendance', docId(classId, date, uid)), {
    classId, uid, date, month: monthOf(date),
    name: profile.displayName ?? '', studentId: profile.studentId ?? '',
    status: 'present', reason: '', note: '', by: 'self', checkedAt: serverTimestamp(),
  });
}

// 교사: 상태 바꾸기 (학생이 체크한 시각은 그대로 둠)
export function setStatus(classId, date, student, { status, reason = '', note = '' }, existing) {
  const ref = doc(db, 'attendance', docId(classId, date, student.uid));
  const base = {
    classId, uid: student.uid, date, month: monthOf(date),
    name: student.displayName ?? '', studentId: student.studentId ?? '',
    status, reason: status === 'present' ? '' : reason, note,
    by: existing?.by ?? 'teacher', updatedAt: serverTimestamp(),
  };
  return existing ? updateDoc(ref, base) : setDoc(ref, base);
}

export const clearRecord = (classId, date, uid) => deleteDoc(doc(db, 'attendance', docId(classId, date, uid)));

export const setDeadline = (classId, deadline) => updateDoc(doc(db, 'classes', classId), { checkInDeadline: deadline });

// 체크 시각이 기준보다 늦었는지 ('08:30')
export function isAfter(ts, deadline) {
  if (!deadline) return false;
  const t = kstTime(ts);
  return !!t && t > deadline;
}

export function downloadMonthCsv(month, roster, records) {
  const byUid = {};
  records.forEach((r) => ((byUid[r.uid] ??= []).push(r)));
  const header = ['학번', '이름', '출석', '지각', '조퇴', '결석', '기록(날짜 상태 사유)'];
  const rows = roster.map((s) => {
    const rs = (byUid[s.uid] ?? []).sort((a, b) => a.date - b.date);
    const c = (k) => rs.filter((r) => r.status === k).length;
    const detail = rs.filter((r) => r.status !== 'present').map((r) => `${r.date % 100}일 ${STATUSES[r.status]}${r.reason ? `(${r.reason})` : ''}`).join(' / ');
    return [s.studentId, s.displayName, c('present'), c('late'), c('early'), c('absent'), detail];
  });
  const csv = [header, ...rows].map((r) => r.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `attendance-${month}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
