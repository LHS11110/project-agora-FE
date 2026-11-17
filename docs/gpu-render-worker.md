# GPU 렌더링 스레드 분리

지원 브라우저에서는 깊이별 Rust·wgpu 렌더러가 Web Worker의 OffscreenCanvas에서 동작한다. 기존 GPU 컨텍스트 한도에 따라 최대 4개 GPU Worker를 사용한다. Worker 초기화가 불가능한 브라우저는 기존 메인 스레드 GPU 경로를 사용하고, 실행 중 GPU/Worker 장애는 캐시된 Canvas 2D 경로로 복구한다.

## 작업 분담

- 메인 스레드: 입력·선택·DOM 편집기·패널, 공간 검색과 객체 미리보기 래스터 준비. 래스터 준비는 기존 시간 예산으로 나눈다.
- GPU Worker: WASM 인스턴스와 GPU 컨텍스트, 텍스처 업로드, 장면 버퍼 갱신, RenderBundle과 그리기 명령 제출, 프레임 생성.
- 메인 스레드 표시: 전달받은 ImageBitmap을 bitmaprenderer에 교체한다. 카메라 입력 시 기존 프레임을 즉시 재투영하여 DOM 편집기와 좌표를 맞춘다. 프레임에는 256px 여백을 둔다.

DOM이나 모든 객체 래스터화까지 Worker로 이전한 것은 아니다. 브라우저에서 직접 조작해야 하는 UI와 DOM 기반 폰트/콘텐츠 준비는 메인에 남아 있다.

## 전송·자원 관리

카메라·텍스처·장면 변경은 최신 상태로 합친다. 처리 중인 프레임은 하나만 허용하고, 다음 상태를 계속 덮어써 오래된 요청이 쌓이지 않게 한다. 이는 FPS 상한이 아니다. 카메라만 바뀌면 텍스처와 장면 버퍼를 다시 보내지 않는다.

장면 인스턴스는 typed array를 한 번 복사한 뒤 ArrayBuffer 소유권을 전송한다. 텍스처는 제출 시점에 최신 아틀라스를 ImageBitmap으로 캡처한다. 프레임과 텍스처도 transferable로 보낸다. SharedArrayBuffer·WASM pthreads·COOP/COEP 헤더는 요구하지 않는다.

WebGL의 ImageBitmap 업로드 제한에 맞춰 비트맵을 premultiplyAlpha로 생성하고 Rust 복사 플래그를 선택한다. 업로드 비트맵은 GPU 명령 제출 이후에 닫아, 지연된 복사가 빈 이미지를 읽지 않게 한다. 부분 캡처 실패·오래된 장면 프레임·종료 후 늦게 도착한 비트맵도 정리한다.

장면 버전이 이미 바뀌었으면 이전 Worker 프레임은 표시하지 않는다. 카메라만 달라진 결과는 현재 카메라에 맞춰 투영한다. 초기 프레임이 도착하기 전에는 기존 Canvas 2D 표시를 유지한다. 초기화·프레임 처리에는 장애 감지용 제한 시간이 있으며, 정상 렌더링에 고정 프레임 간격은 없다.

## 검증

- 단위 테스트: 프레임 수 제한, 최신 장면 유지, 오래된 결과 폐기, 부분 캡처 실패 시 자원 정리.
- `tests/integration/gpu-worker-rendering.mjs`: Worker 메시지를 60ms 지연시킨 상태의 이동·확대 픽셀 정렬, 반투명 색상, Worker 불가 시 메인 GPU 대체 경로.
- `scripts/check-depth-rendering-browser.mjs`: 깊이 변경과 Worker GPU 컨텍스트 손실 복구.
- `tests/integration/camera-layer-alignment.mjs`: GPU/Canvas2D 카메라 좌표 일치.
- 코드 객체 편집·격자 배치 브라우저 회귀 테스트.

검증 환경의 60Hz headless Chrome에서 2만 객체 이동·확대는 약 60회/초였고, 메인 카메라 이벤트 처리 p95는 약 0.2ms였다. Worker 프레임도 각 3초 구간에 약 180회 도착했다. 20만 혼합 객체 테스트는 Worker 경로에서 약 60.7fps였다. 초기 객체 준비 이후의 짧은 독립 장면 측정이며 실제 대규모 협업 화면 전체의 성능 보장은 아니다.

실제 하드웨어 WebGL 경로를 검사했다. WebGPU OffscreenCanvas 경로는 브라우저·어댑터별 추가 검증이 필요하다.
