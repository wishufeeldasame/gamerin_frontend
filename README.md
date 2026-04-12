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
