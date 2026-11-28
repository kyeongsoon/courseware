// 매일 아침 나이스 학사일정·이번 주 시간표를 모든 반에 반영 (GitHub Actions: .github/workflows/neis-sync.yml)
// - settings/school 의 학교·API 키를 씀. autoSync 가 false 이거나 키가 없으면 하지 않음
// - 학사일정: 올해 학년도 전체에서 "나이스에서 가져온 일정"만 비교해 바뀐 것만 지우고 더함 (직접 만든 일정은 그대로)
// - 시간표: 이번 주(주말이면 다음 주) 과목만 바꿈. 교시 시간·같은 과목 칸의 교실은 그대로. 나이스에 자료가 없으면 그대로 둠
// - 결과는 settings/neisSync 에 남겨 학교 설정 화면에서 보임
// 실행: GOOGLE_APPLICATION_CREDENTIALS=키.json FIREBASE_PROJECT=courseware-acba8 node scripts/neis-sync.mjs
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
  NeisError, diffNeisEvents, fetchSchedule, fetchTimetable, mergeNeisTimetable,
  parseGradeClass, sameCells, schoolYearRange, targetMonday,
} from '../src/neisCore.js';
import { kstToday } from '../src/scheduleCore.js';

const projectId = process.env.FIREBASE_PROJECT || process.env.GCLOUD_PROJECT;
initializeApp(projectId ? { projectId } : undefined);
const db = getFirestore();

const today = Number(process.env.SYNC_TODAY) || kstToday();
const log = (...a) => console.log(...a);

async function writeStatus(ok, message, classes = []) {
  await db.doc('settings/neisSync').set({ at: FieldValue.serverTimestamp(), ok, message, classes, today });
}

async function syncEvents(classId, cls, fresh, range) {
  const snap = await db.collection('events').where('classId', '==', classId).get();
  const old = snap.docs
    .filter((d) => d.data().source === 'neis' && d.data().date >= range.from && d.data().date <= range.to)
    .map((d) => ({ ...d.data(), ref: d.ref }));
  const { toDelete, toAdd } = diffNeisEvents(old, fresh);
  const batch = db.batch();
  toDelete.forEach((e) => batch.delete(e.ref));
  toAdd.forEach((e) => batch.set(db.collection('events').doc(), {
    classId, title: e.title, type: e.type, date: e.date, endDate: e.endDate, note: '',
    source: 'neis', teacherUid: cls.teacherUid ?? '', createdAt: FieldValue.serverTimestamp(),
  }));
  if (toDelete.length || toAdd.length) await batch.commit();
  return toAdd.length || toDelete.length ? `일정 +${toAdd.length} −${toDelete.length}` : '일정 변화 없음';
}

async function syncTimetable(classId, cls, settings, grade, classNo, monday) {
  if (!grade || !classNo) return '시간표 건너뜀 (반 이름에서 학년·반을 못 읽음)';
  const got = await fetchTimetable(settings, { grade, classNo, monday });
  if (!got) return '시간표: 나이스에 자료 없음 (그대로 둠)';
  const ref = db.doc(`timetables/${classId}`);
  const base = (await ref.get()).data() ?? null;
  const { limited, ...merged } = mergeNeisTimetable(base, got);
  if (base && base.days === merged.days && base.periods === merged.periods && sameCells(base.cells, merged.cells)) {
    return '시간표 변화 없음';
  }
  await ref.set({
    ...merged, neisWeek: monday,
    teacherUid: base?.teacherUid ?? cls.teacherUid ?? '', updatedAt: FieldValue.serverTimestamp(),
  });
  return base ? '시간표 바뀜' : '시간표 새로 만듦';
}

async function main() {
  const settingsSnap = await db.doc('settings/school').get();
  const settings = settingsSnap.data();
  if (!settings?.schoolCode) return log('학교 설정이 없어 건너뜀');
  if (settings.autoSync === false) return log('자동 갱신이 꺼져 있어 건너뜀');
  if (!settings.apiKey) {
    await writeStatus(false, '나이스 API 키가 없어 자동 갱신을 못 했어요. 학교 설정에서 키를 넣어 주세요.');
    return log('API 키 없음');
  }

  const range = schoolYearRange(today);
  const monday = targetMonday(today);
  log(`오늘 ${today}, 학년도 ${range.from}~${range.to}, 시간표 주 ${monday}, 학교 ${settings.schoolName}`);

  const classes = (await db.collection('classes').get()).docs;
  const scheduleByGrade = new Map(); // 학년별로 한 번만 부름
  const results = [];
  let failed = 0;
  for (const c of classes) {
    const cls = c.data();
    const { grade, classNo } = parseGradeClass(cls.name);
    const parts = [];
    try {
      if (!scheduleByGrade.has(grade)) scheduleByGrade.set(grade, fetchSchedule(settings, { ...range, grade }));
      const { events } = await scheduleByGrade.get(grade);
      parts.push(await syncEvents(c.id, cls, events, range));
      parts.push(await syncTimetable(c.id, cls, settings, grade, classNo, monday));
    } catch (e) {
      failed++;
      parts.push(`실패: ${e instanceof NeisError ? e.message : e.code ?? e.message}`);
      if (e instanceof NeisError && /키가 올바르지|한도/.test(e.message)) {
        results.push({ name: cls.name, summary: parts.join(', ') });
        await writeStatus(false, e.message, results);
        throw e;
      }
    }
    const summary = parts.join(', ');
    log(`${cls.name}: ${summary}`);
    results.push({ name: cls.name, summary });
  }
  await writeStatus(failed === 0, failed ? `${failed}개 반에서 실패했어요.` : `${classes.length}개 반을 갱신했어요.`, results);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
