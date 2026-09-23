# AGENTS.md

이 문서는 GamerIN 프론트엔드 저장소 루트에서 Codex가 작업할 때 적용하는 팀 지침이다. 이 저장소만 클론하거나 열어도 사용할 수 있도록 공통 작업 규칙을 포함한다.

## 적용 범위와 저장소 경계

- 아래 파일 경로와 명령은 별도 설명이 없으면 **이 저장소 루트** 기준이다. 폴더 이름이 `frontend`이거나 상위에 `capstone/`이 있을 필요는 없다.
- 상위 `capstone/`의 지침을 읽거나 가져오는 것을 전제로 하지 않는다.
- `../frontend/`, `../backend/`, `../docker/`는 세 저장소를 형제로 배치했을 때의 경로 예시다. 다른 배치에서는 실제 체크아웃 경로를 사용한다.
- 다른 저장소와 연결된 변경은 접근 가능한 해당 저장소의 코드와 `AGENTS.md`(있는 경우)를 확인한다. 저장소가 없으면 현재 저장소에서 가능한 작업을 진행하고, 교차 검증하지 못한 계약과 필요한 자료를 보고한다. 경로를 추측하거나 자동으로 클론하지 않는다.
- 구현 설명은 탐색을 위한 참고이며 실제 코드와 다르면 현재 코드를 기준으로 판단한다. 설계 의도·보안 정책·작업 안전 규칙은 임의로 완화하지 않는다.
- 더 하위의 구체적인 작업 지침을 따르되, 이를 안전 정책을 완화하는 근거로 삼지 않는다.

## 작업 원칙

- 모든 답변과 완료 보고는 한국어로 작성한다.
- 작업 전에 관련 파일과 기존 구현 흐름을 확인하고, 수정 전에 변경 범위와 검증 방법을 간단히 제시한다.
- 명시적인 개발·수정·버그 해결·리팩터링·설정 변경 요청은 해당 범위의 수정 승인으로 간주한다.
- 조사·설명·검토·제안 요청만으로 파일을 수정하지 않는다. 수정 요청인지 불분명하면 변경 전에 확인한다.
- 요청 범위에 필요한 최소 변경만 수행하고 관련 없는 리팩터링이나 포맷 변경을 섞지 않는다. 큰 변경은 단계별로 진행한다.
- 기존 코드 스타일, 패키지 구조, 네이밍, API/응답 형식을 우선 유지한다.
- 확인한 사실, 추정, 권장사항, 사용자 결정이 필요한 내용을 구분하고 미확인 사항은 `확인 필요`로 표시한다.

## 멀티에이전트 사용

- 서로 독립적인 하위 작업이 둘 이상이고 병렬 수행이 속도나 품질을 실질적으로 높일 때 `.codex/agents/`의 전문 서브에이전트에 위임한다.
- 작거나 순차 의존적인 작업, 같은 파일을 동시에 수정해야 하는 작업은 메인 에이전트가 직접 처리한다.
- 작업 성격에 맞춰 `nextjs-developer`, `react-specialist`, `typescript-pro`, `ui-designer`, `accessibility-tester`, `api-designer`, `dependency-manager`, `design-bridge`, `fullstack-developer`, `test-automator`를 선택한다.
- 위임할 때 담당 범위와 파일 소유권, 완료 조건을 명확히 지정하고, 각 서브에이전트에 다른 작업자의 변경을 되돌리지 않도록 알린다.
- 메인 에이전트는 결과를 통합하고 충돌과 중복을 정리하며, 최종 코드와 검증 결과에 책임을 진다.

## Git과 작업 안전

- 이 디렉토리는 독립 Git 저장소다. 작업 시작 시 이 저장소 루트에서 `git status --short --branch`를 확인하고 기존 사용자 변경을 보존한다.
- Git 명령은 대상 저장소에서 실행한다. `capstone/`처럼 여러 저장소를 모아 둔 상위 디렉토리를 하나의 Git 저장소로 취급하지 않는다.
- commit, push, merge, rebase, reset, `checkout --`, 변경 폐기 및 대량 삭제는 사용자 승인 후 수행한다.
- 컨테이너 기동·중지·재시작(`docker compose --env-file .env up -d`, `stop`, `restart` 등)은 승인 없이 수행할 수 있다. 전후 상태를 `ps`로 확인하고, 변경한 컨테이너와 이유를 완료 보고에 명시한다.
- DB 초기화·복원, 볼륨·데이터 디렉토리 삭제(`down -v` 포함), 배포 스크립트 실행과 실제 배포 등 그 밖의 런타임 상태 변경은 사용자 승인 후 수행한다.
- DB 복원 전에는 대상 DB, 최신 백업과 복원 파일을 확인한다.

## 민감정보와 런타임 데이터

- `.env`, `.env.local`, `application-local.yaml` 및 기타 비밀 설정·키·토큰 파일은 **존재 여부만 확인**한다.
- 민감 파일은 내용을 읽거나 검색·출력·복사·수정·덮어쓰기하지 않는다. 저장소 전체 검색에서도 제외한다.
- 설정 구조는 `.env.example`, `application-local.example.yaml` 같은 공개 예제만 확인한다. 예제로 실제 비밀 설정을 자동 생성하거나 덮어쓰지 않는다.
- 키·토큰·개인정보는 로그, 문서, 응답에 남기지 않는다.
- `data/`, `backups/`, 업로드·DB·임시 파일 등 런타임 데이터는 위치와 관계없이 임의로 수정하지 않는다. 형제 배치에서는 `../data/`, `../backups/`도 해당한다.
- Docker 명령이 내부적으로 `.env`를 사용하는 것은 가능하지만 파일 내용이나 변수가 확장된 전체 구성을 출력하지 않는다. Compose 설정 검사는 해당 저장소에서 `docker compose --env-file .env config --quiet`를 사용한다.

## 문서 작업과 지침 유지

- `docs/` 문서는 사용자가 요청한 경우에만 참고하거나 갱신한다.
- 문서의 경로·명령·구현 설명은 현재 코드를 근거로 작성한다.
- 기능 변경 후 README, API 명세, DB 문서, Docker 운영 문서의 갱신 필요 여부를 확인하고 보고한다.
- 이 저장소의 `AGENTS.md`와 `CLAUDE.md`는 각각 Codex와 Claude Code용이다. 팀 규칙을 변경할 때는 두 파일을 함께 갱신하고 내용이 어긋나지 않도록 확인한다.

## 기술 구성과 시작점

> 이 절은 현재 구현 기준이다. 작업 시 실제 설정과 관련 코드를 다시 확인한다.

- Next.js 15 App Router, React 19, TypeScript strict 모드, Tailwind CSS v4를 사용한다.
- Node 버전은 `.nvmrc`를 기준으로 한다. 현재 기준은 Node 22다.
- 의존성과 실행 스크립트는 `package.json` 및 `package-lock.json`을 기준으로 한다.
- 작업 전에 `package.json`, `next.config.ts`, `tsconfig.json`과 관련 `src/app/`, `src/lib/` 코드를 확인한다.
- `@/*`는 `src/*` 별칭이다.
- `src/app/layout.tsx`는 전역 스타일, 폰트, `AuthProvider`, `BookmarkCollectionProvider`를 연결한다.
- 서버 컴포넌트와 `'use client'` 경계를 유지한다.
- 브라우저 API, React 상태와 effect를 사용할 때 실행 위치를 확인하고 상위 레이아웃 전체를 불필요하게 클라이언트 컴포넌트로 바꾸지 않는다.

## 화면 구조

> 아래 경로는 현재 구현 탐색을 위한 참고다. 작업 전 실제 route와 component 위치를 다시 확인한다.

- `src/app/(app)/layout.tsx`: 인증 준비 상태와 사용자를 확인하고 미로그인 시 `/login`으로 이동한다. Header와 Sidebar를 포함한 공통 셸이다.
- `src/app/(app)/`: `home`, `messages`, `mentoring`, `bookmarks`, `posts/[postId]`, `profile`, `profile/[userId]`, `settings`, `search`, `hashtags/[name]` 화면이 있다.
- route group 이름은 URL에 포함되지 않는다.
- `src/app/home/components/`: 피드, 게시물, 프로필, 멘토링 및 공통 모달 등 기존 컴포넌트가 모여 있다. 디렉토리 이름만 보고 `/home/...` 라우트라고 가정하지 않는다.
- `src/app/(admin)/admin/`: 관리자 화면과 `_components`, `_data`가 있다.
- 관리자 로그인은 `/api/v1/auth/login`과 `/api/v1/auth/me`를 호출하고 role을 확인한다. `AdminRouteGuard`와 `src/lib/admin-auth.ts`를 함께 확인한다. 대시보드에는 실제 신고 조회와 `_data` 기반 데모 통계가 혼재하므로 화면별 API 연동과 서버 인가를 따로 확인한다.
- `src/app/auth/`, `src/app/login/` 및 계정 복구 화면을 함께 확인한다.
- `find-Password`처럼 대소문자가 포함된 실제 경로를 보존한다.
- `/`에서 `/login`으로 이동하는 redirect와 `/uploads/:path*`의 조건부 rewrite는 `next.config.ts`에 있다.
- UI 변경은 모바일·데스크톱, 다크 모드, 로딩·에러·빈 상태, 키보드 접근성, 요청 중 중복 동작을 함께 확인한다.

## 인증과 상태

### 유지해야 하는 규칙

- access token을 다시 localStorage나 URL에 영속 저장하지 않는다.
- 프론트 인증 가드만으로 서버 인가가 보장된다고 가정하지 않는다.
- 백엔드 인증은 stateless JWT 기반이다. 인증 변경은 백엔드 Security 설정, JWT, OAuth2 handler, cookie, CORS 계약과 함께 검토한다.

### 현재 구현

- `src/app/context/AuthContext.tsx`: `user`, `isAuthReady`, `isLoggingOut`, `login`, `updateUser`, `logout` 등 인증 상태와 동작을 제공한다.
- 저장된 사용자 정보가 있으면 refresh 후 `/api/v1/auth/me`로 계정 상태를 검증해 복원한다.
- `src/lib/auth-store.ts`: access token은 메모리에 저장한다.
- 과거 `gamerin_access_token` localStorage 항목은 제거한다.
- 사용자 정보는 `gamerin_user`에 저장한다.
- `clearStoredAuth()`와 `AUTH_CLEARED_EVENT`, 로그아웃 진행 상태 및 탭 간 동기화 흐름을 함께 확인한다. 로그아웃 도중 요청이나 오래된 응답이 세션을 복구하지 않도록 유지한다.
- refresh 요청은 `/api/v1/auth/refresh`에 `credentials: 'include'`로 전송한다.
- 인증 세대 번호와 진행 중 refresh 요청 공유는 사용자 전환 후 오래된 응답이 인증을 되살리는 것을 막으므로 관련 변경 시 함께 검토한다.
- `src/app/auth/oauth-success/page.tsx`는 HttpOnly refresh cookie로 access token을 발급받고 `/api/v1/auth/me`를 조회한 뒤 `/home`으로 이동한다.
- `(app)/layout.tsx`가 URL의 access token을 처리한다고 가정하지 않는다.

## API와 업로드

### API 계약

- API 변경 전 접근 가능한 백엔드의 실제 controller와 DTO를 대조한다. 형제 배치의 소스 경로는 `../backend/src/main/java/com/gamerin/backend/`이며, 백엔드가 없을 때는 위 저장소 경계 규칙을 따른다.
- 일반 성공 응답은 `ApiResponse<T>`의 `{ success: true, data: T }` 형식이다.
- 일반 JSON 오류는 `{ success: false, message }`다. SSE·파일 다운로드 등 별도 형식은 실제 엔드포인트 구현을 확인한다.
- API는 주로 `/api/v1/...`이며 도메인 이름만으로 URL을 추측하지 않는다.
- 실제 응답 데이터는 일반적으로 `body.data`에서 사용한다.
- 커서 목록은 `data` 내부의 `{ items, nextCursor, hasNext }`다.
- 응답 데이터의 null 가능성과 오류 처리는 엔드포인트별로 확인한다.
- 일부 mutation(예: `PATCH /api/v1/users/me`)은 `data: null`을 반환하고 이후 `GET`으로 재조회하는 흐름이 있으므로 실제 구현을 확인한다.

### 현재 API 모듈과 base URL 처리

- 도메인별 호출은 `src/lib/feed-api.ts`, `message-api.ts`, `mentoring-api.ts`, `mileage-api.ts`, `report-api.ts`, `game-stats-api.ts`, `community-search-api.ts`, `notification-api.ts`, `user-settings.ts` 등 기존 모듈을 먼저 확인한다.
- API 주소 처리는 아직 완전히 통일되어 있지 않다.
- `src/lib/api-base.ts`의 `getApiBaseUrl()`은 설정값이 있으면 앞뒤 공백과 마지막 슬래시를 제거한다.
- 설정값이 없으면 서버에서는 빈 문자열을 반환한다.
- 브라우저가 localhost/127.0.0.1의 3000 포트라면 같은 프로토콜·호스트의 8080 주소를 사용하고, 그 외에는 빈 문자열을 반환한다.
- 인증이 필요한 요청은 `src/lib/api-client.ts`의 `apiRequest()`/`apiRequestBlob()`을 사용하고, 요청할 때 `getApiBaseUrl()`로 주소를 얻는다. 도메인 모듈은 엔드포인트 함수와 도메인 오류 변환(`toError`)만 둔다.
- 공통 인증 정책: 첫 401은 refresh 후 1회 재시도하고, refresh 거절·최종 401·차단 계정이면 `logoutAuthSession()`으로 세션을 종료한다. 네트워크 오류·5xx·429와 일반 403은 세션을 유지한다. 사용자 전환·로그아웃 뒤 도착한 응답은 AbortError로 버린다.
- 인증 화면 일부(`find-id`, `auth/forgot-password`, `auth/reset-password`)는 환경변수 미설정 시 `http://localhost:8080`을 기본값으로 쓰므로(#57) 한쪽만 바꿔 전체에 적용됐다고 가정하지 않는다.

### SSE, 첨부, 이미지

- `message-api.ts`의 SSE는 `/api/v1/messages/stream-token` 발급 후 쿠키를 포함한 `EventSource`를 사용한다.
- 메시지 상태는 `message-store.ts`와 함께 확인한다.
- DM 첨부 접근은 공개 `/uploads` URL이 아니라 `Authorization` 헤더를 사용하는 인증 fetch 후 object URL로 렌더링하는 흐름을 유지한다.
- 프로필 이미지 압축은 `src/lib/profile-image-compression.ts`를 확인한다.
- 업로드 형식·크기 변경은 서버 검증과 함께 확인한다.
- `next/image`를 사용한다.
- 원격 이미지 허용 범위는 `next.config.ts`의 `images.remotePatterns`에서 확인한다. 현재 `images.unsplash.com`이 포함되어 있다.
- API·이미지·동영상 출처를 바꾸면 `next.config.ts`의 CSP 및 보안 헤더도 확인하고 기존 보안 정책을 임의로 완화하지 않는다.
- `next.config.ts`는 API 주소가 지정되면 `/uploads/:path*`를 해당 백엔드로 rewrite한다.

## 환경과 Docker 연동

- `NEXT_PUBLIC_API_BASE_URL`은 **빌드 타임 변수**다.
- `Dockerfile`의 build arg와 `../docker/docker-compose.yml`을 함께 확인한다.
- `../docker/.env.example`은 nginx를 통한 상대경로 호출을 위해 빈 값을 안내하며 Compose는 지정된 값을 build arg로 전달한다.
- 빈 값의 상대경로 호출과 로컬 직접 호출을 구분한다.
- 런타임 환경변수만 바꿔 이미 생성된 프론트 빌드 결과가 변경된다고 가정하지 않는다.
- 실제 `.env.local`이나 운영 값을 읽거나 단정하지 않는다.
- 통합 구성은 브라우저 → nginx → frontend:3000 / backend:8080 흐름이다. API·OAuth·uploads는 백엔드, 그 외 화면은 프론트로 프록시된다.
- 연동 변경 시 Docker 저장소의 `nginx/default.conf`에서 SSE 전용 buffering/timeout, 업로드 경로의 크기 제한·rate limit과 프록시 헤더를 확인한다.
- 배포 스크립트는 이미지 빌드뿐 아니라 서비스 기동과 nginx reload를 수행하므로 단순 검증 용도로 실행하지 않는다.

## 검증 명령과 실행 조건

실행 명령이 의존성, 생성 파일, 네트워크에 미치는 영향을 먼저 확인한다.

```bash
npm ci                # lockfile 기준 의존성 재설치
npm run dev           # 개발 서버, 기본 3000
npm run lint          # ESLint
npm test              # Vitest 단위·컴포넌트 테스트
npm run test:e2e       # Playwright E2E (환경 확인 후)
npm run build         # 프로덕션 빌드 및 타입 오류 확인
npx tsc --noEmit      # 필요 시 별도 타입 검사
```

- 의존성을 추가하거나 버전을 변경할 때는 `npm install`을 사용한다.
- 기존 lockfile 기준 재현 설치에는 `npm ci`를 사용한다.
- 코드 변경 후 가능한 경우 `npm run lint`를 실행한다.
- 빌드 영향이 있으면 `npm run build`를 실행한다.
- 필요한 경우 `npx tsc --noEmit`을 추가한다.
- 코드 변경과 관련된 Vitest 테스트를 실행한다. `vitest.config.mts`는 jsdom과 `src/test/setup.ts`를 사용한다.
- E2E는 `playwright.config.ts`와 `e2e/`를 확인한다. 현재 Chromium을 사용하며 127.0.0.1:3000 개발 서버를 시작하거나 기존 서버를 재사용한다. 브라우저 설치 여부와 테스트의 API mock/실제 요청 범위를 먼저 확인한다.
- 의존성 누락으로 명령이 실패하면 `npm ls --depth=0`으로 확인하고 필요 시 `npm ci`로 lockfile 기준 설치 후 다시 검증한다. 실행 실패와 테스트 실패를 구분한다.
- UI나 인증 흐름 변경은 관련 화면과 세션 만료·로그아웃·사용자 전환을 필요한 범위에서 확인한다.
- 테스트 도구와 실행 환경이 없으면 미검증으로 보고한다.
- 문서만 변경한 경우 경로·명령·구현 설명 대조와 `git diff --check`로 검증하고 앱 빌드·테스트 생략 이유를 보고한다. 새 파일은 일반 diff에 포함되지 않을 수 있으므로 별도로 점검한다.

## 완료 보고

- 변경 파일과 이유를 보고한다.
- 실행한 검증과 결과를 보고한다.
- 미실행 또는 실패한 검증은 이유와 필요한 환경을 구분해 보고한다.
- 남은 TODO와 관련 문서 갱신 필요 여부를 보고한다.
- 여러 저장소를 수정했다면 저장소별로 나누어 보고한다.
