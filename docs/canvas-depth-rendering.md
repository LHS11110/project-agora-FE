# 깊이 변경 렌더링 회귀 검증

깊이 레이어를 제거한 뒤 지연된 `webglcontextlost` 이벤트가 도착하면, 종료된 Pixi Application의 `canvas` getter가 이미 해제된 renderer에 접근해 예외가 발생했다. 레이어 정리 시 이벤트를 해제하고, 이미 대기 중인 콜백에서도 종료 여부를 확인한다.

GPU 렌더링 호출이 실패하거나 컨텍스트가 손실되면 해당 레이어는 Canvas 2D로 전환한다. 객체·래스터 캐시는 유지하고, 장면 및 화면 버퍼의 유효 상태를 초기화해 객체나 카메라가 추가로 바뀌지 않아도 전체를 다시 그린다. GPU 사용 슬롯도 반환한다.

검증 결과:

- Node 회귀 테스트 126개 통과.
- Chrome의 하드웨어 WebGL 경로에서 도형·드로잉·일반 텍스트 36개 검증.
- 0 깊이와 양수·음수의 9개 깊이 사이를 여섯 차례 분리·병합.
- GPU draw 호출 예외와 WebGL 컨텍스트 손실을 강제로 발생시켜 2D 복구 확인.
- 각 단계의 브라우저 스크린샷을 픽셀 검사해 36개 객체의 표시를 확인. 브라우저 예외 없음.

브라우저 검증은 실제 계정·캔버스·저장소를 사용하지 않는 독립된 렌더러 테스트다. `tests/browser/depth-layers.html`과 실제 SceneViewModel, 공간 인덱스, DepthVectorLayer를 사용한다. Python이나 이미지 처리 패키지는 필요하지 않다.

```sh
node --test tests/*.test.js
# 선택적 검증 도구는 애플리케이션 의존성과 분리해서 설치한다.
npm install --prefix /tmp/agora-depth-check playwright-core --no-audit --no-fund
PLAYWRIGHT_MODULE_PATH=/tmp/agora-depth-check/node_modules/playwright-core/index.mjs \
REQUIRE_GPU=1 node scripts/check-depth-rendering-browser.mjs
```

기존 로컬 개발용 TLS 설정이 필요하며, 브라우저 테스트 서버는 빈 임시 포트를 사용하고 종료 시 닫는다. Chrome 경로는 `CHROME_PATH`로 지정한다. GPU가 없는 환경에서는 `REQUIRE_GPU`를 생략하면 CPU 렌더링만 확인하며, GPU 장애 주입은 생략한다.
