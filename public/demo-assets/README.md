# 전시용 발로란트 자료

- 원본: 사용자가 제공한 작업 공간 루트의 `vlrt_movie.mp4` (1920×1080, 약 10.63초). 원본은 수정하지 않았다.
- `valorant-highlight.mp4`: 원본 2–10초의 8초 구간. 1280×720 MP4, 오디오 트랙 제외. 전시 페이지에서 무음 재생한다.
- `valorant-thumb-1.jpg`, `valorant-thumb-2.jpg`, `valorant-thumb-3.jpg`: 원본 약 2.8·4.8·6.5초의 1280px JPEG 프레임.
- 게시 데모는 두 번째 썸네일을 선택한다. 배그 영상은 포함하지 않는다.
- macOS AVFoundation의 `AVAssetExportSession`과 `AVAssetImageGenerator`로 추출했다. 앱 런타임에서 변환하지 않는다.
- 파일은 공개 정적 경로로 제공된다. 원본 영상의 전시·배포 권한은 제공자가 확인해야 하며 프로젝트 라이선스가 영상 권리를 부여하지 않는다.

## 실제 서비스 화면 녹화

- `exhibition.mp4`: 현재 프론트의 `/profile/viewer`, `/`, `/posts/1`, `/mentoring`, `/messages`를 Playwright로 열고 실제 DOM 조작을 촬영한 60초 무음 영상이다. 별도로 그린 앱 UI는 사용하지 않는다.
- `exhibition-poster.jpg`: 실제 피드의 촬영 프레임이다.
- 계정·전적·게시물·멘토링·후기는 촬영 전용 예시다. `e2e/support/demo-capture.ts`가 촬영 브라우저의 API 요청을 가로챈다. 실제 로그인·업로드·신청·결제·메시지 쓰기를 서버에 보내지 않는다.
- 사용자 제공 게임 영상은 게시 전 미리보기, 게시된 피드·게시물 상세, 메시지 첨부 화면에서 실제로 재생한다. 촬영 테스트는 동영상의 `currentTime` 증가를 확인한다.
- 0–5초와 54–60초는 페이지의 타이틀 연출 구간이다. 중간 화면은 연결 5–13초, 게시 13–26초, 반응 26–35초, 멘토 선택·신청 35–44초, 수락·피드백·완료·후기 44–54초다. 조작 구간은 해당 길이에 맞춰 편집한다.
- 프론트 화면이 바뀌면 다시 촬영해야 한다. 앱 소스나 사용자 작업 파일은 촬영을 위해 수정하지 않는다.

재생성(macOS, 실행 중인 로컬 프론트 필요):

```bash
# 비밀 설정 파일이나 실제 계정 상태를 읽지 않는다. 출력 경로는 작업용 임시 디렉토리를 지정한다.
DEMO_CAPTURE_DIR=/path/to/temporary/capture npx playwright test e2e/demo-capture.spec.ts --grep '실제 화면 전시 영상 촬영' --workers=1
# 출력 MP4가 이미 있으면 다른 이름으로 만든 뒤 검토한다. 기존 파일을 자동 삭제하지 않는다.
swift scripts/render-demo.swift /path/to/temporary/capture/manifest.json /path/to/new/exhibition.mp4
```

렌더러는 AVFoundation으로 촬영 프레임을 연결하고 60초·오디오 트랙 없음·대본 순서를 자체 검사한다. `ffmpeg`나 새 npm 의존성은 필요 없다. 앱에서 녹화 요청이나 데이터 fixture를 실행하지 않으며 정적 MP4만 제공한다.
