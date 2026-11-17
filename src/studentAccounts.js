import { initializeApp, deleteApp } from 'firebase/app';
import {
  initializeAuth,
  inMemoryPersistence,
  createUserWithEmailAndPassword,
  signOut,
  connectAuthEmulator,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app, db, useEmulator, AUTH_EMULATOR_URL } from './firebase';

/**
 * 학생은 이메일 대신 "아이디(보통 학번)"로 로그인합니다.
 * Firebase Auth 는 이메일이 필요하므로 내부적으로 `아이디@도메인` 형태의 가짜 이메일을 씁니다.
 */
export const STUDENT_EMAIL_DOMAIN = import.meta.env.VITE_STUDENT_EMAIL_DOMAIN || 'student.invalid';
export const STUDENT_ID_PATTERN = /^[a-z0-9._-]{3,20}$/;

export function loginIdToEmail(input) {
  const v = input.trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${STUDENT_EMAIL_DOMAIN}`;
}

export function emailToLoginId(email = '') {
  return email.endsWith(`@${STUDENT_EMAIL_DOMAIN}`) ? email.split('@')[0] : email;
}

// 헷갈리는 글자(0/O, 1/l/I)를 뺀 초기 비밀번호 생성
export function generatePassword(length = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

/**
 * "학번,이름[,비밀번호]" 형식의 여러 줄 텍스트를 파싱
 * 쉼표·탭(엑셀에서 붙여넣기) 모두 지원
 */
export function parseStudentList(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [studentId = '', displayName = '', password = ''] = line.split(/[,\t]/).map((s) => s.trim());
      const id = studentId.toLowerCase();
      let error = '';
      if (!STUDENT_ID_PATTERN.test(id)) error = '아이디는 영문 소문자·숫자 3~20자';
      else if (!displayName) error = '이름이 비어 있음';
      else if (password && password.length < 6) error = '비밀번호는 6자 이상';
      return { line: i + 1, studentId: id, displayName, password: password || generatePassword(), error };
    });
}

/**
 * 교사가 로그인한 상태를 유지한 채 학생 계정을 생성합니다.
 * 같은 Auth 인스턴스로 가입시키면 교사가 로그아웃되므로, 메모리 전용 보조 앱을 따로 띄웁니다.
 * (무료 Spark 요금제에서 동작. 같은 IP 에서 시간당 생성 개수 제한이 있으니 한 반씩 만드세요.)
 */
export async function createStudentAccounts(students, teacherUid, onProgress = () => {}) {
  const secondary = initializeApp(app.options, `student-creator-${Date.now()}`);
  const secondaryAuth = initializeAuth(secondary, { persistence: inMemoryPersistence });
  if (useEmulator) connectAuthEmulator(secondaryAuth, AUTH_EMULATOR_URL, { disableWarnings: true });
  const results = [];

  try {
    for (const s of students) {
      try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, loginIdToEmail(s.studentId), s.password);
        // Firestore 문서는 교사 권한(기본 앱)으로 작성 → 보안 규칙에서 교사만 허용
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          email: cred.user.email,
          loginId: s.studentId,
          displayName: s.displayName,
          studentId: s.studentId,
          role: 'student',
          mustChangePassword: true,
          createdBy: teacherUid,
          createdAt: serverTimestamp(),
          lastLoginAt: null,
        });
        await signOut(secondaryAuth);
        results.push({ ...s, ok: true });
      } catch (err) {
        const msg = err.code === 'auth/email-already-in-use' ? '이미 있는 아이디' : err.code ?? err.message;
        results.push({ ...s, ok: false, error: msg });
      }
      onProgress(results.length, students.length);
    }
  } finally {
    await deleteApp(secondary);
  }
  return results;
}

// 결과를 엑셀에서 열 수 있는 CSV 로 다운로드 (한글 깨짐 방지 BOM 포함)
export function downloadCsv(rows, filename = `student-accounts-${new Date().toISOString().slice(0, 10)}.csv`) {
  const header = ['학번', '이름', '아이디', '초기비밀번호', '결과'];
  const body = rows.map((r) => [r.studentId, r.displayName, r.studentId, r.ok ? r.password : '', r.ok ? '생성됨' : r.error]);
  const csv = [header, ...body]
    .map((cols) => cols.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 바로 해제하면 일부 브라우저에서 파일 이름이 사라지므로 조금 뒤에 해제
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
