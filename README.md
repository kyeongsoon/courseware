# Hello, Class!

우리 반 학급운영 웹사이트입니다 (알림장·설문·상담·출결·자리 배치·학급 달력·시간표, 나이스 연동). Vite + React + Firebase

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
| 학급운영 · 소통: 알림장(읽음 확인), 설문·투표, 상담 신청 | 켜짐 |
| 학급운영 · 생활: 출결(QR)·자리 배치·역할·청소·교우 관계 | 켜짐 |
| 학급운영 · 일정: 학급 달력, 시간표 | 켜짐 |
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

## 학급운영 · 소통

교사 화면 위쪽 **반 선택**에서 고른 반을 대상으로 동작합니다 (이 기기에 기억). 학생은 자기 반 것만 봅니다.

- **알림장**: 교사가 알림을 올리면 학생 홈과 알림장에 보입니다. 중요한 알림은 **맨 위에 고정**.
  학생이 알림을 열면 읽음이 기록되고, 교사는 알림 화면에서 **읽음 n/전체**와 안 읽은 학생을 봅니다. 학생 화면에는 안 읽은 알림에 '새 글'.
- **설문·투표**: 질문과 선택지(2~20개), 여러 개 선택, **익명**(이름을 저장하지 않음)을 정해 올립니다.
  학생은 마감 전까지 답을 바꿀 수 있고, 교사는 실시간 결과·응답자·미응답자를 봅니다. **마감**, **학생에게 결과 공개**(그 순간의 결과) 가능.
- **상담 신청**: 학생이 주제·내용·편한 시간을 적어 신청하면 **선생님만** 봅니다. 교사는 상태(확인 전/상담 예정/상담 완료)와 답변을 남기고,
  학생은 확인 전일 때만 취소할 수 있습니다.
- 보안 규칙: 다른 반 글 읽기, 친구 이름으로 쓰기, 친구 응답·상담 보기, 마감된 설문 응답, 학생의 상태 변경은 모두 거부됩니다.
- 색인(인덱스)을 따로 만들 필요가 없도록 반 하나로만 조회하고 정렬은 화면에서 합니다.

## 학급운영 · 생활

- **출결·조회 체크**
  - **QR 출석** (교실에 없는 학생이 출석 누르기 방지)
    - 교사: **출결 → 출석 QR 띄우기**를 누르면 교실 TV·프로젝터에 큰 QR과 6자리 코드가 뜹니다. **20초마다 바뀌고**, 출석한 인원과 방금 출석한 학생이 보입니다.
    - 학생: 홈의 **QR로 출석** → 카메라로 QR을 비추거나 코드 6자리 입력. 휴대폰 기본 카메라로 QR을 찍어도 사이트가 열리며 바로 출석됩니다(로그인 안 돼 있으면 로그인 후 자동으로).
    - 코드는 만든 지 **45초** 동안만 통하고(방금 바뀐 직전 코드도 잠깐 인정), QR 화면을 닫으면 바로 무효가 됩니다. 확인은 Firestore 보안 규칙이 하고 학생은 코드를 읽을 수 없어 화면 조작으로 뚫을 수 없습니다.
    - 출장 등으로 QR을 못 띄우는 날은 **QR 없이 출석 허용**을 켜면 예전처럼 **출석 체크** 버튼으로 출석합니다.
  - 학생은 오늘 날짜, 자기 반, 자기 것만, 처음 한 번만 '출석'으로 쓸 수 있습니다(지각·결석 등은 학생이 못 씀).
  - 교사(메뉴 **출결**): 날짜별로 반 전체를 보고 **미체크** 학생을 확인합니다. 출석·지각·조퇴·결석을 눌러 바꾸고, 사유(질병·미인정·기타·출석인정)와 메모를 남깁니다.
    **늦음 기준** 시각을 정하면 그 뒤에 체크한 학생이 표시되고, **미체크 모두 결석**으로 한 번에 기록할 수 있습니다. 교사가 고쳐도 학생이 체크한 시각은 남습니다.
  - **월별 요약**: 학생별 출석·지각·조퇴·결석 일수와 **CSV 다운로드**(날짜별 기록 포함) — 나이스 입력할 때 참고하세요.
  - 날짜는 한국 시각 기준입니다.
- **자리 배치** (메뉴 **자리 배치** / 학생은 **자리표**)
  - 줄·칸(최대 12×12)을 정하고 **무작위 배치** 또는 **학번순**으로 앉힙니다.
  - 누르는 방식: **자리 바꾸기**(두 자리를 눌러 교환, '아직 자리가 없는 학생'을 눌러 앉히기), **자리 없음 칸**(기둥·통로), **고정**(무작위 배치 때 안 움직임).
  - **교사 시점**(교탁이 아래)·**학생 시점**(교탁이 위)으로 볼 수 있고, 전체 화면으로 프로젝터에 띄울 수 있습니다.
  - **인쇄**: 지금 보는 방향 그대로 A4 가로 한 장에 반 이름·날짜와 함께 인쇄됩니다 (교실 게시용은 학생 시점, 교탁용은 교사 시점).
  - **저장**한 뒤 **학생에게 공개**하면 학생 화면에서 자기 자리가 강조됩니다. 공개 전에는 학생이 볼 수 없습니다(열어 둔 학생 화면도 공개 후 10초 안에 보임).

- **역할·청소** (메뉴 **역할·청소** / 학생은 **내 역할·청소**) — 1인 1역과 청소 당번을 같은 방식으로
  - **역할(구역) 목록**: 이름·설명·**난이도**(가벼움 1 · 보통 2 · 힘듦 3)·**인원**. '추천 목록 불러오기'로 시작해 우리 반에 맞게 고칩니다.
    할 일이 많은 역할은 인원을 늘리고 억지로 만든 역할은 지워도 됩니다 — 자리가 학생보다 적으면 남는 학생은 이번엔 쉬고 다음 배정에서 먼저 맡습니다.
  - **공평하게 자동 배정**: 난이도 × 기간(주)을 '부담 점수'로 쌓아, 점수가 적은 학생부터 힘든 역할을 맡기고 지난번과 같은 역할은 피합니다. 자리마다 학생을 골라 맞바꿀 수 있고, 배정 뒤 최소·최대 부담 점수를 미리 봅니다. 1인 1역은 4주, 청소는 1주가 기본 기간입니다.
  - **오늘 했어요**: 학생이 홈에서 누르면 교사 화면에 ✓와 '오늘 했어요 n / m명'이 보입니다(자기 역할·오늘·진행 중인 공개 배정만, 보안 규칙).
  - **공평 점검**: 학생별 1인 1역·청소·합계 부담 점수(평균보다 많이 높으면 🔺, 낮으면 🔻), 힘든/가벼운 역할 횟수, 맡은 기간 평일 대비 '했어요' 비율.
  - 시뮬레이션(28명·14역할·4주씩 6회): 자동 배정 후 부담 점수 차이 8점, 무작위 배정은 40점 안팎.

- **교우 관계** (메뉴 **교우 관계** / 학생은 **친구 조사**)
  - **조사 관리**: 회차(예: 3월, 6월)를 시작하면 학생 홈에 응답 안내가 뜹니다. 기본 질문 3개(모둠 활동을 같이 하고 싶은 친구 / 고민이 있을 때 이야기하는 친구 / 도움을 받고 싶은 친구)에 질문마다 **3명까지** 고릅니다. 미응답 학생 확인, 마감·다시 열기, 삭제.
  - 학생 응답은 **교사만** 봅니다. 학생은 진행 중인 자기 반 조사에 자기 응답만 쓰고(마감 전까지 수정), 자기 자신·4명 이상은 고를 수 없습니다(보안 규칙).
  - **관계도**: 학생은 점(크기·숫자 = 받은 선택 수), 선택은 화살표, **서로 고른 관계는 굵은 선**. 친한 무리는 같은 색, **아무도 고르지 않은 학생**은 빨간 점선 테두리와 목록으로 표시. 질문별로 보거나 전체를 합쳐 볼 수 있고, 학생을 누르면 고른 친구·고른 사람을 봅니다.
  - **변화 보기**: '비교'에서 지난 회차를 고르면 새로 생긴 선택(초록)·사라진 선택(빨간 점선)과 학생별 받은 선택 수 변화를 보여 줍니다. **학생별 추이** 탭은 회차마다 받은 선택 수를 표로 보여 줍니다.
  - **관찰 기록**: 교사가 본 관계(친함·챙겨 줌·갈등·기타)를 두 학생 사이에 날짜·메모와 함께 남기고, 관계도에 점선으로 겹쳐 볼 수 있습니다.
  - **갈등 질문 (선택)**: 회차를 시작할 때 '갈등 질문 넣기'를 켜면(기본 켜짐) 학생이 "최근 갈등이 있었거나 불편했던 친구"를 **2명까지** 고르고 무슨 일이 있었는지 짧게(200자) 쓸 수 있습니다. 답하지 않아도 됩니다. 학생 화면에 "선생님만 보고 친구에게 알려지지 않아요"라고 안내합니다.
    - 갈등은 받은 선택 수·무리·'아무도 고르지 않은 학생' 계산에 넣지 않고, 관계도에서 **학생이 적은 갈등 보기**를 켤 때만 빨간 점선(적은 학생 → 상대)으로 보입니다. 오른쪽 목록과 학생 상세(누가 이 학생을 적었는지)에도 나옵니다.
    - **관찰 기록 → 갈등 모아 보기**: 선생님 관찰의 '갈등'과 학생 응답의 갈등을 날짜순으로 한 목록에서 봅니다.
    - 학교폭력으로 보이는 내용이 있으면 학교 규정에 따른 보고 의무가 생길 수 있으니 응답을 확인할 시간을 정해 두세요. 실명과 내용이 저장되므로 지난 회차는 학기 말에 삭제하는 것을 권장합니다(회차를 지우면 응답도 함께 지워짐).

## 학급운영 · 일정

- **학급 달력**: 월 달력에 시험·수행평가·행사·과제·기타 일정을 색으로 구분해 보여 줍니다.
  교사는 **일정 추가** 또는 날짜 칸을 눌러 추가하고(여러 날 일정 가능, 메모), 일정을 눌러 수정·삭제합니다. 학생은 눌러서 내용만 봅니다.
  홈에 **다가오는 일정**(14일, D-day)이 보입니다.
- **시간표**: 교사가 **시간표 만들기**로 월~금(또는 월~토), 1~10교시의 과목·교실과 교시별 시간(예: `09:00-09:45`)을 입력합니다.
  오늘 요일과 **지금 수업**이 강조되고, 홈에 **오늘 시간표**가 보입니다 (한국 시각 기준, 1분마다 갱신).

### 나이스(NEIS) 연동 — 학사일정·시간표 가져오기

나이스 교육정보 개방 포털(open.neis.go.kr)의 공개 API를 **브라우저에서 바로** 불러옵니다 (서버·Blaze 요금제 필요 없음).

1. [나이스 포털](https://open.neis.go.kr/portal/guide/actKeyPage.do)에서 회원가입 → 인증키 신청(무료)으로 API 키를 받습니다.
   키가 없으면 한 번에 5건까지만 받아져서 실제로는 키가 필요합니다.
2. 사이드바 **설정 → 학교 설정 (나이스)** 에서 API 키를 넣고, 학교 이름으로 찾아 고른 뒤 **저장**합니다.
   키와 학교 정보는 Firestore `settings/school` 에 저장되고 **교사만** 읽을 수 있습니다 (사이트 코드에 들어가지 않음).
3. **학급 달력 → 나이스 학사일정**: 기간(기본은 올해 학년도 3월~2월)을 고르고 **나이스에서 불러오기** → 미리보기 → **달력에 넣기**.
   - 반 이름(예: `3학년 1반`)에서 학년을 읽어 그 학년 일정과 전교 일정만 가져옵니다. 토요휴업일은 기본으로 뺍니다.
   - 같은 이름의 연속된 날(주말 사이 포함)은 하나의 여러 날 일정으로 합칩니다. 이름에 고사·시험·평가가 있으면 '시험', 휴업·공휴일·재량은 '기타', 나머지는 '행사'.
   - 다시 가져오면 그 기간에 예전에 나이스에서 가져온 일정만 새것으로 바뀝니다. 직접 추가한 일정은 그대로입니다.
4. **시간표 → 나이스에서 가져오기**: 학년·반과 가져올 주를 고르고 **불러오기**하면 그 주 시간표가 편집 화면에 채워집니다.
   교시 시간·교실은 기존 값이 유지되니 확인하고 **저장**하세요 (나이스 시간표는 학교가 입력한 만큼만 나옵니다).

### 매일 아침 자동 갱신 (나이스)

GitHub Actions(`.github/workflows/neis-sync.yml`)가 **매일 한국 시각 06:45쯤** `scripts/neis-sync.mjs`를 실행해서, 7시 전에 모든 반에 반영합니다. 서버·결제가 필요 없습니다.

- **학사일정**: 올해 학년도 전체에서 나이스에서 가져온 일정만 비교해 **바뀐 것만** 지우고 더합니다. 직접 만든 일정은 그대로입니다.
- **시간표**: 이번 주(주말에는 다음 주) 나이스 시간표의 과목을 반영합니다. 교시 시간은 그대로이고, 과목이 같은 칸은 교실도 그대로입니다. 나이스에 그 주 자료가 없으면(방학 등) 건드리지 않습니다.
- 반 이름이 `3학년 1반`처럼 되어 있어야 그 반 시간표를 가져옵니다. 학년을 못 읽는 반은 학교 전체 일정만 받습니다.
- 결과는 **학교 설정** 화면 아래 '마지막 자동 갱신'에 보입니다. 끄려면 학교 설정에서 체크를 끄고 저장하세요.
- 바로 실행: GitHub 저장소 → **Actions → NEIS daily sync → Run workflow**.

**처음 한 번 필요한 설정**: 자동 배포에 쓰는 서비스 계정이 Firestore 데이터를 쓸 수 있어야 합니다.

1. <https://console.cloud.google.com/iam-admin/iam?project=courseware-acba8> 접속
2. 배포용 서비스 계정(`…@courseware-acba8.iam.gserviceaccount.com`) 줄의 연필(수정) 버튼 → **다른 역할 추가**
3. `Cloud Datastore 사용자` (Cloud Datastore User) 를 골라 **저장**

> GitHub은 저장소에 60일 동안 커밋이 없으면 예약 실행을 멈춥니다. 그때는 Actions 탭에서 다시 켜 주세요.

## 학생 계정 삭제 (교사)

**학생 명단**에서 학생 줄의 **삭제**를 누르거나, 여러 명을 체크한 뒤 **선택한 학생 삭제**를 누릅니다.
그 학생의 출결, 알림 읽음 기록, 설문 응답, 상담 신청이 지워지고 자리표의 자리는 빈자리가 됩니다. 되돌릴 수 없습니다.

- **무료 요금제(지금)**: 남의 로그인 계정을 지우는 건 서버 기능(Blaze)으로만 되므로, 계정 정보가 '삭제됨'으로 바뀌어
  명단·반에서 빠지고, 그 아이디로 로그인해도 "삭제된 계정이에요"만 보입니다 (스스로 되돌릴 수 없음).
  **같은 학번으로 다시 만들려면** 학생 명단 위 **Firebase 로그인 계정 관리** 버튼(새 탭: 콘솔 Authentication → 사용자)에서
  `학번@student.invalid` 계정을 지운 뒤 계정 만들기에서 다시 만드세요. 삭제 완료 안내에도 지울 아이디와 바로가기가 나옵니다.
- **서버 기능을 켜면**(아래 6번과 같은 설정): 로그인 계정과 계정 정보까지 완전히 지워져 같은 학번을 바로 다시 쓸 수 있습니다 (Cloud Function `deleteStudent`).

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

notices/{id}         // 알림장
  classId, title, body, pinned, teacherUid, createdAt, updatedAt
notices/{id}/reads/{uid}       // 읽음 기록 (학생 본인)
  name, studentId, readAt
polls/{id}           // 설문·투표
  classId, title, description, options[], multiple, anonymous, closed,
  results[] | null, resultsRespondents, teacherUid, createdAt
polls/{id}/responses/{uid}     // 응답 (학생 본인, 익명이면 이름 없음)
  choices[], answeredAt, name?, studentId?
counsel/{id}         // 상담 신청 (본인과 교사만)
  classId, studentUid, name, studentId, topic, message, preferredTime,
  status ('new'|'scheduled'|'done'), reply, createdAt, updatedAt

attendance/{반_날짜_학생}   // 출결 (학생은 오늘 '출석'만 처음 한 번)
  classId, uid, date(20261128), month(202611), name, studentId,
  status ('present'|'late'|'early'|'absent'), reason, note, by ('self'|'teacher'), code(학생이 낸 출석 코드), checkedAt, updatedAt
classes/{id}.checkInDeadline   // '08:30' — 늦음 표시 기준
classes/{id}.checkInOpen       // true 면 QR 없이 출석 허용
dutyBoards/{반_kind}   // 1인 1역(role)·청소(clean) 목록 (교사가 쓰고 그 반 학생이 읽음)
  classId, kind, tasks[{id, name, desc, level(1~3), count}], teacherUid, updatedAt
dutyRounds/{id}      // 배정 회차 (공개한 것만 학생이 읽음)
  classId, kind, from, to, assign{taskId:[uid…]}, tasks(그때 목록), names{uid:이름}, published, teacherUid, createdAt
dutyChecks/{회차_날짜_학생}  // '오늘 했어요' (학생은 자기 것만)
  roundId, classId, uid, taskId, date, checkedAt
relSurveys/{id}      // 교우관계 조사 회차 (교사가 만들고 그 반 학생이 읽음)
  classId, title, questions[{id:'q1'|'q2'|'q3', text}], questionIds, maxPicks(3), roster[{uid,name,studentId}], conflictQ(갈등 질문), open, teacherUid, createdAt
relResponses/{회차_학생}  // 응답 (학생은 자기 것만, 결과는 교사만)
  surveyId, classId, uid, answers{q1:[uid…], …}, conflicts[{uid, text}](갈등 질문, 최대 2), submittedAt
relNotes/{id}        // 교사 관찰 기록 (교사만)
  classId, a, b, kind('close'|'care'|'conflict'|'other'), note, date, teacherUid, createdAt
checkinCodes/{classId} // 출석 QR 코드 (교사만 읽고 씀, 20초마다 바뀜)
  code, issuedAt, prevCode, prevIssuedAt, teacherUid
seating/{classId}    // 자리표 (교사만 씀, 공개하면 그 반 학생이 읽음)
  rows, cols, cells[ null | {blocked:true} | {uid,name,studentId} ], locked[], published, teacherUid, updatedAt

events/{id}          // 학급 달력 일정
  classId, title, type ('시험'|'수행평가'|'행사'|'과제'|'기타'), date, endDate, note, source ('neis'|없음), teacherUid, createdAt
settings/school      // 나이스 연동 (교사만 읽고 씀)
  atptCode, schoolCode, schoolName, kind, region, apiKey, autoSync(false면 자동 갱신 끔), updatedAt
settings/neisSync    // 매일 아침 자동 갱신 결과 (GitHub Actions가 씀)
  at, ok, message, today, classes[{name, summary}]
timetables/{classId} // 시간표
  days(5|6), periods(1~10), times['09:00-09:45', …], cells[ {s: 과목, r: 교실} | null ] (요일 먼저), neisWeek(자동 갱신한 주 월요일), teacherUid, updatedAt

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
  deleteStudents.js           학생 계정 삭제 (기록 정리 + 정지/완전 삭제), 콘솔 바로가기 주소
  contexts/ClassContext.jsx   학급운영 대상 반 (교사: 반 선택, 학생: 내 반)
  components/ClassGate.jsx    반 선택 상자, 반이 없을 때 안내
  components/ClassFeed.jsx    홈의 '우리 반 소식' (알림장·설문·상담)
  notices.js, polls.js, counsel.js   알림장·설문·상담 데이터
  attendance.js, seating.js   출결·자리표 데이터 (배치·교환·크기 바꾸기)
  checkinCode.js              출석 QR 코드 만들기·바꾸기, components/CheckInQr.jsx(교사 화면), QrScanner.jsx(학생 인증 창)
  pages/CheckInLinkPage.jsx   휴대폰 카메라로 QR을 찍으면 열리는 /checkin 주소
  duties.js, pages/DutiesPage.jsx  1인 1역·청소 당번 (부담 점수, 공평 자동 배정, 오늘 했어요)
  relations.js                교우관계 조사·응답·관찰 기록과 분석 (서로 고름, 무리, 회차 비교)
  pages/RelationsPage.jsx, components/RelationGraph.jsx  관계도 (d3-force 배치)
  pages/AttendancePage.jsx, SeatingPage.jsx
  schedule.js                 달력·시간표 데이터와 날짜 계산
  neis.js                     나이스 연동 Firestore 쪽 (settings/school, 일정 가져오기)
  neisCore.js, scheduleCore.js 나이스 호출·날짜·시간표 계산 (화면과 자동 갱신 스크립트가 같이 씀)
scripts/neis-sync.mjs         매일 아침 나이스 자동 갱신 (GitHub Actions)
  pages/SchoolSettingsPage.jsx 학교 설정 (나이스 키·학교)
  pages/CalendarPage.jsx, TimetablePage.jsx (홈의 '오늘 시간표·다가오는 일정' 포함)
  pages/Notices*.jsx, Poll*.jsx, CounselPage.jsx
  pages/ChangePasswordPage.jsx  비밀번호 변경 (첫 로그인 시 강제)
  studentAccounts.js          학번↔내부 이메일 변환, 일괄 생성, CSV 저장
firestore.rules               Firestore 보안 규칙
functions/index.js            Cloud Functions: 학생 비밀번호 초기화, 학생 계정 완전 삭제
```
