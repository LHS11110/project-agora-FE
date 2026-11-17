# 카메라 이동·확대·축소 최적화 (2026-11-17)

## 변경

- 이동·확대 중 카메라 픽셀 변환은 브라우저의 매 requestAnimationFrame에서 적용한다. 애플리케이션에서 30/60fps를 지정하거나 프레임을 건너뛰는 타이머를 사용하지 않는다.
- Rust/wgpu 표시 모드는 고정 Fifo에서 AutoNoVsync로 변경했다. 지원되는 경우 비동기 표시를 선택하고 미지원 환경에서는 wgpu가 지원 모드로 대체한다. 브라우저 requestAnimationFrame과 실제 화면 주사율에 따른 제한은 여전히 존재한다.
- React 장면 갱신의 140/240ms 주기를 제거했다. 이전 뷰포트에 대한 256px 준비 여백을 소모하기 전에 공간 검색을 갱신한다. 두 배 이상 확대하면 불필요한 화면 밖 객체를 정리하기 위해 갱신한다. 중간 화면 변환은 React 갱신을 기다리지 않는다.
- 입력마다 정지 감지 타이머를 취소·재생성하지 않고, 하나의 타이머가 최신 정지 마감 시각을 확인한다. 카메라 훅과 깊이별 렌더러에 적용했다.
- GPU 장면의 draw 명령을 RenderBundle로 캐시한다. 카메라 이동은 uniform만 변경하고 같은 명령을 실행한다. 장면/인스턴스 버퍼 변경, 텍스처 생성·삭제 시 캐시를 무효화한다. 텍스처 내용만 갱신하면 기존 바인딩을 재사용한다.

## 검증과 측정 범위

`tests/integration/camera-motion-performance.mjs`는 실제 카메라 훅과 Rust 렌더러를 사용한다. 2만 도형을 미리 준비한 뒤 이동과 확대·축소를 각각 약 3초간 수행했다. 준비 영역 안의 이동에서 React 중간 갱신은 13→0회, 확대·축소는 22→0회다. 조작 종료 후 갱신은 별도로 수행한다. 두 경우 모두 추가 래스터화는 0회였다.

60Hz headless Chrome의 일반 실행에서는 이동 약 60.3회/초, 확대·축소 약 60.5회/초의 애니메이션 콜백과 실제 렌더러 제출을 확인했다. 프레임 간격 p95는 각각 16.8ms와 16.7ms였다. 고주사율 모니터에서의 실제 표시 프레임은 별도 측정이 필요하다.

`UNTHROTTLED=1`은 테스트용 Chrome 제한 해제 옵션이다. 여기서 얻는 수천 회/초 수치는 애니메이션 콜백·명령 제출 처리량이며 실제 모니터 FPS나 고유 영상 프레임 수가 아니다. 이를 일반 FPS 성능으로 해석하지 않는다.

```sh
AGORA_E2E_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs node tests/integration/camera-motion-performance.mjs
node --test tests/cameraIdleTask.test.js tests/cameraCommitSchedule.test.js
node tests/integration/camera-layer-alignment.mjs
PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core/index.mjs REQUIRE_GPU=1 node scripts/check-depth-rendering-browser.mjs
```

카메라 정렬은 GPU·Canvas2D 둘 다 검사한다. 깊이 분할·병합, GPU 컨텍스트 손실 복구와 코드 객체 편집/격자 배치도 브라우저에서 확인한다. 측정은 독립 테스트 장면이며 실제 대규모 협업 페이지 전체의 성능을 보장하는 결과는 아니다.
