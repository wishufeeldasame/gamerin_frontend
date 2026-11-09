# 공개 탐색 로그인 모달

2026-11-07 작성 · 2026-11-08 갱신 · 기준: `feature/design-v2` `a69469d`.

FE 이슈 #187은 [PR #194](https://github.com/wishufeeldasame/gamerin_frontend/pull/194)(구현 최종 `f3baf30`, 병합 `6a894b1`)로 완료했다. BE 이슈 #189의 [PR #191](https://github.com/wishufeeldasame/gamerin_backend/pull/191)도 병합했다. 후속 [PR #199](https://github.com/wishufeeldasame/gamerin_frontend/pull/199)(`3de177a`, 병합 `b0ac95f`)에서 계정 화면·가입 2단계·설정과 워드마크 IN 색상 `#F8C24A`를 정리했다. 병합과 운영 배포는 구분한다.

[Figma 시안 6종](https://www.figma.com/design/e4aQUNEbh9n2aXiStJYniH?node-id=73-2)

공개 피드·게시물·프로필·멘토링 조회는 로그인 없이 허용한다. 회원 전용 행동을 선택하면 현재 화면 위 중앙 모달을 연다. 모바일도 바텀 시트로 바꾸지 않는다. 프론트 PR #194(이슈 #187)에서 `/login`·`/home` 페이지를 제거하고 메인을 `/`로 통일했다. 회원가입은 `/signup`으로 분리했다. OAuth 콜백과 가입·계정 복구 페이지는 유지한다.

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

- OAuth 이메일 미인증·탈퇴 계정 오류는 `/?login=1&error=...`의 중앙 모달에 안내한다. 삭제한 `/login`으로 이동하지 않는다.

## 구현·검증 기록

- 구현: `src/app/auth/_components/LoginPromptProvider.tsx`의 `LoginDialog`. 별도 로그인 페이지는 없고, Google·아이디 로그인과 가입·복구 링크를 제공한다.
- PR #194 최종 후속 기록: 단위/컴포넌트 1,144개·lint·build 통과, Playwright 579개 수집. 사용자 요청으로 당시 브라우저/E2E 실행·Google 실로그인은 생략했다.
- PR #199의 인증·설정 E2E는 최초 105개 중 99개 통과, 이전 설정 기대값 6개 수정 후 관련 8개 재검증 통과다. 실제 이메일·Google·iOS는 미검증이다.
- 이번 갱신은 코드·커밋·GitHub PR 대조이며 브라우저 실행이나 Figma/PNG 재생성은 하지 않았다. 전체 상태는 [README 8-1·9절](README.md)을 따른다.
