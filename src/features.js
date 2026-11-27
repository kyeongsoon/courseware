// 기능 켜고 끄기. 값은 .env.production(배포) / .env.local(내 컴퓨터)에서 정함.
// 끈 기능은 메뉴·화면만 숨기고, 코드와 이미 저장된 데이터는 그대로 둠.
export const FEATURES = {
  // 수업(단원·차시), 슬라이드(PDF), 실시간 수업(따라오기·손들기 등)
  lessons: import.meta.env.VITE_FEATURE_LESSONS === 'true',
};
