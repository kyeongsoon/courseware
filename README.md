# 정보 코스웨어

학생과 함께 수업하는 정보교과 웹 코스웨어입니다. (Vite + React + Firebase)

- 전체 개발 로드맵: [docs/GUIDE.md](docs/GUIDE.md)
- 현재 구현: **① Firebase Authentication + Firestore 로그인**

## 1. Firebase 프로젝트 준비 (콘솔에서 1회)

1. <https://console.firebase.google.com> 에서 프로젝트 생성
2. **Authentication → 시작하기 → 로그인 방법**에서 `Google`, `이메일/비밀번호` 사용 설정
3. **Firestore Database → 데이터베이스 만들기** (위치: `asia-northeast3 (서울)` 권장, 프로덕션 모드)
4. **프로젝트 설정 → 내 앱 → 웹 앱(</>) 추가** 후 표시되는 `firebaseConfig` 값을 복사
5. 배포 주소를 쓸 경우 **Authentication → 설정 → 승인된 도메인**에 도메인 추가 (`localhost`는 기본 포함)

## 2. 로컬 실행

```bash
npm install
```

```bash
cp .env.example .env.local
```

`.env.local` 에 4번에서 복사한 값을 채운 뒤:

```bash
npm run dev
```

## 3. 보안 규칙 배포

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

```bash
firebase use --add
```

```bash
firebase deploy --only firestore:rules
```

## 4. 교사 계정 만들기

1. 교사도 먼저 앱에서 한 번 로그인합니다 (자동으로 `role: "student"` 문서 생성).
2. Firebase 콘솔 → Firestore → `users` → 내 문서에서 `role` 값을 `teacher`로 수정합니다.
3. 새로고침 없이 즉시 반영되며, 대시보드에 **교사용 페이지** 링크가 나타납니다.

> 보안 규칙상 학생은 자기 `role`을 바꿀 수 없습니다. 교사 지정은 콘솔(또는 이미 교사인 계정)에서만 가능합니다.

## 데이터 구조

```
users/{uid}
  uid, email, displayName,
  studentId    // 학번, 예: "30215"
  role         // "student" | "teacher"
  createdAt, lastLoginAt
```

## 폴더 구조

```
src/
  firebase.js                 Firebase 초기화 (.env.local 사용)
  contexts/AuthContext.jsx    로그인 상태·프로필 관리, 로그인/가입 함수
  components/ProtectedRoute.jsx  로그인·교사 권한 확인
  pages/LoginPage.jsx         Google/이메일 로그인, 회원가입, 비밀번호 재설정
  pages/ProfileSetupPage.jsx  이름·학번 입력 (Google 첫 로그인 시)
  pages/DashboardPage.jsx     로그인 후 첫 화면
  pages/TeacherPage.jsx       교사 전용 학생 명단
firestore.rules               Firestore 보안 규칙
```
