# 정보 코스웨어

학생과 함께 수업하는 정보교과 웹 코스웨어입니다. (Vite + React + Firebase)

- 전체 개발 로드맵: [docs/GUIDE.md](docs/GUIDE.md)
- 현재 구현: **① Firebase Authentication + Firestore 로그인**
  - 교사가 학생 계정을 한꺼번에 생성 (학번 = 아이디, 초기 비밀번호 자동 생성 + CSV 저장)
  - 학생은 첫 로그인 때 비밀번호 변경
  - 교사는 Google 또는 이메일 계정으로 로그인

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

1. 앱에서 **Google 계정으로 로그인**합니다. (Google 대신 이메일을 쓰려면 Firebase 콘솔 → Authentication → 사용자 추가로 먼저 만든 뒤, 아이디 칸에 이메일을 입력해 로그인)
2. 이 시점엔 `role: "student"` 로 만들어져 프로필 입력 화면이 보입니다. 그대로 두고,
3. Firebase 콘솔 → Firestore → `users` → 내 문서에서 `role` 값을 `teacher`로 수정합니다.
4. 새로고침 없이 바로 대시보드로 넘어가고 **교사용 페이지** 링크가 나타납니다.

> 보안 규칙상 학생은 자기 `role`을 바꿀 수 없습니다. 교사 지정은 콘솔에서만 가능합니다.

## 5. 학생 계정 만들기 (교사)

1. 교사용 페이지 → **학생 계정 만들기**에 한 줄에 한 명씩 `학번,이름` 입력 (엑셀 두 열 복사·붙여넣기 가능)
   - 세 번째 칸에 비밀번호를 쓰면 그 값, 비우면 8자리 초기 비밀번호 자동 생성
2. **미리보기**로 형식 오류를 확인한 뒤 **계정 만들기**
3. 초기 비밀번호는 이 화면에서만 볼 수 있으니 **CSV 다운로드**로 꼭 저장해 학생에게 나눠 줍니다.
4. 학생은 학번을 아이디로 로그인하고, 첫 로그인 때 자기 비밀번호로 바꿉니다.

**알아 둘 점**
- 학생 아이디는 내부적으로 `학번@student.invalid` 형식의 가짜 이메일로 저장됩니다 (실제 메일 발송 없음, `.env.local` 의 `VITE_STUDENT_EMAIL_DOMAIN` 으로 변경 가능).
- Firebase는 같은 IP에서 시간당 만들 수 있는 계정 수를 제한합니다. 한 번에 한 반(30명 안팎)씩 만드세요.
- 무료(Spark) 요금제에서는 교사가 **학생 비밀번호를 앱에서 초기화할 수 없습니다.** 학생이 비밀번호를 잊으면
  Firebase 콘솔 → Authentication 에서 그 학생을 삭제하고, Firestore `users` 에서 문서도 삭제한 뒤 다시 만들어 주세요.
  (앱 안의 "비밀번호 초기화" 버튼은 Blaze 요금제 + Cloud Functions 가 필요해 다음 단계로 남겨 둠)

## 로컬 테스트 (에뮬레이터, 실제 프로젝트 없이)

Java가 필요합니다. 터미널 두 개에서:

```bash
npm run emulators
```

```bash
npm run dev:emu
```

## 데이터 구조

```
users/{uid}
  uid, email, displayName,
  loginId      // 로그인 아이디 (교사가 만든 계정)
  studentId    // 학번, 예: "30215"
  role         // "student" | "teacher"
  mustChangePassword  // 초기 비밀번호를 아직 안 바꿨으면 true
  createdBy, createdAt, lastLoginAt
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
  pages/TeacherPage.jsx       교사 전용: 학생 계정 일괄 생성, 학생 명단
  pages/ChangePasswordPage.jsx  비밀번호 변경 (첫 로그인 시 강제)
  studentAccounts.js          학번↔내부 이메일 변환, 일괄 생성, CSV 저장
firestore.rules               Firestore 보안 규칙
```
