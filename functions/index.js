import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { randomInt } from 'node:crypto';

initializeApp();
const db = getFirestore();

// 헷갈리는 글자(0/O, 1/l/I)를 뺀 8자리 임시 비밀번호
function generatePassword(length = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[randomInt(chars.length)]).join('');
}

/**
 * 교사가 학생 비밀번호를 초기화합니다.
 * - 호출한 사람이 users/{uid}.role == 'teacher' 인지 서버에서 확인
 * - 대상은 학생 계정만 가능 (교사 계정은 초기화 불가)
 * - 새 임시 비밀번호를 돌려주고, 학생은 다음 로그인 때 다시 비밀번호를 바꿔야 함
 */
/**
 * 교사가 학생 계정을 완전히 삭제합니다 (로그인 계정 + users 문서).
 * 출결·응답 등 학생 기록은 화면(교사 브라우저)에서 먼저 지운 뒤 호출합니다.
 * 로그인 계정이 지워지므로 같은 학번으로 바로 다시 만들 수 있습니다.
 */
export const deleteStudent = onCall({ region: 'asia-northeast3' }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const caller = await db.doc(`users/${callerUid}`).get();
  if (caller.get('role') !== 'teacher') throw new HttpsError('permission-denied', '교사만 사용할 수 있습니다.');

  const { uid } = request.data ?? {};
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', '학생을 지정해 주세요.');
  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  if (snap.exists && snap.get('role') !== 'student') throw new HttpsError('permission-denied', '학생 계정만 삭제할 수 있습니다.');

  try {
    await getAuth().deleteUser(uid);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
  }
  await ref.delete();
  return { ok: true };
});

export const resetStudentPassword = onCall({ region: 'asia-northeast3' }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const caller = await db.doc(`users/${callerUid}`).get();
  if (caller.get('role') !== 'teacher') throw new HttpsError('permission-denied', '교사만 사용할 수 있습니다.');

  const { uid, password } = request.data ?? {};
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', '학생을 지정해 주세요.');
  if (password !== undefined && (typeof password !== 'string' || password.length < 6)) {
    throw new HttpsError('invalid-argument', '비밀번호는 6자 이상이어야 합니다.');
  }

  const targetRef = db.doc(`users/${uid}`);
  const target = await targetRef.get();
  if (!target.exists) throw new HttpsError('not-found', '학생을 찾을 수 없습니다.');
  if (target.get('role') !== 'student') throw new HttpsError('permission-denied', '학생 계정만 초기화할 수 있습니다.');

  const newPassword = password || generatePassword();
  const auth = getAuth();
  await auth.updateUser(uid, { password: newPassword });
  await auth.revokeRefreshTokens(uid); // 다른 기기에 로그인된 세션 종료
  await targetRef.update({
    mustChangePassword: true,
    passwordResetAt: FieldValue.serverTimestamp(),
    passwordResetBy: callerUid,
  });

  return { password: newPassword };
});
