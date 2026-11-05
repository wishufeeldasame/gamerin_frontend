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
| D | C 레이아웃 + 다크·라임(Volt) 브랜드, 날 선 형태 | **반려**: "딸깍"·양산형 플랫폼 느낌 |
| E~J | 다크 공통 레이아웃(테두리 없는 카드) + 브랜드 색 6종 | J(Amber)·H(Violet)로 좁힌 뒤 **J 확정** |
| L1 / L2 | 알림·지갑 위치를 바꾼 레이아웃 2종 | **L2(사이드바 통합형) 확정** |
| 확정안 | L2 + Amber, 데스크톱·모바일·탭·상태 화면 | Figma 현행 파일, `mockups/final-amber/` |
| 나머지 화면 | 관리자 제외 31종 × 데스크톱·모바일 × 다크·라이트 | `mockups/final-amber/more/`(126장) |

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

## 시안 D — 다크 + Volt (반려)

반려 이유(사용자 피드백): 나쁘지 않지만 "딸깍" 느낌이 강해 양산형 플랫폼처럼 보인다. 다크 기본과 색 방향은 괜찮으니 여러 색으로 시안을 더 만들어 보라는 요청으로 이어졌다(시안 E~J).

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

## 시안 E~J — 다크 공통 레이아웃 + 브랜드 색 6종

요청: 시안 D는 "딸깍"·양산형 느낌이 강하다. 기본 다크 모드와 색 방향은 괜찮으니 여러 색으로 시안을 만든다.

D가 양산형으로 보인 원인을 이렇게 판단했다(**추정**). 모든 요소를 1px 테두리 박스로 감쌌고, 대문자 영문 라벨·티어 알약 배지를 반복했고, 강조색을 여러 곳에 썼다. 그래서 E~J는 레이아웃 하나를 공통으로 쓰고 색만 바꿨다.

- 카드 테두리를 없애고 바탕 명도 차이로만 영역을 나눴다.
- 티어·게임은 흐린 글자로, 아바타는 원형으로 했다.
- 브랜드 색은 활성 메뉴, Primary 버튼, 탭 밑줄, 좋아요, 알림 점, 로고 `IN`에만 쓴다.
- 색은 Figma `Brand` 변수 컬렉션의 모드로만 바꾼다.

| 시안 | 브랜드 색 | 결과 |
|---|---|---|
| E Volt | `#C3F53C` (시안 D와 같은 색) | — |
| F Teal | `#2FD6C3` | — |
| G Coral | `#FF6B57` | — |
| H Violet | `#9B8CFF` | 후보로 남김 |
| I Ice | `#5CB8FF` | — |
| J Amber | `#F5B93D` (기존 노랑을 다크에 적용) | **확정** |

| E Volt | F Teal | G Coral |
|---|---|---|
| ![](mockups/e-j-dark-colors/e-volt.png) | ![](mockups/e-j-dark-colors/f-teal.png) | ![](mockups/e-j-dark-colors/g-coral.png) |
| **H Violet** | **I Ice** | **J Amber** |
| ![](mockups/e-j-dark-colors/h-violet.png) | ![](mockups/e-j-dark-colors/i-ice.png) | ![](mockups/e-j-dark-colors/j-amber.png) |

## 레이아웃 L1 · L2 — 알림·지갑 위치

요청: 알림 버튼과 내 지갑의 위치가 애매하다.

판단:

- 알림은 1440px 화면 맨 오른쪽(x≈1400)에 있었는데, 콘텐츠는 x 374~1314 안에 있어서 떨어져 보였다.
- 지갑은 마일리지 충전 기능이라 매일 가는 목적지가 아니다. 그런데 홈·메시지와 같은 메뉴 줄에 있었다(현재 코드는 데스크톱 사이드바 전용, `Sidebar.tsx:19-20`).

| 안 | 구성 | 결과 |
|---|---|---|
| L1 헤더 정렬형 | 헤더를 아래 열에 맞춰 정렬(검색 = 피드 폭, 알림 = 오른쪽 열 끝). 지갑은 사이드바 하단 계정 카드로 이동 | — |
| L2 사이드바 통합형 | 헤더를 없애고 알림을 사이드바 메뉴(숫자 배지)로. 지갑은 L1과 같음 | **채택** |

후속 결정(사용자 요청):

- 알림은 별도 페이지가 아니라 모달처럼, 왼쪽에서 오른쪽으로 슬라이드되는 패널로 연다.
- 검색창도 사이드바 메뉴로 옮기고, 같은 슬라이드 패널을 쓴다. Enter를 누르면 지금처럼 `/search?q=` 결과 페이지로 간다.

| L1 | L2(첫 안) |
|---|---|
| ![](mockups/l1-l2-layouts/l1-header-aligned.png) | ![](mockups/l1-l2-layouts/l2-sidebar-integrated.png) |

### L2 다듬기 (비평 후 수정)

`design-critique` 틀(첫인상·사용성·위계·일관성·접근성)로 점검한 뒤 고쳤다.

1. **대비:** Dark `text/tertiary` `#71717A`가 카드 바탕 `#151518` 위 3.77:1이라 작은 글자 기준(4.5:1)에 못 미쳤다. `neutral/450` `#8B8B94`(5.40:1)를 추가했다. WCAG 공식으로 계산했다.
2. **가로 균형:** 사이드바·피드·오른쪽 열(1212px)을 가운데 정렬했다. 왼쪽 쏠림과 142px 빈 간격이 없어졌다.
3. **강조:** 활성 메뉴를 브랜드색 바탕 → 회색 바탕 + 브랜드 아이콘으로 바꿨다. 빈 작성창의 `게시` 버튼은 비활성 모양으로 했다.
4. **게임 이름:** 게시물 헤더 오른쪽 끝에서 `@핸들 · 시간 · 게임` 줄로 옮겼다.
5. **일관성:** 팔로우 버튼을 반경 10 · 회색 바탕으로 맞추고, 오른쪽 열 제목을 탭과 같은 높이로 맞췄다.

| 다듬기 전 | 다듬은 뒤(확정 홈) |
|---|---|
| ![](mockups/l1-l2-layouts/l2-before-polish.png) | ![](mockups/final-amber/desktop/home.png) |

## 확정안 — L2 + Amber

사용자 확정: 다크 기본, 브랜드 Amber `#F5B93D`, L2 레이아웃. 결정 목록은 [README.md](README.md) 2-1절(F1~F13)에 있다. 화면은 현행 Figma 파일의 `Screens`·`Mobile`·`Light`·`Screens · FHD` 페이지에 있다. Violet 버전도 `Screens`·`Mobile`에 비교용으로 남겼다.

프로필에는 커버 사진을 넣었다(F12). 커버는 현재 코드에 있는 기능인데 첫 확정안 이미지에서 빠져 있었다. 아래 프로필 이미지는 커버를 넣은 버전으로 교체했다. 사진이 없을 때의 기본 이미지 `public/images/default-profile-cover.svg`를 Figma `Profile Cover` 컴포넌트로 옮겼다. SVG의 격자 패턴은 Figma로 가져올 때 빠져서, 같은 56px 간격의 선으로 다시 그렸다.

화면 문구와 항목은 현재 코드를 근거로 했다.

| 화면 | 근거 |
|---|---|
| 검색 결과 탭 | `search/page.tsx` 전체/사용자/게시글/해시태그 |
| 북마크 | `bookmarks/page.tsx` 모음집·전체 북마크·미분류, `SaveToCollectionModal.tsx` `새 모음집` |
| 프로필 | `profile/[userId]/page.tsx` 게시물/전적/미디어 탭, 팔로워·팔로잉·게시물, 인증된 전적·실시간 연동·연결된 계정, 미디어 3열 정사각형 격자 |
| 전적 | `game-stats-api.ts`의 LoL·PUBG·R6, 티어·K/D(KDA)·승률·판수 |
| 내 지갑 | `wallet/page.tsx` 현재 마일리지, 충전 금액 선택, `카카오페이로 N원 결제`, 1원당 1마일리지, 마일리지/결제 내역, `멤버십 혜택` |
| 멘토링 | `mentoring/page.tsx` 탭 4개, 신청 상태 7종(`statusLabel`)과 상태별 안내 문구·버튼, 내 프로그램·멘토 등록 요청·프로그램 상세 항목 |
| 멤버십 | `membership/page.tsx` 이용권·이용 중·만료일·연장, 혜택 3개와 안내 문구 |
| 상태 | 홈 `피드를 불러오지 못했습니다.`, 북마크 `아직 저장한 게시물이 없어요`, 검색 `{종류} 결과가 없습니다.`, `SessionUnavailableNotice` |

예시 데이터와 제안 문구:

- 사람·숫자·날짜는 예시다. 충전 금액 4종과 멤버십 가격 4,900원도 예시이며, 실제 값은 서버 상품 정보에서 온다.
- 홈 오류의 둘째 줄과 멘토 되기 안내의 "관리자 검토를 거쳐"는 코드에 없는 제안 문구다.

### 데스크톱

| 홈 | 알림 패널 | 검색 패널 |
|---|---|---|
| ![](mockups/final-amber/desktop/home.png) | ![](mockups/final-amber/desktop/notification-panel.png) | ![](mockups/final-amber/desktop/search-panel.png) |
| **검색 결과** | **북마크** | **프로필 · 게시물** |
| ![](mockups/final-amber/desktop/search-results.png) | ![](mockups/final-amber/desktop/bookmarks.png) | ![](mockups/final-amber/desktop/profile.png) |
| **프로필 · 전적** | **프로필 · 미디어** | **내 지갑** |
| ![](mockups/final-amber/desktop/profile-stats-tab.png) | ![](mockups/final-amber/desktop/profile-media-tab.png) | ![](mockups/final-amber/desktop/wallet.png) |
| **멘토링 · 멘토 찾기** | **멘토링 · 내 멘토링** | **멘토링 · 내 프로그램** |
| ![](mockups/final-amber/desktop/mentoring.png) | ![](mockups/final-amber/desktop/mentoring-mine-tab.png) | ![](mockups/final-amber/desktop/mentoring-programs-tab.png) |
| **멘토링 · 멘토 되기** | **프로그램 상세 모달** | **멤버십 · 미가입** |
| ![](mockups/final-amber/desktop/mentoring-become-tab.png) | ![](mockups/final-amber/desktop/mentoring-program-detail.png) | ![](mockups/final-amber/desktop/membership-join.png) |
| **멤버십 · 이용 중** | | |
| ![](mockups/final-amber/desktop/membership-active.png) | | |

### 상태

| 홈 로딩 | 홈 오류 | 북마크 빈 상태 |
|---|---|---|
| ![](mockups/final-amber/states/home-loading.png) | ![](mockups/final-amber/states/home-error.png) | ![](mockups/final-amber/states/bookmarks-empty.png) |
| **검색 결과 없음** | **세션 확인 실패** | |
| ![](mockups/final-amber/states/search-no-results.png) | ![](mockups/final-amber/states/session-unavailable.png) | |

### 모바일 (390×844)

- 하단 탭 5칸은 현재 코드와 같다.
- 상단 바는 로고·검색·알림이다.
- 검색은 전체 화면 패널이고 키보드 자리는 회색 상자로만 표시했다.
- 알림은 뒤로 가기가 있는 페이지다.
- 지갑은 내 프로필의 마일리지 카드로 들어간다. 지갑·멤버십 화면에서는 하단 탭의 `프로필`을 활성으로 두었다.
- 작성 칸은 두 줄로, 아랫줄에 동영상·사진·해시태그 버튼과 `게시`를 둔다.

| 홈 | 검색 패널 | 알림 | 북마크 |
|---|---|---|---|
| ![](mockups/final-amber/mobile/home.png) | ![](mockups/final-amber/mobile/search-panel.png) | ![](mockups/final-amber/mobile/notifications.png) | ![](mockups/final-amber/mobile/bookmarks.png) |
| **프로필** | **내 지갑** | **멘토링** | **멤버십** |
| ![](mockups/final-amber/mobile/profile.png) | ![](mockups/final-amber/mobile/wallet.png) | ![](mockups/final-amber/mobile/mentoring.png) | ![](mockups/final-amber/mobile/membership.png) |

### 라이트 모드

다크가 기본이지만 라이트도 제공한다(F13). 같은 화면을 `Color` 변수 모드만 Light로 바꿔 만들었다. 다크에서 없앤 카드 테두리 때문에 흰 카드가 바탕에 묻혀서, 라이트에서만 보이는 `border/card` 1px 테두리를 추가했다. 모바일 검색 패널의 키보드 자리는 라이트에서 밝은 회색으로 바꿨다.

| 홈 | 알림 패널 | 검색 패널 |
|---|---|---|
| ![](mockups/final-amber/light/desktop/home.png) | ![](mockups/final-amber/light/desktop/notification-panel.png) | ![](mockups/final-amber/light/desktop/search-panel.png) |
| **검색 결과** | **북마크** | **프로필 · 게시물** |
| ![](mockups/final-amber/light/desktop/search-results.png) | ![](mockups/final-amber/light/desktop/bookmarks.png) | ![](mockups/final-amber/light/desktop/profile.png) |
| **프로필 · 전적** | **프로필 · 미디어** | **내 지갑** |
| ![](mockups/final-amber/light/desktop/profile-stats-tab.png) | ![](mockups/final-amber/light/desktop/profile-media-tab.png) | ![](mockups/final-amber/light/desktop/wallet.png) |
| **멘토링 · 멘토 찾기** | **멘토링 · 내 멘토링** | **멘토링 · 내 프로그램** |
| ![](mockups/final-amber/light/desktop/mentoring.png) | ![](mockups/final-amber/light/desktop/mentoring-mine-tab.png) | ![](mockups/final-amber/light/desktop/mentoring-programs-tab.png) |
| **멘토링 · 멘토 되기** | **프로그램 상세 모달** | **멤버십 · 미가입** |
| ![](mockups/final-amber/light/desktop/mentoring-become-tab.png) | ![](mockups/final-amber/light/desktop/mentoring-program-detail.png) | ![](mockups/final-amber/light/desktop/membership-join.png) |
| **멤버십 · 이용 중** | **홈 로딩** | **홈 오류** |
| ![](mockups/final-amber/light/desktop/membership-active.png) | ![](mockups/final-amber/light/desktop/state-home-loading.png) | ![](mockups/final-amber/light/desktop/state-home-error.png) |
| **북마크 빈 상태** | **검색 결과 없음** | **세션 확인 실패** |
| ![](mockups/final-amber/light/desktop/state-bookmarks-empty.png) | ![](mockups/final-amber/light/desktop/state-search-no-results.png) | ![](mockups/final-amber/light/desktop/state-session-unavailable.png) |

| 홈 | 검색 패널 | 알림 | 북마크 |
|---|---|---|---|
| ![](mockups/final-amber/light/mobile/home.png) | ![](mockups/final-amber/light/mobile/search-panel.png) | ![](mockups/final-amber/light/mobile/notifications.png) | ![](mockups/final-amber/light/mobile/bookmarks.png) |
| **프로필** | **내 지갑** | **멘토링** | **멤버십** |
| ![](mockups/final-amber/light/mobile/profile.png) | ![](mockups/final-amber/light/mobile/wallet.png) | ![](mockups/final-amber/light/mobile/mentoring.png) | ![](mockups/final-amber/light/mobile/membership.png) |

## 확정안 — 나머지 화면 (관리자 제외)

관리자 화면을 뺀 나머지 라우트와 주요 모달을 확정안 규칙으로 그렸다. 31종을 데스크톱·모바일 × 다크·라이트로 만들어 모두 126장이다. 공통 규칙은 [README.md](README.md) 2-1절 F15에 있다. 내 프로필에는 코드와 같은 설정 아이콘 버튼을 추가했다(F14). 위 확정안의 프로필 이미지는 이 버튼을 넣은 버전으로 교체했다.

| 묶음 | 화면 | 근거(코드) |
|---|---|---|
| 앱 핵심 | 메시지, 게시물 상세, 해시태그, 설정 계정·테마, 내 신고 | `messages/page.tsx`, `PostDetail.tsx`, `hashtags/[name]/page.tsx`, `settings/page.tsx`, `MyReports.tsx` |
| 로그인·계정 | 로그인, 회원가입 1·2단계, 소셜 가입, 아이디 찾기·결과, 비밀번호 찾기·발송, 비밀번호 재설정·링크 오류, OAuth 처리 중·오류 | `login/page.tsx`, `SignupConsent.tsx`, `auth/**`, `find-id*/page.tsx` |
| 모달 | 작성 펼침, 게시물 수정, 프로필 수정, 모음집 저장, 공유, 신고, 게임 전적 연동, 카카오페이 결제 | `PostComposer.tsx`, `EditPostModal.tsx`, `EditProfileModal.tsx`, `SaveToCollectionModal.tsx`, `SharePostModal.tsx`, `Report.tsx`, `FetchGameStatsModal.tsx`, `KakaoPaymentDialog.tsx` |
| 기타 | 결제 결과(충전 완료·확인 중·미완료), 이용약관, 개인정보 처리방침 | `payments/result/page.tsx`, `(legal)/**` |

예시·추정:
- 신고 사유는 서버 목록이라 예시다.
- 모음집 모달 제목 "모음집에 저장"과 버튼 "완료", 신고 모달 제목 "신고하기", 공유 링크 주소, OAuth 처리 중 설명 한 줄은 코드에서 확인하지 못한 문구다.
- 전적 연동 목록은 코드의 7개 게임 중 5개를 보여 준다. 연동 가능한 LoL·PUBG·R6 외에는 "지원 예정"으로 표시했다.
- 개인정보 처리방침은 조항 제목만 넣었다.
- Google·게임 아이콘은 회색 자리 표시다.
- 로그인 왼쪽 브랜드 패널은 이미지 영역이라 라이트에서도 어둡게 둔다.

### 데스크톱 · 다크

|   |   |   |
|---|---|---|
| **메시지** | **게시물 상세** | **해시태그** |
| ![](mockups/final-amber/more/dark/desktop/messages.png) | ![](mockups/final-amber/more/dark/desktop/post-detail.png) | ![](mockups/final-amber/more/dark/desktop/hashtag.png) |
| **설정 · 계정** | **설정 · 테마** | **내 신고** |
| ![](mockups/final-amber/more/dark/desktop/settings-account.png) | ![](mockups/final-amber/more/dark/desktop/settings-theme.png) | ![](mockups/final-amber/more/dark/desktop/my-reports.png) |
| **로그인** | **회원가입 1단계** | **회원가입 2단계** |
| ![](mockups/final-amber/more/dark/desktop/login.png) | ![](mockups/final-amber/more/dark/desktop/signup-step1.png) | ![](mockups/final-amber/more/dark/desktop/signup-step2.png) |
| **소셜 가입** | **아이디 찾기** | **아이디 찾기 결과** |
| ![](mockups/final-amber/more/dark/desktop/social-signup.png) | ![](mockups/final-amber/more/dark/desktop/find-id.png) | ![](mockups/final-amber/more/dark/desktop/find-id-result.png) |
| **비밀번호 찾기** | **비밀번호 찾기 · 발송** | **비밀번호 재설정** |
| ![](mockups/final-amber/more/dark/desktop/forgot-password.png) | ![](mockups/final-amber/more/dark/desktop/forgot-password-sent.png) | ![](mockups/final-amber/more/dark/desktop/reset-password.png) |
| **재설정 링크 오류** | **OAuth 처리 중** | **OAuth 오류** |
| ![](mockups/final-amber/more/dark/desktop/reset-password-invalid.png) | ![](mockups/final-amber/more/dark/desktop/oauth-processing.png) | ![](mockups/final-amber/more/dark/desktop/oauth-error.png) |
| **게시물 작성 펼침** | **게시물 수정** | **프로필 수정** |
| ![](mockups/final-amber/more/dark/desktop/composer-expanded.png) | ![](mockups/final-amber/more/dark/desktop/modal-edit-post.png) | ![](mockups/final-amber/more/dark/desktop/modal-edit-profile.png) |
| **모음집 저장** | **게시글 공유** | **신고** |
| ![](mockups/final-amber/more/dark/desktop/modal-save-collection.png) | ![](mockups/final-amber/more/dark/desktop/modal-share.png) | ![](mockups/final-amber/more/dark/desktop/modal-report.png) |
| **게임 전적 연동** | **카카오페이 결제** | **결제 결과 · 충전 완료** |
| ![](mockups/final-amber/more/dark/desktop/modal-game-stats.png) | ![](mockups/final-amber/more/dark/desktop/modal-kakaopay.png) | ![](mockups/final-amber/more/dark/desktop/payment-success.png) |
| **결제 결과 · 확인 중** | **결제 결과 · 미완료** | **이용약관** |
| ![](mockups/final-amber/more/dark/desktop/payment-checking.png) | ![](mockups/final-amber/more/dark/desktop/payment-failed.png) | ![](mockups/final-amber/more/dark/desktop/terms.png) |
| **개인정보 처리방침** |  |  |
| ![](mockups/final-amber/more/dark/desktop/privacy.png) |  |  |

### 모바일 · 다크

|   |   |   |   |
|---|---|---|---|
| **메시지 목록** | **메시지 대화** | **게시물 상세** | **해시태그** |
| ![](mockups/final-amber/more/dark/mobile/messages-list.png) | ![](mockups/final-amber/more/dark/mobile/messages-chat.png) | ![](mockups/final-amber/more/dark/mobile/post-detail.png) | ![](mockups/final-amber/more/dark/mobile/hashtag.png) |
| **설정 · 계정** | **설정 · 테마** | **내 신고** | **로그인** |
| ![](mockups/final-amber/more/dark/mobile/settings-account.png) | ![](mockups/final-amber/more/dark/mobile/settings-theme.png) | ![](mockups/final-amber/more/dark/mobile/my-reports.png) | ![](mockups/final-amber/more/dark/mobile/login.png) |
| **소셜 가입** | **아이디 찾기** | **아이디 찾기 결과** | **비밀번호 찾기** |
| ![](mockups/final-amber/more/dark/mobile/social-signup.png) | ![](mockups/final-amber/more/dark/mobile/find-id.png) | ![](mockups/final-amber/more/dark/mobile/find-id-result.png) | ![](mockups/final-amber/more/dark/mobile/forgot-password.png) |
| **비밀번호 찾기 · 발송** | **비밀번호 재설정** | **재설정 링크 오류** | **회원가입 1단계** |
| ![](mockups/final-amber/more/dark/mobile/forgot-password-sent.png) | ![](mockups/final-amber/more/dark/mobile/reset-password.png) | ![](mockups/final-amber/more/dark/mobile/reset-password-invalid.png) | ![](mockups/final-amber/more/dark/mobile/signup-step1.png) |
| **회원가입 2단계** | **OAuth 처리 중** | **OAuth 오류** | **게시물 수정** |
| ![](mockups/final-amber/more/dark/mobile/signup-step2.png) | ![](mockups/final-amber/more/dark/mobile/oauth-processing.png) | ![](mockups/final-amber/more/dark/mobile/oauth-error.png) | ![](mockups/final-amber/more/dark/mobile/sheet-edit-post.png) |
| **프로필 수정** | **모음집 저장** | **게시글 공유** | **신고** |
| ![](mockups/final-amber/more/dark/mobile/sheet-edit-profile.png) | ![](mockups/final-amber/more/dark/mobile/sheet-save-collection.png) | ![](mockups/final-amber/more/dark/mobile/sheet-share.png) | ![](mockups/final-amber/more/dark/mobile/sheet-report.png) |
| **게임 전적 연동** | **카카오페이 결제** | **게시물 작성 펼침** | **결제 결과 · 충전 완료** |
| ![](mockups/final-amber/more/dark/mobile/sheet-game-stats.png) | ![](mockups/final-amber/more/dark/mobile/sheet-kakaopay.png) | ![](mockups/final-amber/more/dark/mobile/composer-expanded.png) | ![](mockups/final-amber/more/dark/mobile/payment-success.png) |
| **결제 결과 · 확인 중** | **결제 결과 · 미완료** | **이용약관** | **개인정보 처리방침** |
| ![](mockups/final-amber/more/dark/mobile/payment-checking.png) | ![](mockups/final-amber/more/dark/mobile/payment-failed.png) | ![](mockups/final-amber/more/dark/mobile/terms.png) | ![](mockups/final-amber/more/dark/mobile/privacy.png) |

### 데스크톱 · 라이트

|   |   |   |
|---|---|---|
| **메시지** | **게시물 상세** | **해시태그** |
| ![](mockups/final-amber/more/light/desktop/messages.png) | ![](mockups/final-amber/more/light/desktop/post-detail.png) | ![](mockups/final-amber/more/light/desktop/hashtag.png) |
| **설정 · 계정** | **설정 · 테마** | **내 신고** |
| ![](mockups/final-amber/more/light/desktop/settings-account.png) | ![](mockups/final-amber/more/light/desktop/settings-theme.png) | ![](mockups/final-amber/more/light/desktop/my-reports.png) |
| **로그인** | **회원가입 1단계** | **회원가입 2단계** |
| ![](mockups/final-amber/more/light/desktop/login.png) | ![](mockups/final-amber/more/light/desktop/signup-step1.png) | ![](mockups/final-amber/more/light/desktop/signup-step2.png) |
| **소셜 가입** | **아이디 찾기** | **아이디 찾기 결과** |
| ![](mockups/final-amber/more/light/desktop/social-signup.png) | ![](mockups/final-amber/more/light/desktop/find-id.png) | ![](mockups/final-amber/more/light/desktop/find-id-result.png) |
| **비밀번호 찾기** | **비밀번호 찾기 · 발송** | **비밀번호 재설정** |
| ![](mockups/final-amber/more/light/desktop/forgot-password.png) | ![](mockups/final-amber/more/light/desktop/forgot-password-sent.png) | ![](mockups/final-amber/more/light/desktop/reset-password.png) |
| **재설정 링크 오류** | **OAuth 처리 중** | **OAuth 오류** |
| ![](mockups/final-amber/more/light/desktop/reset-password-invalid.png) | ![](mockups/final-amber/more/light/desktop/oauth-processing.png) | ![](mockups/final-amber/more/light/desktop/oauth-error.png) |
| **게시물 작성 펼침** | **게시물 수정** | **프로필 수정** |
| ![](mockups/final-amber/more/light/desktop/composer-expanded.png) | ![](mockups/final-amber/more/light/desktop/modal-edit-post.png) | ![](mockups/final-amber/more/light/desktop/modal-edit-profile.png) |
| **모음집 저장** | **게시글 공유** | **신고** |
| ![](mockups/final-amber/more/light/desktop/modal-save-collection.png) | ![](mockups/final-amber/more/light/desktop/modal-share.png) | ![](mockups/final-amber/more/light/desktop/modal-report.png) |
| **게임 전적 연동** | **카카오페이 결제** | **결제 결과 · 충전 완료** |
| ![](mockups/final-amber/more/light/desktop/modal-game-stats.png) | ![](mockups/final-amber/more/light/desktop/modal-kakaopay.png) | ![](mockups/final-amber/more/light/desktop/payment-success.png) |
| **결제 결과 · 확인 중** | **결제 결과 · 미완료** | **이용약관** |
| ![](mockups/final-amber/more/light/desktop/payment-checking.png) | ![](mockups/final-amber/more/light/desktop/payment-failed.png) | ![](mockups/final-amber/more/light/desktop/terms.png) |
| **개인정보 처리방침** |  |  |
| ![](mockups/final-amber/more/light/desktop/privacy.png) |  |  |

### 모바일 · 라이트

|   |   |   |   |
|---|---|---|---|
| **메시지 목록** | **메시지 대화** | **게시물 상세** | **해시태그** |
| ![](mockups/final-amber/more/light/mobile/messages-list.png) | ![](mockups/final-amber/more/light/mobile/messages-chat.png) | ![](mockups/final-amber/more/light/mobile/post-detail.png) | ![](mockups/final-amber/more/light/mobile/hashtag.png) |
| **설정 · 계정** | **설정 · 테마** | **내 신고** | **로그인** |
| ![](mockups/final-amber/more/light/mobile/settings-account.png) | ![](mockups/final-amber/more/light/mobile/settings-theme.png) | ![](mockups/final-amber/more/light/mobile/my-reports.png) | ![](mockups/final-amber/more/light/mobile/login.png) |
| **소셜 가입** | **아이디 찾기** | **아이디 찾기 결과** | **비밀번호 찾기** |
| ![](mockups/final-amber/more/light/mobile/social-signup.png) | ![](mockups/final-amber/more/light/mobile/find-id.png) | ![](mockups/final-amber/more/light/mobile/find-id-result.png) | ![](mockups/final-amber/more/light/mobile/forgot-password.png) |
| **비밀번호 찾기 · 발송** | **비밀번호 재설정** | **재설정 링크 오류** | **회원가입 1단계** |
| ![](mockups/final-amber/more/light/mobile/forgot-password-sent.png) | ![](mockups/final-amber/more/light/mobile/reset-password.png) | ![](mockups/final-amber/more/light/mobile/reset-password-invalid.png) | ![](mockups/final-amber/more/light/mobile/signup-step1.png) |
| **회원가입 2단계** | **OAuth 처리 중** | **OAuth 오류** | **게시물 수정** |
| ![](mockups/final-amber/more/light/mobile/signup-step2.png) | ![](mockups/final-amber/more/light/mobile/oauth-processing.png) | ![](mockups/final-amber/more/light/mobile/oauth-error.png) | ![](mockups/final-amber/more/light/mobile/sheet-edit-post.png) |
| **프로필 수정** | **모음집 저장** | **게시글 공유** | **신고** |
| ![](mockups/final-amber/more/light/mobile/sheet-edit-profile.png) | ![](mockups/final-amber/more/light/mobile/sheet-save-collection.png) | ![](mockups/final-amber/more/light/mobile/sheet-share.png) | ![](mockups/final-amber/more/light/mobile/sheet-report.png) |
| **게임 전적 연동** | **카카오페이 결제** | **게시물 작성 펼침** | **결제 결과 · 충전 완료** |
| ![](mockups/final-amber/more/light/mobile/sheet-game-stats.png) | ![](mockups/final-amber/more/light/mobile/sheet-kakaopay.png) | ![](mockups/final-amber/more/light/mobile/composer-expanded.png) | ![](mockups/final-amber/more/light/mobile/payment-success.png) |
| **결제 결과 · 확인 중** | **결제 결과 · 미완료** | **이용약관** | **개인정보 처리방침** |
| ![](mockups/final-amber/more/light/mobile/payment-checking.png) | ![](mockups/final-amber/more/light/mobile/payment-failed.png) | ![](mockups/final-amber/more/light/mobile/terms.png) | ![](mockups/final-amber/more/light/mobile/privacy.png) |


## 재현 방법

시안 E~J, L1/L2, 확정안은 현행 Figma 파일([README.md](README.md) 4-1절)에 컴포넌트와 변수로 만든 편집 가능한 화면이다. 이미지는 Figma 스크린샷이며 별도 재현 스크립트는 없다. 색은 프레임의 `Brand` 변수 모드를 바꿔 전환한다.

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
