# Project Agora — 보고서용 아키텍처 도판

2026년 10월 15일의 소스 코드와 실행 중인 Docker 구성을 기준으로 작성했습니다.
설명·제목·화살표 라벨·주석은 한국어이며, 제품명과 API 식별자는 원문을 유지합니다.

편집 가능한 캔버스: https://112.168.71.147/canvases/2042

- `01-system-architecture.svg`: 클라이언트, 외부 진입 계층, 애플리케이션,
  저장소, Project Orchestra 제어 계층을 나타낸 구성도입니다.
- `02-replication-protocol.svg`: 편집 제안부터 브라우저 호스트 승인과 저장까지의
  논리적 메시지 흐름입니다. 브라우저의 수용 확인과 Redis 반영을 구분합니다.
- `project-agora-architecture.pdf`: 한글 글꼴을 포함한 A4 가로형 2페이지 PDF입니다.
  글자와 도형은 확대 가능한 벡터 형식입니다.
- `architecture.canvas.json`: 네이티브 객체 125개로 구성된 편집용 데이터입니다.

실행 중인 Nginx 설정, HAProxy 구성, Docker 서비스 목록, `CanvasBrokerPeers`,
`HostCanvasSession`, 백엔드·DB의 Compose 구성을 확인했습니다.
임베딩 워커 호출은 내부 게이트웨이를 경유합니다. 전체 구성도에서는 이 중간
단계를 논리적으로 묶어 표시하고, 응답 경로는 생략했습니다.
현재 서비스는 하나의 Docker 호스트에 있으며, Redis는 주 노드 1대·복제본 2대·
Sentinel 3대 구성입니다. SQL Express와 Elasticsearch는 단일 노드입니다.

재생성:

```sh
node scripts/generate-report-architecture.mjs
PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core/index.mjs node scripts/export-report-architecture.mjs
```

초기 캔버스 생성용 `scripts/create-report-canvas-browser.mjs`는 소유자 전용 세션 파일
(`REPORT_SESSION_FILE`)과 새 캔버스를 사용합니다. 인증 토큰은 저장소에 포함하지 않습니다.
한국어 갱신 시에는 기존 캔버스의 텍스트만 수정하여 사용자가 변경한 위치와 크기를 보존했습니다.

탐색 창 검증: 데스크톱 캔버스 너비는 1684px에서 1920px로, 모바일 높이는 788px에서
844px로 증가했습니다. 새로고침 후 상태 유지, 키보드 복원, 프로필 페이지가 영향을
받지 않는 것도 확인했습니다. 이 설정은 다른 참여자에게 공유되지 않습니다.
