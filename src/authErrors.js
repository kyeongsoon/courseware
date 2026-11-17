// Firebase Auth 오류 코드를 학생이 이해하기 쉬운 한국어로 변환
const messages = {
  'auth/invalid-email': '이메일 형식이 올바르지 않아요.',
  'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않아요.',
  'auth/user-not-found': '가입되지 않은 이메일이에요.',
  'auth/wrong-password': '비밀번호가 맞지 않아요.',
  'auth/email-already-in-use': '이미 가입된 이메일이에요. 로그인해 주세요.',
  'auth/weak-password': '비밀번호는 6자 이상이어야 해요.',
  'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.',
  'auth/popup-closed-by-user': '로그인 창이 닫혔어요.',
  'auth/popup-blocked': '팝업이 차단되었어요. 브라우저에서 팝업을 허용해 주세요.',
  'auth/network-request-failed': '네트워크 연결을 확인해 주세요.',
  'auth/unauthorized-domain': '이 주소는 Firebase 승인된 도메인에 등록되지 않았어요.',
};

export function toKoreanMessage(err) {
  return messages[err?.code] ?? `오류가 발생했어요. (${err?.code ?? err?.message})`;
}
