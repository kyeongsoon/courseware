import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { addDays, diffDays, weekday } from './schedule';

/**
 * 나이스 교육정보 개방 포털 (https://open.neis.go.kr) 연동
 * - 브라우저에서 바로 호출 (나이스가 CORS 를 허용함) → 서버·결제 필요 없음
 * - API 키는 settings/school 에 저장 (교사만 읽을 수 있음). 키가 없으면 나이스가 한 번에 5건까지만 줌
 * settings/school { atptCode, schoolCode, schoolName, kind('초등학교'|'중학교'|'고등학교'|…), apiKey, updatedAt }
 */
const BASE = 'https://open.neis.go.kr/hub/';

export class NeisError extends Error {}

async function call(service, params, key) {
  const rows = [];
  for (let page = 1; page <= 20; page++) {
    const qs = new URLSearchParams({ Type: 'json', pIndex: String(page), pSize: key ? '1000' : '5', ...params });
    if (key) qs.set('KEY', key);
    let data;
    try {
      const res = await fetch(`${BASE}${service}?${qs}`);
      data = await res.json();
    } catch {
      throw new NeisError('나이스에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.');
    }
    const body = data[service];
    if (!body) {
      const code = data.RESULT?.CODE ?? '';
      if (code === 'INFO-200') return rows; // 자료 없음
      if (code === 'ERROR-290' || code === 'ERROR-300') throw new NeisError('나이스 API 키가 올바르지 않아요. 학교 설정에서 키를 확인해 주세요.');
      if (code === 'ERROR-337') throw new NeisError('오늘 나이스 이용 한도를 넘었어요. 내일 다시 해 주세요.');
      throw new NeisError(`나이스 오류: ${data.RESULT?.MESSAGE ?? code ?? '알 수 없음'}`);
    }
    const total = body[0].head[0].list_total_count;
    rows.push(...(body[1]?.row ?? []));
    if (!key || rows.length >= total) return rows; // 키가 없으면 첫 쪽만
  }
  return rows;
}

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

export async function searchSchools(name, key) {
  const rows = await call('schoolInfo', { SCHUL_NM: name.trim() }, key);
  return rows.map((r) => ({
    atptCode: r.ATPT_OFCDC_SC_CODE, schoolCode: r.SD_SCHUL_CODE, schoolName: r.SCHUL_NM,
    kind: r.SCHUL_KND_SC_NM, region: r.ATPT_OFCDC_SC_NM, address: r.ORG_RDNMA ?? '',
  }));
}

// 반 이름에서 학년·반 읽기: "3학년 2반", "3-2", "3학년2반"
export function parseGradeClass(name = '') {
  const m = name.match(/(\d+)\s*학년\s*(\d+)\s*반/) || name.match(/(\d+)\s*-\s*(\d+)/);
  return m ? { grade: Number(m[1]), classNo: Number(m[2]) } : { grade: 0, classNo: 0 };
}

// 학년도: 3월 ~ 다음 해 2월
export function schoolYearRange(today) {
  const y = Math.floor(today / 10000), m = Math.floor(today / 100) % 100;
  const start = m >= 3 ? y : y - 1;
  const end = start + 1;
  const feb = (end % 4 === 0 && (end % 100 !== 0 || end % 400 === 0)) ? 29 : 28;
  return { from: start * 10000 + 301, to: end * 10000 + 200 + feb };
}

// ── 학사일정 ──
const GRADE_FLAGS = ['ONE', 'TW', 'THREE', 'FR', 'FIV', 'SIX'];

export function guessType(name) {
  if (/고사|시험|평가/.test(name)) return '시험';
  if (/휴업|공휴일|대체|재량/.test(name)) return '기타';
  return '행사';
}

// 같은 이름이 이어지는 날(주말만 끼어 있어도 이어진 것으로)은 하나의 여러 날 일정으로
function mergeRuns(items) {
  const byName = {};
  items.forEach((it) => (byName[it.title] ??= []).push(it.date));
  const out = [];
  Object.entries(byName).forEach(([title, dates]) => {
    dates.sort((a, b) => a - b);
    let start = dates[0], end = dates[0];
    const flush = () => out.push({ title, date: start, endDate: end, type: guessType(title) });
    for (const d of dates.slice(1)) {
      const gap = diffDays(end, d);
      const onlyWeekend = gap > 1 && Array.from({ length: gap - 1 }, (_, i) => weekday(addDays(end, i + 1))).every((w) => w === 0 || w === 6);
      if (gap === 1 || onlyWeekend) end = d;
      else {
        flush();
        start = d;
        end = d;
      }
    }
    flush();
  });
  return out.sort((a, b) => a.date - b.date);
}

export async function fetchSchedule(settings, { from, to, grade, skipSaturday = true }) {
  const rows = await call('SchoolSchedule', {
    ATPT_OFCDC_SC_CODE: settings.atptCode, SD_SCHUL_CODE: settings.schoolCode,
    AA_FROM_YMD: String(from), AA_TO_YMD: String(to),
  }, settings.apiKey);
  const items = rows
    .filter((r) => r.EVENT_NM && !(skipSaturday && r.EVENT_NM.trim() === '토요휴업일'))
    // 학년 표시가 있으면 우리 반 학년 행사만 (모두 N 이면 학교 전체 행사로 봄)
    .filter((r) => {
      if (!grade || grade > 6) return true;
      const flags = GRADE_FLAGS.map((g) => r[`${g}_GRADE_EVENT_YN`]);
      return flags.every((f) => f !== 'Y') || flags[grade - 1] === 'Y';
    })
    .map((r) => ({ title: r.EVENT_NM.trim().slice(0, 100), date: Number(r.AA_YMD) }));
  return { events: mergeRuns(items), limited: !settings.apiKey && rows.length >= 5 };
}

// 예전에 나이스에서 가져온 일정(그 기간)은 지우고 새로 넣음. 직접 만든 일정은 그대로
export async function importSchedule(classId, events, { from, to }, teacherUid) {
  const snap = await getDocs(query(collection(db, 'events'), where('classId', '==', classId)));
  const old = snap.docs.filter((d) => d.data().source === 'neis' && d.data().date >= from && d.data().date <= to);
  await Promise.all(old.map((d) => deleteDoc(d.ref)));
  for (const e of events) {
    await addDoc(collection(db, 'events'), {
      classId, title: e.title, type: e.type, date: e.date, endDate: e.endDate, note: '',
      source: 'neis', teacherUid, createdAt: serverTimestamp(),
    });
  }
  return { removed: old.length, added: events.length };
}

// ── 시간표 ──
const TIMETABLE_SERVICE = { 초등학교: 'elsTimetable', 중학교: 'misTimetable', 고등학교: 'hisTimetable', 특수학교: 'spsTimetable' };
export const timetableService = (kind) => TIMETABLE_SERVICE[kind] ?? 'hisTimetable';

// 그 주(월요일부터)의 우리 반 시간표 → { days, periods, cells }
export async function fetchTimetable(settings, { grade, classNo, monday }) {
  const rows = await call(timetableService(settings.kind), {
    ATPT_OFCDC_SC_CODE: settings.atptCode, SD_SCHUL_CODE: settings.schoolCode,
    GRADE: String(grade), CLASS_NM: String(classNo),
    TI_FROM_YMD: String(monday), TI_TO_YMD: String(addDays(monday, 5)),
  }, settings.apiKey);
  if (!rows.length) return null;
  const days = rows.some((r) => diffDays(monday, Number(r.ALL_TI_YMD)) === 5) ? 6 : 5;
  const periods = Math.min(10, Math.max(...rows.map((r) => Number(r.PERIO) || 0)));
  const cells = Array(days * periods).fill(null);
  rows.forEach((r) => {
    const d = diffDays(monday, Number(r.ALL_TI_YMD)), p = Number(r.PERIO) - 1;
    const s = String(r.ITRT_CNTNT ?? '').replace(/^[\s*\-·]+/, '').trim().slice(0, 20);
    if (d >= 0 && d < days && p >= 0 && p < periods && s) cells[d * periods + p] = { s, r: '' };
  });
  return { days, periods, cells, limited: !settings.apiKey && rows.length >= 5 };
}

// 그 날짜가 있는 주의 월요일
export const mondayOf = (date) => addDays(date, -((weekday(date) + 6) % 7));
