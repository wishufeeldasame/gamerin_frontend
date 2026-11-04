# GamerIN 디자인 시스템 v2 — 결정사항과 작업 기록

작성일: 2026-11-04 · 코드 확인 기준: frontend `develop` `d3fee9b`

**상태: 디자인 초안(코드 미반영).** Figma에 토큰·컴포넌트·홈 피드 화면을 만들었고, 로그인 화면은 이 문서에 명세만 있다(5-2절). `globals.css`와 컴포넌트 코드는 아직 바꾸지 않았다.

- Figma 파일: [GamerIN Design System v2](https://www.figma.com/design/KFhNXMpM8Klw9oXWiCkhRZ) (팀 `서장호의 팀`, Starter 플랜)
- 목표: 기존 노란 브랜드 색(`#F5B93D`)은 유지하고, 색·굵기·모서리 단계를 줄여 더 단순하고 정돈된 UI로 바꾼다.

## 1. 현재 코드 진단

아래 수치는 `src/` 전체를 grep으로 센 값이다(2026-11-04, `d3fee9b`).

| 항목 | 현재 상태 | 근거 |
|---|---|---|
| 브랜드 색 사용 | 노랑 `#f5b93d`는 117회 쓰이지만 다크 모드에서만 primary다. 라이트 모드의 primary 버튼과 활성 사이드바는 검정이다. | `globals.css`의 `btn-primary`(`bg-black … dark:bg-[#f5b93d]`), `Sidebar.tsx` 활성 항목(`bg-black text-white`) |
| 팔레트 혼용 | 앱은 Tailwind `zinc`, 관리자 화면은 별도 회색(`#667085` 71회, `#344054` 62회 등)과 파랑(`#315ef5` 61회)을 쓴다. `amber-*`/`yellow-*` 유틸리티도 섞여 있다. | `src/app/(admin)/admin/_components/*` 등 |
| 글자 굵기 | `font-black` 330회, `font-bold` 281회, `font-semibold` 102회, `font-medium` 51회 | 굵은 글씨가 대부분이라 위계가 잘 보이지 않는다. |
| 모서리 반경 | `rounded-2xl` 200, `xl` 172, `full` 71, `3xl` 34, `lg` 32, `[20px]` 19, `md` 4, `sm`·`[2rem]` 등 10종 | 같은 역할의 요소도 반경이 서로 다르다. |
| 장식 | 활성 메뉴의 `scale-[1.02]`·`shadow-lg`, `uppercase tracking-widest` 라벨 | `Sidebar.tsx`, `login/page.tsx` 등 |
| 폰트 | 앱은 시스템 기본 폰트, 관리자 화면만 Noto Sans KR(`next/font/local`) | `src/app/(admin)/admin/_components/admin-font.ts` |

## 2. 결정사항

| # | 결정 | 이유 |
|---|---|---|
| D1 | 라이트·다크 모두 Primary를 노랑(`bg/brand` = `yellow/500` `#F5B93D`)으로 통일하고, 그 위 글자는 거의 검정인 `#1A1406`으로 쓴다. | 브랜드 색이 한쪽 모드에서만 보이는 문제를 해소한다. 노랑 바탕 위 흰 글자는 대비가 낮아 어두운 글자를 쓴다. |
| D2 | 강조색은 노랑 하나. 상태 색은 red(위험)와 green(성공)만 두고, 관리자 화면의 파랑은 폐기 후보로 둔다. | 팔레트 3종 혼용 해소. 관리자 화면 적용 범위는 확인이 필요하다(7절). |
| D3 | 회색은 neutral 한 계열(0–950)만 쓴다. 다크 단계는 기존 값 `#0C0C0E`/`#151518`/`#1F1F24`/`#2A2A30`을 유지한다. | 다크 모드 표면 3단계(#138)에서 정한 값을 바꾸지 않는다. |
| D4 | 폰트는 Noto Sans KR로 통일하고, 굵기는 Regular 400 / Medium 500 / Bold 700만 쓴다. | 저장소에 이미 woff2가 있다. Pretendard는 Figma 계정에 없어 쓰지 않았다. |
| D5 | 모서리 반경은 4단계: `sm 6` / `md 10` / `lg 14` / `full`. | 10종 이상 쓰이던 반경을 역할별로 정리한다. |
| D6 | 그림자는 팝오버(`Elevation/Popover`)와 포커스 링(`Focus/Ring`)에만 쓴다. 활성 상태는 배경·글자색만으로 나타낸다. | 장식 요소를 줄인다. |
| D7 | 아바타는 원형으로 하고, 이미지가 없으면 연노랑 배경(`bg/brand-subtle`)에 이니셜을 넣는다. | 지금의 검정 각진 사각형(`rounded-xl bg-black`)보다 화면이 가볍다. |
| D8 | 피드 탭 활성 표시는 2px 노란 밑줄, 사이드바 활성 표시는 연노랑 배경 + 노란 아이콘으로 한다. | 노랑을 쓰는 위치를 줄인다. |
| D9 | 아이콘은 `lucide-react`를 유지하되 20px에 선 굵기 1.67로 그린다(24px 원본을 0.833배 축소한 값). | 지금 쓰는 아이콘 세트를 그대로 쓰면서 선을 가늘게 한다. |
| D10 | 흐린 글자색(`text/tertiary`)은 Light·Dark 모두 `neutral/500` `#71717A`, `text/secondary`(Light)는 `neutral/600` `#52525B`로 한다. | 처음 값(Light `#A1A1AA`, Dark `#52525B`)은 대비가 약 2.5:1로 WCAG AA 본문 기준(4.5:1)에 못 미친다. 대비값은 공식으로 계산한 근사치다. **Figma에는 아직 반영하지 못했다(6절).** |

### 2-1. 토큰

CSS 변수 이름은 코드에 반영할 때 쓸 제안이다(Figma 변수의 Web code syntax에 넣어 두었다).

**Primitives**

| 계열 | 단계 |
|---|---|
| yellow | 50 `#FFF9EB` · 100 `#FEF0C7` · 200 `#FDE08A` · 300 `#FBCD5A` · 400 `#F8C24A` · **500 `#F5B93D`** · 600 `#DB9A1F` · 700 `#B07614` · 800 `#7D5310` · 900 `#4A310A` · 950 `#2A2112` |
| neutral | 0 `#FFFFFF` · 50 `#FAFAFA` · 100 `#F4F4F5` · 200 `#E4E4E7` · 300 `#D4D4D8` · 400 `#A1A1AA` · 500 `#71717A` · 600 `#52525B` · 700 `#3F3F46` · 800 `#2A2A30` · 850 `#1F1F24` · 900 `#151518` · 950 `#0C0C0E` · ink `#1A1406` |
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
| `text/tertiary` | neutral/500 (D10) | neutral/500 (D10) | 핸들·시간·placeholder |
| `text/on-brand` | neutral/ink | neutral/ink | 노랑 바탕 위 글자 |
| `text/brand` | yellow/800 | yellow/400 | 해시태그, 티어 라벨 |
| `text/danger` / `text/success` | red/500 / green/500 | red/300 / green/300 | 오류·성공 문구 |
| `icon/primary` / `icon/secondary` / `icon/brand` | neutral/900 / neutral/500 / yellow/600 | neutral/100 / neutral/400 / yellow/500 | 아이콘 |
| `border/default` / `border/strong` | neutral/200 / neutral/300 | neutral/800 / neutral/700 | 구분선·카드 테두리 / Secondary 버튼 |
| `border/focus` / `border/danger` | yellow/500 / red/500 | yellow/500 / red/300 | 포커스 / 오류 입력 |

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
| 헤더 | `GamerIN`(Label, `text/brand`, 대문자·자간 넓힘 없음) + 제목(Display). 제목 문구 `지금 가입하세요.`는 로그인 화면과 맞지 않아 `다시 오신 걸 환영해요`로 바꾸자는 제안 — **확인 필요** |
| 개발 단계 안내 | `bg/brand-subtle`, `radius/md`, 패딩 `space/3`, Label Regular, `text/brand`. 테두리 없음 |
| OAuth 오류 | 같은 구조에 `bg/danger-subtle` + `text/danger` |
| Google 버튼 | Button Secondary Medium, 높이 48, 폭 100%, `/google.png` 20px + `Google로 계속하기` |
| ID 로그인 | 토글 대신 `또는 아이디로 로그인` 구분선(Caption, `text/tertiary`, 양옆 `border/default` 선)과 항상 펼친 폼을 제안한다. 입력은 Input(아이콘 없음, 높이 48), 비밀번호 칸 오른쪽에 눈 아이콘 `icon/secondary` — **확인 필요** (토글을 유지할지) |
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

## 7. 코드 반영 계획 (제안, 미착수)

1. `globals.css`에 2-1절 토큰을 CSS 변수로 추가하고, `@theme inline`에 연결한다. `.dark`의 기존 표면 값은 유지한다.
2. `btn-primary`, `btn-secondary`, `input-base`, `page-title` 등 기존 유틸리티를 새 토큰 기준으로 바꾼다. 유틸리티를 쓰는 화면은 한 번에 바뀐다.
3. `Sidebar` / `MobileTabBar` / `Header` / `Post` / `PostComposer` / 로그인 화면 순서로 컴포넌트별로 나눠 적용한다(화면 단위 PR).
4. 앱 전체 폰트를 Noto Sans KR로 바꾼다. 관리자 화면 `admin-font.ts`와 같은 woff2를 쓰고, 크기(약 3.9MB)와 preload 정책을 함께 검토한다.
5. 관리자 화면의 별도 팔레트(`#667085`, `#315ef5` 등)를 통일할지 결정한다 — **사용자 결정 필요**
6. 각 단계마다 `npm run lint`, `npm test`, `npm run build`를 실행하고, 라이트·다크와 모바일·데스크톱 화면을 확인한다.

## 8. 작업 기록

| 일자 | 내용 |
|---|---|
| 2026-11-04 | 코드 진단(1절). Figma 파일 생성, 변수 93개(Primitives 33, Light·Dark 각 24, Dimension 12), 텍스트 스타일 7개, 이펙트 스타일 2개 생성 |
| 2026-11-04 | 아이콘 21종, 컴포넌트 세트 8개, Post Card·Post Composer 생성 |
| 2026-11-04 | 홈 피드 화면 3개(데스크톱 Light/Dark, 모바일) 생성. Foundations 문서 페이지 작성. 각 결과물을 Figma 스크린샷으로 확인 |
| 2026-11-04 | D10 대비 문제 발견. Figma 반영 전에 MCP 호출 한도에 걸림. 로그인 화면은 이 문서에 명세만 작성 |
