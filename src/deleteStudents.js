import { collection, deleteDoc, deleteField, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';

/**
 * 교사가 학생 계정 삭제
 * 1) 학생 기록 지우기: 출결, 알림 읽음, 설문 응답, 상담, 자리표의 자리, 교우관계 응답·관찰 기록
 * 2-a) 서버 기능(Cloud Functions, Blaze 요금제)을 켰으면: 로그인 계정과 users 문서까지 완전히 삭제
 * 2-b) 무료 요금제: users 문서를 '삭제됨'으로 바꾸고 반·이름을 지움 → 로그인해도 아무것도 못 함.
 *      로그인 계정은 남으므로 같은 학번을 다시 쓰려면 Firebase 콘솔 Authentication 에서 지워야 함
 */
export const FULL_DELETE = import.meta.env.VITE_ENABLE_PASSWORD_RESET === 'true';

// Firebase 콘솔의 로그인 계정(Authentication) 목록 바로가기 — 무료 요금제에서 로그인 계정을 지울 때
export const AUTH_CONSOLE_URL = `https://console.firebase.google.com/project/${import.meta.env.VITE_FIREBASE_PROJECT_ID}/authentication/users?hl=ko`;

async function deleteAll(q) {
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  return snap.size;
}

// 여러 학생을 한 번에 지울 때 반복 조회를 줄이려고 공지·설문·자리표 목록은 한 번만 읽음
async function loadShared() {
  const [notices, polls, seating, surveys] = await Promise.all([
    getDocs(collection(db, 'notices')),
    getDocs(collection(db, 'polls')),
    getDocs(collection(db, 'seating')),
    getDocs(collection(db, 'relSurveys')),
  ]);
  const responses = await getDocs(collection(db, 'relResponses'));
  const duties = await getDocs(collection(db, 'dutyRounds'));
  return { notices: notices.docs, polls: polls.docs, seating: seating.docs, surveys: surveys.docs, responses: responses.docs, duties: duties.docs };
}

async function removeRecords(uid, shared) {
  await deleteAll(query(collection(db, 'attendance'), where('uid', '==', uid)));
  await deleteAll(query(collection(db, 'counsel'), where('studentUid', '==', uid)));
  // 교우관계: 그 학생의 응답과 관찰 기록, 조사 명단에서 이름 빼기
  await deleteAll(query(collection(db, 'relResponses'), where('uid', '==', uid)));
  // 다른 학생 응답에서 그 학생을 고른 것·갈등으로 적은 것 빼기
  for (const r of shared.responses) {
    const d = (shared.resData ??= new Map()).get(r.id) ?? r.data();
    shared.resData.set(r.id, d);
    if (d.uid === uid || shared.removed?.has(d.uid)) continue; // 지운(지울) 학생의 응답은 건너뜀
    const answers = Object.fromEntries(Object.entries(d.answers ?? {}).map(([q, l]) => [q, l.filter((x) => x !== uid)]));
    const conflicts = (d.conflicts ?? []).filter((c) => c.uid !== uid);
    if (JSON.stringify(answers) !== JSON.stringify(d.answers ?? {}) || conflicts.length !== (d.conflicts ?? []).length) {
      await updateDoc(r.ref, { answers, ...(d.conflicts ? { conflicts } : {}) });
      d.answers = answers; // 같은 목록으로 다음 학생을 지울 때 최신 내용 기준으로
      if (d.conflicts) d.conflicts = conflicts;
    }
  }
  // 역할·청소: 체크 기록 지우고 배정표에서 빼기
  await deleteAll(query(collection(db, 'dutyChecks'), where('uid', '==', uid)));
  for (const r of shared.duties) {
    const d = (shared.dutyData ??= new Map()).get(r.id) ?? r.data();
    shared.dutyData.set(r.id, d);
    if (Object.values(d.assign ?? {}).some((l) => l.includes(uid))) {
      d.assign = Object.fromEntries(Object.entries(d.assign).map(([k, l]) => [k, l.filter((x) => x !== uid)]));
      await updateDoc(r.ref, { assign: d.assign });
    }
  }
  await deleteAll(query(collection(db, 'relNotes'), where('a', '==', uid)));
  await deleteAll(query(collection(db, 'relNotes'), where('b', '==', uid)));
  for (const s of shared.surveys) {
    const d = (shared.surveyData ??= new Map()).get(s.id) ?? s.data();
    shared.surveyData.set(s.id, d);
    const roster = d.roster ?? [];
    if (roster.some((r) => r.uid === uid)) {
      d.roster = roster.filter((r) => r.uid !== uid); // 여러 명을 지울 때 앞에서 뺀 학생이 되살아나지 않게
      await updateDoc(s.ref, { roster: d.roster });
    }
  }
  // 없는 문서를 지워도 오류가 아니므로 공지·설문마다 그 학생 문서를 지움
  await Promise.all([
    ...shared.notices.map((n) => deleteDoc(doc(db, 'notices', n.id, 'reads', uid))),
    ...shared.polls.map((p) => deleteDoc(doc(db, 'polls', p.id, 'responses', uid))),
  ]);
  // 자리표에서 그 학생 자리를 빈자리로
  for (const s of shared.seating) {
    const data = s.data();
    const i = (data.cells ?? []).findIndex((c) => c?.uid === uid);
    if (i >= 0) {
      const cells = [...data.cells];
      cells[i] = null;
      data.cells = cells;
      await updateDoc(s.ref, { cells, locked: (data.locked ?? []).filter((x) => x !== i) });
    }
  }
}

export async function deleteStudents(students, onProgress = () => {}) {
  const shared = await loadShared();
  shared.removed = new Set(students.map((s) => s.uid));
  const results = [];
  for (const [k, s] of students.entries()) {
    onProgress(k, students.length);
    try {
      await removeRecords(s.uid, shared);
      if (FULL_DELETE) {
        await httpsCallable(functions, 'deleteStudent')({ uid: s.uid });
      } else {
        await updateDoc(doc(db, 'users', s.uid), {
          deleted: true, deletedAt: serverTimestamp(), classId: null,
          displayName: deleteField(), mustChangePassword: false,
        });
      }
      results.push({ ...s, ok: true });
    } catch (e) {
      results.push({ ...s, ok: false, error: e.code ?? e.message });
    }
  }
  onProgress(students.length, students.length);
  return results;
}
