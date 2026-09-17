# AGENTS.md

이 문서는 GamerIN 프론트엔드(`frontend/`)에서 Codex 작업할 때 적용하는 세부 지침이다. 상위 `../AGENTS.md`의 공통 작업 원칙을 함께 적용한다.

## 문서 적용 범위

- 아래 경로와 명령은 별도 표시가 없으면 `frontend/` 기준이다.
- 이 문서의 작업 규칙과 안전 정책은 지침으로 적용한다.
- 아키텍처·경로·현재 동작에 대한 설명은 **현재 구현 탐색을 위한 참고 정보**다. 실제 코드와 다르면 현재 코드를 source of truth로 사용한다.
- backend 또는 docker와 계약이 연결된 변경은 해당 저장소의 실제 코드와 존재하는 경우 `AGENTS.md`도 함께 확인한다.

## 작업 원칙

- 답변과 완료 보고는 한국어로 작성한다.
- 이 디렉토리는 독립 Git 저장소다.
- 작업 전에 `frontend/`에서 `git status --short --branch`를 실행하고 기존 사용자 변경을 보존한다.
- capstone 루트에서 Git 작업을 하지 않는다.
- 관련 코드를 조사한 뒤 변경 범위와 검증 방법을 짧게 제시한다.
- 명시적인 수정 요청은 해당 범위의 승인으로 간주한다.
- 조사·설명·제안만 요청받았다면 임의로 수정하지 않는다.
- 기존 스타일과 구조를 유지하고 관련 없는 리팩터링을 섞지 않는다.
- commit, push, merge, rebase, reset, 변경 폐기 및 배포는 사용자 승인 후 수행한다.
- `.env`, `.env.local` 등 비밀 설정은 존재 여부만 확인한다. 내용을 읽거나 검색·출력·복사·수정하지 않는다.
- 필요하면 공개 예제 설정만 확인한다.
- `../data/`, `../backups/` 등 런타임 데이터는 수정하지 않는다.
- 기존 `docs/` 현행화 문서는 사용자가 요청한 경우에만 참고하거나 갱신한다.

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
- 현재 관리자 로그인 폼은 클라이언트 데모 검증, 대시보드는 `_data`의 정적 데이터를 사용하는 부분이 있으므로 화면 존재만으로 실제 API 연동이나 관리자 인가가 완료됐다고 단정하지 않는다.
- `src/app/auth/`, `src/app/login/` 및 계정 복구 화면을 함께 확인한다.
- `find-Password`처럼 대소문자가 포함된 실제 경로를 보존한다.
- `/`에서 `/login`으로 이동하는 redirect와 `/uploads/:path*`의 조건부 rewrite는 `next.config.ts`에 있다.
- UI 변경은 모바일·데스크톱, 다크 모드, 로딩·에러·빈 상태, 키보드 접근성, 요청 중 중복 동작을 함께 확인한다.

## 인증과 상태

### 유지해야 하는 규칙

- access token을 다시 localStorage나 URL에 영속 저장하지 않는다.
- 프론트 인증 가드만으로 서버 인가가 보장된다고 가정하지 않는다.
- 인증 변경은 백엔드 Security 설정, JWT, OAuth2 handler, cookie, CORS 계약과 함께 검토한다.

### 현재 구현

- `src/app/context/AuthContext.tsx`: `user`, `isAuthReady`, `login`, `updateUser`, `logout`을 제공한다.
- 저장된 사용자 정보가 있으면 refresh 성공 후 복원한다.
- `src/lib/auth-store.ts`: access token은 메모리에 저장한다.
- 과거 `gamerin_access_token` localStorage 항목은 제거한다.
- 사용자 정보는 `gamerin_user`에 저장한다.
- `clearStoredAuth()`와 `AUTH_CLEARED_EVENT`로 전역 동기화한다.
- refresh 요청은 `/api/v1/auth/refresh`에 `credentials: 'include'`로 전송한다.
- 인증 세대 번호와 진행 중 refresh 요청 공유는 사용자 전환 후 오래된 응답이 인증을 되살리는 것을 막으므로 관련 변경 시 함께 검토한다.
- `src/app/auth/oauth-success/page.tsx`는 HttpOnly refresh cookie로 access token을 발급받고 `/api/v1/auth/me`를 조회한 뒤 `/home`으로 이동한다.
- `(app)/layout.tsx`가 URL의 access token을 처리한다고 가정하지 않는다.

## API와 업로드

### API 계약

- API 변경 전 `../backend/src/main/java/com/gamerin/backend/`의 실제 controller와 DTO를 대조한다.
- 일반 성공 응답은 `ApiResponse<T>`의 `{ success, data }` 형식이다.
- 실제 응답 데이터는 일반적으로 `body.data`에서 사용한다.
- 커서 목록은 `data` 내부의 `{ items, nextCursor, hasNext }`다.
- 응답 데이터의 null 가능성과 오류 처리는 엔드포인트별로 확인한다.
- 일부 mutation(예: `PATCH /api/v1/users/me`)은 `data: null`을 반환하고 이후 `GET`으로 재조회하는 흐름이 있으므로 실제 구현을 확인한다.

### 현재 API 모듈과 base URL 처리

- 도메인별 호출은 `src/lib/feed-api.ts`, `message-api.ts`, `mentoring-api.ts`, `mileage-api.ts`, `report-api.ts`, `game-stats-api.ts`, `community-search-api.ts`, `user-settings.ts` 등 기존 모듈을 먼저 확인한다.
- API 주소 처리는 아직 완전히 통일되어 있지 않다.
- `src/lib/api-base.ts`의 `getApiBaseUrl()`은 설정값이 있으면 앞뒤 공백과 마지막 슬래시를 제거한다.
- 설정값이 없으면 서버에서는 빈 문자열을 반환한다.
- 브라우저가 localhost/127.0.0.1의 3000 포트라면 같은 프로토콜·호스트의 8080 주소를 사용하고, 그 외에는 빈 문자열을 반환한다.
- `message-api.ts`, `community-search-api.ts`는 `getApiBaseUrl()`을 사용한다.
- `auth-store.ts`, `feed-api.ts`, `mentoring-api.ts`, `mileage-api.ts`, `AuthContext.tsx` 등은 별도 `API_BASE`를 선언하는 부분이 있다.
- 별도 `API_BASE` 선언 모듈은 환경변수 미설정 시 `http://localhost:8080`을 기본값으로 사용하는 경우가 있으므로 한쪽만 바꿔 전체에 적용됐다고 가정하지 않는다.

### SSE, 첨부, 이미지

- `message-api.ts`의 SSE는 `/api/v1/messages/stream-token` 발급 후 쿠키를 포함한 `EventSource`를 사용한다.
- 메시지 상태는 `message-store.ts`와 함께 확인한다.
- DM 첨부 접근은 공개 `/uploads` URL이 아니라 `Authorization` 헤더를 사용하는 인증 fetch 후 object URL로 렌더링하는 흐름을 유지한다.
- 프로필 이미지 압축은 `src/lib/profile-image-compression.ts`를 확인한다.
- 업로드 형식·크기 변경은 서버 검증과 함께 확인한다.
- `next/image`를 사용한다.
- 원격 이미지 허용 범위는 `next.config.ts`의 `images.remotePatterns`에서 확인한다. 현재 `images.unsplash.com`이 포함되어 있다.
- `next.config.ts`는 API 주소가 지정되면 `/uploads/:path*`를 해당 백엔드로 rewrite한다.

## 환경과 Docker 연동

- `NEXT_PUBLIC_API_BASE_URL`은 **빌드 타임 변수**다.
- `Dockerfile`의 build arg와 `../docker/docker-compose.yml`을 함께 확인한다.
- `../docker/.env.example`은 nginx를 통한 상대경로 호출을 위해 빈 값을 안내하며 Compose는 지정된 값을 build arg로 전달한다.
- 빈 값의 상대경로 호출과 로컬 직접 호출을 구분한다.
- 런타임 환경변수만 바꿔 이미 생성된 프론트 빌드 결과가 변경된다고 가정하지 않는다.
- 실제 `.env.local`이나 운영 값을 읽거나 단정하지 않는다.

## 검증 명령과 실행 조건

실행 명령이 의존성, 생성 파일, 네트워크에 미치는 영향을 먼저 확인한다.

```bash
npm ci                # lockfile 기준 의존성 재설치
npm run dev           # 개발 서버, 기본 3000
npm run lint          # ESLint
npm run build         # 프로덕션 빌드 및 타입 오류 확인
npx tsc --noEmit      # 필요 시 별도 타입 검사
```

- 의존성을 추가하거나 버전을 변경할 때는 `npm install`을 사용한다.
- 기존 lockfile 기준 재현 설치에는 `npm ci`를 사용한다.
- 코드 변경 후 가능한 경우 `npm run lint`를 실행한다.
- 빌드 영향이 있으면 `npm run build`를 실행한다.
- 필요한 경우 `npx tsc --noEmit`을 추가한다.
- 현재 `package.json`에는 테스트 스크립트가 없다. 자동화 테스트 명령은 `확인 필요`이며 임의로 `npm test`가 지원된다고 안내하지 않는다.
- UI나 인증 흐름 변경은 관련 화면과 세션 만료·로그아웃·사용자 전환을 필요한 범위에서 확인한다.
- 테스트 도구와 실행 환경이 없으면 미검증으로 보고한다.
- 문서만 변경한 경우 경로·명령·구현 설명 대조와 `git diff --check`로 검증하고 앱 빌드 생략 이유를 보고한다.

## 완료 보고

- 변경 파일과 이유를 보고한다.
- 실행한 검증과 결과를 보고한다.
- 미실행 또는 실패한 검증은 이유와 필요한 환경을 구분해 보고한다.
- 남은 TODO와 관련 문서 갱신 필요 여부를 보고한다.
- 여러 저장소를 수정했다면 저장소별로 나누어 보고한다.
