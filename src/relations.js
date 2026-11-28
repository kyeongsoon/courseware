import { useEffect, useState } from 'react';
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * 교우관계 조사 + 관계도
 * relSurveys/{id}  { classId, title, questions: [{ id: 'q1'|'q2'|'q3', text }], questionIds, maxPicks: 3,
 *                    roster: [{ uid, name, studentId }] (만들 때 반 명단, 학생이 친구를 고를 때 씀),
 *                    open, teacherUid, createdAt }   — 교사가 만들고 그 반 학생이 읽음
 * relResponses/{설문_학생}  { surveyId, classId, uid, answers: { q1: [uid…], … }, submittedAt }
 *                    — 학생은 자기 것만 쓰고 읽음, 결과(남의 응답)는 교사만
 * relNotes/{id}    { classId, a, b, kind, note, date, teacherUid, createdAt } — 교사 관찰 기록 (교사만)
 */
export const DEFAULT_QUESTIONS = [
  { id: 'q1', text: '모둠 활동을 같이 하고 싶은 친구' },
  { id: 'q2', text: '고민이 있을 때 이야기하는 친구' },
  { id: 'q3', text: '도움을 받고 싶은 친구' },
];
export const MAX_PICKS = 3;

export const NOTE_KINDS = {
  close: { label: '친함', color: '#2563eb' },
  care: { label: '챙겨 줌', color: '#16a34a' },
  conflict: { label: '갈등', color: '#dc2626' },
  other: { label: '기타', color: '#71717a' },
};

const byCreated = (a, b) => (a.createdAt?.toMillis?.() ?? Infinity) - (b.createdAt?.toMillis?.() ?? Infinity);

export function useSurveys(classId) {
  const [list, setList] = useState(undefined);
  useEffect(() => {
    if (!classId) return setList([]);
    return onSnapshot(query(collection(db, 'relSurveys'), where('classId', '==', classId)),
      (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })).sort(byCreated)),
      () => setList([]));
  }, [classId]);
  return list;
}

export function useResponses(classId, enabled = true) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!classId || !enabled) return setList([]);
    return onSnapshot(query(collection(db, 'relResponses'), where('classId', '==', classId)),
      (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setList([]));
  }, [classId, enabled]);
  return list;
}

export function useMyResponse(surveyId, uid) {
  const [r, setR] = useState(undefined);
  useEffect(() => {
    if (!surveyId || !uid) return setR(null);
    return onSnapshot(doc(db, 'relResponses', `${surveyId}_${uid}`), (s) => setR(s.exists() ? s.data() : null), () => setR(null));
  }, [surveyId, uid]);
  return r;
}

export function useNotes(classId) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!classId) return setList([]);
    return onSnapshot(query(collection(db, 'relNotes'), where('classId', '==', classId)),
      (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.date - a.date || byCreated(b, a))), () => setList([]));
  }, [classId]);
  return list;
}

export function createSurvey(classId, { title, questions, roster }, teacherUid) {
  const qs = questions.filter((q) => q.text.trim()).map((q, i) => ({ id: `q${i + 1}`, text: q.text.trim().slice(0, 60) }));
  return addDoc(collection(db, 'relSurveys'), {
    classId, title: title.trim().slice(0, 40), questions: qs, questionIds: qs.map((q) => q.id), maxPicks: MAX_PICKS,
    roster: roster.map((s) => ({ uid: s.uid, name: s.displayName ?? '', studentId: s.studentId ?? '' })),
    open: true, teacherUid, createdAt: serverTimestamp(),
  });
}

export const setSurveyOpen = (id, open) => updateDoc(doc(db, 'relSurveys', id), { open });

export async function deleteSurvey(id) {
  const snap = await getDocs(query(collection(db, 'relResponses'), where('surveyId', '==', id)));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, 'relSurveys', id));
}

export const submitResponse = (survey, uid, answers) => setDoc(doc(db, 'relResponses', `${survey.id}_${uid}`), {
  surveyId: survey.id, classId: survey.classId, uid,
  answers: Object.fromEntries(survey.questionIds.map((q) => [q, (answers[q] ?? []).slice(0, survey.maxPicks)])),
  submittedAt: serverTimestamp(),
});

export const addNote = (classId, n, teacherUid) => addDoc(collection(db, 'relNotes'), {
  classId, a: n.a, b: n.b, kind: n.kind, note: n.note.trim().slice(0, 200), date: n.date, teacherUid, createdAt: serverTimestamp(),
});
export const deleteNote = (id) => deleteDoc(doc(db, 'relNotes', id));

// ── 분석 ──

// 한 회차의 선택(화살표) 목록: question 'all' 이면 모든 질문을 합침 (같은 사람을 여러 질문에서 고르면 굵게)
export function edgesOf(survey, responses, question = 'all') {
  const inRoster = new Set(survey.roster.map((s) => s.uid));
  const w = new Map();
  responses.filter((r) => r.surveyId === survey.id && inRoster.has(r.uid)).forEach((r) => {
    const qs = question === 'all' ? survey.questionIds : [question];
    qs.forEach((q) => (r.answers?.[q] ?? []).forEach((to) => {
      if (to === r.uid || !inRoster.has(to)) return;
      const k = `${r.uid}>${to}`;
      w.set(k, (w.get(k) ?? 0) + 1);
    }));
  });
  return [...w].map(([k, weight]) => {
    const [from, to] = k.split('>');
    return { from, to, weight, mutual: w.has(`${to}>${from}`) };
  });
}

// 학생마다 받은 선택 수(몇 명에게), 고른 수
export function degrees(roster, edges) {
  const d = Object.fromEntries(roster.map((s) => [s.uid, { inn: 0, out: 0 }]));
  edges.forEach((e) => {
    if (d[e.to]) d[e.to].inn += 1;
    if (d[e.from]) d[e.from].out += 1;
  });
  return d;
}

// 서로 고른 짝
export function mutualPairs(edges) {
  const seen = new Set();
  return edges.filter((e) => e.mutual).flatMap((e) => {
    const k = [e.from, e.to].sort().join('|');
    if (seen.has(k)) return [];
    seen.add(k);
    return [[e.from, e.to]];
  });
}

// 무리 나누기: 서로 고른 관계(없으면 한쪽 선택도)로 이어진 친구들을 같은 무리로 (라벨 전파)
export function groupsOf(roster, edges) {
  const nb = Object.fromEntries(roster.map((s) => [s.uid, new Map()]));
  edges.forEach((e) => {
    const add = (a, b, v) => nb[a] && nb[a].set(b, (nb[a].get(b) ?? 0) + v);
    const v = e.mutual ? 2 : 1;
    add(e.from, e.to, v);
    add(e.to, e.from, v);
  });
  const label = Object.fromEntries(roster.map((s, i) => [s.uid, i]));
  const order = [...roster].sort((a, b) => String(a.studentId).localeCompare(String(b.studentId))).map((s) => s.uid);
  for (let round = 0; round < 20; round++) {
    let changed = false;
    order.forEach((u) => {
      const score = new Map();
      nb[u].forEach((v, other) => score.set(label[other], (score.get(label[other]) ?? 0) + v));
      if (!score.size) return;
      const best = [...score].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
      if (best !== label[u] && (score.get(best) ?? 0) > (score.get(label[u]) ?? 0)) {
        label[u] = best;
        changed = true;
      }
    });
    if (!changed) break;
  }
  // 아무에게도 선택받지 못한 학생은 무리에 넣지 않음 (한쪽으로만 고른 것)
  const chosen = new Set(edges.map((e) => e.to));
  Object.keys(label).forEach((u) => { if (!chosen.has(u)) label[u] = `solo-${u}`; });
  // 1명짜리 무리는 무리 없음(-1), 나머지는 0,1,2… 로 다시 번호
  const size = {};
  Object.values(label).forEach((l) => (size[l] = (size[l] ?? 0) + 1));
  const ids = {};
  let next = 0;
  return Object.fromEntries(Object.entries(label).map(([u, l]) => [u, size[l] > 1 ? (ids[l] ??= next++) : -1]));
}

// 두 회차 비교: 새로 생긴 / 사라진 / 그대로인 선택
export function compareEdges(prev, cur) {
  const key = (e) => `${e.from}>${e.to}`;
  const p = new Set(prev.map(key));
  const c = new Set(cur.map(key));
  return {
    added: cur.filter((e) => !p.has(key(e))),
    removed: prev.filter((e) => !c.has(key(e))),
    kept: cur.filter((e) => p.has(key(e))),
  };
}
