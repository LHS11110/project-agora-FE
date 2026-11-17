# Rust / wgpu 렌더링

캔버스의 깊이별 GPU 렌더링은 `rust/agora-wgpu-renderer`의 Rust 코드를 WASM으로 빌드하여 사용한다. `DepthVectorLayer` → `wgpuEngine` → `WgpuCanvasRenderer` 순서다. WebGL2를 우선하고 초기화할 수 없으면 WebGPU를 시도한다. 소프트웨어 어댑터는 제외하며, GPU를 사용할 수 없거나 컨텍스트가 손실되면 기존 캐시와 Canvas 2D/Worker 합성 경로를 사용한다.

- 외형 준비: 기존 JavaScript Canvas 2D 래스터 캐시를 유지한다. 선택·편집 UI, 실제 영상/HTML 편집기는 DOM이다. 모든 기능을 Rust로 이전한 것은 아니다.
- 텍스처: 1,024px 아틀라스와 개별 텍스처를 Rust GPU 리소스 ID로 관리한다. 변경된 페이지만 업로드한다.
- 장면: JS에서 48바이트 인스턴스(위치·크기·UV·회전·색)를 채우고 Rust가 GPU 버퍼에 올린다. 같은 텍스처가 연속된 항목만 묶어 깊이 순서를 유지한다.
- 카메라: 캐시된 장면의 카메라 이동은 인스턴스 버퍼와 텍스처를 재업로드하지 않고 uniform만 변경한다. DOM 카메라 이벤트와 같은 프레임에서 그려 정렬을 유지한다.
- 품질: 기존 그래픽 품질별 DPR·래스터 예산·그림자 정책을 유지한다.
- 오류: surface 재구성을 시도하며, 복구할 수 없는 surface/device 오류는 Canvas 2D 경로로 전환한다.

## 빌드

Rust, `wasm32-unknown-unknown` 타깃, `wasm-bindgen-cli 0.2.100`이 필요하다. wasm-bindgen 라이브러리와 CLI 버전은 일치해야 한다.

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.100 --locked
npm run build:wasm
python3 scripts/wgpu-notices.py
npm run build
```

Cargo.lock을 사용한다. 생성된 `src/canvas/wgpu/pkg`와 `public/licenses/rust`는 배포 입력이며 저장소에 포함한다. Docker의 Node 빌드는 이 생성물을 사용하므로 Rust 소스를 수정했으면 WASM을 다시 생성해야 한다. `rust/**/target`은 Git과 Docker 컨텍스트에서 제외한다.

## 검증

```sh
node --test tests/wgpuSceneBatcher.test.js
PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core/index.mjs REQUIRE_GPU=1 node scripts/check-depth-rendering-browser.mjs
node tests/integration/camera-layer-alignment.mjs
```

깊이 분리·병합, GPU 컨텍스트 손실 뒤 복구, GPU/Canvas2D 카메라 정렬을 검증한다. WebGL 메서드에서 인위적으로 JavaScript 예외를 발생시키는 과거 Pixi 전용 검사는 WASM 내부 호출을 중간에 끊으므로 실제 컨텍스트 손실 검사로 대체했다. WebGPU 장치의 실제 드라이버 손실은 별도 환경에서 검증해야 한다.

20만 개 혼합 객체 테스트는 `tests/integration/mixed-graphics.mjs`이다. `REQUIRE_GPU=1`로 하드웨어 Rust 렌더러 사용을 확인할 수 있다. 테스트 수치는 해당 하드웨어·축소 배율의 결과이며, 20만 개의 영상 디코더를 동시에 재생하는 시험은 아니다.

## 2026-11-17 검증 결과

- 단위 테스트: 551개 통과(인스턴스 패킹·아틀라스 업로드/해제 포함).
- 실제 브라우저: 36개 객체의 깊이 변경 6회, GPU 컨텍스트 손실 후 Canvas2D 복구 통과.
- 카메라 이벤트 직후 좌표 일치: 하드웨어 GPU와 Canvas2D 모두 통과.
- 20만 개 혼합 객체, low 품질, 배율 약 0.04, 1,200×850 headless Chrome, 준비 완료 후 약 2.5초 이동·확대: Rust/wgpu WebGL 약 60.65fps, 최대 프레임 간격 16.8ms. 같은 조건의 Canvas2D는 약 43.79fps, 최대 266.6ms.

초기 준비 시간을 제외한 짧은 단일 측정이다. 이미지·미디어는 대량 객체 LOD 개요를 사용하며 실제 스트리밍 동시 재생 성능을 뜻하지 않는다. 프레임 수는 브라우저 rAF 간격으로 측정한다.
