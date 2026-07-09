# GamerIN Frontend

**기획 및 테스트**
- 서장호

**프론트엔드**
- 전준범 (팀장)
- 김신의

**백엔드**
- 방경식
- 이상혁


## 프론트엔드 셋업

### 1. 다음 버전이 설치되어 있어야 함

- Node.js 22.22.1 LTS
- npm 10 이상

Node 버전 확인:
```bash
node -v
npm -v
```
### 2. 프로젝트 루트에서 아래 명령어 실행
```bash
cd frontend
npm install
```
설치된 패키지 버전 확인
```bash
cd frontend
npm list
```
### 3. 개발 서버 실행
```bash
cd frontend
npm run dev
```

### 3. application-local.yaml 설정
**backend/src/main/resources/application-local.example.yaml** 을 참고하여 같은 디렉토리에 application-local.yaml 생성.
그 후 본인이 설정한 패스워드 입력

### 4. .env.local 생성 
프론트엔드 프로젝트 폴더에 .env.local 파일 생성 후 NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 적어두고 저장.![alt text](image.png)

- docker 세팅으로 인해서 로컬 개발 서버 실행시 해당 부분이 꼭 필요함. 

### 4. 수정 일지

- **26/04/22** 서장호  
  
  > AuthContext에 `isAuthReady`와 옵션형 `logout()`을 추가하여 인증 초기화 및 로그아웃 흐름 정리  
  > 로그아웃 시 `/login`으로 즉시 이동하도록 수정하고 `/home` 및 하위 경로에 로그인 가드 적용  
  > 로그인 페이지에서 이미 로그인된 사용자는 `/home`으로 리다이렉트되도록 수정  
  > 비밀번호 재설정 성공 시에는 로그아웃만 수행하고 성공 화면은 유지하도록 예외 처리  
  > `ErrorToast`, `MentorDetailModal`, `Mentoring`, `PostDetail` 등에 명시적 타입을 적용해 기존 ESLint 에러 제거  
  > 문자열 이스케이프 처리 및 미사용 import 정리를 통해 남아 있던 코드 품질 이슈 보완  
  > 주요 이미지 컴포넌트를 `next/image`로 전환하고 `next.config.ts`에 Unsplash 원격 이미지 허용 설정 추가  
  > `useSearchParams()`를 사용하는 `/auth/reset-password`, `/find-id-result` 페이지에 `Suspense` 경계 추가  
  > `Header`, `Sidebar`의 로그아웃 핸들러 타입 충돌 및 `AddAcountModal` import 경로 오류 수정  
  > `npm run lint`, `npm run build` 검증 완료 및 경고/빌드 오류 없이 통과 확인  

  > 요약 : 로그아웃했을때 홈화면에 남아있는 현상 수정 + lint와 build 했을때 나오는 오류 경고들 모두 수정  

- **26/05/14** 서장호  
  
  > `auth-store`에 `AUTH_USER_KEY`, `AUTH_CLEARED_EVENT`, `clearStoredAuth()`를 추가하여 인증 상태 정리 로직 통합  
  > refresh token 검증 실패 시 `gamerin_access_token`뿐 아니라 `gamerin_user`도 함께 삭제하도록 수정  
  > 인증 상태가 정리되면 전역 이벤트를 발생시켜 `AuthContext`의 `user` 상태도 즉시 `null`로 동기화  
  > 앱 부팅 시 저장된 `gamerin_user`를 바로 로그인 상태로 처리하지 않고 `refreshAccessToken()`으로 서버 세션 유효성 먼저 검증  
  > refresh 실패 또는 저장된 유저 정보 파싱 실패 시 저장된 인증 정보를 정리하고 `/home` 진입 대신 `/login`으로 이동되도록 처리  
  > `login`, `updateUser`, `logout`에서 `gamerin_user` 문자열 직접 사용을 제거하고 공통 인증 저장소 상수를 사용하도록 수정  
  > 백엔드에 아직 없는 `/api/v1/feed/trending/games` 호출을 홈 피드 초기 로딩에서 비활성화하여 피드 API 정상 응답까지 실패 처리되는 문제 방지  

  > 요약 : 서버/DB 재시작 후 브라우저에 남은 이전 로그인 정보로 홈에 진입하거나 피드에서 401 인증 오류가 반복되는 문제 수정  

- **26/05/30** 서장호  

  > Docker 운영 배포를 위한 프론트엔드 Dockerfile과 .dockerignore 추가  
  > Node 22 기반 멀티 스테이지 빌드로 의존성 설치, Next.js 빌드, production 실행 이미지를 분리  
  > Docker 빌드 시 `NEXT_PUBLIC_API_BASE_URL`을 build arg로 주입하도록 구성  
  > reverse proxy 환경에서 `NEXT_PUBLIC_API_BASE_URL`을 비워 `/api/...` 상대경로 호출이 가능하도록 구성  
  > production 컨테이너에서 `npm run start`로 Next.js 앱을 3000 포트에서 실행하도록 구성  

  > 요약 : 프론트엔드 Docker 이미지 빌드 및 reverse proxy 배포에 필요한 코드/설정 추가  

- **26/05/31** 서장호  

  > 게시글 상세 화면 진입 시 기존 댓글 목록을 불러올 수 있도록 `fetchPostComments()` API 함수 추가  
  > `PostDetail`에서 게시글 상세 정보와 댓글 목록을 함께 요청하도록 변경  
  > 기존 화면에서 새로 작성한 댓글만 보관하던 `submittedComments` 상태를 실제 댓글 목록 상태로 통합  
  > 댓글이 없을 때 표시되는 안내 문구를 기존 API 미지원 문구에서 일반 빈 상태 문구로 변경  
  > 게시글 카드와 상세 화면의 점 3개 버튼을 메뉴로 동작하도록 변경  
  > 작성자 본인 게시물(`mine`)일 때만 삭제 항목이 표시되도록 처리  
  > 삭제 요청 시 `DELETE /api/v1/posts/{postId}` API를 호출하는 `deletePost()` 함수 추가  
  > 삭제 성공 후 피드, 상세, 북마크, 프로필 게시글 목록에서 해당 게시물이 즉시 제거되도록 상태 갱신 연결  

  > 요약 : 게시글 상세 화면에서 기존 댓글 목록과 새로 작성한 댓글이 함께 표시되도록 프론트 연동 수정  

- **26/06/03** 서장호  

  > 북마크 데이터를 프론트 localStorage가 아닌 백엔드 `post_bookmarks` API 기준으로 사용하도록 변경  
  > `/home/friends` 북마크 화면을 제거하고 `/home/bookmarks` 서버 연동 북마크 화면으로 라우트 변경  
  > Sidebar의 북마크 메뉴 경로를 `/home/bookmarks`로 수정  
  > `fetchMyBookmarks()`를 사용해 내 북마크 목록을 커서 기반으로 불러오고 `더 보기` 버튼으로 다음 페이지를 조회하도록 구현  
  > 기존 `bookmark-store.ts`와 북마크 localStorage 이벤트 의존성을 제거하여 서버 데이터를 단일 기준으로 정리  
  > 피드, 프로필, 북마크 목록에서 북마크 저장/해제 상태가 부모 목록 상태에도 즉시 반영되도록 연결  
  > 북마크 화면에서 북마크 해제 성공 시 해당 게시글이 목록에서 즉시 제거되도록 처리  
  > 게시글 카드의 빈 영역 클릭 시 상세 화면으로 이동하도록 카드 클릭 영역을 확장  
  > 좋아요, 북마크, 공유, 메뉴, 프로필 영역은 카드 상세 이동에서 제외되도록 클릭 이벤트 분리  
  > 댓글 버튼을 정상 버튼으로 복구하고 클릭 시 게시글 상세 화면의 댓글 작성/목록 영역으로 이동하도록 처리  
  > 북마크 페이지의 게시글 카드에도 좋아요/좋아요 취소 핸들러를 연결하여 좋아요 버튼이 정상 동작하도록 수정  
  > 북마크 페이지 좋아요 처리 시 optimistic update를 적용하고 API 실패 시 기존 상태로 롤백되도록 처리   

  > 요약 : 북마크 화면을 백엔드 API 기반으로 전환하고 게시글 카드의 상세 이동, 댓글, 좋아요 버튼 동작을 수정  

- **26/06/04** 서장호  

  > 멘토 미등록 사용자의 상태 확인을 `GET /api/v1/mentoring/mentors/{userId}` 실패 응답이 아닌 `GET /api/v1/mentoring/mentors/me` 정상 응답 기준으로 변경  
  > `fetchMyMentorProfile()`을 추가하고 `loadCurrentMentorProfile()`에서 사용하여, 멘토 등록 전 사용자는 `data: null` 상태로 멘토 등록 UI를 표시하도록 정리  
  > 신청 목록의 리뷰 완료 여부를 프론트 임시 상태나 `fetchMentorReviews()` 재조회 결과로 추론하지 않고, 백엔드가 내려주는 `application.reviewed` 필드 기준으로 표시하도록 변경  
  > 리뷰 작성 성공 또는 중복 리뷰 방어 처리 시 해당 신청 항목의 `reviewed` 값을 로컬 상태에서도 즉시 `true`로 갱신하도록 보강  
  > `MentoringApplicationResponse` 타입에 `reviewed`를 추가하고, 백엔드 응답 계약에 맞춰 `mentorId`, `menteeId`, `programTitle` 사용 흐름을 정리  
  > 실제 백엔드에 없는 신청 삭제 API 호출 함수 `deleteMentoringApplication()`을 제거하고, 취소된 신청은 `CANCELLED` 상태 배지만 표시하도록 UI 정리  
  > 404 응답 메시지 처리에서 `message`가 없을 수 있는 타입 오류를 방지하도록 `MentoringApiError` 생성 로직 보완  

- **26/06/06** 서장호

  > Docker/nginx 배포 환경에서 메시지 API가 `localhost:8080`으로 직접 호출되어 `ERR_CONNECTION_REFUSED`가 발생하던 문제 수정  
  > `src/lib/api-base.ts`에서 `NEXT_PUBLIC_API_BASE_URL`이 비어 있을 때 브라우저의 `window.location.origin`을 API base로 사용하도록 변경  
  > 운영 배포에서는 `/api/...` 요청이 현재 접속 origin의 nginx를 거쳐 backend로 프록시되도록 정리  
  > 설정값에 trailing slash가 포함되어도 중복 slash가 생기지 않도록 `NEXT_PUBLIC_API_BASE_URL` 끝의 `/`를 제거하는 처리 추가  
  > 메시지 페이지와 멘토링 페이지의 채팅 시작 기능이 같은 메시지 API base URL을 사용하도록 흐름 정리  
  > 메시지 SSE 연결은 nginx에서 `/api/v1/messages/stream` 전용 설정을 추가해 buffering을 끄고 timeout을 늘리는 방식으로 보완  
  > 배포 후 backend/frontend 컨테이너 IP 변경으로 nginx upstream이 stale 상태가 되는 문제를 줄이기 위해 deploy 스크립트에 nginx reload 추가  
  > 검증: `npm run lint`, `npm run build` 통과, 배포 후 `/home/messages` 200 응답 및 메시지 API 401 인증 응답 확인  

  > 요약 : 메시지 API가 `localhost:8080`으로 직접 호출되던 문제를 수정하고, nginx reverse proxy 기준으로 메시지/SSE 연결이 동작하도록 정리  

- **26/06/06** 서장호

  > 백엔드에서 메시지 수정 API를 지원하지 않도록 정리한 계약에 맞춰 메시지 수정 버튼과 편집 입력 UI 제거
  > `src/lib/message-api.ts`에서 `updateConversationMessage()`와 `message-updated` 실시간 이벤트 타입 제거
  > `src/lib/message-store.ts`와 메시지 응답 변환 흐름에서 `editedAt` 필드 제거
  > 메시지 말풍선 액션 메뉴는 삭제만 제공하도록 단순화하고, 삭제/대화방 나가기 상태 처리에서 편집 상태 의존성 제거
  > 검증: `npm run lint`, `npm run build` 통과

  > 요약 : 메시지 수정 기능 제거에 맞춰 프론트 메시지 API 계약과 UI를 삭제 전용 흐름으로 정리

- **26/06/10** 서장호

  > 인증 후 공통 레이아웃을 `src/app/(app)/layout.tsx` route group layout으로 분리하고 기존 `AppShell` 컴포넌트 제거
  > `/messages`, `/bookmarks`, `/mentoring`, `/settings`, `/profile`, `/profile/[userId]`, `/posts/[postId]` 페이지를 최상위 라우트 구조로 이동
  > `/home/messages`, `/home/bookmarks`, `/home/mentoring`, `/home/profile`, `/home/settings` 구 라우터와 호환 redirect 제거
  > `/home` 피드 라우트는 현재 URL을 유지하면서 같은 `(app)` 레이아웃을 사용하도록 정리
  > 메시지 페이지 직접 진입 시 최상위 대화방이 자동 선택되어 읽음 처리되던 동작 제거
  > `/messages`는 대화 미선택 상태로 유지하고, 대화 카드 클릭 또는 `conversationId`/`recipient` 쿼리 기반 명시 진입만 대화방을 열도록 정리
  > 대화 목록 갱신, SSE 갱신, 대화방 나가기 이후에도 첫 대화방으로 자동 이동하지 않도록 선택 상태 초기화
  > 새 메시지 송수신 시 최신 메시지 기준으로 메시지 목록 최하단으로 자동 스크롤되도록 보완
  > 검증: `git diff --check origin/main...HEAD`, `npm run lint`, `npm run build` 통과

  > 요약 : 인증 후 화면 라우팅을 최상위 경로 기준으로 정리하고, 메시지 화면에서 원치 않는 자동 읽음 처리를 방지

- **26/06/11** 서장호

  > 메시지 페이지 진입 시 팔로잉 목록을 미리 불러오던 `fetchFollowing()` 호출을 제거하여 `/api/v1/users/{handle}/following` 401 오류가 메시지 화면 오류로 노출되던 문제 수정
  > 새 대화 검색 컴포넌트에서 `allowedRecipientHandles` 기반 프론트 필터링과 로딩 상태 의존성을 제거
  > 새 대화 시작 및 `/messages?recipient=...` 진입 시 프론트에서 팔로우 여부를 검사하던 차단 로직 제거
  > 프로필 메시지 버튼의 `isFollowing` 기반 비활성화와 "팔로우한 사용자에게만 메시지를 보낼 수 있습니다." 안내 문구 제거
  > 팔로우 여부는 프로필 팔로우 버튼과 팔로우 목록 상태에만 사용하고, 메시지 상대 검색 정책은 백엔드 `messages/recipients` API에서 적용할 수 있도록 역할 분리
  > 검증: `git diff --check`, `npm run lint`, `npm run build` 통과

  > 요약 : 메시지 화면 재진입 시 팔로잉 API 401 오류가 뜨던 원인을 제거하고, 프론트의 메시지 상대 팔로우 제한 정책을 정리

- **26/06/11** 서장호

  > main 브랜치 `feature/routing-profile-message-refactor` 브랜치에 병합
  > `src/app/(app)/layout.tsx`에 main 브랜치의 소셜 로그인 후 무한 리다이렉트 방지 로직을 반영하고, 인증 준비 전/비로그인 상태에서 보호 화면이 렌더링되지 않도록 가드 유지
  > `src/app/(app)/home/page.tsx`는 PR 브랜치의 `/posts/[postId]` 상세 라우팅 구조를 유지하도록 충돌 해결
  > main 브랜치의 `/home?postId=...` 기반 홈 내부 `PostDetail` 렌더링 방식은 새 최상위 게시글 상세 라우팅 구조와 중복되어 제거
  > 병합 과정에서 홈 피드 JSX의 불필요한 fragment와 들여쓰기 정리

  > 요약 : PR #27 자동 병합을 막던 홈/레이아웃 충돌을 해소하고, 최상위 라우팅 구조와 소셜 로그인 안정화 로직을 함께 유지

- **26/06/15** 서장호

  > 백엔드 `PATCH /api/v1/users/me`가 성공 시 프로필 객체가 아닌 `data: null`을 반환하는 계약에 맞춰 `updateMyProfile()` 흐름 수정
  > 프로필 수정 성공 후 `GET /api/v1/users/me`를 다시 호출해 최신 프로필을 화면과 인증 사용자 상태에 반영하도록 변경
  > `UserProfile` 타입에 백엔드 응답 필드인 `location`, `website`, `coverImageUrl`을 추가
  > 편집 모달의 `location`, `website` 초기값을 서버 프로필 값으로 채우고, 저장 시 `nickname`, `bio`, `location`, `website`를 백엔드 프로필 수정 API로 전송하도록 연결
  > 프로필 커버/아바타 파일은 브라우저 canvas에서 JPEG로 압축한 뒤 `POST /api/v1/users/me/profile-images` 업로드 API로 전송하고, 이미지 URL은 업로드 API가 서버 프로필에 직접 반영하도록 변경
  > API 성공 전에 커버/아바타 localStorage 상태를 먼저 바꾸던 흐름을 제거하고, 저장 성공 후 서버 응답 기준으로 커버/아바타 상태를 동기화
  > data URL 이미지로 인한 브라우저 storage quota 초과를 방지하기 위해 프로필 커버/아바타 legacy localStorage 저장을 제거하고, 인증 사용자 캐시에서도 이미지 필드를 제외
  > 프로필 화면에 위치와 웹사이트 표시를 추가하고, 다른 사용자 프로필에서도 서버 `coverImageUrl`을 사용하도록 수정
  > 백엔드 validation에 맞춰 닉네임 2~20자, 소개글 160자 이하, 위치 100자 이하, 웹사이트 2048자 이하 및 URL 형식 검증 추가
  > 이미지가 변경되지 않은 저장에서는 기존 이미지 URL을 다시 보내지 않아 legacy data URL 값이 PATCH payload로 흘러가지 않도록 처리
  > 게시물 이미지/동영상 썸네일 선택을 백엔드 업로드 계약에 맞춰 JPEG/PNG, 장당 20MB 이하로 제한하고 영상 선택 MIME/확장자도 MP4/MOV/M4V로 정리
  > 검증: `git diff --check`, `npm run lint`, `npm run build` 통과

  > 요약 : 프로필 수정 화면을 백엔드 프로필 수정/이미지 업로드 API 계약에 맞춰 연결하고, 위치/웹사이트/커버/아바타 상태가 서버 프로필 기준으로 반영되도록 정리

- **26/06/15** 서장호

  > 인증 사용자 캐시에 `profileImageUrl`을 유지하도록 정규화 흐름을 보완
  > 프로필 페이지 진입 및 프로필 수정 성공 후 최신 서버 프로필 이미지 URL을 인증 사용자 상태에 반영하도록 변경
  > 상단바, 좌측 사이드바 하단, 게시글 작성창에서 기본 이니셜 대신 서버 프로필 이미지를 우선 표시하도록 수정
  > 메시지 수신자 타입과 메시지 화면 대화 목록, 새 대화 검색 결과, 대화 헤더, 상대방 말풍선 아바타에 `profileImageUrl` 표시를 연결
  > 이미지 URL이 없거나 로딩에 실패한 경우 기존 이니셜 fallback을 유지하도록 처리
  > 검증: `git diff --check`, `npm run lint`, `npx tsc --noEmit`, `npm run build` 통과

  > 요약 : 프로필 이미지 변경 후 홈 피드 외 상단바, 사이드바, 작성창, 메시지 화면에도 최신 프로필 사진이 반영되도록 정리

- **26/06/15** 서장호

  > 프로필 게시물 탭의 `Post` 카드에 홈/북마크 피드와 동일한 좋아요, 상세 이동, 댓글 이동 핸들러 연결
  > 프로필 게시물 목록 폭을 홈 피드 카드 폭과 맞춰 이미지/동영상 표시 비율과 카드 사용감을 통일
  > 프로필 게시물 좋아요 처리에 optimistic update와 실패 시 롤백 흐름 추가
  > 프로필 게시물 삭제 시 게시물 목록뿐 아니라 미디어 탭의 같은 게시물 이미지/동영상 타일도 즉시 제거되도록 상태 갱신
  > 프로필 미디어 탭의 이미지/동영상 타일을 고정 비율 버튼으로 변경하고 클릭 시 해당 게시물 상세 페이지로 이동하도록 연결
  > 검증: `git diff --check`, `npm run lint`, `npx tsc --noEmit`, `npm run build` 통과

  > 요약 : 프로필 페이지 게시물/미디어 탭의 좋아요, 댓글, 상세 이동, 삭제 후 상태 반영, 미디어 표시 비율을 홈 피드 UX와 맞춰 정리

## 2026-07-09 북마크 컬렉션 프론트엔드 개발 노트

작업 브랜치: `feature/bookmark-collections`

### 구현 내용

- `BookmarkCollection` 타입에 `id`, `title`, `coverImageUrl`, `createdAt`, `savedPostIds`를 정의했습니다.
- 게시글 타입에 컬렉션 저장 상태를 위한 `isSaved`, `savedCollectionIds` 선택 필드를 추가했습니다.
- `BookmarkCollectionProvider`에서 컬렉션 생성과 게시글 저장/취소 상태를 전역으로 관리합니다.
- 컬렉션 데이터는 백엔드 API가 준비되기 전까지 `localStorage`의 `gamerin_bookmark_collections` 키에 저장됩니다.
- 피드와 게시글 상세의 북마크 버튼을 누르면 `SaveToCollectionModal`이 열립니다.
- 모달에서 기존 모음집을 복수 선택하거나 새 모음집을 만든 뒤 현재 게시글을 바로 저장할 수 있습니다.
- 컬렉션이 하나 이상 선택되면 기존 게시글 북마크 API를 유지하고, 모든 컬렉션에서 해제하면 기존 북마크도 해제합니다.
- `/bookmarks` 페이지에서 전체 북마크와 각 모음집을 선택하고 해당 모음집의 게시글만 볼 수 있습니다.
- 새로 만든 컬렉션과 게시글 포함 상태는 새로고침 후에도 현재 브라우저에서 유지됩니다.

### 현재 사용 중인 기존 북마크 API

```text
POST   /api/v1/posts/{postId}/bookmarks
DELETE /api/v1/posts/{postId}/bookmarks
GET    /api/v1/users/me/bookmarks
```

위 API는 게시글이 북마크되었는지만 관리하며 컬렉션 정보는 아직 프론트에만 존재합니다.

### 백엔드 구현 및 협의 필요사항

아래 경로는 프론트와 백엔드가 협의할 수 있는 권장 계약입니다. 실제 경로가 확정되면 Context의 로컬 상태 로직을 API 호출로 교체해야 합니다.

```text
GET    /api/v1/bookmark-collections
POST   /api/v1/bookmark-collections
PATCH  /api/v1/bookmark-collections/{collectionId}
DELETE /api/v1/bookmark-collections/{collectionId}

PUT    /api/v1/bookmark-collections/{collectionId}/posts/{postId}
DELETE /api/v1/bookmark-collections/{collectionId}/posts/{postId}
```

컬렉션 생성 요청 예시:

```json
{
  "title": "다시 볼 공략",
  "coverImageUrl": null
}
```

컬렉션 응답 예시:

```json
{
  "id": "collection-id",
  "title": "다시 볼 공략",
  "coverImageUrl": null,
  "createdAt": "2026-07-09T12:00:00Z",
  "savedPostIds": ["post-id-1", "post-id-2"]
}
```

1. 컬렉션은 로그인 사용자별로 분리되어야 하며 다른 사용자의 컬렉션을 조회하거나 수정할 수 없어야 합니다.
2. 한 게시글은 여러 컬렉션에 동시에 포함될 수 있어야 합니다.
3. 동일 컬렉션에 같은 게시글을 반복 추가하거나 제거해도 중복 데이터와 오류가 생기지 않도록 멱등성을 보장해야 합니다.
4. 컬렉션 이름 길이와 중복 이름 허용 여부를 백엔드 validation 정책으로 확정해야 합니다. 현재 프론트는 공백 이름을 차단하고 최대 40자로 제한합니다.
5. 기존 단일 북마크 사용자를 위해 기본 컬렉션을 서버에서 자동 생성하거나, 컬렉션에 속하지 않은 북마크를 `미분류`로 처리할지 결정해야 합니다.
6. 게시글을 마지막 컬렉션에서 제거할 때 기존 북마크도 삭제할지, 미분류 북마크로 남길지 정책을 확정해야 합니다. 현재 프론트는 기존 북마크도 삭제합니다.
7. 컬렉션을 삭제할 때 포함된 게시글의 기존 북마크 유지 여부를 정책으로 확정해야 합니다.
8. 삭제되거나 접근 권한이 사라진 게시글 ID를 컬렉션 응답에서 정리하는 기준이 필요합니다.
9. 컬렉션 목록 응답에 게시물 개수와 대표 이미지가 포함되면 `/bookmarks` 화면에서 전체 게시글을 내려받지 않고도 정확한 카드 정보를 표시할 수 있습니다.

### 현재 부족한 부분

- 컬렉션은 `localStorage`에 저장되므로 계정 간 분리, 다른 브라우저 및 다른 기기 동기화가 지원되지 않습니다.
- 브라우저 저장소를 삭제하거나 다른 환경에서 로그인하면 컬렉션이 유지되지 않습니다.
- 컬렉션별 게시글 화면은 기존 북마크 API로 현재 불러온 게시글 안에서만 필터링합니다.
- 컬렉션 이름 변경, 삭제, 순서 변경 기능은 아직 없습니다.
- 컬렉션 대표 이미지 직접 설정과 업로드 기능은 없습니다.
- 서버에서 이미 저장된 기존 북마크는 모달을 처음 열 때 로컬 기본 `즐겨찾기` 컬렉션으로 연결됩니다.
- API 실패 시 컬렉션 로컬 상태와 기존 서버 북마크 상태가 일시적으로 달라질 가능성이 있어 서버 API 연동 시 트랜잭션 또는 롤백 처리가 필요합니다.

### 검증

- `npm run lint` 통과
- `tsc --noEmit` 통과

## 2026-07-09 전역 검색 및 탐색 프론트엔드 개발 노트

작업 브랜치: `feature/global-search-explore`

### 구현 내용

- 헤더 검색창을 제어 입력으로 변경하고 입력값 상태를 관리합니다.
- 공백만 입력한 검색은 차단합니다.
- 검색어 입력 후 Enter를 누르면 `/search?q={검색어}`로 이동합니다.
- `/search` 페이지에서 URL의 `q` 파라미터를 읽어 현재 검색어를 표시합니다.
- 검색 결과 유형을 `인기`, `계정`, `게시글`, `해시태그` 탭으로 분리했습니다.
- URL에 `tab=hashtag`처럼 유효한 탭이 전달되면 해당 탭을 초기 선택합니다.
- `GameFilter`를 재사용 가능한 제어 컴포넌트로 분리했습니다.
- 게임 필터는 `전체`, `PUBG`, `VALORANT`, `LEAGUE OF LEGENDS`, `FPS`를 제공합니다.
- 선택한 탭과 게임 필터에 따라 하단 결과 영역이 교체되는 상태 구조를 구현했습니다.
- `useSearchParams` 사용으로 인한 App Router 빌드 오류를 방지하도록 `Suspense` 경계를 추가했습니다.
- 기존 `Header.tsx`의 알림 패널과 사용자 액션 코드는 변경하지 않았습니다.

### 현재 프론트 라우팅 계약

```text
/search?q={keyword}
/search?q={keyword}&tab=popular
/search?q={keyword}&tab=accounts
/search?q={keyword}&tab=posts
/search?q={keyword}&tab=hashtag
```

현재 탭 값:

```text
popular | accounts | posts | hashtag
```

현재 게임 필터 값:

```text
all | pubg | valorant | league-of-legends | fps
```

### 백엔드 구현 및 협의 필요사항

검색 API는 아직 구현되지 않았습니다. 아래는 단일 통합 검색 API를 사용할 경우의 권장 계약입니다.

```text
GET /api/v1/search?q={keyword}&type={type}&game={game}&cursor={cursor}&size={size}
```

요청 예시:

```text
GET /api/v1/search?q=PUBG&type=posts&game=pubg&size=20
```

통합 응답 예시:

```json
{
  "success": true,
  "data": {
    "accounts": [],
    "posts": [],
    "hashtags": [],
    "nextCursor": null,
    "hasNext": false
  }
}
```

계정 결과 권장 필드:

```json
{
  "userId": "user-id",
  "handle": "player_handle",
  "nickname": "플레이어",
  "profileImageUrl": null,
  "bio": null,
  "verifiedBadge": false,
  "followedByMe": false
}
```

해시태그 결과 권장 필드:

```json
{
  "tag": "PUBG",
  "postCount": 128
}
```

1. `q`의 최소·최대 길이와 허용 문자 정책을 확정해야 합니다.
2. 검색어 앞뒤 공백 제거, 대소문자 무시, 한글 초성 검색 지원 여부를 확정해야 합니다.
3. `popular` 타입은 계정·게시글·해시태그를 혼합할지, 별도 랭킹 응답을 제공할지 결정해야 합니다.
4. 게시글 검색 결과는 기존 `PostRecord`와 동일한 응답 구조를 사용하면 현재 `Post` 컴포넌트를 재사용할 수 있습니다.
5. 게임 필터의 서버 식별자는 프론트의 임시 slug와 맞추거나 게임 ID 기반으로 교체해야 합니다.
6. `FPS`처럼 장르 필터와 `PUBG`처럼 개별 게임 필터를 같은 파라미터로 처리할지 별도 `genre` 파라미터를 사용할지 협의가 필요합니다.
7. 결과가 많을 수 있으므로 cursor 기반 페이지네이션과 안정적인 정렬 기준이 필요합니다.
8. 비공개·차단·탈퇴·정지 사용자와 삭제·숨김·신고 처리된 게시물은 검색 결과에서 제외해야 합니다.
9. 해시태그는 저장 시 정규화 규칙과 검색 시 `#` 포함 여부를 통일해야 합니다.
10. 검색 자동완성을 추가할 경우 별도 suggestion API와 요청 빈도 제한 정책이 필요합니다.

### 현재 부족한 부분

- 백엔드 검색 API가 없어 현재 결과 영역은 빈 상태 UI만 표시합니다.
- 검색 결과 데이터 로딩, 오류 처리, 재시도, 페이지네이션은 아직 없습니다.
- 헤더 자동완성, 최근 검색어, 추천 검색어 기능은 없습니다.
- 모바일 화면에서는 기존 헤더 검색창이 숨겨져 있어 별도 모바일 검색 진입 UI가 필요합니다.
- 탭과 게임 필터를 클릭해도 현재 URL의 `tab`, `game` 파라미터는 갱신되지 않습니다.
- 게임 필터 목록은 프론트 상수이므로 서버 게임 목록과 자동 동기화되지 않습니다.
- 게시글 본문의 해시태그를 `/search?q={tag}&tab=hashtag` 링크로 변환하는 작업은 아직 없습니다.
- 검색어 강조 표시와 계정 팔로우 액션은 아직 연결되지 않았습니다.

### 검증

- `npm run lint` 통과
- `tsc --noEmit` 통과

### 브랜치 의존성

`feature/global-search-explore`는 `feature/bookmark-collections`에서 분기했습니다. PR 병합 시 `feature/bookmark-collections`를 먼저 병합하거나 검색 기능 커밋을 대상 브랜치에 재배치해야 합니다.
