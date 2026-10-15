# Canvas 데이터 생명 주기

편집 가능한 캔버스: https://112.168.71.147/canvases/2046

한국어 보고서형 도판 두 장과 편집 가능한 네이티브 객체 82개입니다.

- `01-canvas-lifecycle.svg`: 생성, 비활성 보관, 접근, Redis 복원·재사용, 공동 편집, 유휴 판정, 스냅샷, 자원 회수 및 재접속.
- `02-persistence-and-deletion.svg`: 저장 검증, 실패 시 활성 데이터 유지, 영구 삭제의 권한·비활성 조건.
- `project-agora-canvas-lifecycle.pdf`: A4 가로형 2페이지 벡터 PDF.
- `canvas-lifecycle.canvas.json`: 편집 가능한 캔버스 객체.

2026-10-15 현재 코드를 확인했습니다. Spring `CanvasService`의 생성·접속·삭제,
C++ `CanvasLifecycleMemory`의 초기화·스냅샷·언로드, `CanvasServiceMemory`와
`CanvasSnapshotMemory`의 저장·복원, Phoenix `Room`의 순차 스냅샷 및 lease가 근거입니다.

유휴 기준은 최근 질의 기본 TTL 90초이며 활성 연결은 30초 주기 lease로 유지됩니다.
회수는 데이터 삭제가 아닙니다. ES 반영 후 SQL을 비활성으로 바꾸고, 세대가 일치하는
Redis 캐시만 정리합니다. 활성 Redis를 읽지 못한 경우 이전 ES 상태로 조용히 되돌리지 않습니다.
삭제는 소유자·시스템 관리자만 가능하며 활성 캐시 상태에서는 거절됩니다.

실제 서버 저장 응답, RedisJSON 객체 82개, 새로고침 후 재로딩을 검증했습니다.
브라우저 JavaScript 오류는 없었습니다. 생성·내보내기 명령:

```sh
node scripts/generate-canvas-lifecycle.mjs
PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core/index.mjs node scripts/export-canvas-lifecycle.mjs
```

`scripts/create-canvas-lifecycle-browser.mjs`는 새 캔버스와 소유자 전용
`LIFECYCLE_SESSION_FILE`을 사용합니다. 인증 정보는 저장소에 포함하지 않습니다.
