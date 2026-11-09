# GamerIN 디자인 시스템 v2 — 결정사항과 작업 기록

작성일: 2026-11-04 · 갱신: 2026-11-08 · 기준: 원격 `feature/design-v2` [`a69469d`](https://github.com/wishufeeldasame/gamerin_frontend/commit/a69469d5a6ebd5b82da5c3cc31766398f43e0e31) (PR #200 병합).

**상태: 디자인 시스템 v2 구현 완료, develop 통합 대기(2026-11-09).** 토큰·공통 유틸리티·앱 셸부터 홈, 게시물 상세, 검색·북마크, 프로필, 지갑, 멘토링, 멤버십, 공개 탐색·중앙 로그인 모달, 설정·가입·계정 복구, 메시지, 공통 모달·결제 결과·약관까지 병합했다. 실서버·실기기 확인은 남았다. 앱 전체 Noto Sans KR 연결은 2026-11-09 적용했다. 임시 목 API는 2026-11-09 제거했다. 관리자 화면은 이번 범위에서 제외한다.

다크 기본 + Amber `#F5B93D` + L2 사이드바 통합형이 확정안이다. PR #199에서 워드마크의 `IN`만 `#F8C24A`로 맞췄다. PR #198에서 보낸 메시지·전송 대기·실패 말풍선을 `bg-brand`(`#F5B93D`) + `text-fg-on-brand`(`#1A1406`)로 통일했다. 공유 게시글 카드는 독립 `bg-surface`를 유지한다.

PR #200에서 YouTube·Twitch·SOOP 별도 계정 연결 UI와 localStorage 읽기·쓰기를 제거했다. 기존 브라우저 값은 읽거나 삭제하지 않는다. 프로필 웹사이트는 기존 `PATCH /api/v1/users/me`로 `user_profiles.website`에 저장하고 헤더에서 링크 하나를 표시한다. 게시물 미디어 탭과 게임 전적 연결은 유지한다.

이 문서의 1절과 과거 시안·작업 기록은 당시 상태다. **현재 완료 여부는 7절, PR·커밋 근거는 8-1절, 남은 작업은 9절**을 따른다. 병합은 운영 배포·실서버 검증 완료를 뜻하지 않는다.

- Figma 파일(현행): [GamerIN Design System v2](https://www.figma.com/design/e4aQUNEbh9n2aXiStJYniH) (팀 `서장호's team`, Student 플랜) — 4-1절
- Figma 파일(초기, 참고용): [GamerIN Design System v2](https://www.figma.com/design/KFhNXMpM8Klw9oXWiCkhRZ) (팀 `서장호의 팀`, Starter 플랜). 3·4절의 컴포넌트·화면은 이 파일 기준이며 새 파일로 옮기지 않았다.
- 목표: 기존 노란 브랜드 색(`#F5B93D`)은 유지하고, 색·굵기·모서리 단계를 줄여 더 단순하고 정돈된 UI로 바꾼다.

## 1. 현재 코드 진단

아래는 코드 반영 전 상태다. 수치는 `src/` 전체를 grep으로 센 값이고(2026-11-04, `d3fee9b`), 이후 `feature/design-v2`에서 `Header.tsx` 제거, `btn-primary` 등 유틸리티 교체 같은 변경이 있어 현재 코드와 다르다.

| 항목 | 현재 상태 | 근거 |
|---|---|---|
| 브랜드 색 사용 | 노랑 `#f5b93d`는 117회 쓰인다. 라이트 모드에서는 헤더 전체가 노랑이지만, primary 버튼과 활성 사이드바는 검정이고 다크 모드에서만 노랑이다. 헤더 로고는 노랑 위 흰 글자라 대비가 약 1.8:1이다(공식 계산 근사치). | `Header.tsx:144`(`bg-[#f5b93d]`), `Header.tsx:150`(로고 `text-white`), `globals.css`의 `btn-primary`(`bg-black … dark:bg-[#f5b93d]`), `Sidebar.tsx` 활성 항목(`bg-black text-white`) |
| 팔레트 혼용 | 앱은 Tailwind `zinc`, 관리자 화면은 별도 회색(`#667085` 71회, `#344054` 62회 등)과 파랑(`#315ef5` 61회)을 쓴다. `amber-*`/`yellow-*` 유틸리티도 섞여 있다. | `src/app/(admin)/admin/_components/*` 등 |
| 글자 굵기 | `font-black` 330회, `font-bold` 281회, `font-semibold` 102회, `font-medium` 51회 | 굵은 글씨가 대부분이라 위계가 잘 보이지 않는다. |
| 모서리 반경 | `rounded-2xl` 200, `xl` 172, `full` 71, `3xl` 34, `lg` 32, `[20px]` 19, `md` 4, `sm`·`[2rem]` 등 10종 | 같은 역할의 요소도 반경이 서로 다르다. |
| 장식 | 활성 메뉴의 `scale-[1.02]`·`shadow-lg`, `uppercase tracking-widest` 라벨 | `Sidebar.tsx`, `login/page.tsx` 등 |
| 폰트 | 앱은 시스템 기본 폰트, 관리자 화면만 Noto Sans KR(`next/font/local`) | `src/app/(admin)/admin/_components/admin-font.ts` |

## 2. 결정사항

| # | 결정 | 이유 |
|---|---|---|
| D1 | 라이트·다크 모두 Primary를 노랑(`bg/brand` = `yellow/500` `#F5B93D`)으로 통일하고, 그 위 글자는 거의 검정인 `#1A1406`으로 쓴다. | 버튼·활성 상태의 브랜드 색이 모드마다 다른 문제를 해소한다. 노랑 바탕 위 흰 글자는 대비가 낮아 어두운 글자를 쓴다. |
| D2 | 강조색은 노랑 하나. 상태 색은 red(위험)와 green(성공)만 두고, 관리자 화면의 파랑은 폐기 후보로 둔다. | 팔레트 3종 혼용 해소. 관리자 화면은 F20에 따라 이번 개편에서 제외한다. |
| D3 | 회색은 neutral 한 계열(0–950)만 쓴다. 다크 단계는 기존 값 `#0C0C0E`/`#151518`/`#1F1F24`/`#2A2A30`을 유지한다. | 다크 모드 표면 3단계(#138)에서 정한 값을 바꾸지 않는다. |
| D4 | 폰트는 Noto Sans KR로 통일하고, 굵기는 Regular 400 / Medium 500 / Bold 700만 쓴다. | 저장소에 이미 woff2가 있다. Pretendard는 Figma 계정에 없어 쓰지 않았다. |
| D5 | 모서리 반경은 4단계: `sm 6` / `md 10` / `lg 14` / `full`. | 10종 이상 쓰이던 반경을 역할별로 정리한다. |
| D6 | 그림자는 팝오버(`Elevation/Popover`)와 포커스 링(`Focus/Ring`)에만 쓴다. 활성 상태는 배경·글자색만으로 나타낸다. | 장식 요소를 줄인다. |
| D7 | 아바타는 원형으로 하고, 이미지가 없으면 연노랑 배경(`bg/brand-subtle`)에 이니셜을 넣는다. | 지금의 검정 각진 사각형(`rounded-xl bg-black`)보다 화면이 가볍다. |
| D8 | 피드 탭 활성 표시는 2px 노란 밑줄, 사이드바 활성 표시는 연노랑 배경 + 노란 아이콘으로 한다. | 노랑을 쓰는 위치를 줄인다. |
| D9 | 아이콘은 `lucide-react`를 유지하되 20px에 선 굵기 1.67로 그린다(24px 원본을 0.833배 축소한 값). | 지금 쓰는 아이콘 세트를 그대로 쓰면서 선을 가늘게 한다. |
| D10 | 흐린 글자색(`text/tertiary`)은 Light `neutral/500` `#71717A`, Dark `neutral/450` `#8B8B94`, `text/secondary`(Light)는 `neutral/600` `#52525B`로 한다. | 처음 값(Light `#A1A1AA`, Dark `#52525B`)은 대비가 약 2.5:1로 WCAG AA 본문 기준(4.5:1)에 못 미친다. Dark를 `neutral/500`으로 올려도 카드 바탕 `#151518` 위 3.77:1이라 `neutral/450`(5.40:1)을 추가했다. 대비값은 WCAG 상대 휘도 공식으로 계산했다. 새 Figma 파일에 반영했다. |

D3·D10의 다크 색은 2026-11-06 밝기 조정(아래 절), D7·D8은 확정안 F6으로 대체됐다. D4 글꼴 통일은 2026-11-09 Noto Sans KR 전역 연결로 적용했다. 굵기 단계 축소는 별도다.

### 2-1. 확정안 결정 (2026-11-05)

| # | 결정 | 이유 |
|---|---|---|
| F1 | 다크 모드를 기본으로 하고 브랜드 색은 노랑 Amber `#F5B93D`로 확정한다. Teal·Coral·Violet·Ice·Volt는 비교용 시안으로만 남긴다. | 사용자 결정. 시안 D(Volt)는 "딸깍"·양산형 플랫폼 느낌이라는 피드백을 받았다. |
| F2 | 카드에서 1px 테두리를 빼고 바탕 명도 차이로만 구분한다. 티어·게임은 알약 배지 대신 흐린 글자, 게임 이름은 `@핸들 · 시간 · 게임` 줄에 둔다. | D의 양산형 인상은 모든 요소를 테두리 박스로 감싸고, 대문자 라벨과 알약 배지를 반복한 데서 왔다고 판단했다(추정). |
| F3 | 브랜드 색은 로고 `IN`, 탭 밑줄, 좋아요한 하트·수, 알림 배지, 입력이 있을 때의 Primary 버튼, 활성 아이콘에만 쓴다. 빈 작성창의 `게시` 버튼은 비활성 모양(`bg/subtle`)이다. | 콘텐츠보다 메뉴·버튼이 먼저 눈에 띄던 문제를 없앤다. |
| F4 | 레이아웃 L2: 상단 헤더를 없애고, 사이드바 메뉴를 홈·검색·알림(숫자 배지)·북마크·메시지·멘토링·프로필 순으로 둔다. 사이드바(248)·피드(600)·오른쪽 열(300)을 한 묶음(1212)으로 화면 가운데에 정렬한다. | 헤더 오른쪽 끝의 알림이 콘텐츠와 떨어져 있었고, 왼쪽으로 쏠린 배치를 고친다. |
| F5 | 데스크톱의 검색·알림은 사이드바 오른쪽 가장자리에서 폭 400 패널이 왼쪽→오른쪽으로 밀려 나온다(제안 220ms ease-out). 피드 영역만 스크림으로 덮고, 해당 메뉴를 활성으로 표시한다. X·Esc·스크림·같은 메뉴로 닫는다. 검색은 Enter를 누르면 지금처럼 `/search?q=` 결과 페이지로 간다. | 사용자 요청: 알림은 별도 페이지가 아니라 모달처럼 슬라이드. 검색창 디자인이 L2와 맞지 않았다. |
| F6 | 사이드바 활성 항목은 `bg/subtle` 회색 바탕 + `icon/brand` 아이콘 + Body Strong 글자다(D8 변경). 아바타 이니셜 바탕은 `bg/subtle`이다(D7 변경). | 브랜드색 바탕 블록이 화면에서 가장 진한 덩어리였다. |
| F7 | `내 지갑`을 메뉴에서 빼고, 사이드바 하단 계정 카드에 마일리지 잔액과 `충전`을 둔다. 멤버십은 지갑 화면 헤더의 `멤버십 혜택 ›`로 들어간다(현재 코드 `wallet/page.tsx:128`과 같다). | 지갑은 매일 들어가는 목적지가 아니라 계정 기능이다. 잔액이 늘 보이면 멘토링 결제 전에 확인하기 쉽다. |
| F8 | 지갑·멘토링·멤버십처럼 정보가 넓은 화면은 오른쪽 열을 빼고 940 한 칸을 쓴다. 북마크는 오른쪽 열에 모음집 목록, 프로필은 인증된 전적을 둔다. 별도 미디어 계정 연결 UI는 제거하고 서버에 저장되는 프로필 웹사이트 링크를 사용한다. | 화면별로 오른쪽 열을 쓸모 있게 채운다. |
| F9 | 모바일은 하단 탭 5칸(홈·북마크·메시지·멘토링·프로필)을 유지하고, 상단 바에 로고·검색·알림을 둔다. 검색은 전체 화면 패널, 알림은 뒤로 가기가 있는 별도 페이지로 연다. 지갑은 내 프로필의 마일리지 카드로 들어간다. | 사용자 요청: 모바일 알림은 페이지. 현재 모바일에는 지갑 진입 메뉴가 없다(`Sidebar.tsx:19-20`). |
| F10 | 게시물 영상은 16:9 비율을 고정해 폭에 맞춰 높이를 정한다(데스크톱 560×315, 모바일 326×183). | 6절 미반영 3(모바일 미디어 높이)을 해결한다. |
| F11 | 멤버십 혜택 문구의 "노란 체크 배지"는 코드 문구 그대로 둔다. | 사용자 결정. 브랜드가 노랑으로 확정되어 색과 문구가 맞는다. |
| F12 | 프로필 맨 위에 커버 사진을 둔다. 높이는 데스크톱 224·모바일 128(코드 `h-32 md:h-56`과 같음), 반경 `lg 14`(모바일 12)다. 아바타(데스크톱 88·모바일 72)는 커버 아래쪽에 반쯤 걸치고 `bg/canvas` 4px 테두리로 분리한다. `프로필 수정` 버튼은 커버 오른쪽 아래에 둔다. 사진이 없으면 기본 이미지 `public/images/default-profile-cover.svg`를 쓴다. | 커버는 현재 코드에 있는 기능(`profile/[userId]/page.tsx:1021-1041`, `EditProfileModal` 업로드)인데 시안에서 빠져 있었다. 레이아웃은 바꾸지 않고 커버만 더했다. |
| F14 | 내 프로필 커버 아래 `프로필 수정` 왼쪽에 설정 아이콘 버튼을 둔다. 설정·내 신고는 이 버튼으로 들어간다. | 현재 코드의 내 프로필 아이콘 버튼(`profile/[userId]/page.tsx:1066-1080`, `aria-label="설정"`)과 같은 진입점이다. |
| F15 | 나머지 화면 공통 규칙. 회원가입·계정 복구 화면은 데스크톱에서 왼쪽 브랜드 패널(648) + 오른쪽 폼(400), 모바일에서 폼만 두고 위에 로고를 둔다. 모달은 데스크톱에서 가운데, 모바일에서 아래에서 올라오는 시트(위쪽 반경 20, 손잡이)다. 단, 로그인은 F25에 따라 모바일에서도 중앙 모달을 쓴다. 모바일 메시지는 목록과 대화를 나눠 보여 준다. 상세·하위 화면(게시물 상세, 해시태그, 설정, 내 신고, 지갑, 멤버십, 알림, 대화)은 모바일에서 뒤로 버튼이 있는 헤더를 쓴다. | 로그인·계정 화면은 코드가 같은 왼쪽 로고 패널(`AuthPageShell`)을 공유한다. 모바일 메시지 분리는 코드의 `대화 목록으로 돌아가기` 동작과 같다. 뒤로 버튼은 웹앱 독립 실행에서 브라우저 뒤로가기가 없기 때문이다(10절). |
| F13 | 다크가 기본이지만 라이트 모드도 제공한다. 라이트 색은 2-2절 Light 토큰을 그대로 쓰고, 카드 테두리용 `border/card`(Light `neutral/200`, Dark 투명)를 추가해 라이트에서만 흰 카드에 1px 테두리를 그린다. | 사용자 요청. 테두리 없이는 흰 카드(`#FFFFFF`)가 바탕(`#FAFAFA`)에 묻힌다. Dark에서는 투명이라 F2(테두리 없음)가 유지된다. |

### 2-1-1. 남은 결정 확정 (2026-11-05)

| # | 결정 | 이유 |
|---|---|---|
| F16 | 기본 테마는 다크다. 설정의 라이트/다크 선택은 유지하고, 선택값을 서버에도 저장한다. localStorage(`gamerin_user_settings`)는 첫 화면 깜빡임을 막는 캐시로 남기고, 로그인 뒤에는 서버 값을 따른다. 프론트 PR #195에서 서버 저장·로그인/복원 동기화를 구현했다. | 사용자 결정. 기본값은 `dark`다. `src/lib/user-settings.ts`의 `saveThemeToServer`·`syncThemeFromServer`와 `AuthContext`를 사용한다. 백엔드 PR #190 병합 확인, 배포 여부는 별도다. |
| F17 | 좋아요한 하트는 브랜드 노랑이 아니라 지금 코드처럼 Tailwind `red-500`(`#EF4444`, 라이트·다크 공통)이다. 숫자는 선택 여부와 상관없이 `text-fg-secondary`다(라이트 흰 카드 위 `red-500` 글자 대비가 4.5:1에 못 미친다, PR #180 리뷰). 2-2절 primitive `red/500`(`#DC2626`)은 오류용이라 다른 색이다. F3의 "좋아요한 하트·수"는 이 결정으로 바뀐다. Figma 시안은 노랑으로 그려져 있다. | 사용자 결정. 노랑은 버튼·활성 상태에 이미 쓰여 좋아요와 구분되지 않는다. |
| F18 | 로그인 제목을 `지금 가입하세요.`에서 `다시 오신 걸 환영해요`로 바꾼다. | 사용자 결정(5-2절 제안 채택). |
| F19 | `ID로 로그인` 토글을 없애고 `또는 아이디로 로그인` 구분선 아래 아이디·비밀번호 폼을 항상 보여 준다. | 사용자 결정(5-2절 제안 채택). |
| F20 | 관리자 화면의 별도 팔레트는 이번 개편에서 그대로 둔다. 관리자 시안을 그린 뒤 따로 다룬다. | 사용자 결정. 관리자 시안이 없다. |
| F21 | 라이트 모드의 사이드바 활성 바탕은 `neutral/200`으로 더 진하게 한다. 다크는 F6대로 `neutral/850`(`bg/subtle`)이다. 코드에서는 `bg/nav-active` 토큰(Light `neutral/200`, Dark `neutral/850`)으로 둔다. | 사용자 결정. `#F4F4F5`는 페이지 바탕 `#FAFAFA`와 차이가 작았다. |
| F22 | 시안에만 있던 문구 2개를 코드에 넣는다. 홈 오류 둘째 줄 `네트워크 상태를 확인한 뒤 다시 시도해 주세요.`, 멘토 되기 안내의 `관리자 검토를 거쳐`. | 사용자 결정. |
| F23 | 게시물 카드 이름 옆 티어는 작성자의 **대표 게임 티어**(wishufeeldasame/gamerin_backend#179 `authorRepresentativeTier`)를 **엠블럼 이미지만** 보여 준다. 티어 글자(`Diamond 2`)와 게임 약칭은 붙이지 않고, 엠블럼에 `LoL Gold I` 같은 대체 텍스트를 단다. 메타 줄의 `· 게임`(게시물 게임 태그)은 만들지 않는다. 조회수는 wishufeeldasame/gamerin_backend#183으로 진행한다. | 사용자 결정(2026-11-05). 대표 티어와 게시물 게임을 한 카드에 같이 두면 두 게임이 다를 때 티어가 어느 게임 것인지 헷갈린다. 게임마다 엠블럼 그림이 달라 엠블럼만으로 게임이 구분된다. 게시물 게임은 게임별 피드 필터가 필요해질 때 그 UI와 함께 설계한다. Figma 시안은 티어 글자·게임 이름을 그린 그대로다. |
| F24 | 조회수(wishufeeldasame/gamerin_backend#183, #188 `viewCount`)는 시안대로 액션 줄의 리포스트 다음에 눈 아이콘과 숫자로 둔다(카드·상세 공통 `PostViewCount`, 버튼 아님). 1만 미만은 `1,234`, 1만 이상은 `1.2만`·`12만`·`1.5억`이다(단위 앞 숫자가 10 미만이면 소수 한 자리, 반올림 없이 버림, `formatViewCount`). 0은 다른 숫자처럼 보이고, 응답에 값이 없거나 0 이상의 정수가 아니면 숨긴다. 카드 노출 집계(`usePostViewImpression`): 모바일 상단 바·하단 탭 바와 홈·프로필의 sticky 탭(`data-view-occluder`)에 가린 부분을 뺀 화면 영역에서 카드가 절반 이상(화면보다 긴 카드는 그 영역 높이의 절반 이상) 보이는 상태가 탭이 보이는 채로 1초 이어지면 1회다(탭을 숨기면 1초를 처음부터 다시 재고, 화면에 걸친 카드가 있는 동안 스크롤·창 크기 변경 때와 1초가 끝날 때 보이는 높이를 다시 잰다). 같은 탭에서 같은 글은 한 번만 보고하고(사용자가 바뀌면 초기화), 50개가 차거나 첫 노출 5초 뒤 `POST /api/v1/posts/views`로 묶어 보낸다. 탭을 숨기거나 떠날 때(`visibilitychange`·`pagehide`) 남은 것을 `keepalive`로 바로 보낸다. 실패는 다시 보내지 않고, 보내기 전에 로그아웃·다른 사용자 로그인·토큰 갱신으로 인증 세대가 바뀌면 남은 것은 버린다. 비로그인이거나 IntersectionObserver가 없으면 보고하지 않는다. 상세는 서버가 `GET`에서 세고 응답 값은 이번 조회 전 값이므로 그대로 보여 준다. | 구현 결정(2026-11-06). 서버가 같은 사용자·같은 글을 24시간에 1번만 세므로(`PostViewService`) 프론트 중복 제거는 요청 수만 줄인다. 조회수는 근사치라 재시도로 요청을 늘리지 않는다. 절반·1초는 흔히 쓰는 노출 기준(IAB 디스플레이 광고 기준)이다. 시안은 0을 숨기지만 코드의 좋아요·댓글·리포스트 숫자가 0도 보이므로 맞췄다. |
| F25 | 비로그인 공개 탐색(FE #187·BE #189)에 맞춰 별도 로그인 페이지를 공통 중앙 로그인 모달로 대체한다. 데스크톱 폭 440, 모바일 좌우 여백 16·폭 343(375 화면)/288(320 화면), 반경 20. Google 로그인과 항상 펼친 아이디·비밀번호 폼, 계정 복구·가입 링크를 둔다. 닫기·Esc 후 탐색 위치와 포커스를 보존하며, 로그인 성공만으로 보류된 쓰기를 자동 실행하지 않는다. | 사용자 결정(2026-11-07). FE 이슈 #187은 PR #194로 구현·병합했다. BE 이슈 #189의 PR #191도 병합했다. 운영에서 공개 API를 사용하려면 해당 백엔드 배포가 필요하다. [시안](login-modal.md). |

#### 다크 팔레트 밝기 조정

프로필 모바일 시안에서 다크 바탕이 너무 어두워, 중립색의 밝기를 아래와 같이 높이기로 했다. 공통 다크 토큰과 현행 Figma의 Dark 모드에 아래 값을 반영했다. D3·D10의 기존 다크 값은 이전 결정 기록이다.

| 역할 | 적용값 |
|---|---|
| 화면 바탕 (`canvas`, `background`) | `#19191D` |
| 카드·모바일 하단 탭 표면 (`surface`) | `#222226` |
| 한 단계 밝은 표면 (`surface-elevated`)과 사진 없는 프로필 기본 커버 | `#2B2B31` |
| 기본 구분선 (`line`) | `#38383F` |

초기 화면과 설치형 웹앱은 `APP_THEME_COLORS.dark`(`#19191D`)를 사용한다. 다크에서 사진이 없는 프로필 커버와 수정 미리보기는 `#2B2B31`을 표시한다. 라이트 기본 커버는 기존 SVG를 사용한다. 업로드한 커버와 미디어에는 팔레트 변환을 적용하지 않는다.

기존 다크 보조 글자 `#8B8B94`는 한 단계 밝은 표면에서 4.17:1이었다. 공통 `text/tertiary`를 `#94949E`로 올려 `#2B2B31` 위에서 4.68:1을 확보했다. Chromium에서 홈·검색·해시태그·북마크·게시물 상세·프로필·지갑과 모바일 알림을 확인했다.

### 2-2. 토큰

Figma 토큰과 CSS 변수의 이름은 다를 수 있다. 현행 코드는 `src/app/globals.css`의 CSS 변수와 `@theme inline` 연결을 따른다. 아래는 Figma 명세다. 초기 CSS 변수 이름 제안은 Figma 변수의 Web code syntax에 넣어 두었다.

**Primitives**

| 계열 | 단계 |
|---|---|
| yellow | 50 `#FFF9EB` · 100 `#FEF0C7` · 200 `#FDE08A` · 300 `#FBCD5A` · 400 `#F8C24A` · **500 `#F5B93D`** · 600 `#DB9A1F` · 700 `#B07614` · 800 `#7D5310` · 900 `#4A310A` · 950 `#2A2112` |
| neutral | 0 `#FFFFFF` · 50 `#FAFAFA` · 100 `#F4F4F5` · 200 `#E4E4E7` · 300 `#D4D4D8` · 400 `#A1A1AA` · 450 `#8B8B94` · 500 `#71717A` · 600 `#52525B` · 700 `#3F3F46` · 800 `#2A2A30` · 850 `#1F1F24` · 900 `#151518` · 950 `#0C0C0E` · ink `#1A1406` |
| dark-neutral | 450 `#94949E` · 800 `#38383F` · 850 `#2B2B31` · 900 `#222226` · 950 `#19191D` |
| red | 50 `#FEF2F2` · 300 `#F87171` · 500 `#DC2626` · 950 `#2A1212` |
| green | 50 `#F0FDF4` · 300 `#4ADE80` · 500 `#16A34A` · 950 `#0F2416` |

**의미별 색 (Light / Dark)**

| 토큰 | Light | Dark | 용도 |
|---|---|---|---|
| `bg/canvas` | neutral/50 | dark-neutral/950 | 페이지 바탕 |
| `bg/surface` | neutral/0 | dark-neutral/900 | 카드·헤더·모바일 하단 탭 |
| `bg/subtle` | neutral/100 | dark-neutral/850 | hover, 검색창, 미디어 자리. 다크의 `--surface-elevated`와 같은 값 |
| `bg/profile-cover` | 기존 기본 SVG | dark-neutral/850 | 사진이 없는 프로필 커버. Figma에서 Light 모드에만 기존 벡터 삽화를 표시 |
| `bg/inverse` | neutral/900 | neutral/0 | 토스트 등 반전 표면 |
| `bg/brand` | yellow/500 | yellow/500 | Primary 버튼, 로고 마크 |
| `bg/brand-hover` | yellow/600 | yellow/300 | Primary hover |
| `bg/brand-subtle` | yellow/50 | yellow/950 | 활성 메뉴, 티어 Chip, 아바타, 안내 배너 |
| `bg/danger-subtle` / `bg/success-subtle` | red/50 / green/50 | red/950 / green/950 | Danger 버튼, 상태 배너 |
| `text/primary` | neutral/900 | neutral/100 | 본문·제목 |
| `text/secondary` | neutral/600 (D10) | neutral/400 | 보조 설명, 비활성 메뉴 |
| `text/tertiary` | neutral/500 (D10) | dark-neutral/450 | 핸들·시간·placeholder |
| `text/on-brand` | neutral/ink | neutral/ink | 노랑 바탕 위 글자 |
| `text/brand` | yellow/800 | yellow/400 | 해시태그, 티어 라벨 |
| `text/danger` / `text/success` | red/500 / green/500 | red/300 / green/300 | 오류·성공 문구 |
| `icon/primary` / `icon/secondary` / `icon/brand` | neutral/900 / neutral/500 / yellow/600 | neutral/100 / neutral/400 / yellow/500 | 아이콘 |
| `border/default` / `border/strong` | neutral/200 / neutral/300 | dark-neutral/800 / neutral/700 | 구분선·카드 테두리 / Secondary 버튼 |
| `border/focus` / `border/danger` | yellow/500 / red/500 | yellow/500 / red/300 | 포커스 / 오류 입력 |
| `border/card` | neutral/200 | 투명(`#00000000`) | 카드 테두리. 라이트에서만 보인다(F13) |

새 Figma 파일에서는 Light/Dark를 `Color` 컬렉션 하나의 두 모드로 합쳤다. Dark 모드의 `bg/brand`·`bg/brand-hover`·`bg/brand-subtle`·`text/on-brand`·`text/brand`·`icon/brand`·`border/focus`는 `Brand` 컬렉션(`brand/solid`·`hover`·`subtle`·`on`)을 참조한다. 확정 모드 `Amber` 값은 solid `#F5B93D` · hover `#FBCD5A` · subtle `#2A2112` · on `#1A1406`으로 위 표의 yellow 값과 같다. 나머지 모드(Volt·Teal·Coral·Violet·Ice)는 비교용이다.

**간격·반경**: `space/1 4` · `2 8` · `3 12` · `4 16` · `5 20` · `6 24` · `8 32` · `10 40` / `radius/sm 6` · `md 10` · `lg 14` · `full`

**텍스트 스타일 (Noto Sans KR)**

| 스타일 | 크기/행간 | 굵기 | 자간 | 용도 |
|---|---|---|---|---|
| Display | 28/36 | Bold | -2% | 페이지 제목(`page-title` 대체) |
| Title | 20/28 | Bold | -1.5% | 섹션 제목 |
| Heading | 16/24 | Bold | -1% | 카드 제목 |
| Body | 15/24 | Regular | -0.5% | 본문 |
| Body Strong | 15/24 | Medium | -0.5% | 이름, Medium 버튼 |
| Label | 13/20 | Medium | 0 | Small 버튼, 링크, 보조 정보 |
| Caption | 12/16 | Regular | 0 | 핸들·시간·푸터 |

## 3. 컴포넌트 (초기 Figma `Components` 기록)

| 컴포넌트 | 속성 | 대체할 현재 코드 |
|---|---|---|
| Icon/* (21종) | — | `lucide-react` 1.8.0 원본 SVG |
| Button | Variant(Primary/Secondary/Ghost/Danger) × Size(Medium 40/Small 32) × State(Default/Disabled), Label, Show icon, Icon | `btn-primary`, `btn-secondary` |
| Input | State(Default/Focus/Error), Value, Show icon | `input-base` |
| Nav Item | State(Default/Active), Label, Icon | `Sidebar` 메뉴 링크 |
| Tab Bar Item | State(Default/Active), Label, Icon | `MobileTabBar` |
| Feed Tab | State(Default/Active), Label | 홈 전체/팔로잉 탭 |
| Avatar | Size(40/32), Initials | 각 화면의 이니셜 박스 |
| Chip | Variant(Neutral/Brand), Label | 해시태그·티어·역할 배지 |
| Post Action | State(Default/Active), Count, Icon | `Post` 하단 액션 |
| Post Card | Name, Handle, Show tier, Show media | `Post.tsx` |
| Post Composer | — | `PostComposer.tsx` 접힌 상태 |

## 4. 화면 (초기 Figma `Screens` 기록)

아래 3개 화면과 Header 기반 구조는 초기 파일의 기록이다. 현재 앱은 L2 셸과 `src/app/(app)/page.tsx`의 `/` 피드를 사용한다.

| 화면 | 크기 | 구성 |
|---|---|---|
| Home · Desktop · Light | 1440 | Header 64(로고, 검색, 알림·메시지, 아바타) / Sidebar 256(메뉴 6개, 하단 계정 + 로그아웃) / 피드 600(탭 → 작성기 → 카드 2개) / 오른쪽 300(추천 친구, 푸터) |
| Home · Desktop · Dark | 1440 | 라이트 화면을 복제한 뒤 색 바인딩을 `Color · Dark` 변수로 교체 |
| Home · Mobile · Light | 390×844 | Header 56, 피드 탭, 작성기, 카드, 하단 탭바 5칸 |

- 화면 구조는 `src/app/(app)/layout.tsx`, `src/app/(app)/home/page.tsx`, `Sidebar.tsx`, `Header.tsx`, `RightSidebar.tsx`를 따랐다.
- 홈과 프로필은 xl(1280px) 이상에서 추천 친구 카드(`SuggestedFriendsCard`)를 표시한다. PR #196(병합 완료)에서 예시 계정·비활성 버튼을 제거하고 인증 전용 추천 API(백엔드 #192, `GET /api/v1/users/me/recommendations?limit=5`)에 연결했다. 닉네임·핸들·이미지·멤버십·대표 티어 엠블럼·저장 승률·공통 연결 수를 표시하고, 팔로우 성공 시 해당 후보를 제거한다. null 통계는 숨기며 로딩·빈 목록·오류·재시도를 제공한다. 비로그인과 인증 복원 중에는 카드를 렌더하지 않는다. 계정 전환은 사용자 ID key로 목록을 초기화하고 이전 조회를 취소한다. 백엔드 PR #192도 병합했다. 선행 API 배포와 로그인 실서버 검증은 별도다.
- **정정**: Figma 화면의 피드 탭을 `전체`/`팔로잉`으로 넣었지만, 실제 코드의 탭 이름은 `추천`/`팔로잉`이다(`src/app/(app)/home/page.tsx:171`). Figma 화면은 아직 고치지 않았다(호출 한도). 이후 시안(mockups.md)은 `추천`으로 맞췄다.
- 시안 C부터는 사용자 요청에 따라 헤더 오른쪽의 메시지·아바타를 빼고 알림만 둔다(mockups.md 시안 C).

### 4-1. 현행 Figma 파일 구성 (`서장호's team`, 2026-11-05)

| 페이지 | 내용 |
|---|---|
| Foundations | 비어 있음. 변수(Primitives 39, Brand 4×6모드, Color 27×Light/Dark, Dimension 12), 텍스트 스타일 7, 이펙트 스타일 2만 있다. 초기 파일의 Foundations 문서 페이지는 옮기지 않았다. |
| Components | 아이콘 36종(lucide 원본 SVG), Avatar, Nav Item, Post Action, Post Card(Media 16:9 고정), Notification Item, Tab, Chip, User Row, Program Card, Charge Option, History Row, Application Card, Benefit Row, Profile Cover(Light 기본 SVG, Dark 단색), Tab Bar Item, Mobile Tab Bar, Mobile Top Bar |
| Mockups · Dark | 시안 E~J(색 6종), L1/L2 레이아웃, L2 알림·검색 패널 열림 상태 |
| Screens | 확정 레이아웃의 데스크톱 화면: 홈, 검색 결과, 북마크, 프로필(게시물·전적·미디어), 내 지갑, 멘토링(멘토 찾기·내 멘토링·내 프로그램·멘토 되기·프로그램 상세), 멤버십(미가입·이용 중), 상태(홈 로딩·오류, 북마크 빈 상태, 검색 결과 없음, 세션 확인 실패). 각 화면에 Amber·Violet 두 벌이 있다. |
| Mobile | 390×844: 홈, 검색 패널, 알림 페이지, 북마크, 프로필, 내 지갑, 멘토링, 멤버십. Amber·Violet 두 벌 |
| Screens · FHD | 확정 데스크톱 21개 화면을 1920×1080 프레임으로 복제한 것(Dark·Amber). 세 칸 묶음은 가운데 정렬 그대로이고 양옆 여백만 넓다. 패널·스크림·모달은 1920 기준으로 다시 배치했다. |
| Light | 확정 화면 29개(데스크톱 21, 모바일 8)의 Light 모드 복제본(F13) |
| Screens · More | 나머지 데스크톱 화면 31개(Dark): 메시지, 게시물 상세, 해시태그, 설정 계정·테마, 내 신고 / 로그인, 회원가입 1·2단계, 소셜 가입, 아이디 찾기·결과, 비밀번호 찾기·발송, 비밀번호 재설정·링크 오류, OAuth 처리 중·오류 / 게시물 작성 펼침, 게시물 수정, 프로필 수정, 모음집 저장, 공유, 신고, 게임 전적 연동, 카카오페이 결제 / 결제 결과 3종, 이용약관, 개인정보 처리방침 |
| Mobile · More | 위 화면의 모바일 32개(Dark, 메시지는 목록·대화 2개) |
| Light · More | 위 63개의 Light 모드 복제본 |

Components에는 이후 아이콘 13종(settings, log-out, eye-off, mail, lock, circle-check, circle-alert, loader-circle, camera, link, flag, plus, send)을 더 추가해 아이콘은 49종이다.

- 화면 문구와 항목은 현재 코드 기준이다. 근거는 [mockups.md](mockups.md) 확정안 절에 화면별로 적었다.
- 화면 속 사람·숫자·날짜·가격은 예시 데이터다.

## 5. 로그인 화면 (초기 설계 기록)

**현행:** PR #194로 별도 `/login`·`/home`을 제거하고 `/` 공개 피드와 공통 중앙 로그인 모달을 도입했다. 모달은 `src/app/auth/_components/LoginPromptProvider.tsx`의 `LoginDialog`다. [현재 명세·Figma·PNG](login-modal.md)를 따른다. 가입은 `/signup`, 복구·소셜 가입은 기존 인증 경로를 사용하며 PR #199로 v2 적용을 마쳤다. 아래 전체 페이지 구조·명세는 대체된 기록이다.

### 5-1. 개편 전 구조 (삭제된 `src/app/login/page.tsx`)

- `md` 이상에서는 왼쪽 45%가 로고 패널(`/logo.png`, `bg-gray-50/50`)이고, 오른쪽에 최대 420px 폼이 있다.
- 폼은 위에서부터 `GamerIN` 라벨(대문자·넓은 자간), 제목 `지금 가입하세요.`, 개발 단계 안내 배너(amber), OAuth 오류 배너(red), `Google로 계속하기`, `ID로 로그인` 토글(펼치면 아이디·비밀번호 입력과 검정 `로그인` 버튼), 아이디·비밀번호 찾기와 약관 링크, 회원가입 순이다.

### 5-2. 초기 전체 페이지 설계 명세 (중앙 모달로 대체)

당시에는 Figma MCP 호출 한도로 화면을 만들지 못했다. 이후 나머지 화면 시안과 F25 중앙 모달 6종을 제작했으므로 아래 명세를 신규 구현 기준으로 사용하지 않는다.

| 영역 | v2 명세 |
|---|---|
| 프레임 | 1440×900, `bg/surface` |
| 왼쪽 브랜드 패널 | 너비 45%(648), `bg/canvas`, 오른쪽 `border/default` 1px. 가운데에 로고(`/logo.png`, 기존 `drop-shadow-xl` 제거), 아래에 `GamerIN`(Display)과 `실력 인증부터 멘토링까지, 게이머들의 이력서이자 커뮤니티`(Body, `text/secondary`, `src/app/layout.tsx` metadata description 문구) |
| 폼 | 너비 400, 세로 간격 `space/6` |
| 헤더 | `GamerIN`(Label, `text/brand`, 대문자·자간 넓힘 없음) + 제목(Display). 제목은 `다시 오신 걸 환영해요`(F18) |
| 개발 단계 안내 | `bg/brand-subtle`, `radius/md`, 패딩 `space/3`, Label Regular, `text/brand`. 테두리 없음 |
| OAuth 오류 | 같은 구조에 `bg/danger-subtle` + `text/danger` |
| Google 버튼 | Button Secondary Medium, 높이 48, 폭 100%, `/google.png` 20px + `Google로 계속하기` |
| ID 로그인 | 토글 대신 `또는 아이디로 로그인` 구분선(Caption, `text/tertiary`, 양옆 `border/default` 선)과 항상 펼친 폼을 제안한다. 입력은 Input(아이콘 없음, 높이 48), 비밀번호 칸 오른쪽에 눈 아이콘 `icon/secondary`. 토글은 없앤다(F19) |
| 로그인 버튼 | Button Primary Medium, 높이 48, 폭 100%(검정 → 노랑). 로딩 문구(`로그인 중...`, `이전 세션 정리 중...`)는 그대로 둔다. |
| 링크 | 왼쪽 `아이디 찾기 · 비밀번호 찾기`(Label, `text/secondary`), 오른쪽 `이용약관 개인정보 처리방침`(Caption, `text/tertiary`) |
| 회원가입 | `border/default` 구분선 아래 `아직 계정이 없으신가요?`(Body, `text/secondary`) + `회원가입`(Body Strong, `text/primary`) |
| 모바일 | 브랜드 패널을 숨기고 폼 위에 로고 96px. 좌우 여백 `space/5` |

## 6. Figma 작업 제약 기록과 잔여 자산

| 항목 | 내용 |
|---|---|
| 페이지 3개 제한 | Starter 플랜 제약으로 `Foundations`(표지 + 기초 문서) / `Components` / `Screens` 3페이지로 구성했다. |
| 변수 모드 1개 제한 | 라이트/다크를 한 컬렉션의 두 모드가 아니라, 이름 구조가 같은 두 컬렉션(`Color · Light`, `Color · Dark`)으로 만들었다. 다크 화면은 복제본이라 컴포넌트를 고쳐도 자동으로 따라오지 않는다. Professional 이상이면 두 모드로 합칠 수 있다. |
| MCP 호출 한도 | 한도에 걸려 아래 항목을 Figma에 반영하지 못했다. |
| 미반영 1 | D10 대비 수정: `Color · Light`의 `text/secondary` → `neutral/600`, `text/tertiary` → `neutral/500` / `Color · Dark`의 `text/tertiary` → `neutral/500`. Foundations 문서 색상표의 해당 행 값도 함께 고쳐야 한다. |
| 미반영 2 | 로그인 화면(5-2절) |
| 미반영 3 | 모바일 홈 카드의 미디어 높이를 200px로 줄이려 했으나, 인스턴스 안쪽 프레임 높이는 override할 수 없어 300px로 남았다. |

**2026-11-05 갱신:** 새 계정의 Student 플랜 팀으로 파일을 새로 만들어 페이지 수·모드 수 제약이 없어졌다. 미반영 1(D10)과 미반영 3(F10)은 새 파일에서 해결했다.

**2026-11-08 정리(기존 제작 기록 기준):**

- 미반영 2는 해결됐다. 전체 로그인 페이지 시안은 이전 기록이며, 현행 F25 중앙 모달 6종과 PNG를 제작했다([명세](login-modal.md)).
- 초기 파일의 컴포넌트 세트 8개와 화면 3개는 새 파일로 옮기지 않았다. Plugin API로는 파일 간 노드 복사가 되지 않는다. 원본이 필요하면 Figma에서 초기 파일을 복제한다.

## 7. 코드 반영 현황 (주요 화면 병합 완료)

1~4단계와 설정·계정·공통 모달 후속은 PR #200까지 통합 브랜치에 병합했다. 아래는 단계별 구현 범위다. 5번 전체 폰트 통일은 2026-11-09 적용, 6번 관리자는 제외, 7번 검증은 8-1절의 PR별 기록과 9절의 미검증 항목을 구분한다.

아래는 확정안(다크 기본 + Amber, L2) 기준이다.

1. `globals.css`에 2-2절 토큰을 CSS 변수로 추가하고, `@theme inline`에 연결한다. 다크 표면은 이후 `e86c699`의 밝기 조정값을 사용한다(2-1-1절). 기본 테마는 다크로 바꾸고 라이트/다크 선택은 유지한다(F16). PR #195에서 서버 저장과 로그인·세션 복원 동기화까지 반영했다. 게스트와 서버 값이 null인 경우 기기 캐시 또는 기본 dark를 유지한다.
2. `btn-primary`, `btn-secondary`, `input-base`, `page-title` 등 기존 유틸리티를 새 토큰 기준으로 바꾼다. 유틸리티를 쓰는 화면은 한 번에 바뀐다.
3. 앱 셸(L2): `Header` 제거, `Sidebar`에 검색·알림 메뉴와 하단 계정 카드(마일리지) 추가, 세 칸 가운데 정렬. 검색·알림 슬라이드 패널은 기존 `Header.tsx`의 검색 제출과 `NotificationPanel`의 데이터·동작(무한 스크롤, 모두 읽음, Esc 닫기)을 옮겨 쓴다. 모바일은 상단 바 + `MobileTabBar`를 유지하고 알림 페이지 route를 새로 만든다. 같은 단계에서 웹앱 설정(매니페스트, iOS 메타, 안전 영역, 앱 안 이동 통일)을 함께 넣는다(10절).
4. `Post` / `PostComposer` / 각 페이지(검색 결과, 북마크, 프로필, 지갑, 멘토링, 멤버십) / 로그인 화면 순서로 화면 단위 PR로 적용한다. 첫 묶음(브랜치 `feat/design-v2-post`, PR #180)은 `Post`·`PostComposer`·홈 피드(탭, 오류 화면 F22 문구)·임시 카드·스켈레톤이다. 게시물이 모든 폭에서 카드가 되어 검색·해시태그·북마크·프로필 목록의 모바일 여백(16px)과 간격(12px)도 함께 맞췄다. 시안과 다르게 둔 것: 조회수(첫 묶음 당시 응답에 값이 없었다. 이후 백엔드 wishufeeldasame/gamerin_backend#188과 브랜치 `feat/design-v2-view-count`로 액션 줄에 넣었다(F24). 대표 티어 엠블럼(F23)은 백엔드 #179와 프론트 PR #182로 구현했다), 메타 줄 게임 이름(만들지 않음, F23), 작성창 placeholder(코드 문구 유지), 멘션 색(해시태그와 구분하려고 하늘색 유지), 라이트 모드 카드·액션 바 포커스 색(`yellow/500`은 흰 카드 위 대비가 3:1에 못 미쳐 `text/brand` `#7D5310`, 다크는 `border/focus` 그대로). 둘째 묶음(브랜치 `feat/design-v2-post-detail`, PR #181)은 게시물 상세다. 게시물 카드와 댓글을 각각 `rounded-card` 카드로 나누고, 모든 폭에서 `‹ 게시물` 뒤로 헤더를 둔다. 모바일은 앱 상단 바 대신 이 헤더가 위에 붙는다(F15). 시안과 다르게 둔 것: 조회수(첫 묶음과 같음. 이후 F24로 추가. 티어 엠블럼은 #182에서 추가), 댓글 줄의 `@핸들`(유지), 댓글 글자 수(입력 중에만 입력창 아래 표시). 이후 대표 티어 엠블럼과 대표 게임 설정(PR #182), 발로란트 전적 연동 화면(PR #184, 원 PR #183), 게시물 조회수 표시와 카드 노출 집계(브랜치 `feat/design-v2-view-count`, F24)가 같은 브랜치에 들어갔다(8절). 셋째 묶음(브랜치 `feat/design-v2-search-bookmark`)은 검색 결과·해시태그·북마크다. 세 화면 모두 홈과 같은 본문 + 오른쪽 열 구성이고, 빈·오류 상태는 홈 오류 화면과 같은 카드다. 검색 결과는 버튼 없는 검색창(Enter 제출), 왼쪽 정렬 탭 밑줄, 카드 없는 사용자 행, `#이름 · 개수` 해시태그 칩, 섹션 `모두 보기`다. 해시태그는 모바일에서 앱 상단 바 대신 `‹ #이름` 뒤로 헤더를 쓰고(F15), 데스크톱은 시안대로 제목만 둔다. 북마크는 모음집 목록을 xl(1280) 이상에서 오른쪽 열(F8), 그 아래 폭에서 제목 아래 가로 칩으로 둔다(DOM은 한 벌). 시안의 `+ 새 모음집`을 넣었다(이름 입력 → `createCollection`). 사이드바 `검색` 메뉴는 `/search`·`/hashtags/*`에서 활성이다. 시안과 다르게 둔 것: 검색 결과 사용자 행의 `팔로우` 버튼과 `발로란트 Diamond 2`·`팔로워 1.2만` 글자(검색 응답에 팔로우 상태·팔로워 수가 없다. 티어는 F23대로 엠블럼만), 검색 오른쪽 열은 이용약관 줄만 표시(추천 친구는 홈·프로필에서 표시하며 PR #196으로 실제 API 사용), 북마크 `전체 북마크`·`미분류` 개수(총개수 API가 없다. 헤더 `· N개`는 조회 오류 없이 목록을 끝까지 불러왔을 때만 붙인다), 북마크 검색창·`미디어만` 토글(시안에 없지만 기존 기능이라 헤더 아래 한 줄로 남겼다), 북마크 빈 상태 문구(시안 `아직 저장한 게시물이 없어요` 대신 코드 문구 `아직 저장한 게시글이 없습니다` 유지), 모바일 모음집 칩 끝의 `+ 새 모음집`(모바일 시안에는 없다), 1024~1279 폭의 북마크(시안 없음. 오른쪽 열 대신 칩을 쓴다), 게시물 카드의 게임 이름(첫 묶음과 같다. 조회수는 F24로 들어갔다).
   - 넷째 묶음(`feat/design-v2-profile`)은 프로필이다. F6·F12·F14에 맞춰 기본 커버·원형 아바타·설정과 수정 버튼을 배치했다. 게시글·전적·미디어 탭은 xl(1280px) 이상에서 본문 600px과 스크롤에 고정되는 전적 요약 열 300px(F8)을 함께 유지한다. 오른쪽 열에는 전적 요약 아래 추천 친구 카드를 둔다(PR #190의 예시는 PR #196에서 실제 API로 교체). 그 아래 폭에서는 본문 한 열을 쓰며, 전적 탭의 게임별 지표 카드는 본문에 표시한다. 탭은 방향키·Home·End로 전환하고, 미디어는 3열 썸네일로 표시한다. 내 프로필의 lg 미만 마일리지 카드는 기존 잔액 API와 지갑 링크를 쓴다(F9).
   - 시안과 다른 점은 기존 데이터와 동작을 따른다. 2026-11-08 사용자 결정으로 별도 미디어 계정 연결 UI와 브라우저 저장 로직을 제거했다. 프로필 웹사이트 링크는 기존 PATCH /api/v1/users/me와 user_profiles.website를 사용한다. 전적 탭의 추가·새로고침·해제와 갱신 시각은 유지한다. 사이드바와 마일리지 카드는 폭에 따라 각각 잔액을 읽는다. 표시 이름 옆은 멤버십 배지와 대표 티어 엠블럼(F23)을 사용한다.
   - 다섯째 묶음(`feat/design-v2-wallet`)은 내 지갑이다. F8의 940px 본문 안에서 xl(1280px) 이상은 잔액·충전과 내역을 좌우에 놓고, 그 아래에서는 한 열로 쌓는다. 충전 상품은 모든 폭에서 2열이며 서버 상품만 표시하고 사용자가 고르기 전에는 결제 버튼을 비활성화한다. 모바일은 뒤로 헤더(F15)와 잔액 아래 멤버십 링크(F7)를 쓴다. 내역 탭은 방향키·Home·End로 전환한다. 카카오페이 확인창은 데스크톱 중앙 모달, 모바일 하단 시트다. 팝업 다시 열기·결제 중단, 내역 설명·시각과 금액 단위는 기존 표시를 따른다.
   - 여섯째 묶음(`feat/design-v2-mentoring`)은 멘토링이다. F8의 940px 한 열 안에서 프로그램과 신청 내역을 xl 이상 두 열, 그 아래 한 열로 배치한다. 밑줄 탭과 `/games` 기반 게임 필터 버튼, 공통 마일리지 헤더, 멘토 등록·프로그램 작성 폼을 Amber 토큰에 맞춘다. 탭은 방향키·Home·End로 전환하고, 평점은 라디오 그룹으로 한 값을 선택한다. 프로그램 상세·리뷰·마일리지 부족 안내는 데스크톱 중앙 모달과 모바일 하단 시트를 쓴다(F15). 프로그램의 진행 시간과 방식·가격, 신청 상태와 수수료는 기존 API 값을 표시한다.
   - 일곱째 묶음(`feat/design-v2-membership`)은 멤버십이다. F8의 940px 본문 안에서 시안의 640px 이용권·혜택 카드를 세로로 배치한다. F15의 모바일 뒤로 헤더는 이전 기록이 없으면 지갑으로 이동한다. 미가입·이용 중·만료·상품 없음·조회 오류를 기존 API 값으로 구분하고, 결제는 지갑과 같은 `KakaoPaymentDialog`를 쓴다. 혜택 세 개와 수수료 안내는 한 카드로 모으며 노란 체크 배지 문구(F11)를 유지한다.
   - 여덟째 묶음(PR #198, 병합 완료)은 메시지다. 데스크톱은 940px 패널 안에 목록 340px과 대화를 나란히 두고, 768~1279px에서는 목록 280px을 쓴다. 768px 미만에서는 기존 목록·대화 전환을 유지하며 대화를 열 때 앱 상단 바와 하단 탭을 숨긴다. 뒤로 버튼으로 목록에 돌아오면 두 바를 복원한다(F15). 원형 아바타·회색 선택 행·브랜드 노랑 보낸 말풍선(전송 대기·실패 포함, `de69216`)·40px 입력/전송 버튼과 로딩·오류·빈 상태에 v2 토큰을 적용했다. 상대 헤더의 고정 파란 인증 아이콘은 실제 멤버십·대표 티어 배지로 교체했다. SSE·첨부 인증 fetch·낙관적 전송·재시도·검색·삭제·나가기는 기존 흐름을 유지한다. 시안과 달리 목록 핸들·첨부 파일명·읽음/보냄 상태·메시지 액션을 남겼고, 시간은 말풍선 아래에 표시한다. 대화 수는 스크린리더용으로 유지한다. `e2e/design-v2-messages.spec.ts`에서 라이트·다크의 390/768/1024/1440px 전환과 320px 긴 메시지 줄바꿈을 검증한다. 실제 서버 SSE·실기기 키보드는 별도 확인이 필요하다.
   - 후속 설정·계정(PR #195·#199)은 테마 서버 동기화, 계정/개인화 탭과 640px 카드, 대표 게임 설정, 약관 동의 후 가입 정보 입력 2단계, 복구·소셜 가입·OAuth 상태·공용 인증 컴포넌트를 정리했다.
   - 공통 모달·기타(PR #200)는 공유·전적 연결·프로필/게시글 수정·모음집 저장·신고에 공통 모달 토큰을 적용했다. 1024px 이상 중앙, 그 아래 하단 시트이며 로그인·네이티브 확인창·신고 최종 확인창은 중앙을 유지한다. `modal-overlay`·`modal-panel`·`modal-handle`을 공유하고 입력·선택·로딩·오류 상태를 맞췄다. 전적 입력은 선택 카드 안에서 펼치며 `connectedGames`로 연결 완료/지원 예정 상태를 구분한다. RIOT/LOL은 LoL로 합치고 발로란트는 별개로 판정한다. 결제 결과는 성공·실패·확인 중 상태색과 440px 카드, 약관은 720px 본문·브랜드 고지·가로 스크롤 표를 반영했다. API·DB·결제 승인/relay/polling·약관 본문과 버전은 유지했다. 별도 미디어 계정 연결은 제거했다.
5. **2026-11-09 적용:** 기존 `admin-font.ts` 로컬 로더와 woff2를 전역에서 재사용한다. html에 `--font-noto-sans-kr` 변수를 연결하고 body와 Tailwind `font-sans`에 적용했다. ID/신고번호의 `font-mono`도 `font-sans`로 통일했다. 100–900 가변 굵기·display swap·preload false를 유지하며 외부 폰트 요청은 없다.
6. 관리자 화면의 별도 팔레트(`#667085`, `#315ef5` 등)는 이번 개편에서 그대로 둔다(F20).
7. 각 단계마다 `npm run lint`, `npm test`, `npm run build`를 실행하고, 라이트·다크와 모바일·데스크톱 화면을 확인한다.

### 공개 탐색·중앙 로그인 모달 (이슈 #187, PR #194 병합 완료)

실제 피드를 `(app)/page.tsx`의 `/`로 옮기고 `/home`·`/login` 페이지·redirect를 제거했다. F25 중앙 모달은 모바일에서도 가운데에 뜨며 F18 제목·F19 상시 펼친 ID 폼을 적용했다. 일반 가입·이메일 인증은 `/signup`으로 보존했다. 공개 API는 optional/public 인증으로 나누고 회원 행동은 편집·낙관적 변경·개인 조회 전에 막는다. 로그인은 개인화만 갱신하며 대기한 쓰기는 재실행하지 않는다. 저장된 복귀 URL만 `/home`을 `/`로 정규화한다. 검색/해시태그·관계 목록은 공개 범위에 넣지 않았다. Figma·최종 PNG는 [모달 명세](login-modal.md) 기준이다.

## 8. 작업 기록

2026-11-08: FE #187 공개 셸·중앙 로그인 모달·라우트 이관·게스트 행동 가드 구현. backend #191의 이메일 미인증 복귀도 새 모달에 맞췄다. 사용자 요청으로 브라우저는 조작하지 않았다.


2026-11-07: FE #187·BE #189 정책을 확인하고 F25 중앙 로그인 모달 시안을 제작했다. 다크·라이트 1440·375·320 PNG 내보내기 완료. 별도 로그인 페이지 제거·공개 셸은 백엔드 계약 후 #187에서 구현한다.


| 일자 | 내용 |
|---|---|
| 2026-11-04 | 코드 진단(1절). Figma 파일 생성, 변수 93개(Primitives 33, Light·Dark 각 24, Dimension 12), 텍스트 스타일 7개, 이펙트 스타일 2개 생성 |
| 2026-11-04 | 아이콘 21종, 컴포넌트 세트 8개, Post Card·Post Composer 생성 |
| 2026-11-04 | 홈 피드 화면 3개(데스크톱 Light/Dark, 모바일) 생성. Foundations 문서 페이지 작성. 각 결과물을 Figma 스크린샷으로 확인 |
| 2026-11-04 | D10 대비 문제 발견. Figma 반영 전에 MCP 호출 한도에 걸림. 로그인 화면은 이 문서에 명세만 작성 |
| 2026-11-05 | 기존 화면과 v2 비교 검토. 1절 진단 정정(라이트 모드 헤더는 노랑), 피드 탭 이름 정정(`추천`) |
| 2026-11-05 | 시안 A: 실제 앱을 E2E 픽스처로 띄워 v2 색 override만 주입해 홈·프로필 before/after 캡처 |
| 2026-11-05 | 시안 T(Twitter형)·B(현재 골격 변형) 제작 후 사용자 피드백으로 반려 |
| 2026-11-05 | 시안 C(Figma v2 구성 정리), 시안 D(다크·Volt) 제작. 시안과 재현 소스를 `mockups/`에 저장 |
| 2026-11-05 | 새 계정(Student 플랜)에 Figma 파일을 새로 만들고 토큰·스타일을 옮김(D10 반영, Light/Dark 모드 통합, `Brand` 컬렉션 추가) |
| 2026-11-05 | 시안 D 반려("딸깍"·양산형 느낌). 다크 공통 레이아웃에 색만 바꾼 시안 E~J 제작, 사용자가 J(Amber)·H(Violet)로 좁힘 |
| 2026-11-05 | 레이아웃 L1(헤더 정렬형)·L2(사이드바 통합형) 비교 후 L2 채택. 검색 메뉴화, 알림·검색 슬라이드 패널 |
| 2026-11-05 | L2 비평과 수정(F2·F3·F6, D10 Dark `neutral/450`, 가운데 정렬). 데스크톱 6개 화면, 탭·상태 화면 11종, 모바일 8개 화면, 멤버십 화면 제작 |
| 2026-11-05 | 브랜드 색 Amber 확정. 확정 화면 이미지를 `mockups/final-amber/`에 저장 |
| 2026-11-05 | 데스크톱 21개 화면 FHD(1920×1080) 버전 제작(`Screens · FHD`) |
| 2026-11-05 | 프로필 커버 추가(F12, 11개 화면). 라이트 모드 29개 화면 제작과 `border/card` 추가(F13). 이미지를 `mockups/final-amber/light/`에 저장하고 프로필 이미지 교체 |
| 2026-11-05 | 관리자를 뺀 나머지 화면 31종을 데스크톱·모바일 × 다크·라이트(126장)로 제작(F15). 내 프로필 설정 버튼 추가(F14, 15개 화면). 이미지를 `mockups/final-amber/more/`에 저장. 웹앱 고려사항 정리(10절) |
| 2026-11-05 | 4단계 첫 묶음: `Post`·`PostComposer`·홈 피드에 확정안 적용(카드·접힘/펼침 작성창·`#` 버튼·탭 밑줄·오류 화면). 데스크톱 다크·라이트, 모바일 다크 화면으로 확인 |
| 2026-11-06 | 4단계 둘째 묶음: 게시물 상세(`PostDetail`)에 확정안 적용(뒤로 헤더, 게시물·댓글 카드, 댓글 입력 `등록` 버튼, 관련 게시물 카드). 데스크톱 다크, 모바일 다크·라이트(375·320)로 확인 |
| 2026-11-06 | 4단계 대표 티어(PR #182, 백엔드 #179, F23): 닉네임 옆에 대표 게임 티어 엠블럼만 표시(사이드바 계정 카드, 프로필 이름 옆·팔로워 목록, 게시물 카드·상세·댓글, 검색 결과, 멘토링, DM, 알림). 설정 화면에서 연동한 게임 중 대표 게임을 고르는 `RepresentativeGameSetting` 추가 |
| 2026-11-06 | 발로란트 전적 연동 화면(PR #183, 백엔드 #178). `feature/design-v2`에는 PR #184로 반영: 게임 연동 모달(`FetchGameStatsModal`), 프로필 전적 표시, 개인정보 처리방침 문구와 버전(1.1) |
| 2026-11-06 | 게임 연동 모달에서 게임별 국외 전송 동의 체크 제거(`d5b3e03`). 국외 조회처는 개인정보 처리방침 제8조로 고지한다 |
| 2026-11-06 | 게시물 조회수(프론트 PR #186, 백엔드 #188, F24): 카드·상세 액션 줄에 조회수 표시(`PostViewCount`, `formatViewCount`), 카드 노출 집계 훅 `usePostViewImpression`, 목 API에 `viewCount`·`POST /posts/views` 추가. 데스크톱·모바일 × 다크·라이트로 확인 |
| 2026-11-06 | 4단계 셋째 묶음(PR #185): 검색 결과·해시태그·북마크에 확정안 적용(검색창·탭·사용자 행·해시태그 칩, 해시태그 모바일 뒤로 헤더, 북마크 오른쪽 열 모음집 목록·가로 칩·`+ 새 모음집`, 사이드바 검색 활성). 데스크톱(1440·1100) 다크·라이트, 모바일 375·320 다크·라이트로 확인 |
| 2026-11-06 | 4단계 넷째 묶음(PR #188): 프로필 확정안 적용. 리뷰 반영으로 전적 요약 고정, 전적 탭 본문 확장, 탭 키보드 조작, 프로필 빈·오류 상태와 메뉴·모달 토큰, 잔액 훅 테스트를 추가했다. 연결된 미디어 계정의 v2 반영은 마지막으로 미뤘다 |
| 2026-11-06 | 4단계 다섯째 묶음: 내 지갑에 Amber 시안, 모바일 뒤로 헤더, 결제 확인 시트를 반영했다. Chromium 목 API에서 1440·375·320px 다크·라이트와 PC 팝업·모바일 결제 흐름을 확인했다 |
| 2026-11-06 | 공통 다크 팔레트 밝기 조정. 앱 셸·프로필 기본 커버·웹앱 초기 색상과 Figma 변수·최종 시안을 동기화했다 |

### 8-1. PR·커밋 기반 통합 기록 (2026-11-08 확인)

아래 PR은 모두 `feature/design-v2` 대상이며 GitHub에서 `merged: true`와 병합 SHA를 확인했다. 로컬에 가져온 원격 브랜치의 커밋 이력과 대조했다. 날짜는 한국 시간 병합일이며, 구현 기록일과 다를 수 있다. `PR 최종 head`는 여러 커밋을 포함할 수 있고, `병합 커밋`은 통합 완료 근거다.

| 병합일(KST) | 범위 | PR | PR 최종 head | 병합 커밋 |
|---|---|---|---|---|
| 2026-11-05 | 토큰·공통 유틸리티·앱 셸·웹앱 | [#179](https://github.com/wishufeeldasame/gamerin_frontend/pull/179) | [`2c24b3f`](https://github.com/wishufeeldasame/gamerin_frontend/commit/2c24b3f231a4baf57e46f88de7eb7f1536af27c4) | [`d240633`](https://github.com/wishufeeldasame/gamerin_frontend/commit/d240633cc7aa2b97389dad0da67ca4c90c8e18f0) |
| 2026-11-06 | 게시물 카드·작성창·홈 | [#180](https://github.com/wishufeeldasame/gamerin_frontend/pull/180) | [`8bf972c`](https://github.com/wishufeeldasame/gamerin_frontend/commit/8bf972c4d41db8073e2adddfdfdb58feedf2f57a) | [`e96a960`](https://github.com/wishufeeldasame/gamerin_frontend/commit/e96a9601ce9cb44473ebccb6ce8253185485a6fa) |
| 2026-11-06 | 게시물 상세 | [#181](https://github.com/wishufeeldasame/gamerin_frontend/pull/181) | [`74d730e`](https://github.com/wishufeeldasame/gamerin_frontend/commit/74d730e682b82b31fc304bcabca1a407d74a54cf) | [`dce9f29`](https://github.com/wishufeeldasame/gamerin_frontend/commit/dce9f29a21ef9c7df066a5e8116df72da62ffc3d) |
| 2026-11-06 | 대표 티어·대표 게임 | [#182](https://github.com/wishufeeldasame/gamerin_frontend/pull/182) | [`58da967`](https://github.com/wishufeeldasame/gamerin_frontend/commit/58da96768bd1945a54f19b908599b1d6df941b7e) | [`fd99ad5`](https://github.com/wishufeeldasame/gamerin_frontend/commit/fd99ad545e8e8deecb4fb3cb5b92e3f10c0cd3f3) |
| 2026-11-06 | 발로란트 전적 연동 반영 | [#184](https://github.com/wishufeeldasame/gamerin_frontend/pull/184) | [`d5b3e03`](https://github.com/wishufeeldasame/gamerin_frontend/commit/d5b3e03ad9c396f5f7d40d5e5649cd30f36f39e8) | [`1a2be36`](https://github.com/wishufeeldasame/gamerin_frontend/commit/1a2be36f8e56987958d45f0e6590bfe4a679d176) |
| 2026-11-06 | 조회수·카드 노출 집계 | [#186](https://github.com/wishufeeldasame/gamerin_frontend/pull/186) | [`e0aa4e7`](https://github.com/wishufeeldasame/gamerin_frontend/commit/e0aa4e7aaaa7d53c9123fd0553918a05fa474513) | [`89954f1`](https://github.com/wishufeeldasame/gamerin_frontend/commit/89954f161ea6319dde5593eb7aceb53041baa420) |
| 2026-11-06 | 검색·해시태그·북마크 | [#185](https://github.com/wishufeeldasame/gamerin_frontend/pull/185) | [`84a4566`](https://github.com/wishufeeldasame/gamerin_frontend/commit/84a4566e5157b033c0d3749e7421317116c29992) | [`f8e1c53`](https://github.com/wishufeeldasame/gamerin_frontend/commit/f8e1c533e002e3bb570a65a4cf1fe639f4ddd10b) |
| 2026-11-06 | 프로필 | [#188](https://github.com/wishufeeldasame/gamerin_frontend/pull/188) | [`5f0cc8f`](https://github.com/wishufeeldasame/gamerin_frontend/commit/5f0cc8f13cedf492afd7c3e0bb5522f8d977b28d) | [`52553dc`](https://github.com/wishufeeldasame/gamerin_frontend/commit/52553dc0737251a900b3e57f0f1b79e8153b6f86) |
| 2026-11-06 | 내 지갑·다크 팔레트 | [#189](https://github.com/wishufeeldasame/gamerin_frontend/pull/189) | [`2305be8`](https://github.com/wishufeeldasame/gamerin_frontend/commit/2305be887a0cdf60eb1fdcfba1d95e358e9b9a02) | [`b4f9757`](https://github.com/wishufeeldasame/gamerin_frontend/commit/b4f97578d1f146865755af59ced08c56145381f0) |
| 2026-11-06 | 프로필 레이아웃·추천 예시 | [#190](https://github.com/wishufeeldasame/gamerin_frontend/pull/190) | [`42795b6`](https://github.com/wishufeeldasame/gamerin_frontend/commit/42795b6899e878317091042181eadaf13345dffb) | [`97c44af`](https://github.com/wishufeeldasame/gamerin_frontend/commit/97c44afa8d7e2f83332f329837f6f5746f21ac3e) |
| 2026-11-07 | 멘토링 | [#191](https://github.com/wishufeeldasame/gamerin_frontend/pull/191) | [`5d1c08f`](https://github.com/wishufeeldasame/gamerin_frontend/commit/5d1c08f2014aff729288bd139e5ec7309533f06f) | [`c81f23c`](https://github.com/wishufeeldasame/gamerin_frontend/commit/c81f23c192fd5249ab5b383fb1c0ede0e3b150e3) |
| 2026-11-07 | 멤버십 | [#193](https://github.com/wishufeeldasame/gamerin_frontend/pull/193) | [`9a3f76f`](https://github.com/wishufeeldasame/gamerin_frontend/commit/9a3f76faf5898951416dcd81e65922d35a1e29a5) | [`1e9a1eb`](https://github.com/wishufeeldasame/gamerin_frontend/commit/1e9a1eb3610c887023c0b5afbd337bf1bed657b0) |
| 2026-11-08 | 공개 탐색·중앙 로그인 모달 | [#194](https://github.com/wishufeeldasame/gamerin_frontend/pull/194) | [`f3baf30`](https://github.com/wishufeeldasame/gamerin_frontend/commit/f3baf3019cbc45747288cefb419d94b3615ab009) | [`6a894b1`](https://github.com/wishufeeldasame/gamerin_frontend/commit/6a894b104e7c37576b5a68273749927c447815c7) |
| 2026-11-08 | 설정 v2·테마 서버 동기화 | [#195](https://github.com/wishufeeldasame/gamerin_frontend/pull/195) | [`8ffb694`](https://github.com/wishufeeldasame/gamerin_frontend/commit/8ffb6945880ef2eb9f550e1cddfa029245b22f47) | [`7bb49a6`](https://github.com/wishufeeldasame/gamerin_frontend/commit/7bb49a6947f1e76d0e592c07477ad76b0b9bfea3) |
| 2026-11-08 | 추천 친구 API 연동 | [#196](https://github.com/wishufeeldasame/gamerin_frontend/pull/196) | [`00832d3`](https://github.com/wishufeeldasame/gamerin_frontend/commit/00832d31026abcae238a15894cc3b8a7ac0d0c19) | [`3aab91d`](https://github.com/wishufeeldasame/gamerin_frontend/commit/3aab91d8c963c6cb175ba739062d59073b4780a3) |
| 2026-11-08 | 메시지·보낸 말풍선 색 | [#198](https://github.com/wishufeeldasame/gamerin_frontend/pull/198) | [`de69216`](https://github.com/wishufeeldasame/gamerin_frontend/commit/de69216b513a864e58587cdbda33e90e306e6792) | [`7056e34`](https://github.com/wishufeeldasame/gamerin_frontend/commit/7056e344f99151f3327d4e30e3420b935cb3e535) |
| 2026-11-08 | 가입·복구·설정 후속·로고 | [#199](https://github.com/wishufeeldasame/gamerin_frontend/pull/199) | [`d8a7ffa`](https://github.com/wishufeeldasame/gamerin_frontend/commit/d8a7ffa47ac50a5d1b4c6ce9c4b0c57ccffe3998) | [`b0ac95f`](https://github.com/wishufeeldasame/gamerin_frontend/commit/b0ac95f669debebc27ee3caf7f3e2e6dc2d26065) |
| 2026-11-08 | 공통 모달·결제 결과·약관·미디어 연결 제거 | [#200](https://github.com/wishufeeldasame/gamerin_frontend/pull/200) | [`d5e8a77`](https://github.com/wishufeeldasame/gamerin_frontend/commit/d5e8a77dfc3ced4181c0419791e092fe24723140) | [`a69469d`](https://github.com/wishufeeldasame/gamerin_frontend/commit/a69469d5a6ebd5b82da5c3cc31766398f43e0e31) |

주요 구현 커밋: 토큰 `5ff7e44`, 공통 유틸리티 `5e22de5`, 앱 셸 `24757c5`, 밝아진 다크 팔레트 `e86c699`, 멘토링 `c15e489`, 테마 서버 연동 `0be17cf`, 추천 API `40c8d62`, 메시지 `5dbfd32`·말풍선 후속 `de69216`, 계정 후속 `3de177a`, 공통 모달 `e1ed21d`, 미디어 계정 연결 제거 `d5e8a77`.

검증은 **각 PR 본문에 기록된 당시 결과**다. 이번 문서 갱신에서 앱 테스트·빌드를 다시 실행하지 않았다.

| PR | 기록된 검증 | 남은 확인 |
|---|---|---|
| #194 | 최종 후속 단위/컴포넌트 1,144개, lint·build 통과. Playwright 579개 수집. 로컬 nginx 경유 공개/보호 API·라우트 확인 | 브라우저 E2E 실행·Google 실로그인 미실행 |
| #195 | 관련 단위 38개, lint·타입·build 통과. 프론트 컨테이너·`/settings` 200 확인 | 실제 다중 기기 테마 동기화는 별도 확인 |
| #196 | 전체 단위 1,162개, src lint·타입·build 통과 | 로그인 실서버 추천 조회·팔로우와 브라우저 확인 |
| #198 | 전체 단위 1,162개(메시지 관련 128개 포함), 신규 E2E 9개·기존 메시지 64개, 타입·build 통과. 말풍선 색 후속은 관련 128개·E2E 73개 재검증 | 색 후속에서 전체 build 재실행 안 함. 실서버 SSE·첨부·iOS 키보드 미검증 |
| #199 | 전체 단위 1,166개·lint·build 통과. 인증·설정 E2E 최초 105개 중 99개 통과, 오래된 기대값 6개 수정 후 관련 8개 통과 | 105개 전체를 수정 후 다시 통과한 기록은 아님. 실제 이메일·Google·iOS 미검증 |
| #200 | 전체 단위 1,170개·E2E 20개·타입·build·공백 검사 통과. lint는 기존 캡처 스크립트 경고 1개 | 실결제·외부 전적 API·iOS·프로덕션 브라우저 미검증 |

전체 단위 테스트 수는 PR별 시점 값이다. 기본 `npm test`·lint는 중첩 `.claude/worktrees`를 수집해 실패한 기록이 있어, `--dir src` 또는 `--exclude '.claude/**'`, lint의 `--ignore-pattern '.claude/**'`로 검증한 결과와 구분한다. 이는 이번 작업에서 재현한 결과가 아니다.

백엔드 의존 PR도 병합을 확인했다: [대표 티어 #184](https://github.com/wishufeeldasame/gamerin_backend/pull/184), [테마 저장 #190](https://github.com/wishufeeldasame/gamerin_backend/pull/190), [공개 탐색 #191](https://github.com/wishufeeldasame/gamerin_backend/pull/191), [추천 친구 #192](https://github.com/wishufeeldasame/gamerin_backend/pull/192). 운영 배포 여부는 확인하지 않았다.

## 9. 확정 상태와 다음 단계

| 항목 | 현재 상태 |
|---|---|
| 브랜드·레이아웃 | 다크 기본 + Amber `#F5B93D`, L2 확정·적용. 워드마크 IN은 `#F8C24A`. 좋아요는 F17의 빨강 하트·보조색 숫자 |
| 주요 화면 | 8-1절의 PR #179~#200 병합 완료. 최종 기준 `a69469d`. 개발·운영 브랜치 병합이나 운영 배포 완료로 해석하지 않는다 |
| 로그인·계정 | 이슈 #187은 PR #194로 완료. F25 중앙 모달·공개 `/`·`/signup`. 가입·복구·설정 후속도 #199 병합 완료 |
| 테마 저장 | #195 완료. 서버 LIGHT/DARK 저장·로그인/복원 동기화, null이면 기기 캐시/기본 dark, 관리자는 라이트 강제 유지 |
| 추천 친구 | #196 실제 API 연동 완료. #190 예시 카드는 대체됨. 서버 배포·로그인 실서버 확인 별도 |
| 공통 모달·기타 | #200 병합 완료. 1024px 이상 중앙·그 아래 시트. 로그인과 네이티브 확인창·신고 최종 확인창은 중앙 유지 |
| 미디어 계정 | #200에서 별도 연결 제거. 프로필 웹사이트 링크·게시물 미디어·게임 전적은 유지. 기존 브라우저 저장값 삭제 작업은 하지 않음 |
| 앱 전체 폰트 | 2026-11-09 Noto Sans KR 전역 적용. 일반·인증·법적 문서·관리자 및 번호 표시의 글꼴 통일. 기존 로더·파일 재사용, display swap·preload false |
| Figma 잔여 자산 | 초기 파일의 컴포넌트 세트 8개·화면 3개는 현행 파일로 미이관. FHD 라이트, 프로그램 만들기·리뷰 작성·알림 빈 상태·모바일 탭/상태·멤버십 로딩/오류·중간 폭 전용 시안은 기존 기록상 미제작. 이번에는 Figma를 재조회하지 않았으며 코드 미구현 목록과 다름 |
| 시안과 코드 차이 | 좋아요 색(F17), 라이트 사이드바 활성색(F21), 대표 티어 엠블럼(F23), 메시지 노랑 말풍선, 실제 추천 API·웹사이트 링크, 가입 2단계는 코드·후속 결정이 기준. 이전 PNG를 현재 화면과 동일하다고 보지 않음 |
| 관리자 | F20에 따라 이번 개편 제외 |
| 임시 목 API | 2026-11-09 `scripts/dev-mock-api.mjs`와 `dev:mock` 제거. Playwright route fixture와 Vitest mock은 독립 유지 |
| 최종 검증 | 실서버 추천·SSE/첨부, 이메일·Google 로그인, 실결제·외부 게임 API, iOS 키보드·안전 영역·상태 표시줄·홈 화면 앱 확인 필요. PR별 mock/Chromium 결과와 구분 |

프로필 헤더에서는 멤버십 배지와 대표 티어 엠블럼을 독립적으로 표시한다. 둘 다 해당하면 닉네임, 멤버십 배지, 대표 티어 엠블럼 순으로 표시한다. 로컬 프로덕션 컨테이너에서 고밀도 화면용 발로란트 티어 엠블럼의 `/_next/image` 48px 요청이 504를 반환했다. 대표 티어 배지만 런타임 변환을 건너뛰고 번들에 포함된 정적 파일을 읽는다.

## 10. 웹앱(데스크톱·iOS 홈 화면 앱) 고려사항

브라우저 탭뿐 아니라 설치형 웹앱(데스크톱 Chrome·Edge 설치, iOS "홈 화면에 추가")으로 쓰는 경우도 함께 고려한다.

### 10-1. 3단계 전 코드 상태 (확인한 사실, 2026-11-05)

| 항목 | 상태 | 근거 |
|---|---|---|
| 웹 앱 매니페스트 | 없음. `src/app/manifest.ts`, `public/manifest.webmanifest`가 없다. CSP에는 `manifest-src 'self'`가 이미 있다. | `next.config.ts:61` |
| iOS 웹앱 메타 | 없음. `metadata`에 `appleWebApp`·`icons`가 없어 `apple-mobile-web-app-capable`·`apple-touch-icon`이 나가지 않는다. `public/`에는 `logo.png`, `google.png`만 있고 앱 아이콘 크기별 파일이 없다. | `src/app/layout.tsx:9-12` |
| viewport | `viewport-fit=cover`만 지정. `themeColor` 없음. | `src/app/layout.tsx:15-19` |
| 하단 안전 영역 | 모바일 하단 탭 바가 `pb-[env(safe-area-inset-bottom)]`로 홈 인디케이터를 피한다. 상단 안전 영역 처리는 없다. | `Sidebar.tsx:42` |
| 앱 안 이동 | 대부분 Next `<Link>`·`router`의 클라이언트 이동이다. 전체 페이지를 새로 여는 이동은 다음뿐이다: 멤버십 이동 `window.location.assign('/membership')`, 결제 결과 `location.replace`, 카카오페이 `location.assign(paymentUrl)`·`window.open` 팝업, Google 로그인 `location.href = {API}/oauth2/authorization/google`, 외부 링크 `target="_blank"`(프로필 연결 계정·웹사이트, 약관 동의 링크). | `Post.tsx:370`, `PostDetail.tsx:544`, `payments/result/page.tsx:94`, `KakaoPaymentDialog.tsx:123·161`, `login/page.tsx:229`, `profile/[userId]/page.tsx:937·953·1177`, `SignupConsent.tsx:78·93` |

3단계 반영 결과(브랜치 `feat/design-v2-tokens`):

| 항목 | 반영 |
|---|---|
| 매니페스트 | `src/app/manifest.ts`(`start_url /`(PR #194에서 변경), `scope /`, `display standalone`, 바탕·테마 `#19191D`). 아이콘은 `public/icons/`에 192·512·maskable 512(`logo.png` 가운데를 노란 바탕에 얹음) |
| iOS 메타 | `appleWebApp`(`capable`, `title GamerIN`, `statusBarStyle black-translucent`), `icons.apple` 180. Next 15는 `capable`을 `mobile-web-app-capable`로만 내보내서 `apple-mobile-web-app-capable`을 `other`로 따로 넣었다 |
| theme-color | `viewport.themeColor #19191D`. 라이트 테마면 첫 화면 스크립트와 `applyThemeMode`가 `#FAFAFA`로 바꾼다. `media`별 지정(10-2 제안 3)은 앱 테마가 OS 설정과 따로 움직여서 쓰지 않았다 |
| 안전 영역 | 모바일 상단 바·알림 페이지 헤더·전체 화면 검색에 `env(safe-area-inset-top)`, `--app-header-height`가 상단 바 높이를 포함한다 |
| 앱 안 이동 | 멤버십 이동을 `router.push('/membership')`로 바꿨다(`Post.tsx`, `PostDetail.tsx`) |

### 10-2. iOS 홈 화면 앱의 하단 Safari 조작창 문제

**증상(사용자 보고):** iOS에서 홈 화면에 추가해 웹앱으로 열면, 프로필·메시지 같은 다른 페이지로 갈 때 화면 아래에 Safari 조작창(뒤로·앞으로 등)이 떠서 불편하다.

**초기 원인 후보 — 3단계 반영 전 추정 기록, 실기기 재현 필요**

아래 선언 누락은 3단계에서 해결했다. 현행 코드의 원인으로 확정하지 않는다.

1. **웹앱 선언이 없다.** 매니페스트와 iOS 웹앱 메타가 없으면 iOS가 사이트를 정식 웹앱으로 다루지 않는다. iOS 버전과 "웹 앱으로 열기" 설정에 따라 홈 화면 아이콘이 일반 Safari로 열리거나, 시작 주소에서 추론한 범위(scope)로만 독립 실행된다. 범위가 좁게 잡히면 다른 경로로 이동할 때 범위 밖으로 처리될 수 있다.
2. **범위 밖·다른 origin으로 이동한다.** 독립 실행 중에 매니페스트 `scope` 밖이나 다른 origin으로 가면 iOS가 브라우저 조작 UI를 보여 준다. 다음 경우 같은 앱 안 이동도 범위 밖이 될 수 있다.
   - http→https 리다이렉트
   - www·비www 혼용
   - 로컬 개발에서 3000 → 8080으로 가는 주소
3. 앱 안 이동은 대부분 클라이언트 이동이라, 프로필·메시지 이동 자체가 전체 페이지를 새로 여는 경우는 코드에서 찾지 못했다. 그래서 1·2가 더 유력하다고 본다(추정).

**확인 방법**

- 운영 주소를 실기기에서 홈 화면에 추가한 뒤, 조작창이 뜨는 이동을 기록한다. 클라이언트 이동, 새로고침, 외부 링크를 구분한다.
- iOS 버전과 홈 화면 추가 시 "웹 앱으로 열기" 선택 여부를 기록한다.
- 맥 Safari 웹 속성(개발자 메뉴)으로 `navigator.standalone`, `matchMedia('(display-mode: standalone)').matches` 값과 실제 주소(origin·경로)를 확인한다.

**초기 개선 방향 (반영 결과는 10-1절 표 참고)**

1. `src/app/manifest.ts`를 추가한다.
   - `name`·`short_name`: `GamerIN`
   - `start_url: '/'`(PR #194 이후 현행 경로), `scope: '/'`, `display: 'standalone'`
   - `background_color`·`theme_color`: 다크 기본 `#19191D`
   - 아이콘 192·512와 maskable 아이콘
2. `metadata`에 iOS 설정을 넣는다.
   - `appleWebApp: { capable: true, title: 'GamerIN', statusBarStyle: 'black-translucent' }`
   - `icons.apple`: 180×180 아이콘
   - Next 버전에 따라 출력되는 메타 이름이 다를 수 있으니 빌드 결과 HTML에서 확인한다.
3. `viewport.themeColor`를 라이트(`#FAFAFA`)·다크(`#19191D`) `media`별로 지정한다.
4. 앱 안 이동은 클라이언트 이동으로 통일한다. `window.location.assign('/membership')`(`Post.tsx:370`, `PostDetail.tsx:544`)은 `router.push`로 바꾼다.
5. 범위 밖으로 나가는 것은 의도한 경우만 남긴다: 프로필 웹사이트 등 외부 링크, 카카오페이 결제, Google OAuth.
   - 이때 iOS 조작 UI가 뜨는 것은 정상 동작이다.
   - 돌아오는 주소(`/payments/result`, `/auth/oauth-success`)가 같은 origin·scope 안인지 확인한다.
6. 운영 주소를 하나로 고정한다(https, www 여부). 리다이렉트로 origin이 바뀌지 않게 한다. nginx 설정과 함께 확인한다.

### 10-3. 독립 실행(standalone) 화면 설계 반영 사항

- **뒤로 버튼:** 웹앱 독립 실행에는 브라우저 뒤로가기가 없다. 모바일 시안의 상세·하위 화면에는 뒤로 버튼 헤더를 넣었다(F15). 코드에서도 상세 화면마다 앱 안 뒤로 수단을 둔다.
- **상단 안전 영역:** `statusBarStyle: 'black-translucent'`를 쓰면 콘텐츠가 상태 표시줄 아래까지 올라간다. 모바일 상단 바와 뒤로 헤더에 `padding-top: env(safe-area-inset-top)`을 준다. 모바일 시안(390×844)에는 상태 표시줄 영역을 그리지 않았다.
- **하단 안전 영역:** 하단 탭 바와 바텀시트·모달 하단에 `env(safe-area-inset-bottom)`을 유지·추가한다. 시안의 탭 바 높이 82는 탭 56에 아래 여백을 더한 값이다.
- **새로고침:** 독립 실행에서는 당겨서 새로고침이 브라우저처럼 동작하지 않을 수 있다(추정). 피드 새 글 알림이나 새로고침 동작을 검토한다.
- **시작 화면 색:** 다크 기본이라 매니페스트 `background_color`를 다크로 둬서 실행 직후 흰 화면이 번쩍이지 않게 한다.
- **외부 링크:** 앱 밖(Safari)으로 열린다는 표시(↗)를 검토한다.

### 10-4. 데스크톱 웹앱 (Chrome·Edge 설치)

- 10-2의 매니페스트로 설치할 수 있다. `display: 'standalone'`이면 주소창 없는 창으로 실행된다. 그래서 데스크톱에서도 앱 안 뒤로가기 수단이 필요하다. 게시물 상세·내 신고 시안에는 뒤로 버튼이 있다.
- 설치 창의 제목 표시줄 색은 `theme_color`를 따른다.
- **중간 폭 대응:** 창 크기가 자유로워 중간 폭 대응이 필요하다. 시안은 1440·1920(FHD)·390만 있다. 다음은 아직 그리지 않았다.
  - 1024~1280: 오른쪽 열 숨김
  - 768~1024: 사이드바를 아이콘만 표시
- 웹 푸시 알림 등 OS 연동은 이번 범위 밖이다 — **확인 필요**.


## 2026-11-09 후속 화면 통합 리뷰·임시 API 제거

리뷰 기준은 `3aab91d..a69469d`(추천 친구 반영 이후 메시지 #198·계정/설정 #199·공통 모달/기타 #200)다. 현재 작업 브랜치와 해당 통합 head의 파일 내용은 동일한 상태에서 임시 API 제거를 적용했다. Ponytail 기준 직접 diff·연결 코드 리뷰를 수행했으며 별도 Codex `/review`나 서브에이전트 리뷰는 실행하지 않았다.

확인 범위: 메시지 앱 바 숨김/복원·전송/첨부 흐름 유지, 가입 동의·이메일 인증 상태와 만료 처리, 공용 인증 입력 호출부, 대표 게임 연결 판정/저장, 프로필 웹사이트와 별도 미디어 연결 제거, 공유·수정·신고·모음집 모달 및 결제 결과의 기존 API 흐름. 일반 회원의 브라우저 조작을 기준으로 보았으며 서버 처리량·실제 외부 서비스는 이번 리뷰 범위가 아니다. 확정적인 신규 버그·보안·데이터 손실 문제는 발견하지 못했다.

`scripts/dev-mock-api.mjs`(334줄)와 package.json의 `dev:mock`을 제거했다. 실행 참조는 이 두 곳뿐이었으며 Playwright route fixture와 Vitest mock은 독립적으로 유지한다. 사용자 로컬 실행 설정과 기존 문서 변경은 보존했다.

이번 실행 결과: `npm test -- --dir src` 105파일·1,171개 통과. 인증·설정·메시지·공통 모달의 design-v2 E2E 네 파일은 Chromium mock 기반 54개 통과(라이트/다크·320~1440px). lint는 오류 0개·기존 캡처 스크립트 경고 1개다. `npm run build`와 `git diff --check`도 통과했다. 첫 E2E 시도는 샌드박스의 로컬 포트 EPERM으로 서버 시작이 막혀 실행되지 않았고, 허용된 재실행에서 54개 통과했다.

후속으로 앱 전체 Noto Sans KR 연결은 2026-11-09 적용했다. 실제 이메일/Google·게임 API·결제·SSE/첨부·iOS 검증은 남았다. 컨테이너·DB·운영 배포는 변경하지 않았고 커밋·푸시는 하지 않았다.


## 2026-11-09 전역 Noto Sans KR 적용

기존 `admin-font.ts`의 `next/font/local` 로더와 `NotoSansKR-VF.woff2`를 루트 Layout에서 재사용한다. html에 `--font-noto-sans-kr`, body에 `font-sans`, Tailwind `@theme inline`에 sans 매핑을 추가했다. 인증 화면의 `font-sans`와 관리자 글꼴도 같은 로더를 따른다. ID·신고번호에 남았던 `font-mono`를 모두 `font-sans`로 바꿨다. 굵기·크기·색상은 유지하며 가변 weight 100–900, display swap, preload false다. 약 3.9MB 파일을 첫 사용 시 자체 정적 자산으로 로드하며 외부 Google Fonts 요청은 없다.

`e2e/design-v2-font.spec.ts`는 공개 홈·가입·관리자 로그인에서 font family 일치, FontFace 실제 loaded 상태, 320/1440px 라이트/다크 가로 넘침을 검사한다. 기기에 해당하지 않는 이모지·미지원 문자는 브라우저 fallback을 사용할 수 있다.

검증: 단위 105파일·1,171개, 폰트 포함 화면 E2E 58개, 프로덕션 build·타입 검사·공백 검사 통과. lint는 오류 0개·기존 캡처 스크립트 경고 1개다. 실제 iOS·느린 네트워크·운영 컨테이너에서의 폰트 로딩은 미검증이며 커밋·푸시·컨테이너 재빌드는 하지 않았다.


## 2026-11-09 develop 통합 준비

PR #201 병합(`1cd238a`)으로 전역 폰트·임시 API 정리까지 완료했다. 디자인 v2 구현 범위는 종료하며 실제 외부 서비스·iOS·느린 네트워크 확인은 별도 검증 항목이다.

`develop`의 FE #192(탈퇴 Google 로그인 안내)와 v2의 로그인 페이지 삭제가 두 파일에서 충돌했다. `/login` 페이지 삭제를 유지하고 구형 페이지 테스트 대신 중앙 로그인 모달의 `account_withdrawn` 회귀를 유지했다. `develop` 전용 기능은 이 안내 변경뿐이며 모달에서도 해당 안내가 보존된다. 대상 `origin/develop` 대비 통합 diff를 직접 리뷰했으며 API 인증 정책·게스트 보호·안전한 복귀·결제 승인 미재개·테마 저장·조회수 집계와 기존 단계별 리뷰를 대조했다. 별도 Codex /review는 실행하지 않았다.
