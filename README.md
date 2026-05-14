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
