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
