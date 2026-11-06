# GamerIN 디자인 시스템 v2 — 결정사항과 작업 기록

작성일: 2026-11-04 · 갱신: 2026-11-05 · 코드 확인 기준: frontend `develop` `d3fee9b`

**상태: 시안 확정, 코드 미반영.** 2026-11-05에 사용자가 **다크 기본 + 노랑 Amber `#F5B93D`(시안 J)**와 **L2 사이드바 통합형 레이아웃**을 확정했다(2-1절, [mockups.md](mockups.md) 확정안). 데스크톱·모바일 주요 화면과 탭·상태 화면을 새 Figma 파일에 그렸다. `globals.css`와 컴포넌트 코드는 아직 바꾸지 않았다. 시안 A~D, E~J, L1/L2의 결정과 피드백도 [mockups.md](mockups.md)에 정리했다.

- Figma 파일(현행): [GamerIN Design System v2](https://www.figma.com/design/e4aQUNEbh9n2aXiStJYniH) (팀 `서장호's team`, Student 플랜) — 4-1절
- Figma 파일(초기, 참고용): [GamerIN Design System v2](https://www.figma.com/design/KFhNXMpM8Klw9oXWiCkhRZ) (팀 `서장호의 팀`, Starter 플랜). 3·4절의 컴포넌트·화면은 이 파일 기준이며 새 파일로 옮기지 않았다.
- 목표: 기존 노란 브랜드 색(`#F5B93D`)은 유지하고, 색·굵기·모서리 단계를 줄여 더 단순하고 정돈된 UI로 바꾼다.

## 1. 현재 코드 진단

아래 수치는 `src/` 전체를 grep으로 센 값이다(2026-11-04, `d3fee9b`).

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
| D2 | 강조색은 노랑 하나. 상태 색은 red(위험)와 green(성공)만 두고, 관리자 화면의 파랑은 폐기 후보로 둔다. | 팔레트 3종 혼용 해소. 관리자 화면 적용 범위는 확인이 필요하다(7절). |
| D3 | 회색은 neutral 한 계열(0–950)만 쓴다. 다크 단계는 기존 값 `#0C0C0E`/`#151518`/`#1F1F24`/`#2A2A30`을 유지한다. | 다크 모드 표면 3단계(#138)에서 정한 값을 바꾸지 않는다. |
| D4 | 폰트는 Noto Sans KR로 통일하고, 굵기는 Regular 400 / Medium 500 / Bold 700만 쓴다. | 저장소에 이미 woff2가 있다. Pretendard는 Figma 계정에 없어 쓰지 않았다. |
| D5 | 모서리 반경은 4단계: `sm 6` / `md 10` / `lg 14` / `full`. | 10종 이상 쓰이던 반경을 역할별로 정리한다. |
| D6 | 그림자는 팝오버(`Elevation/Popover`)와 포커스 링(`Focus/Ring`)에만 쓴다. 활성 상태는 배경·글자색만으로 나타낸다. | 장식 요소를 줄인다. |
| D7 | 아바타는 원형으로 하고, 이미지가 없으면 연노랑 배경(`bg/brand-subtle`)에 이니셜을 넣는다. | 지금의 검정 각진 사각형(`rounded-xl bg-black`)보다 화면이 가볍다. |
| D8 | 피드 탭 활성 표시는 2px 노란 밑줄, 사이드바 활성 표시는 연노랑 배경 + 노란 아이콘으로 한다. | 노랑을 쓰는 위치를 줄인다. |
| D9 | 아이콘은 `lucide-react`를 유지하되 20px에 선 굵기 1.67로 그린다(24px 원본을 0.833배 축소한 값). | 지금 쓰는 아이콘 세트를 그대로 쓰면서 선을 가늘게 한다. |
| D10 | 흐린 글자색(`text/tertiary`)은 Light `neutral/500` `#71717A`, Dark `neutral/450` `#8B8B94`, `text/secondary`(Light)는 `neutral/600` `#52525B`로 한다. | 처음 값(Light `#A1A1AA`, Dark `#52525B`)은 대비가 약 2.5:1로 WCAG AA 본문 기준(4.5:1)에 못 미친다. Dark를 `neutral/500`으로 올려도 카드 바탕 `#151518` 위 3.77:1이라 `neutral/450`(5.40:1)을 추가했다. 대비값은 WCAG 상대 휘도 공식으로 계산했다. 새 Figma 파일에 반영했다. |

D7·D8은 확정안에서 바뀌었다(2-1절 F6).

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
| F8 | 지갑·멘토링·멤버십처럼 정보가 넓은 화면은 오른쪽 열을 빼고 940 한 칸을 쓴다. 북마크는 오른쪽 열에 모음집 목록, 프로필은 인증된 전적·연결된 계정을 둔다. | 화면별로 오른쪽 열을 쓸모 있게 채운다. |
| F9 | 모바일은 하단 탭 5칸(홈·북마크·메시지·멘토링·프로필)을 유지하고, 상단 바에 로고·검색·알림을 둔다. 검색은 전체 화면 패널, 알림은 뒤로 가기가 있는 별도 페이지로 연다. 지갑은 내 프로필의 마일리지 카드로 들어간다. | 사용자 요청: 모바일 알림은 페이지. 현재 모바일에는 지갑 진입 메뉴가 없다(`Sidebar.tsx:19-20`). |
| F10 | 게시물 영상은 16:9 비율을 고정해 폭에 맞춰 높이를 정한다(데스크톱 560×315, 모바일 326×183). | 6절 미반영 3(모바일 미디어 높이)을 해결한다. |
| F11 | 멤버십 혜택 문구의 "노란 체크 배지"는 코드 문구 그대로 둔다. | 사용자 결정. 브랜드가 노랑으로 확정되어 색과 문구가 맞는다. |
| F12 | 프로필 맨 위에 커버 사진을 둔다. 높이는 데스크톱 224·모바일 128(코드 `h-32 md:h-56`과 같음), 반경 `lg 14`(모바일 12)다. 아바타(데스크톱 88·모바일 72)는 커버 아래쪽에 반쯤 걸치고 `bg/canvas` 4px 테두리로 분리한다. `프로필 수정` 버튼은 커버 오른쪽 아래에 둔다. 사진이 없으면 기본 이미지 `public/images/default-profile-cover.svg`를 쓴다. | 커버는 현재 코드에 있는 기능(`profile/[userId]/page.tsx:1021-1041`, `EditProfileModal` 업로드)인데 시안에서 빠져 있었다. 레이아웃은 바꾸지 않고 커버만 더했다. |
| F14 | 내 프로필 커버 아래 `프로필 수정` 왼쪽에 설정 아이콘 버튼을 둔다. 설정·내 신고는 이 버튼으로 들어간다. | 현재 코드의 내 프로필 아이콘 버튼(`profile/[userId]/page.tsx:1066-1080`, `aria-label="설정"`)과 같은 진입점이다. |
| F15 | 나머지 화면 공통 규칙. 로그인·계정 화면은 데스크톱에서 왼쪽 브랜드 패널(648) + 오른쪽 폼(400), 모바일에서 폼만 두고 위에 로고를 둔다. 모달은 데스크톱에서 가운데, 모바일에서 아래에서 올라오는 시트(위쪽 반경 20, 손잡이)다. 모바일 메시지는 목록과 대화를 나눠 보여 준다. 상세·하위 화면(게시물 상세, 해시태그, 설정, 내 신고, 지갑, 멤버십, 알림, 대화)은 모바일에서 뒤로 버튼이 있는 헤더를 쓴다. | 로그인·계정 화면은 코드가 같은 왼쪽 로고 패널(`AuthPageShell`)을 공유한다. 모바일 메시지 분리는 코드의 `대화 목록으로 돌아가기` 동작과 같다. 뒤로 버튼은 웹앱 독립 실행에서 브라우저 뒤로가기가 없기 때문이다(10절). |
| F13 | 다크가 기본이지만 라이트 모드도 제공한다. 라이트 색은 2-2절 Light 토큰을 그대로 쓰고, 카드 테두리용 `border/card`(Light `neutral/200`, Dark 투명)를 추가해 라이트에서만 흰 카드에 1px 테두리를 그린다. | 사용자 요청. 테두리 없이는 흰 카드(`#FFFFFF`)가 바탕(`#FAFAFA`)에 묻힌다. Dark에서는 투명이라 F2(테두리 없음)가 유지된다. |

### 2-1-1. 남은 결정 확정 (2026-11-05)

| # | 결정 | 이유 |
|---|---|---|
| F16 | 기본 테마는 다크다. 설정의 라이트/다크 선택은 유지하고, 선택값을 서버에도 저장한다. localStorage(`gamerin_user_settings`)는 첫 화면 깜빡임을 막는 캐시로 남기고, 로그인 뒤에는 서버 값을 따른다. 서버 저장은 백엔드 이슈 wishufeeldasame/gamerin_backend#182로 진행하고, 프론트 연동은 디자인 v2 개편 브랜치에서 한다. | 사용자 결정. 기기를 바꿔도 테마가 유지되게 한다. 현재 코드는 기본값 `light`, localStorage에만 저장한다(`src/lib/user-settings.ts:10`). |
| F17 | 좋아요한 하트는 브랜드 노랑이 아니라 지금 코드처럼 Tailwind `red-500`(`#EF4444`, 라이트·다크 공통)이다. 숫자는 선택 여부와 상관없이 `text-fg-secondary`다(라이트 흰 카드 위 `red-500` 글자 대비가 4.5:1에 못 미친다, PR #180 리뷰). 2-2절 primitive `red/500`(`#DC2626`)은 오류용이라 다른 색이다. F3의 "좋아요한 하트·수"는 이 결정으로 바뀐다. Figma 시안은 노랑으로 그려져 있다. | 사용자 결정. 노랑은 버튼·활성 상태에 이미 쓰여 좋아요와 구분되지 않는다. |
| F18 | 로그인 제목을 `지금 가입하세요.`에서 `다시 오신 걸 환영해요`로 바꾼다. | 사용자 결정(5-2절 제안 채택). |
| F19 | `ID로 로그인` 토글을 없애고 `또는 아이디로 로그인` 구분선 아래 아이디·비밀번호 폼을 항상 보여 준다. | 사용자 결정(5-2절 제안 채택). |
| F20 | 관리자 화면의 별도 팔레트는 이번 개편에서 그대로 둔다. 관리자 시안을 그린 뒤 따로 다룬다. | 사용자 결정. 관리자 시안이 없다. |
| F21 | 라이트 모드의 사이드바 활성 바탕은 `neutral/200`으로 더 진하게 한다. 다크는 F6대로 `neutral/850`(`bg/subtle`)이다. 코드에서는 `bg/nav-active` 토큰(Light `neutral/200`, Dark `neutral/850`)으로 둔다. | 사용자 결정. `#F4F4F5`는 페이지 바탕 `#FAFAFA`와 차이가 작았다. |
| F22 | 시안에만 있던 문구 2개를 코드에 넣는다. 홈 오류 둘째 줄 `네트워크 상태를 확인한 뒤 다시 시도해 주세요.`, 멘토 되기 안내의 `관리자 검토를 거쳐`. | 사용자 결정. |
| F23 | 게시물 카드 이름 옆 티어는 작성자의 **대표 게임 티어**(wishufeeldasame/gamerin_backend#179 `authorRepresentativeTier`)를 **엠블럼 이미지만** 보여 준다. 티어 글자(`Diamond 2`)와 게임 약칭은 붙이지 않고, 엠블럼에 `LoL Gold I` 같은 대체 텍스트를 단다. 메타 줄의 `· 게임`(게시물 게임 태그)은 만들지 않는다. 조회수는 wishufeeldasame/gamerin_backend#183으로 진행한다. | 사용자 결정(2026-11-05). 대표 티어와 게시물 게임을 한 카드에 같이 두면 두 게임이 다를 때 티어가 어느 게임 것인지 헷갈린다. 게임마다 엠블럼 그림이 달라 엠블럼만으로 게임이 구분된다. 게시물 게임은 게임별 피드 필터가 필요해질 때 그 UI와 함께 설계한다. Figma 시안은 티어 글자·게임 이름을 그린 그대로다. |

### 2-2. 토큰

CSS 변수 이름은 코드에 반영할 때 쓸 제안이다(Figma 변수의 Web code syntax에 넣어 두었다).

**Primitives**

| 계열 | 단계 |
|---|---|
| yellow | 50 `#FFF9EB` · 100 `#FEF0C7` · 200 `#FDE08A` · 300 `#FBCD5A` · 400 `#F8C24A` · **500 `#F5B93D`** · 600 `#DB9A1F` · 700 `#B07614` · 800 `#7D5310` · 900 `#4A310A` · 950 `#2A2112` |
| neutral | 0 `#FFFFFF` · 50 `#FAFAFA` · 100 `#F4F4F5` · 200 `#E4E4E7` · 300 `#D4D4D8` · 400 `#A1A1AA` · 450 `#8B8B94` · 500 `#71717A` · 600 `#52525B` · 700 `#3F3F46` · 800 `#2A2A30` · 850 `#1F1F24` · 900 `#151518` · 950 `#0C0C0E` · ink `#1A1406` |
| red | 50 `#FEF2F2` · 300 `#F87171` · 500 `#DC2626` · 950 `#2A1212` |
| green | 50 `#F0FDF4` · 300 `#4ADE80` · 500 `#16A34A` · 950 `#0F2416` |

**의미별 색 (Light / Dark)**

| 토큰 | Light | Dark | 용도 |
|---|---|---|---|
| `bg/canvas` | neutral/50 | neutral/950 | 페이지 바탕 |
| `bg/surface` | neutral/0 | neutral/900 | 카드·헤더·사이드바 |
| `bg/subtle` | neutral/100 | neutral/850 | hover, 검색창, 미디어 자리 |
| `bg/inverse` | neutral/900 | neutral/0 | 토스트 등 반전 표면 |
| `bg/brand` | yellow/500 | yellow/500 | Primary 버튼, 로고 마크 |
| `bg/brand-hover` | yellow/600 | yellow/300 | Primary hover |
| `bg/brand-subtle` | yellow/50 | yellow/950 | 활성 메뉴, 티어 Chip, 아바타, 안내 배너 |
| `bg/danger-subtle` / `bg/success-subtle` | red/50 / green/50 | red/950 / green/950 | Danger 버튼, 상태 배너 |
| `text/primary` | neutral/900 | neutral/100 | 본문·제목 |
| `text/secondary` | neutral/600 (D10) | neutral/400 | 보조 설명, 비활성 메뉴 |
| `text/tertiary` | neutral/500 (D10) | neutral/450 (D10) | 핸들·시간·placeholder |
| `text/on-brand` | neutral/ink | neutral/ink | 노랑 바탕 위 글자 |
| `text/brand` | yellow/800 | yellow/400 | 해시태그, 티어 라벨 |
| `text/danger` / `text/success` | red/500 / green/500 | red/300 / green/300 | 오류·성공 문구 |
| `icon/primary` / `icon/secondary` / `icon/brand` | neutral/900 / neutral/500 / yellow/600 | neutral/100 / neutral/400 / yellow/500 | 아이콘 |
| `border/default` / `border/strong` | neutral/200 / neutral/300 | neutral/800 / neutral/700 | 구분선·카드 테두리 / Secondary 버튼 |
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

## 3. 컴포넌트 (Figma `Components` 페이지)

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

## 4. 화면 (Figma `Screens` 페이지)

| 화면 | 크기 | 구성 |
|---|---|---|
| Home · Desktop · Light | 1440 | Header 64(로고, 검색, 알림·메시지, 아바타) / Sidebar 256(메뉴 6개, 하단 계정 + 로그아웃) / 피드 600(탭 → 작성기 → 카드 2개) / 오른쪽 300(추천 친구, 푸터) |
| Home · Desktop · Dark | 1440 | 라이트 화면을 복제한 뒤 색 바인딩을 `Color · Dark` 변수로 교체 |
| Home · Mobile · Light | 390×844 | Header 56, 피드 탭, 작성기, 카드, 하단 탭바 5칸 |

- 화면 구조는 `src/app/(app)/layout.tsx`, `src/app/(app)/home/page.tsx`, `Sidebar.tsx`, `Header.tsx`, `RightSidebar.tsx`를 따랐다.
- 추천 친구 카드는 코드에서 숨겨져 있다(`SHOW_SUGGESTED_FRIENDS = false`). API 연동 후 보일 모습으로 넣었다.
- **정정**: Figma 화면의 피드 탭을 `전체`/`팔로잉`으로 넣었지만, 실제 코드의 탭 이름은 `추천`/`팔로잉`이다(`src/app/(app)/home/page.tsx:171`). Figma 화면은 아직 고치지 않았다(호출 한도). 이후 시안(mockups.md)은 `추천`으로 맞췄다.
- 시안 C부터는 사용자 요청에 따라 헤더 오른쪽의 메시지·아바타를 빼고 알림만 둔다(mockups.md 시안 C).

### 4-1. 현행 Figma 파일 구성 (`서장호's team`, 2026-11-05)

| 페이지 | 내용 |
|---|---|
| Foundations | 비어 있음. 변수(Primitives 34, Brand 4×6모드, Color 25×Light/Dark, Dimension 12), 텍스트 스타일 7, 이펙트 스타일 2만 있다. 초기 파일의 Foundations 문서 페이지는 옮기지 않았다. |
| Components | 아이콘 36종(lucide 원본 SVG), Avatar, Nav Item, Post Action, Post Card(Media 16:9 고정), Notification Item, Tab, Chip, User Row, Program Card, Charge Option, History Row, Application Card, Benefit Row, Profile Cover(기본 커버 SVG), Tab Bar Item, Mobile Tab Bar, Mobile Top Bar |
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

## 5. 로그인 화면

### 5-1. 현재 구조 (`src/app/login/page.tsx`)

- `md` 이상에서는 왼쪽 45%가 로고 패널(`/logo.png`, `bg-gray-50/50`)이고, 오른쪽에 최대 420px 폼이 있다.
- 폼은 위에서부터 `GamerIN` 라벨(대문자·넓은 자간), 제목 `지금 가입하세요.`, 개발 단계 안내 배너(amber), OAuth 오류 배너(red), `Google로 계속하기`, `ID로 로그인` 토글(펼치면 아이디·비밀번호 입력과 검정 `로그인` 버튼), 아이디·비밀번호 찾기와 약관 링크, 회원가입 순이다.

### 5-2. v2 설계 명세 (Figma 미작성)

Figma MCP 호출 한도(Starter 플랜)에 걸려 Figma 화면은 만들지 못했다. 아래 명세대로 기존 컴포넌트를 조립하면 된다.

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

## 6. Figma 작업 제약과 미완료 항목

| 항목 | 내용 |
|---|---|
| 페이지 3개 제한 | Starter 플랜 제약으로 `Foundations`(표지 + 기초 문서) / `Components` / `Screens` 3페이지로 구성했다. |
| 변수 모드 1개 제한 | 라이트/다크를 한 컬렉션의 두 모드가 아니라, 이름 구조가 같은 두 컬렉션(`Color · Light`, `Color · Dark`)으로 만들었다. 다크 화면은 복제본이라 컴포넌트를 고쳐도 자동으로 따라오지 않는다. Professional 이상이면 두 모드로 합칠 수 있다. |
| MCP 호출 한도 | 한도에 걸려 아래 항목을 Figma에 반영하지 못했다. |
| 미반영 1 | D10 대비 수정: `Color · Light`의 `text/secondary` → `neutral/600`, `text/tertiary` → `neutral/500` / `Color · Dark`의 `text/tertiary` → `neutral/500`. Foundations 문서 색상표의 해당 행 값도 함께 고쳐야 한다. |
| 미반영 2 | 로그인 화면(5-2절) |
| 미반영 3 | 모바일 홈 카드의 미디어 높이를 200px로 줄이려 했으나, 인스턴스 안쪽 프레임 높이는 override할 수 없어 300px로 남았다. |

**2026-11-05 갱신:** 새 계정의 Student 플랜 팀으로 파일을 새로 만들어 페이지 수·모드 수 제약이 없어졌다. 미반영 1(D10)과 미반영 3(F10)은 새 파일에서 해결했다. 남은 항목은 다음과 같다.

- 미반영 2(로그인 화면)는 새 파일에도 아직 없다.
- 초기 파일의 컴포넌트 세트 8개와 화면 3개는 새 파일로 옮기지 않았다. Plugin API로는 파일 간 노드 복사가 되지 않는다. 원본이 필요하면 Figma에서 초기 파일을 복제한다.

## 7. 코드 반영 계획 (1~3단계 완료, 4단계 진행 중)

아래는 확정안(다크 기본 + Amber, L2) 기준이다.

1. `globals.css`에 2-2절 토큰을 CSS 변수로 추가하고, `@theme inline`에 연결한다. `.dark`의 기존 표면 값은 유지한다. 기본 테마는 다크로 바꾸고 라이트/다크 선택은 유지한다(F16). 서버 저장은 별도 이슈다.
2. `btn-primary`, `btn-secondary`, `input-base`, `page-title` 등 기존 유틸리티를 새 토큰 기준으로 바꾼다. 유틸리티를 쓰는 화면은 한 번에 바뀐다.
3. 앱 셸(L2): `Header` 제거, `Sidebar`에 검색·알림 메뉴와 하단 계정 카드(마일리지) 추가, 세 칸 가운데 정렬. 검색·알림 슬라이드 패널은 기존 `Header.tsx`의 검색 제출과 `NotificationPanel`의 데이터·동작(무한 스크롤, 모두 읽음, Esc 닫기)을 옮겨 쓴다. 모바일은 상단 바 + `MobileTabBar`를 유지하고 알림 페이지 route를 새로 만든다. 같은 단계에서 웹앱 설정(매니페스트, iOS 메타, 안전 영역, 앱 안 이동 통일)을 함께 넣는다(10절).
4. `Post` / `PostComposer` / 각 페이지(검색 결과, 북마크, 프로필, 지갑, 멘토링, 멤버십) / 로그인 화면 순서로 화면 단위 PR로 적용한다. 첫 묶음(브랜치 `feat/design-v2-post`)은 `Post`·`PostComposer`·홈 피드(탭, 오류 화면 F22 문구)·임시 카드·스켈레톤이다. 게시물이 모든 폭에서 카드가 되어 검색·해시태그·북마크·프로필 목록의 모바일 여백(16px)과 간격(12px)도 함께 맞췄다. 시안과 다르게 둔 것: 이름 옆 티어·조회수(응답에 값 없음. 구현 예정: 백엔드 wishufeeldasame/gamerin_backend#179 대표 티어 엠블럼(F23), #183 조회수), 메타 줄 게임 이름(만들지 않음, F23), 작성창 placeholder(코드 문구 유지), 멘션 색(해시태그와 구분하려고 하늘색 유지), 라이트 모드 카드·액션 바 포커스 색(`yellow/500`은 흰 카드 위 대비가 3:1에 못 미쳐 `text/brand` `#7D5310`, 다크는 `border/focus` 그대로). 둘째 묶음(브랜치 `feat/design-v2-post-detail`)은 게시물 상세다. 게시물 카드와 댓글을 각각 `rounded-card` 카드로 나누고, 모든 폭에서 `‹ 게시물` 뒤로 헤더를 둔다. 모바일은 앱 상단 바 대신 이 헤더가 위에 붙는다(F15). 시안과 다르게 둔 것: 티어·조회수(첫 묶음과 같음), 댓글 줄의 `@핸들`(유지), 댓글 글자 수(입력 중에만 입력창 아래 표시).
5. 앱 전체 폰트를 Noto Sans KR로 바꾼다. 관리자 화면 `admin-font.ts`와 같은 woff2를 쓰고, 크기(약 3.9MB)와 preload 정책을 함께 검토한다.
6. 관리자 화면의 별도 팔레트(`#667085`, `#315ef5` 등)는 이번 개편에서 그대로 둔다(F20).
7. 각 단계마다 `npm run lint`, `npm test`, `npm run build`를 실행하고, 라이트·다크와 모바일·데스크톱 화면을 확인한다.

## 8. 작업 기록

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
| 2026-11-06 | 4단계 둘째 묶음: 게시물 상세(`PostDetail`)에 확정안 적용(뒤로 헤더, 게시물·댓글 카드, 댓글 입력 `등록` 버튼, 관련 게시물 카드). 데스크톱 다크, 모바일 다크·라이트(375·320)로 확인 |
| 2026-11-05 | 4단계 첫 묶음: `Post`·`PostComposer`·홈 피드에 확정안 적용(카드·접힘/펼침 작성창·`#` 버튼·탭 밑줄·오류 화면). 데스크톱 다크·라이트, 모바일 다크 화면으로 확인 |

## 9. 확정 상태와 다음 단계

| 항목 | 상태 |
|---|---|
| 브랜드 방향 | **확정**: 다크 기본 + Amber `#F5B93D`(F1) |
| 레이아웃 | **확정**: L2 사이드바 통합형(F4~F9) |
| 좋아요 색 | **확정**: 현재 코드의 Tailwind `red-500`(`#EF4444`) 유지(F17). Figma 시안은 노랑 그대로다 |
| 다크 기본 방식 | **확정**: 기본 다크 + 라이트/다크 선택 유지 + 서버 저장(F16) |
| 라이트 모드 | 확정 화면 29개를 그렸다(F13). FHD 라이트 버전은 없다. 사이드바 활성 바탕은 **확정**: 라이트 `neutral/200`(F21). Figma 시안은 `#F4F4F5` 그대로다 |
| 시안에만 있는 문구 | **확정**: 두 문구 모두 코드에 넣는다(F22) |
| 미제작 화면 | 관리자 화면 전체, 프로그램 만들기 폼, 리뷰 작성, 알림 빈 상태, 모바일 탭·상태 화면, 멤버십 로딩·오류, 1024~1280·768~1024 중간 폭(10-4절) |
| 나머지 화면의 예시·추정 | 신고 사유는 서버 목록이라 예시다. 모음집 모달 제목 "모음집에 저장"과 버튼 "완료", 신고 모달 제목 "신고하기", 공유 링크 주소, OAuth 처리 중 설명 한 줄은 코드에서 확인하지 못한 문구다. 개인정보 처리방침은 조항 제목만 넣었다 — **확인 필요** |
| 로그인 화면 | **확정**: 제목 `다시 오신 걸 환영해요`(F18), 토글 제거·폼 항상 펼침(F19). Figma 시안은 코드 그대로(제목·토글)다 |
| 웹앱 | 매니페스트·iOS 메타·안전 영역·앱 안 이동 통일을 3단계에서 넣었다(10-1절 아래 표). iOS 하단 Safari 조작창이 사라지는지, 라이트 모드 상태 표시줄(`black-translucent`) 글자가 보이는지는 실기기 확인 필요 |
| 관리자 화면 | **확정**: 이번 개편에서 제외(F20) |
| 코드 반영 | 진행 중(통합 브랜치 `feature/design-v2`). 1단계 토큰·기본 다크, 2단계 공통 유틸리티, 3단계 앱 셸 L2·웹앱 설정 완료(#179). 4단계 첫 묶음 게시물 카드·작성창·홈 피드(`feat/design-v2-post`), 둘째 묶음 게시물 상세(`feat/design-v2-post-detail`). 다음은 검색 결과·북마크·프로필·지갑·멘토링·멤버십 |
| 티어 표시 | **확정**: 시안대로 둔다(2026-11-05 사용자 결정). 계정 카드는 `@핸들`을 보여 주고, 이전 헤더·사이드바에 있던 `user.gameTier`(티어·`미배치`) 표시는 앱 셸에서 뺐다. 티어는 프로필 전적 탭에서 본다. 게시물 카드 등 닉네임 옆에는 #179 대표 티어 엠블럼만 둔다(F23) |
| 임시 목 API | 로그인 이후 화면을 백엔드 없이 확인하려고 `scripts/dev-mock-api.mjs`와 `npm run dev:mock`을 추가했다. **v2 적용 완료 후 두 가지 모두 삭제한다** |

## 10. 웹앱(데스크톱·iOS 홈 화면 앱) 고려사항

이 디자인으로 프론트를 다시 작업할 때, 브라우저 탭뿐 아니라 설치형 웹앱(데스크톱 Chrome·Edge 설치, iOS "홈 화면에 추가")으로 쓰는 경우도 함께 고려한다.

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
| 매니페스트 | `src/app/manifest.ts`(`start_url /home`, `scope /`, `display standalone`, 바탕·테마 `#0C0C0E`). 아이콘은 `public/icons/`에 192·512·maskable 512(`logo.png` 가운데를 노란 바탕에 얹음) |
| iOS 메타 | `appleWebApp`(`capable`, `title GamerIN`, `statusBarStyle black-translucent`), `icons.apple` 180. Next 15는 `capable`을 `mobile-web-app-capable`로만 내보내서 `apple-mobile-web-app-capable`을 `other`로 따로 넣었다 |
| theme-color | `viewport.themeColor #0C0C0E`. 라이트 테마면 첫 화면 스크립트와 `applyThemeMode`가 `#FAFAFA`로 바꾼다. `media`별 지정(10-2 제안 3)은 앱 테마가 OS 설정과 따로 움직여서 쓰지 않았다 |
| 안전 영역 | 모바일 상단 바·알림 페이지 헤더·전체 화면 검색에 `env(safe-area-inset-top)`, `--app-header-height`가 상단 바 높이를 포함한다 |
| 앱 안 이동 | 멤버십 이동을 `router.push('/membership')`로 바꿨다(`Post.tsx`, `PostDetail.tsx`) |

### 10-2. iOS 홈 화면 앱의 하단 Safari 조작창 문제

**증상(사용자 보고):** iOS에서 홈 화면에 추가해 웹앱으로 열면, 프로필·메시지 같은 다른 페이지로 갈 때 화면 아래에 Safari 조작창(뒤로·앞으로 등)이 떠서 불편하다.

**원인 후보 — 추정, 실기기 재현 필요**

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

**개선 방향 (제안)**

1. `src/app/manifest.ts`를 추가한다.
   - `name`·`short_name`: `GamerIN`
   - `start_url: '/home'`, `scope: '/'`, `display: 'standalone'`
   - `background_color`·`theme_color`: 다크 기본 `#0C0C0E`
   - 아이콘 192·512와 maskable 아이콘
2. `metadata`에 iOS 설정을 넣는다.
   - `appleWebApp: { capable: true, title: 'GamerIN', statusBarStyle: 'black-translucent' }`
   - `icons.apple`: 180×180 아이콘
   - Next 버전에 따라 출력되는 메타 이름이 다를 수 있으니 빌드 결과 HTML에서 확인한다.
3. `viewport.themeColor`를 라이트(`#FAFAFA`)·다크(`#0C0C0E`) `media`별로 지정한다.
4. 앱 안 이동은 클라이언트 이동으로 통일한다. `window.location.assign('/membership')`(`Post.tsx:370`, `PostDetail.tsx:544`)은 `router.push`로 바꾼다.
5. 범위 밖으로 나가는 것은 의도한 경우만 남긴다: 외부 링크(YouTube·Twitch 등), 카카오페이 결제, Google OAuth.
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
