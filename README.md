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

* **26/06/18** 서장호

  > 메시지 첨부 이미지/동영상을 공개 `/uploads/message-attachments/**` URL 대신 인증된 백엔드 첨부 API에서 `Authorization` 헤더로 fetch하도록 변경
  > 가져온 첨부 파일은 브라우저 object URL로 변환해 기존 메시지 말풍선 이미지, 동영상, 이미지 확대 보기 UI에서 표시
  > 첨부 로딩/실패 상태를 메시지 말풍선 안에서 처리해 인증 만료나 삭제된 첨부 파일 접근 실패가 화면 깨짐으로 이어지지 않도록 보완
  > 검증: 번들 Node로 `eslint`, `tsc --noEmit` 통과

  > 요약 : DM 첨부 파일 비공개 API 전환에 맞춰 메시지 화면의 첨부 렌더링을 인증 fetch 기반으로 변경

* **26/07/06** 전준범

  > 메시지 대화 목록을 기본 5개만 표시하고, 초과 항목은 `더보기` 버튼으로 펼쳐 볼 수 있도록 기능 추가
  > 펼친 상태에서는 `가리기` 버튼으로 다시 기본 표시 개수로 접히도록 처리
  > 검색 결과가 5개를 초과할 경우 현재 표시 개수/전체 검색 결과 개수를 배지로 표시
  > 검색어 변경 시 대화 목록 펼침 상태가 초기화되도록 수정
  > 로컬 개발 환경에서 `NEXT_PUBLIC_API_BASE_URL` 미설정 시 `localhost:3000` 프론트가 `localhost:8080` 백엔드를 바라보도록 API 기본 주소 처리 개선
  > 메시지 실시간 스트림 연결 시 access token을 확보한 뒤 `EventSource` URL에 포함해 연결하도록 수정
  > 검증: `git diff --check`, `npm run lint`, `npm run build` 통과

  > 요약 : 메시지 대화 목록에 더보기/가리기 UX를 추가하고, 로컬 API 주소 및 메시지 스트림 연결 방식을 보완

* **26/07/07** 전준범

  > 다른 사용자 프로필에서 해당 사용자가 현재 로그인 사용자를 팔로우 중인지 확인할 수 있도록 `followsViewer` 필드 타입 추가
  > 프로필 헤더의 사용자 핸들 옆에 `나를 팔로우합니다` 배지가 표시되도록 UI 추가
  > 내 프로필 화면에서는 해당 배지가 노출되지 않도록 조건 처리
  > 팔로우/언팔로우 버튼과 별개로 상대방이 나를 팔로우하는 상태를 구분해서 표시하도록 정리
  > 검증: `git diff --check`, `npm run lint`, `npm run build` 통과

  > 요약 : 다른 사용자 프로필에서 상대방이 나를 팔로우하는지 `나를 팔로우합니다` 배지로 확인할 수 있도록 표시 기능 추가

* **26/07/09** 김신의

  > 북마크 컬렉션 관리를 위한 `BookmarkCollection` 타입과 게시글 저장 상태 필드를 추가
  > `BookmarkCollectionProvider`를 통해 컬렉션 생성, 게시글 저장, 저장 해제 상태를 전역으로 관리하도록 구현
  > 백엔드 컬렉션 API가 준비되기 전까지 `localStorage`의 `gamerin_bookmark_collections` 키를 사용해 컬렉션 상태를 임시 저장하도록 처리
  > 피드와 게시글 상세 화면의 북마크 버튼 클릭 시 `SaveToCollectionModal`이 열리도록 연결
  > 모달에서 기존 컬렉션을 복수 선택하거나 새 컬렉션을 만든 뒤 현재 게시글을 바로 저장할 수 있도록 구현
  > 컬렉션 선택 상태에 따라 기존 북마크 API와 연동하여 서버 북마크 상태와 프론트 컬렉션 상태가 함께 갱신되도록 처리
  > `/bookmarks` 페이지에서 전체 북마크와 컬렉션별 게시글 목록을 선택해 볼 수 있도록 화면 흐름 정리
  > 향후 백엔드 컬렉션 API 연동을 고려해 컬렉션 생성, 수정, 삭제 및 게시글 추가/삭제 계약 방향을 README에 정리
  > 검증: `npm run lint`, `tsc --noEmit` 통과

  > 요약 : 북마크 컬렉션 UI와 로컬 상태 관리를 추가하고, 기존 북마크 API와 함께 동작하도록 프론트 기능을 구현

* **26/07/09** 김신의

  > 게시글 타입에 `isReposted`, `repostCount`, `reposterInfo` 필드를 추가하여 리포스트 상태와 리포스트 표시 정보를 관리하도록 확장
  > 게시글 카드 액션 영역에 리포스트 버튼과 리포스트 수를 표시하도록 UI 추가
  > 리포스트로 노출된 피드 항목 상단에 `{nickname}님이 리포스트했습니다` 문구가 표시되도록 처리
  > `useRepost` 훅을 추가하여 낙관적 업데이트, 요청 중 중복 클릭 방지, API 실패 시 롤백 흐름을 관리하도록 구현
  > 홈, 북마크, 프로필 게시글 목록의 로컬 상태에 리포스트 변경 사항이 즉시 반영되도록 연결
  > 임시 리포스트 API 계약으로 `POST /api/v1/posts/{postId}/reposts`, `DELETE /api/v1/posts/{postId}/reposts` 호출 흐름을 작성
  > 현재 백엔드 리포스트 API 미구현 상태를 고려해 실제 저장/취소 연동, 리포스트 카운트 재보정, 리포스트 사용자 목록 및 알림 연동은 후속 작업으로 분리
  > `feature/post-repost`가 `feature/bookmark-collections`에서 분기된 상태라 PR 병합 시 북마크 컬렉션 브랜치 선병합 또는 리포스트 커밋 재배치가 필요함을 정리

  > 요약 : 게시글 리포스트 버튼, 리포스트 수 표시, 리포스트 피드 문구, 낙관적 업데이트 기반 리포스트 프론트 흐름을 추가

- **26/07/09** 김신의

  > 헤더 검색창을 제어 입력으로 변경하고 검색어 입력 상태를 관리하도록 수정  
  > 공백 검색을 차단하고 Enter 입력 시 `/search?q={검색어}` 경로로 이동하도록 검색 라우팅 연결  
  > `/search` 페이지에서 URL의 `q` 파라미터를 읽어 현재 검색어를 표시하도록 구현  
  > 검색 결과 유형을 `인기`, `계정`, `게시글`, `해시태그` 탭으로 분리하고 URL의 `tab` 파라미터로 초기 탭 선택이 가능하도록 처리  
  > `GameFilter`를 재사용 가능한 제어 컴포넌트로 분리하고 `전체`, `PUBG`, `VALORANT`, `LEAGUE OF LEGENDS`, `FPS` 필터를 제공하도록 구성  
  > 선택한 탭과 게임 필터에 따라 검색 결과 영역이 교체되는 상태 구조를 구현  
  > `useSearchParams` 사용으로 인한 App Router 빌드 오류를 방지하기 위해 `Suspense` 경계를 추가  
  > 향후 백엔드 검색 API 연동을 고려해 통합 검색 요청 경로, 탭 타입, 게임 필터, 계정·해시태그 응답 필드 방향을 README에 정리  
  > 현재 백엔드 검색 API 미구현 상태를 고려해 데이터 로딩, 오류 처리, 페이지네이션, 자동완성, 최근 검색어, 모바일 검색 진입 UI는 후속 작업으로 분리  
  > `feature/global-search-explore`가 `feature/bookmark-collections`에서 분기된 상태라 PR 병합 시 북마크 컬렉션 브랜치 선병합 또는 검색 기능 커밋 재배치가 필요함을 정리  
  > 검증: `npm run lint`, `tsc --noEmit` 통과

  > 요약 : 헤더 검색 라우팅, 검색 페이지, 결과 탭, 게임 필터, 전역 검색 화면 구조를 추가하고 백엔드 검색 API 연동 준비를 정리

<* **26/07/12** 전준범

  > 메시지 첨부 미리보기 URL 정리 방식을 `attachmentsRef` 기반으로 변경해, 이미지 일부 삭제 시 남은 미리보기가 깨질 수 있는 문제 보완
  > 메시지 SSE 연결 함수에 `forceRefresh` 옵션을 추가하고, 재연결 시 새 access token을 확보하도록 흐름 개선
  > SSE 연결 끊김 시 불필요한 재연결 오류 문구를 노출하지 않고, 내부 재연결만 유지하도록 정리
  > 대화 목록이 5개 초과로 접힌 상태에서도 현재 선택된 대화가 목록에 유지되도록 표시 로직 개선
  > 검증: `npm run lint` 통과, TypeScript `tsc --noEmit` 통과, 변경 파일 ESLint 직접 실행 통과

  > 요약 : 메시지 첨부 미리보기 안정성, 실시간 메시지 재연결 토큰 갱신, 접힌 대화 목록의 선택 대화 유지 동작을 개선

* **26/07/14** 전준범

  > 게시물·댓글·사용자 신고 UI를 공통 `Report.tsx` 컴포넌트로 분리해 동일한 신고 절차를 재사용하도록 구성
  > 게시물 목록과 상세 화면의 `...` 메뉴에서 다른 사용자의 게시물을 신고할 수 있도록 기능 추가
  > 게시물 상세 화면에서 다른 사용자의 댓글을 신고할 수 있도록 메뉴 추가
  > 다른 사용자 프로필의 채팅 버튼 왼쪽에 `...` 메뉴를 추가하고 사용자 신고 기능 연결
  > 신고 사유 8종을 제공하고, `기타` 선택 시 최대 300자의 사유를 직접 입력할 수 있도록 처리
  > 신고 확인 모달과 접수 완료 안내 화면을 추가하고, 본인 콘텐츠에는 신고 대신 기존 삭제 메뉴가 표시되도록 구분
  > 메시지 SSE 연결 함수에 선택적 `forceRefresh` 옵션을 추가해 재연결 시 새로운 access token을 사용하도록 개선
  > 검증: `npm run lint` 통과, TypeScript `npx tsc --noEmit` 통과, `npm run build` 통과

  > 요약 : 게시물·댓글·사용자 신고 UI를 공통 컴포넌트로 구성하고, 메시지 실시간 재연결 시 access token 갱신 흐름을 개선

* **26/07/15** 전준범

  > PR #34에서 변경된 메시지 SSE 인증 흐름을 백엔드 계약에 맞게 복구
  > `EventSource` URL의 `accessToken` query parameter 생성 및 전달 로직 제거
  > SSE 연결 전에 `POST /api/v1/messages/stream-token`을 호출하여 HttpOnly 전용 쿠키를 발급받도록 변경
  > 토큰 없는 `/api/v1/messages/stream` URL에 `withCredentials: true`로 연결하도록 변경
  > access token이 URL, 브라우저 히스토리, 프록시 및 서버 로그에 노출될 수 있는 경로 제거
  > 검증: `git diff --check`, `eslint`, `tsc --noEmit`, `next build` 통과

  > 요약 : PR #34의 SSE 인증 회귀를 수정하고 메시지 실시간 연결을 HttpOnly cookie 기반 방식으로 복구

* **26/07/16** 전준범

  > PR #36 북마크 모음집의 공용 `localStorage` 키를 사용자 ID별 `gamerin_bookmark_collections:{userId}` 키로 분리
  > 로그인 사용자가 바뀌거나 로그아웃될 때 이전 계정의 모음집 상태를 즉시 비우고, 현재 계정 키에서 다시 불러오도록 수정
  > 이전 공용 키 `gamerin_bookmark_collections`는 읽지 않고 삭제하여 계정 간 모음집 정보가 다시 표시되지 않도록 정리
  > 모음집에 게시글을 추가하거나 제거할 때 서버 북마크 요청이 성공한 뒤에만 로컬 `savedPostIds`를 변경하도록 수정
  > 서버 요청 실패 시 모음집 상태를 변경하지 않고 오류를 표시하며, 요청 중 중복 선택을 막도록 처리
  > 선택한 모음집의 현재 로드 결과가 비어 있어도 다음 페이지가 있으면 `더 보기` 버튼을 표시하도록 페이지네이션 표시 조건 수정
  > 저장된 모음집 JSON의 구조를 검증하고, 잘못된 현재 사용자 데이터는 해당 사용자 키만 초기화하도록 보완
  > 검증: `git diff --check`, `tsc --noEmit`, `git diff --cached --check` 통과

  > 요약 : 사용자별 모음집 저장소 분리, 서버 실패 시 로컬 상태 불일치 방지, 모음집 페이지네이션 접근 불가 문제를 수정

* **26/07/17** 김신의

  > 북마크 모음집 상태 관리를 `localStorage` 기반에서 백엔드 API 연동 방식으로 전환
  > `BookmarkCollection` 타입을 백엔드 응답 필드인 `collectionId`, `name`, `coverImageUrl`, `bookmarkCount`, `createdAt`, `updatedAt`, `containsPost` 기준으로 수정
  > `GET /api/v1/bookmark-collections`와 `GET /api/v1/bookmark-collections?postId={postId}`를 사용해 모음집 목록 및 게시글별 저장 상태를 조회하도록 연결
  > 모음집 생성 시 `POST /api/v1/bookmark-collections`에 `name`, `initialPostId`를 전송하여 생성과 동시에 현재 게시글을 저장하도록 처리
  > 모음집 체크·해제 시 `PUT/DELETE /api/v1/bookmark-collections/{collectionId}/bookmarks/{postId}`를 호출하도록 저장 모달 로직 교체
  > 전체 북마크 해제는 기존 `DELETE /api/v1/posts/{postId}/bookmarks` 흐름을 유지하고, 해제 후 모달 내 체크 상태와 북마크 상태가 즉시 반영되도록 수정
  > `/bookmarks` 페이지 조회를 서버 기준으로 변경하여 전체는 `scope=all`, 미분류는 `scope=unclassified`, 모음집별은 `/api/v1/bookmark-collections/{collectionId}/bookmarks`를 사용하도록 연결
  > 검색어 `q`, 미디어 필터 `mediaOnly`, 커서 `cursor`, 페이지 크기 `size`를 백엔드 쿼리 파라미터로 전달하도록 변경
  > 컬렉션 목록의 `bookmarkCount`와 실제 조회 결과가 일시적으로 어긋나는 경우 선택된 모음집 조회 결과 기준으로 화면 카운트를 보정하도록 처리
  > 백엔드 API가 별도 서버에서 동작한다는 전제로 프론트는 인증 포함 API 호출과 응답 상태 반영만 담당하도록 역할 정리
  > 검증: `git diff --check`, `npm run lint`, `tsc --noEmit` 통과

  > 요약 : 북마크 모음집을 서버 API 기반으로 전환하고, 저장 모달과 북마크 페이지의 컬렉션별·미분류 조회 및 상태 동기화를 백엔드 계약에 맞춰 정리

* **26/07/20** 전준범

  > [P1] 북마크 요청 중 계정이 전환되면 이전 계정의 늦은 응답이 현재 계정의 모음집 상태를 덮을 수 있는 문제 수정
  > `auth-store.ts`에 `authGeneration`을 추가하고 로그인·로그아웃 및 refresh 요청을 인증 세대별로 구분
  > `feed-api.ts`에서 요청 시작, 최초 응답, 401 refresh, 재시도 전후의 인증 세대를 검증하고 계정이 바뀌면 `AbortError`로 중단
  > `BookmarkCollectionContext.tsx`의 모음집 상태에 `ownerId`를 부여하고, 사용자 변경 시 기존 목록과 진행 중인 요청 상태를 즉시 초기화
  > 모음집 조회·생성·추가·제거 응답은 요청 당시 사용자 ID와 인증 세대가 현재 사용자와 같은 경우에만 상태에 반영
  > `AuthContext.tsx`의 앱 시작 인증 복원에도 세대 검증을 적용하여 이전 bootstrap 응답이 새 로그인 상태를 덮지 않도록 처리
  > access token 메모리 저장, HttpOnly refresh cookie, 기존 북마크 API 계약과 동일 계정의 401 재시도 정책은 그대로 유지
  > 검증: 계정 전환·401 경합 7개 시나리오, `tsc --noEmit`, 전체 `ESLint`, `Next.js production build`, 백엔드 북마크 테스트 30건, `PostgreSQL` 동시성 테스트 13건 통과
  > 적용 범위: 북마크가 사용하는 `feed-api.ts`에 적용했으며 메시지·멘토링·마일리지 API는 별도 후속 작업으로 분리

  > 요약 : 계정 전환 후 이전 계정의 북마크 응답과 401 재시도가 현재 계정의 토큰·모음집 상태를 덮지 못하도록 수정

* **26/07/21** 서장호

  > PUBG와 Rainbow Six Siege의 전적 API 타입과 인증 요청을 `game-stats-api.ts`로 분리
  > 프로필 전적 카드에 연동 닉네임, 경쟁전·일반전 구분, 티어, K/D, 승률, 경기 수를 공통 형식으로 표시
  > 일반전에서는 티어를 표시하지 않고 조회할 수 없는 값은 `-`로 처리하도록 렌더링 규칙 정리
  > 기존 `kda`, `games` 필드 fallback 없이 새 `kd`, `matches`, `statsMode` 응답 구조만 사용하도록 변경
  > R6 전용 전적 제거 상태·핸들러·확인 모달을 PUBG와 R6가 함께 사용하는 공통 UI로 전환
  > 선택한 게임에 따라 `DELETE /api/v1/pubg/disconnect` 또는 `DELETE /api/v1/r6/disconnect`를 호출하고 성공한 게임 카드만 제거하도록 구현
  > R6 계정이 다른 사용자에게 이미 연동된 경우 백엔드의 `409 Conflict` 메시지를 연결 모달에 표시하도록 처리
  > 검증: `git diff --check`, `npm run lint`, `npx tsc --noEmit`, `npm run build` 통과

  > 요약 : PUBG/R6 공통 전적 표시와 재사용 가능한 전적 제거 UI를 구성하고 R6 중복 연동 오류를 화면에 연결
