# 디자인 시안 기록

작성일: 2026-11-05 · 코드 확인 기준: frontend `develop` `d3fee9b`

[README.md](README.md)의 디자인 시스템 v2(노란 브랜드) 이후 사용자 피드백에 따라 만든 시안을 순서대로 정리한다. 모든 이미지는 **시안(목업)**이며, 앱 코드(`src/`)에는 아직 반영하지 않았다. 화면 속 사람·숫자·영상 썸네일은 예시 데이터다. 영상 썸네일은 특정 게임 화면을 따라 그리지 않은 범용 일러스트다.

## 요약

| 시안 | 방향 | 결과 |
|---|---|---|
| v2 (Figma) | 노란 브랜드 토큰 + 홈 피드 화면 | [README.md](README.md) 2~4절. 사용자 평가: 깔끔함 |
| A | 현재 레이아웃 유지, 색 배치만 v2 | 비교 이미지 제공 |
| T | Twitter형 레이아웃 | **반려**: 레퍼런스를 그대로 옮김 |
| B | 현재 골격에서 조금 변형 + 영상·게임 요소 추가 | **반려**: 불필요한 요소가 많고 깔끔하지 않음 |
| C | Figma v2 구성으로 정리 | 정돈된 기준안 |
| D | C 레이아웃 + 다크·라임(Volt) 브랜드, 날 선 형태 | **최신안**, 채택 여부 결정 필요 |

## 시안 A — 현재 레이아웃 + v2 색 배치

요청: 현재 코드의 디자인(레이아웃)은 유지하고 색 배치만 v2를 적용한 홈·프로필 이미지.

제작 방법: 실제 앱을 E2E 픽스처(`e2e/support/fe8-audit.ts`)로 mock해 띄우고, 캡처 시점에만 색 override CSS를 주입했다. 앱 코드는 수정하지 않았다. 각 이미지는 왼쪽이 현재 코드, 오른쪽이 v2 색이다.

| 요소 | 현재 코드 | 시안 A |
|---|---|---|
| 헤더 | 노란 바탕(`Header.tsx:144` `bg-[#f5b93d]`), 흰 serif 로고 | 흰 바탕, 진한 로고 |
| 사이드바 활성 | 검정 바탕 + 그림자 | 연노랑 바탕 + 노란 아이콘 |
| Primary 버튼(게시, 프로필 수정) | 검정 | 노랑 + 진한 글자 |
| 이니셜 아바타 | 검정 | 연노랑 + 갈색 글자 |
| 해시태그 | 초록(`text-emerald-700`) | `text/brand` |
| 좋아요·북마크 활성 | 빨강·검정 | 노랑 |
| 프로필 비활성 탭 | `text-zinc-300`(흰 바탕 대비 약 1.5:1) | `#71717A` |

결정과 이유:

- 바탕은 `bg/canvas`(#FAFAFA) 대신 흰색을 유지했다. 기존 레이아웃의 흰 sticky 영역(피드 탭 바, 오른쪽 열, 프로필 탭 바)과 경계가 생겨 띠처럼 보였기 때문이다.
- 헤더에서 노랑이 빠지면 브랜드 인상이 약해진다. 노란 헤더를 유지하고 로고 글자만 진하게 바꾸는 절충안을 제안했다(사용자 결정 전).

| 홈 데스크톱 | 프로필 데스크톱 |
|---|---|
| ![](mockups/a-current-layout-v2-colors/home-desktop-compare.png) | ![](mockups/a-current-layout-v2-colors/profile-desktop-compare.png) |
| 홈 모바일 | 프로필 모바일 |
| ![](mockups/a-current-layout-v2-colors/home-mobile-compare.png) | ![](mockups/a-current-layout-v2-colors/profile-mobile-compare.png) |

## 시안 T — Twitter형 (반려)

요청: SNS에 어울리는 Twitter-like 레이아웃. PC 화면 영상이 많이 올라간다는 전제.

만든 것: 3단(왼쪽 아이콘+라벨 메뉴, 가운데 600px 구분선 목록, 오른쪽 위젯) 구조와 16:9 영상 썸네일, 조회수·게임 태그.

반려 이유(사용자 피드백): "Twitter-like"는 Twitter를 그대로 가져오라는 뜻이 아니었다. 레퍼런스는 참고만 하고, 현재 레이아웃과 Figma 레이아웃에서 조금만 벗어나야 한다.

| 피드 | 프로필 |
|---|---|
| ![](mockups/t-twitter-like/feed-desktop.png) | ![](mockups/t-twitter-like/profile-desktop.png) |

## 시안 B — 현재 골격 변형 (반려)

요청: 현재·Figma 레이아웃에서 살짝 벗어난 느낌. 헤더 오른쪽의 프로필·메시지는 중복이니 지우고 알림만 남기거나 다른 것을 추가.

만든 것: 헤더 오른쪽에 `클립 올리기`와 알림, 사이드바 "내 게임" 바로가기, 세그먼트 탭(추천/팔로잉/클립), 카드 폭에 꽉 찬 영상, 오른쪽 "오늘의 클립" 순위.

반려 이유(사용자 피드백): 오늘의 클립, 내 게임, 클립 탭, 클립 올리기 버튼이 불필요하다. 어제 Figma 시안보다 깔끔하지 않다.

교훈: 기능을 덧붙여 "게임 SNS다움"을 보여주려 하지 말고, 요청한 범위 안에서 정돈하는 쪽을 우선한다.

| 피드 | 프로필 |
|---|---|
| ![](mockups/b-current-skeleton-variation/feed-desktop.png) | ![](mockups/b-current-skeleton-variation/profile-desktop.png) |

## 시안 C — Figma v2 구성 기준안

요청: B에서 지적한 요소를 모두 빼고 더 깔끔하게.

결정:

- 헤더: 로고, 검색, **알림만**. 프로필·메시지·로그아웃은 사이드바·하단 탭과 겹치므로 헤더에서 뺐다.
- 사이드바: 현재 코드와 같은 메뉴 6개만 둔다. 계정과 로그아웃은 하단 한 곳에 둔다.
- 피드: 밑줄 탭(추천/팔로잉), 작성창 카드, Figma Post Card 구조의 게시물. 게임 이름은 `@핸들 · 시간 · 게임` 한 줄에 넣는다.
- 영상: 16:9 비율에 radius md, 반투명 검정 재생 버튼, 재생 시간만 표시. 조회수는 액션 줄로 옮겼다. 0인 숫자는 숨긴다.
- 오른쪽 열: 추천 플레이어와 푸터만 둔다.
- 노란 Primary 버튼은 화면당 1개다(피드는 `게시하기`, 프로필은 `팔로우`).

검증: 첫 모바일 캡처에서 액션 줄 최소 폭 때문에 페이지가 403px로 넘쳤다. `min-width: 0`으로 고친 뒤 390px임을 측정했다.

| 피드 | 프로필 |
|---|---|
| ![](mockups/c-figma-v2-layout/feed-desktop.png) | ![](mockups/c-figma-v2-layout/profile-desktop.png) |
| ![](mockups/c-figma-v2-layout/feed-mobile.png) | ![](mockups/c-figma-v2-layout/profile-mobile.png) |

## 시안 D — 다크 + Volt (최신안)

요청: op.gg·dak.gg 같은 전적 사이트를 참고해 노랑이 아닌 브랜드 색을 잡는다. 둥글고 귀여운 느낌 대신 게이머가 좋아하는 세련되고 멋있는 감성으로 하되, 과한 RGB 느낌은 피하고 깔끔함을 20% 이상 유지한다.

참고 근거: 레퍼런스 사이트 화면은 작업 중 직접 열어 대조하지 않았다. "어두운 바탕, 작은 반경, 숫자 중심 정보, 승/패 색 구분"은 일반적인 전적 사이트 인상에 기반한 **추정**이다. 레퍼런스의 브랜드 색과 로고는 가져오지 않았다.

| # | 결정 | 이유 |
|---|---|---|
| D-1 | 브랜드 색 Volt `#C3F53C`(라임) 1색 | 블루(전적 사이트·디스코드), 퍼플(트위치) 계열과 겹치지 않는다. 그라데이션·글로우 없이 단색 포인트로만 쓴다. |
| D-2 | 다크 기본: bg `#0B0D10`, surface `#12151A`, raised `#181C22`, line `#22272F` | 게임 화면과 전적 사이트에 익숙한 사용자 맥락. 무채색 단계로 깔끔함을 유지한다. |
| D-3 | 텍스트 `#E8EAED` / `#A3A9B2` / `#80868F` | tertiary `#80868F`는 surface `#12151A` 위 대비 약 5.0:1(WCAG 상대 휘도 공식 계산 근사치)로 본문 기준 4.5:1을 넘긴다. |
| D-4 | 반경 3/4/6px, 아바타는 각진 사각형(6px) | "둥글고 귀여운" 인상을 없앤다. |
| D-5 | 로고: 기울인 라임 막대 + 자간 넓힌 `GAMERIN` | 각진 인상과 브랜드 색을 한 요소에 담는다. |
| D-6 | 티어·게임명은 작은 영문 대문자 라벨, 숫자는 고정폭 | 전적 사이트식 정보 밀도. 라벨 외 본문에는 쓰지 않는다. |
| D-7 | 승/패 색: 승 Volt, 패 `#F0596A` | 승률 바와 최근 20게임 스트립에서만 쓴다. |
| D-8 | Volt 사용처 제한: Primary 버튼 1개, 활성 메뉴 아이콘·2px 표시선, 탭 밑줄, 좋아요, 해시태그, 승리 표시 | 포인트 색이 화면 전체에 번지지 않게 한다. |
| D-9 | 게시물 영상 아래 경기 결과 줄(WIN/LOSS, 맵, 스코어, K/D/A, ACS) | 게임 SNS만의 정보. 모바일에서는 결과·스코어·K/D/A만 남긴다. |
| D-10 | 프로필 전적 띠: 랭크, 승률 바, K/D, 헤드샷, 최근 20게임 | "게이머의 이력서"라는 서비스 설명(`src/app/layout.tsx` metadata)에 맞춘다. |

확인 필요:

- D-9·D-10에 필요한 데이터(게시물과 경기 연결, 헤드샷 비율, 최근 경기)가 백엔드에 있는지 대조하지 않았다. 현재 프론트에는 전적 연동(`src/lib/game-stats-api.ts`)이 있다. 데이터가 없으면 경기 결과 줄을 빼도 레이아웃은 유지된다.
- 라이트 모드는 만들지 않았다. Volt는 흰 바탕 위 글자로는 대비가 낮아 라이트 모드용 진한 라임이 따로 필요하다.
- 라임이 과하면 같은 구성에서 색만 바꾼 대안(예: 시안 `#2FD6C3`)을 비교할 수 있다.

검증: 추천 플레이어 보조 정보와 모바일 경기 결과 줄의 줄바꿈을 고쳤다. 모바일 페이지 폭이 390px로 넘치지 않음을 측정했다.

| 피드 | 프로필 |
|---|---|
| ![](mockups/d-dark-volt/feed-desktop.png) | ![](mockups/d-dark-volt/profile-desktop.png) |
| ![](mockups/d-dark-volt/feed-mobile.png) | ![](mockups/d-dark-volt/profile-mobile.png) |

## 재현 방법

소스는 [mockups/source/](mockups/source/)에 있다. 경로는 저장소 기준 상대경로다.

### 시안 A (실제 앱 캡처)

1. `npm ci` 후 `npm run dev -- --hostname 127.0.0.1 --port 3000`으로 개발 서버를 실행한다.
2. `mockups/source/capture-current-app/`에서 아래를 실행한다. Node 22의 `--experimental-strip-types`가 필요하다.
   - `node --experimental-strip-types capture.mts <작업 디렉터리>/shots/before`: 현재 색으로 찍는다(개발용 Next 표시를 숨기려면 `nextjs-portal{display:none!important}`만 담은 CSS 파일을 두 번째 인자로 준다).
   - `node --experimental-strip-types capture.mts <작업 디렉터리>/shots/after ds-v2-colors.css`: v2 색으로 찍는다.
   - `python3 compose.py <작업 디렉터리>`: `shots/before`와 `shots/after`를 나란히 붙여 `<작업 디렉터리>/final/`에 저장한다. Pillow가 필요하다.
3. `capture.mts`는 `require('playwright')`로 브라우저를 띄운다. 환경에 맞는 Playwright·Chromium이 필요하다.

### 시안 T·B·C·D (정적 HTML 목업)

1. `mockups/source/static-mockups/`에서 `node build.mjs`(T), `build2.mjs`(B), `build3.mjs`(C), `build4.mjs`(D) 중 하나를 실행하면 같은 폴더에 HTML이 생성된다. 생성된 HTML은 커밋하지 않는다.
2. `node shoot.mjs <출력 디렉터리> <페이지 이름...>`(예: `feed4 profile4`)으로 1440px·390px 캡처를 만든다. 설치된 Playwright와 브라우저 버전이 다르면 `CHROMIUM_PATH`로 Chromium 실행 파일을 지정한다.
3. 폰트는 저장소의 `src/app/(admin)/admin/_fonts/NotoSansKR-VF.woff2`를 상대경로로 읽는다.
4. 아이콘 데이터 `icons.json`은 `node icons.mjs <lucide-react 패키지 디렉터리>`로 다시 만들 수 있다. 기준은 `package-lock.json`의 lucide-react 1.8.0이다.
5. 시안 T의 `shoot`은 페이지 이름 `feed profile`이다(`build.mjs`가 `feed.html`, `profile.html` 생성).
