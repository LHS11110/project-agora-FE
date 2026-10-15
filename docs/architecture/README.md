> 이 캔버스는 이전 호스트 방식의 구성 기록입니다. 현재 구조는 [보고서용 아키텍처](report/README.md)와 [서버 동기화](../canvas-server-sync.md)를 참고하세요.

# Project Agora 아키텍처 캔버스

현재 다이어그램: [캔버스 #2037](https://112.168.71.147/canvases/2037)

2026-10-15 실행 중인 컨테이너, 호스트/Docker Nginx 설정과 FE·BE·Wall·DB 코드를 대조해 작성했습니다. 116개의 편집 가능한 도형·텍스트·화살표로 구성합니다. 각 서비스 카드의 도형과 글자는 그룹으로 묶었습니다.

- 첫 영역: 브라우저, 외부 Nginx, Docker 게이트웨이, Spring, Phoenix, C++, HAProxy, SQL, ES, Redis/Sentinel 및 검색 worker·Orchestra.
- 아래 영역: 변경 중계·호스트 승인·서버 저장, 신규 참여자 동기화, ACK와 영속성의 차이, Docker 네트워크와 현재 HA 범위.
- 편집·포인터·레이저 데이터는 브로커로 전달하고 음성 통화만 WebRTC P2P로 표현합니다. 기존 아키텍처 문서의 포인터 P2P 설명보다 현재 코드를 우선했습니다.
- 현재 공개 진입점은 호스트 Nginx :443이며 Docker 게이트웨이의 호스트 매핑은 127.0.0.1:8444입니다. 점유 중인 8443 포트는 사용하지 않습니다.

백업은 `current-project.canvas.json`이며 캔버스의 **캔버스 코드 → JSON 가져오기 → 변경 검토 → 검토한 변경 적용**으로 가져올 수 있습니다. 기존 내용에 추가되는 merge 파일입니다.

재생성:

```bash
node scripts/generate-architecture-canvas.mjs
```

이 명령은 백업 파일만 생성하고 서버의 캔버스를 변경하지 않습니다. 좌표는 앱의 Canvas as Code 픽셀 단위입니다. 화살표는 수동 배치한 도형이며 서비스 카드 이동 시 경로도 함께 조정해야 합니다.

저장은 실제 브로커의 `host_batch_result` 성공 응답, RedisJSON `canvas:2037`의 객체 116개 및 새 연결의 재로딩으로 검증했습니다. 미리보기 API는 활성 캔버스의 메타데이터 조회 경로에서 객체가 생략될 수 있어 저장 검증에는 사용하지 않았습니다.
