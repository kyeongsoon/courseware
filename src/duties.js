import { useEffect, useState } from 'react';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from './firebase';
import { diffDays } from './scheduleCore';

/**
 * 1인 1역 · 청소 당번 (kind: 'role' | 'clean')
 * dutyBoards/{반_kind}  { classId, kind, tasks: [{ id, name, desc, level(1~3), count }], teacherUid, updatedAt }
 * dutyRounds/{id}       { classId, kind, from, to (날짜 숫자), assign: { taskId: [uid…] }, tasks(그때 역할 목록),
 *                         names: { uid: 이름 }, published, teacherUid, createdAt }  — 공개한 것만 그 반 학생이 읽음
 * dutyChecks/{회차_날짜_학생} { roundId, classId, uid, taskId, date, checkedAt } — 학생이 '오늘 했어요'
 *
 * 공평하게: 역할마다 난이도 점수(가벼움 1 · 보통 2 · 힘듦 3) × 기간(주)을 '부담 점수'로 쌓고,
 * 자동 배정은 누적 부담이 적은 학생부터 힘든 역할을 맡김. 같은 역할을 연달아 맡지 않게 함.
 */
export const KINDS = {
  role: { label: '1인 1역', unit: '역할', period: 28 },
  clean: { label: '청소 당번', unit: '구역', period: 7 },
};
export const LEVELS = { 1: '가벼움', 2: '보통', 3: '힘듦' };

const t = (name, level, count = 1, desc = '') => ({ name, level, count, desc });
export const TEMPLATES = {
  role: [
    t('칠판 정리', 2, 1, '쉬는 시간마다 칠판 지우기'), t('분리수거', 3, 2, '종례 후 분리수거함 비우기'), t('쓰레기통 비우기', 3, 1),
    t('프린트 배부', 2, 2, '가정통신문·학습지 나눠 주기'), t('과제 수합', 2, 2, '제출물 모아서 선생님께'), t('학급 일지', 2, 1),
    t('불·창문 단속', 1, 1, '이동 수업·하교 때 불 끄고 창문 닫기'), t('컴퓨터·프로젝터 끄기', 1, 1), t('교탁 정리', 1, 1),
    t('화분 물 주기', 1, 1), t('신발장·우산꽂이 정리', 2, 1), t('사물함 위 정리', 1, 1), t('칠판 지우개 털기', 2, 1), t('알림장 적기', 1, 1),
  ],
  clean: [
    t('교실 바닥 쓸기', 2, 4), t('대걸레', 3, 3), t('칠판·분필통', 1, 1), t('창틀·사물함 닦기', 2, 2),
    t('쓰레기통·분리수거', 3, 2), t('복도', 2, 3), t('계단', 3, 2),
  ],
};

const newId = () => Math.random().toString(36).slice(2, 9);
export const withIds = (tasks) => tasks.map((x) => ({ id: x.id ?? newId(), desc: '', ...x }));

export function useBoard(classId, kind) {
  const [board, setBoard] = useState(undefined);
  useEffect(() => {
    if (!classId) return setBoard(null);
    return onSnapshot(doc(db, 'dutyBoards', `${classId}_${kind}`), (s) => setBoard(s.exists() ? s.data() : null), () => setBoard(null));
  }, [classId, kind]);
  return board;
}
export const saveBoard = (classId, kind, tasks, teacherUid) => setDoc(doc(db, 'dutyBoards', `${classId}_${kind}`), {
  classId, kind, teacherUid, updatedAt: serverTimestamp(),
  tasks: tasks.map((x) => ({ id: x.id, name: x.name.trim().slice(0, 30), desc: (x.desc ?? '').trim().slice(0, 80), level: Number(x.level), count: Math.max(1, Math.min(10, Number(x.count) || 1)) })),
});

// 교사: 반의 모든 회차 / 학생: 공개된 회차만
export function useRounds(classId, { teacher }) {
  const [rounds, setRounds] = useState(undefined);
  useEffect(() => {
    if (!classId) return setRounds([]);
    const q = teacher
      ? query(collection(db, 'dutyRounds'), where('classId', '==', classId))
      : query(collection(db, 'dutyRounds'), where('classId', '==', classId), where('published', '==', true));
    return onSnapshot(q, (s) => setRounds(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.from - b.from)), () => setRounds([]));
  }, [classId, teacher]);
  return rounds;
}

export const createRound = (classId, kind, r, teacherUid) => addDoc(collection(db, 'dutyRounds'), {
  classId, kind, from: r.from, to: r.to, assign: r.assign, tasks: r.tasks, names: r.names, published: true, teacherUid, createdAt: serverTimestamp(),
});
export const updateRound = (id, patch) => updateDoc(doc(db, 'dutyRounds', id), patch);
export const deleteRound = (id) => deleteDoc(doc(db, 'dutyRounds', id));

export function useChecks(classId, { uid, date } = {}) {
  const [checks, setChecks] = useState([]);
  useEffect(() => {
    if (!classId) return setChecks([]);
    const q = uid
      ? query(collection(db, 'dutyChecks'), where('uid', '==', uid))
      : query(collection(db, 'dutyChecks'), where('classId', '==', classId), ...(date ? [where('date', '==', date)] : []));
    return onSnapshot(q, (s) => setChecks(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))), () => setChecks([]));
  }, [classId, uid, date]);
  return checks;
}
export const checkDone = (round, taskId, uid, date) => setDoc(doc(db, 'dutyChecks', `${round.id}_${date}_${uid}`), {
  roundId: round.id, classId: round.classId, uid, taskId, date, checkedAt: serverTimestamp(),
});
export const uncheck = (roundId, date, uid) => deleteDoc(doc(db, 'dutyChecks', `${roundId}_${date}_${uid}`));

// ── 공평 배정 ──

// 회차 기간(주) — 1주보다 짧아도 1로
export const weeksOf = (r) => Math.max(1, Math.round((diffDays(r.from, r.to) + 1) / 7));

// 학생마다 지금까지의 부담 점수 · 역할별 맡은 횟수 (kind 를 주면 그 종류만)
export function loadOf(rounds, kind) {
  const load = {};
  rounds.filter((r) => !kind || r.kind === kind).forEach((r) => {
    const lv = Object.fromEntries((r.tasks ?? []).map((x) => [x.id, x.level]));
    Object.entries(r.assign ?? {}).forEach(([tid, uids]) => uids.forEach((u) => {
      const L = (load[u] ??= { points: 0, count: 0, heavy: 0, light: 0, none: 0, tasks: {} });
      L.points += (lv[tid] ?? 1) * weeksOf(r);
      L.count += 1;
      if (lv[tid] === 3) L.heavy += 1;
      if (lv[tid] === 1) L.light += 1;
      L.tasks[tid] = (L.tasks[tid] ?? 0) + 1;
    }));
  });
  return load;
}

/**
 * 자동 배정: 힘든 자리부터, 누적 부담이 가장 적은 학생에게 (지난번과 같은 역할은 피함)
 * students: [{ uid, displayName, studentId }], tasks: 역할 목록, past: 같은 종류의 지난 회차들
 * 자리가 학생보다 적으면 남는 학생은 이번엔 쉼(다음 배정에서 우선), 많으면 빈 자리로 남김
 */
export function autoAssign(students, tasks, past, { weeks = 1, seed = Date.now() } = {}) {
  let s = seed % 2147483647 || 1;
  const rnd = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  const load = loadOf(past);
  const last = past.at(-1);
  const lastTask = {};
  Object.entries(last?.assign ?? {}).forEach(([tid, uids]) => uids.forEach((u) => (lastTask[u] = tid)));
  const tie = Object.fromEntries(students.map((x) => [x.uid, rnd()]));
  const pool = [...students];
  const slots = tasks.flatMap((x) => Array.from({ length: x.count }, () => ({ ...x, r: rnd() }))).sort((a, b) => b.level - a.level || a.r - b.r);
  const assign = Object.fromEntries(tasks.map((x) => [x.id, []]));
  // 부담 점수에 이번에 받은 자리도 더해 가며 고름
  const now = Object.fromEntries(students.map((x) => [x.uid, load[x.uid]?.points ?? 0]));
  for (const slot of slots) {
    if (!pool.length) break;
    const score = (u) => now[u.uid] * 10 + (lastTask[u.uid] === slot.id ? 1000 : 0) + tie[u.uid];
    pool.sort((a, b) => score(a) - score(b));
    const pick = pool.shift();
    assign[slot.id].push(pick.uid);
    now[pick.uid] += slot.level * weeks;
  }
  return { assign, resting: pool.map((x) => x.uid) };
}

// 이 회차에서 그 학생이 맡은 역할
export const taskOf = (round, uid) => {
  const tid = Object.entries(round?.assign ?? {}).find(([, uids]) => uids.includes(uid))?.[0];
  return tid ? (round.tasks ?? []).find((x) => x.id === tid) ?? null : null;
};

// 오늘이 들어 있는 회차 (없으면 가장 최근 공개 회차)
export const currentRound = (rounds, kind, today) => {
  const list = rounds.filter((r) => r.kind === kind && r.published);
  return list.find((r) => r.from <= today && today <= r.to) ?? null;
};
