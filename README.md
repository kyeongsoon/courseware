# 정보 코스웨어

학생과 함께 수업하는 정보교과 웹 코스웨어입니다. (Vite + React + Firebase)

- 전체 개발 로드맵: [docs/GUIDE.md](docs/GUIDE.md)
- 현재 구현: **① Firebase Authentication + Firestore 로그인**, **② 반(학급) 관리**, **③ 수업(단원·차시)**, **④ 실시간 수업 모드**
  - 교사가 학생 계정을 한꺼번에 생성 (학번 = 아이디, 초기 비밀번호 자동 생성 + CSV 저장)
  - 학생은 첫 로그인 때 비밀번호 변경
  - 교사는 Google 또는 이메일 계정으로 로그인

## 지금 켜져 있는 기능

| 기능 | 상태 |
|---|---|
| 로그인, 학생 아이디 만들기, 학생 명단, 비밀번호 변경 | 켜짐 |
| 반 관리 (반 만들기, 학번으로 자동 배정) | 켜짐 |
| 수업(단원·차시), 슬라이드(PDF), 실시간 수업 | **꺼 둠** (`VITE_FEATURE_LESSONS=false`) |

꺼 둔 기능은 메뉴와 화면만 숨겨져 있고, 코드와 이미 저장된 수업·슬라이드 데이터는 그대로 남아 있습니다.
꺼 둔 동안에는 실시간 수업도 완전히 멈춰서, 예전에 시작해 둔 수업이 남아 있어도 학생 화면이 끌려가지 않습니다.

**다시 켜려면** `.env.production`의 `VITE_FEATURE_LESSONS=false`를 `true`로 바꿔 `main`에 합치면 자동 배포됩니다.
(로컬 테스트: `npm run dev:emu`는 꺼진 상태, `npm run dev:emu:all`은 켜진 상태로 실행)

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
- 학생이 비밀번호를 잊으면 아래 **6. 비밀번호 초기화**를 사용하세요.

## 5-1. 반(학급) 관리 (교사)

사이드바 **반 관리**에서:
- **반 만들기**: 이름(예: `3학년 2반`)을 입력해 반을 만듭니다.
- **학번으로 자동 배정**: 반이 없는 학생을 학번 앞자리로 나눠 한 번에 배정합니다. (`30215` → `3학년 2반`, `2103` → `2학년 1반`) 같은 이름의 반이 없으면 새로 만듭니다.
- 반을 누르면 **소속 학생 목록**, **빼기**, **학생 추가**(체크해서 여러 명 한 번에, 다른 반 학생은 옮겨짐), **이름 바꾸기**, **반 삭제**를 할 수 있습니다.
  반을 삭제해도 학생 계정은 지워지지 않고 '반 없음'이 됩니다.
- **계정 만들기**에서 "배정할 반"을 고르면 계정을 만들면서 바로 반에 넣을 수 있습니다.
- 학생은 홈에서 자기 반 이름을 볼 수 있고, 스스로 반을 바꿀 수는 없습니다 (보안 규칙).

## 5-2. 수업 만들기 (교사)

사이드바 **수업 관리**에서:
1. **단원 만들기** (예: `자료와 정보`). 화살표로 단원 순서를 바꿀 수 있어요.
2. 단원의 **차시 추가** → 제목, 한 줄 요약, 본문, 영상 주소, 자료 링크(구글 슬라이드·문서 등)를 입력합니다.
   - 본문은 일반 글로 쓰고 빈 줄로 문단을 나눕니다. `http`로 시작하는 주소는 자동으로 링크가 됩니다.
   - YouTube 주소를 넣으면 수업 화면에 영상이 바로 재생됩니다 (youtube-nocookie 사용).
   - 자료 링크는 `http://`·`https://` 주소만 저장됩니다.
   - **슬라이드(PPT)**: PowerPoint에서 **파일 → 내보내기 → PDF**로 저장한 파일을 올리면, 교사 브라우저가 장마다 그림(WebP)으로 바꿔 저장합니다 (최대 150장, 애니메이션은 빠짐).
     수업 화면에서 버튼·키보드 방향키·PageUp/PageDown·발표용 리모컨으로 넘기고, 전체 화면으로 띄울 수 있습니다.
3. **공개할 반**을 고르면 그 반 학생의 홈에 나타납니다. 아무 반도 고르지 않으면 비공개(교사만 보기)입니다.
4. 차시 순서는 화살표로, 내용은 **수정**에서 바꿉니다. 차시가 남아 있는 단원은 지울 수 없습니다.

학생은 홈에서 자기 반에 공개된 차시만 단원별로 보고, 수업 화면 아래 **이전/다음**으로 넘깁니다.
공개되지 않은 차시는 주소를 알아도 열리지 않습니다 (보안 규칙). 반을 삭제하면 그 반은 차시 공개 목록에서도 자동으로 빠집니다.

## 5-3. 실시간 수업 (교사 화면 따라오기)

1. 교사가 수업 화면(차시 보기)에서 반을 고르고 **실시간 수업 시작**을 누릅니다.
2. 그 반 학생은 어느 화면에 있든 교사가 보고 있는 차시로 자동으로 넘어갑니다. 교사가 다른 차시로 가면 학생도 따라옵니다.
   - 공개하지 않은 차시도 수업 중에는 그 반 학생에게 보이고, 수업을 끝내면 다시 닫힙니다.
3. **슬라이드 맞추기**: 교사가 슬라이드를 넘기면 학생 화면도 같은 장으로 넘어갑니다 (학생 쪽 넘기기는 잠김). 따라오기를 끄면 학생이 그 장부터 자유롭게 넘겨 봅니다.
4. **영상 맞추기**: 교사가 YouTube 영상을 재생·일시정지·이동하면 학생 영상도 똑같이 움직입니다 (학생 쪽 조작 버튼은 숨김).
   - 브라우저 정책상 학생이 화면을 한 번도 누르지 않았으면 소리 없이 재생됩니다. 학생이 **수업 참여**(또는 **소리 켜기**)를 누르면 소리가 납니다.
   - 학교 인터넷이 걱정되면 막대의 **영상: 교사 화면(앞 화면)만**을 고르세요. 학생 화면에는 영상 대신 안내만 나옵니다.
5. 교사 화면 위쪽 막대에서 **접속 인원**, **✋ 손든 학생**, **다 했어요 n/접속 인원**을 보고, **학생** 버튼으로 명단을 펼쳐 손을 내려 줄 수 있습니다.
6. **학생** 명단의 점 색으로 학생이 지금 무엇을 보는지 알 수 있습니다.
   - 🟢 수업 화면을 보는 중 · 🔴 다른 탭·다른 앱으로 감(창 최소화 포함) · ⚪ 연결 끊김(창 닫음, 인터넷 끊김)
   - 막대에 **다른 화면 N명**, 학생별로 이번 수업에서 다른 화면으로 간 **횟수**가 나옵니다.
   - 수업 영상을 누른 것은 다른 화면으로 치지 않습니다.
   - 같은 화면에 창 두 개를 나란히 띄우고 다른 창을 보고만 있는 경우처럼, 브라우저가 알려 주지 않는 경우는 감지하지 못합니다.
   - 학생에게 "수업 중 다른 화면으로 가면 선생님 화면에 표시된다"고 미리 알려 주세요.

7. **따라오기**를 끄면 학생이 자유롭게 볼 수 있고, 다시 켜면 교사 화면으로 돌아옵니다. **끝내기**로 수업을 마칩니다.

알아 둘 점
- 웹사이트라서 학생이 다른 탭·앱으로 가는 것까지는 막을 수 없습니다. 우리 사이트 안에서만 교사 화면으로 돌려보냅니다.
- 영상 위치는 교사·학생 기기의 시계를 기준으로 맞추므로, 기기 시계가 크게 틀리면 몇 초 어긋날 수 있습니다 (2초 넘게 어긋나면 다시 맞춤).
- 슬라이드 그림은 Firestore에 저장되고, 학생 기기가 처음 볼 때 서버에서 받습니다(무료 전송량 월 10GB를 씀).
  한 번 받은 슬라이드는 그 기기 브라우저(IndexedDB)에 보관해서, 다시 열거나 새로고침해도 서버에서 또 받지 않습니다.
  같은 PC를 쓰는 다른 학생도 보관본을 그대로 씁니다. PDF를 바꾸면 버전(`slidesVersion`)이 바뀌어 새로 받고, 예전 보관본은 지워집니다.
  글 위주 슬라이드는 장당 수십 KB, 사진이 많은 슬라이드는 수백 KB이니 Firebase 콘솔 → 사용량에서 가끔 확인하세요.
- 사이트 프로그램 파일(`/assets/`)은 브라우저가 1년간 보관하고, 페이지는 매번 최신인지 확인합니다(`firebase.json`의 headers). 배포하면 바로 새 버전이 보입니다.
- 학생 기기는 1분마다 접속 신호를 보냅니다. 30명이 50분 수업하면 쓰기 약 1,500회로, 무료 한도(하루 2만 회) 안에서 하루 5~6교시 정도 쓸 수 있습니다.

## 6. 학생 비밀번호 초기화 (교사)

교사용 페이지 → 학생 명단 → **초기화** 버튼을 누르면 새 8자리 임시 비밀번호가 화면에 나옵니다.
학생에게 알려 주면, 학생은 그 비밀번호로 로그인한 뒤 곧바로 새 비밀번호로 바꾸게 됩니다.
(초기화 즉시 옛 비밀번호는 쓸 수 없고, 다른 기기의 로그인도 끊깁니다.)

남의 비밀번호를 바꾸는 일은 보안상 브라우저에서 할 수 없어서 **Cloud Functions**(`functions/index.js`)를 씁니다.
서버에서 "요청한 사람이 교사인지, 대상이 학생인지"를 확인한 뒤에만 바꿉니다.

**배포 방법 (1회)**
1. Firebase 콘솔 → 요금제를 **Blaze(종량제)** 로 변경 (Cloud Functions 배포에 필요, 카드 등록 필요)
   - 월 200만 회 호출까지 무료라 학급 단위 사용은 사실상 0원입니다. 걱정되면 Google Cloud 결제 → **예산 알림**(예: 1,000원)을 설정하세요.
2. 배포:

```bash
cd functions && npm install && cd ..
```

```bash
firebase deploy --only functions
```

3. `.env.local` 에 `VITE_ENABLE_PASSWORD_RESET=true` 로 바꾸고 다시 빌드·배포하면 **초기화** 버튼이 나타납니다.

```bash
npm run build && firebase deploy --only hosting
```

**결제 전(기본값 `false`)** 에는 초기화 버튼이 숨겨져 있고, 나머지 기능은 모두 동작합니다.
학생이 비밀번호를 잊으면 Firebase 콘솔 → Authentication 에서 학생을 삭제하고 Firestore `users` 문서도 삭제한 뒤 다시 만들어 주세요.

> ⚠️ 결제 전에는 `firebase deploy` 에 꼭 `--only hosting,firestore:rules` 를 붙이세요. 그냥 실행하면 Functions 배포 때문에 Blaze 요금제 오류가 납니다.

## 로컬 테스트 (에뮬레이터, 실제 프로젝트 없이)

Java가 필요합니다. 처음 한 번 `cd functions && npm install` 후, 터미널 두 개에서:

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
  classId      // 소속 반 (classes 문서 ID, 없으면 null)
  mustChangePassword  // 초기 비밀번호를 아직 안 바꿨으면 true
  createdBy, createdAt, lastLoginAt

classes/{classId}
  name         // 예: "3학년 2반"
  teacherUid, createdAt

units/{unitId}       // 단원
  title, order, teacherUid, createdAt

lessons/{lessonId}   // 차시
  unitId, title, order, summary, body, videoUrl
  links        // [{ label, url }]
  openClassIds // 공개할 반 ID 목록 (비어 있으면 비공개)
  slideCount, slidesName, slidesVersion   // 올린 슬라이드 장수, PDF 파일 이름, 올릴 때마다 바뀌는 버전
lessons/{lessonId}/slides/{000…}   // 슬라이드 그림
  index, image (data URL, 1MB 미만), w, h
  teacherUid, createdAt, updatedAt

live/{classId}       // 실시간 수업 (반마다 하나, 교사만 씀)
  active, className, lessonId, slide, follow, videoMode ('sync' | 'teacher')
  video        // { videoId, state: 'playing'|'paused', time, at } 교사 영상 상태
  teacherUid, startedAt, updatedAt
live/{classId}/members/{uid}   // 학생 본인만 씀
  name, studentId, lastSeen, hand, doneLessonId
  focused, awayCount   // 지금 수업 화면을 보는지, 다른 화면으로 간 횟수
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
  pages/ClassesPage.jsx       교사 전용: 반 목록, 반 만들기, 학번으로 자동 배정
  pages/ClassDetailPage.jsx   교사 전용: 반 소속 학생, 추가·빼기, 이름 바꾸기, 삭제
  classes.js                  반 데이터 (구독, 생성, 배정, 삭제)
  pages/TeacherLessonsPage.jsx  교사 전용: 단원·차시 목록, 순서 바꾸기
  pages/LessonEditorPage.jsx  교사 전용: 차시 만들기·수정·삭제, 공개할 반
  pages/LessonViewPage.jsx    수업 화면 (영상, 본문, 자료, 이전/다음)
  components/LessonBody.jsx   본문 표시 (주소 자동 링크, HTML 해석 안 함)
  lessons.js                  단원·차시 데이터, 주소 검사, YouTube 주소 해석
  live.js, youtube.js         실시간 수업 데이터, YouTube 플레이어 불러오기
  contexts/LiveContext.jsx    실시간 수업 상태 (교사 진행·학생 따라오기·접속 신호)
  components/LiveBar.jsx      실시간 수업 막대 (교사 조작·학생 손들기), 시작 버튼
  components/LessonVideo.jsx  수업 영상 (수업 중에는 교사 영상에 맞춰 재생)
  components/SlideViewer.jsx  슬라이드 보기 (넘기기, 리모컨, 전체 화면, 수업 중 교사 따라가기)
  slides.js                   PDF → 슬라이드 그림 변환(pdf.js), 저장, 불러오기
  slideCache.js               슬라이드 기기 보관(IndexedDB) — 다시 볼 때 서버에서 안 받음
  features.js                 기능 켜고 끄기 (VITE_FEATURE_LESSONS)
  pages/ChangePasswordPage.jsx  비밀번호 변경 (첫 로그인 시 강제)
  studentAccounts.js          학번↔내부 이메일 변환, 일괄 생성, CSV 저장
firestore.rules               Firestore 보안 규칙
functions/index.js            Cloud Functions: 학생 비밀번호 초기화
```
