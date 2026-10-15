# 사용자 관점 핵심 흐름도

편집 가능한 캔버스: https://112.168.71.147/canvases/2043

핵심 흐름은 **로그인 → 캔버스 탐색 → 검색 또는 생성 → 접속 → 최신 상태 동기화
→ 공동 편집 → 목록으로 돌아가기**입니다. 검색과 생성은 같은 접속 단계로 합쳐집니다.
로그인 화면의 회원가입, 생성 화면의 선택 항목, 접속 시 비밀번호 확인,
작업 중 재동기화, 선택적인 채팅·음성 통화도 표시했습니다.

- `01-user-journey.svg`: 한국어 벡터 흐름도.
- `project-agora-user-flow.pdf`: 한글 글꼴이 포함된 A4 가로형 1페이지 PDF.
- `user-flow.canvas.json`: 편집 가능한 네이티브 캔버스 객체 60개.

2026년 10월 15일의 `LoginPage`, `SearchPage`, 보호된 라우팅 및 캔버스 연결·편집
화면을 기준으로 작성했습니다. 일반적인 기본 진입 경로를 보여주는 도판이며,
공유받은 캔버스 링크로 시작하면 로그인 후 해당 캔버스로 바로 돌아가는 경로도 있습니다.
연결 복구는 작업 중 일시적인 연결 중단에 대한 흐름을 표현하며, 접근 권한과
비밀번호 오류는 안내에 따라 별도로 확인해야 합니다.

재생성:

```sh
node scripts/generate-user-flow.mjs
PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core/index.mjs node scripts/export-user-flow.mjs
```

초기 업로드 도구 `scripts/create-user-flow-canvas-browser.mjs`는 새 캔버스와
소유자 전용 세션 파일(`USER_FLOW_SESSION_FILE`)을 사용합니다. 실제 브로커·호스트
편집 경로를 통해 적용하며, RedisJSON 저장 및 새로고침 후 복원을 검증합니다.
인증 토큰은 저장소에 포함하지 않습니다.
