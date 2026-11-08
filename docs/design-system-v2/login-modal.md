# 공개 탐색 로그인 모달

2026-11-07 · FE #187 / BE #189 · 디자인·프론트 구현 완료, PR 검토 대기.

[Figma 시안 6종](https://www.figma.com/design/e4aQUNEbh9n2aXiStJYniH?node-id=73-2)

공개 피드·게시물·프로필·멘토링 조회는 로그인 없이 허용한다. 회원 전용 행동을 선택하면 현재 화면 위 중앙 모달을 연다. 모바일도 바텀 시트로 바꾸지 않는다. 프론트 #187에서 `/login`·`/home` 페이지를 제거하고 메인을 `/`로 통일했다. 회원가입은 `/signup`으로 분리했다. OAuth 콜백과 가입·계정 복구 페이지는 유지한다.

## 구성과 토큰

- 데스크톱: 440px 폭, 패딩 28px. 모바일: 좌우 16px, 패딩 20px. 375·320px에서도 가운데 배치한다.
- 모달 표면 `bg/surface`, 입력·Google 버튼 `bg/subtle`, 테두리 `border/default`, 본문 `text/primary`, 작은 보조 글자 `text/tertiary`. 다크 입력 보조 글자는 `text/tertiary` #94949E를 사용한다(#2B2B31 위 4.68:1). 라이트 입력 안내는 `text/secondary` #52525B를 사용해 대비 4.5:1 이상을 확보한다. 모달 반경 20px, 입력·버튼 반경 10px.
- 제목 F18 `다시 오신 걸 환영해요`, Google 버튼·로그인 버튼 높이 48px. F19 `또는 아이디로 로그인` 아래 폼을 항상 펼친다. 닫기 터치 영역 44px.
- 행동별 설명을 바꾼다. 예: `댓글을 남기려면 로그인이 필요해요.` 입력 오류는 해당 필드 아래 표시한다. 요청 중 중복 제출을 막고 상태를 알린다.

## 동작 계약

- 회원 API 호출·낙관적 변경·업로드 시작 전에 로그인 여부를 확인한다. 정상 게스트와 인증 복원 실패·정지 계정을 구분한다.
- `role=dialog`, `aria-modal`, 제목 연결, 포커스 이동·트랩·복귀, Esc/닫기와 배경 스크롤 잠금을 적용한다. 화면 높이가 부족하거나 키보드가 열리면 모달 내부를 스크롤한다.
- 닫으면 기존 화면·스크롤·탭을 유지한다. 보호 URL 직접 진입에서는 개인 UI/API 없이 모달을 보이고, 닫으면 `/`로 이동한다.
- 로그인 성공 후 현재 화면 개인화만 다시 읽는다. 댓글·좋아요·등록·신청·결제 등 대기하던 쓰기는 자동 실행하지 않는다.
- OAuth `returnTo`는 동일 출처의 안전한 경로·쿼리·가능한 앵커만 저장한다. 외부 URL·`//host`·인증 경로 반복은 거절하며 기본 복귀 경로는 `/`다.
- 결제 결과 콜백에서 재로그인이 필요하면 콜백을 벗어나 `/`에서 모달을 연다. 복귀는 `/wallet?tab=payments` 읽기 화면이며 승인 요청을 자동 재개하지 않는다. PG 토큰을 returnTo에 보관하지 않는다.
- ID 로그인은 모달에 머무르고, Google 로그인은 기존 인증 콜백을 유지한다. 가입·복구 링크는 기존 페이지를 이용한다.

## 내보내기

| 테마 | 1440 × 1024 | 375 × 812 | 320 × 740 |
| --- | --- | --- | --- |
| 다크 | [데스크톱](mockups/final-amber/login-modal/dark/desktop.png) | [375](mockups/final-amber/login-modal/dark/mobile-375.png) | [320](mockups/final-amber/login-modal/dark/mobile-320.png) |
| 라이트 | [데스크톱](mockups/final-amber/login-modal/light/desktop.png) | [375](mockups/final-amber/login-modal/light/mobile-375.png) | [320](mockups/final-amber/login-modal/light/mobile-320.png) |

기존 전체 로그인 페이지 시안은 이전 기록으로 남긴다. 이 문서와 `login-modal/` 이미지가 로그인 UI의 최신 기준이다. 배경은 기존 홈 시안을 재사용한 예시다. 브라우저 조작 없이 Figma 렌더를 확인했다.
