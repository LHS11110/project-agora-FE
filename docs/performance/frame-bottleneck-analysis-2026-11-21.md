# 캔버스 프레임 저하 원인 분석 및 최적화 해결 방안 (2026-11-21)

> 기준 시점: `HEAD 5fbe7b9` (`fix: skip GPU-only rasters in the canvas2d depth buffer`)  
> 본 문서는 현재 적용된 최적화 이후에도 프레임(60~120 FPS)과 프레임 페이싱(p95/p99)을 소모시키는 **잔여 병목의 코드 레벨 원인**과 **구체적 해결 방안**을 정리합니다.

---

## 1. 현재 최적화 베이스라인 요약

현재 코드베이스에는 이미 고수준의 최적화가 다수 적용되어 있습니다.
- **GPU 스레드 분리 및 메모리 절감**: Rust/wgpu 기반 단일 공유 GPU Worker(`WorkerGpuRenderer.js`, `gpuRenderer.worker.js`), `RenderBundle` 캐싱, Direct Atlas 부분 업로드(`upload_canvas_subtexture`), 빈 레이어 유휴 GPU 해제.
- **증분 데이터 구조**: 1024-버킷 구조 공유 스냅샷(`itemSnapshots.js`), `ItemSubset`, `CanvasSpatialBTree` + `CanvasGridIndex`, `StableSpatialQuery`, `RasterPaintIndex`.
- **점진적 준비 및 입력 지연 축소**: `ScenePreparationQueue`(프레임 예산 분할), `CameraIdleTask`, 잉크 제스처 중 저해상도 overview + 백버퍼 슬라이스 settle(`inkStrokeRenderer.js`), 드래그 중 선택 패널 갱신 유예.

그럼에도 불구하고 실제 복합 캔버스(리치 DOM 객체·다중 depth layer·잉크·커넥터·고해상도 디스플레이·고주사율 입력)에서 프레임 드랍과 스파이크를 유발하는 핵심 원인들이 아래 4개 영역에 남아 있습니다.

---

## 2. 병목 요약표 (우선순위 순)

| 순위 | 심각도 | 병목 항목 | 주요 발생 시나리오 | 병목 위치 | 핵심 파일 |
|---:|:---:|---|---|---|---|
| 1 | **Critical** | `representationScale = Infinity`로 리치 객체 LOD 전면 비활성화 | 리치 DOM 객체 다수 존재 시 줌아웃·패닝 | 메인 스레드 / 컴포지터 / GPU | `src/pages/CanvasPage.jsx:1478`, `src/canvas/sceneRepresentation.js:14` |
| 2 | **Critical** | `{ ...itemsRef.current }` 스프레드로 `itemSnapshot` 구조 공유 파괴 | 대규모 캔버스에서 리사이즈·회전·벤딩·속성 편집 | 메인 스레드 (O(N) / 이벤트) | `src/canvas/useCanvasObjectInteractions.js:302,324,330,350`, `src/pages/CanvasPage.jsx:794` |
| 3 | **Critical** | 모든 `ScalableObjectContent`의 `filter: drop-shadow` + 개별 `ResizeObserver` | 노트·코드·표·텍스트·링크 DOM 다수 줌/팬·마운트 | GPU 컴포지터 / 메인 레이아웃 | `src/canvas/object-shadow.css:2`, `src/canvas/ScalableObjectContent.jsx:18` |
| 4 | **Critical** | HTML·노트북 출력 라이브 `<iframe>` 상시 마운트 | HTML/노트북 객체 포함 화면 줌/팬 | 브라우저 멀티프로세스 / 컴포지터 | `src/canvas/content/HtmlObject.jsx:24`, `src/canvas/notebook/NotebookOutput.jsx:8` |
| 5 | **High** | 공유 GPU Worker 직렬화 + WebGL2 기본값 + `transferToImageBitmap` 백버퍼 교체 | 다중 depth layer, HiDPI(DPR 2~4), 빠른 패닝/축소 | GPU Worker / GPU 프로세스 | `src/canvas/wgpu/WorkerGpuRenderer.js:6,128`, `gpuRenderer.worker.js:31`, `graphicsQuality.js:5` |
| 6 | **High** | `gpuCullKey` / 드래그 시 `WgpuSceneBatcher.sync()` 전체 씬 O(N) 재빌드 | 객체 >256개 패닝·줌, 벡터 객체 드래그 | 메인 스레드 / Worker / GPU | `src/canvas/DepthVectorLayer.jsx:366,419`, `WgpuSceneBatcher.js:42`, `lib.rs:646` |
| 7 | **High** | `useCanvasCamera`의 `queueMicrotask` 다중 발화 및 동기 연쇄 렌더 | 125~1000Hz 마우스·트랙패드 휠/드래그 | 메인 스레드 | `src/canvas/useCanvasCamera.js:173`, `DepthVectorLayer.jsx:875`, `CanvasAxisTicks.jsx:210` |
| 8 | **High** | 잉크(드로잉) 메인 스레드 2D: O(K²) 라이브 드래프트·`shadowBlur`·전체 순회·`flushCanvas` | 긴 획 그리기, 수천 개 스트로크 줌/팬·정지(settle) | 메인 스레드 / GPU 2D(Skia) | `src/canvas/inkStrokeRenderer.js:230,372,516,722,774` |
| 9 | **Medium** | `1024×1024` 아틀라스 초과 `standalone` 텍스처 난립 및 `invalidate_bundles()` 전역 무효화 | DPR 2~4에서 중대형 도형/텍스트/이미지 혼재 | GPU 드로우 콜 / Worker | `src/canvas/textureAtlas.js:29,64`, `rust/agora-wgpu-renderer/src/lib.rs:543` |
| 10 | **Medium** | 정지(Settle) 직후 `drop-shadow` 2-pass 래스터화 + 일괄 `createImageBitmap` 스파이크 | 확대 후 정지 시점(160ms 후) | 메인 스레드 / GPU 업로드 | `src/canvas/rasterObjectCache.js:130`, `WorkerGpuRenderer.js:72`, `DepthVectorLayer.jsx:532` |
| 11 | **Medium** | 고배율(`coarse`) 시 4배 면적 `.canvas-grid-surface` 매 프레임 CSS 리페인트 | 확대 상태에서 패닝/줌 | 메인 스타일 / GPU 페인트 | `src/canvas/useCanvasCamera.js:66`, `src/canvas/gridProjection.js:5`, `canvas-grid.css:14` |
| 12 | **Medium** | 인터랙션 중 `CanvasWorkspace`(2,631줄) 전체 리렌더링 및 무의존성 이펙트 | 레이저·마퀴·생성박스·커넥터 부착 드래그·모니터링 | React 재조정(Reconciliation) | `useCanvasStageInteractions.js:325,379,535`, `useCanvasObjectInteractions.js:130`, `DepthVectorLayer.jsx:895` |

---

## 3. 상세 원인 분석 및 해결 방안

---

### 영역 1: DOM · CSS · 컴포지터 병목

#### 1) `representationScale = Infinity`로 인한 리치 객체 LOD(Overview Proxy) 전면 비활성화
- **위치**:
  - `src/pages/CanvasPage.jsx:1478` (`const representationScale = Infinity;`)
  - `src/canvas/sceneRepresentation.js:14-21` (`isOverviewProxy`)
  - `src/canvas/renderWindow.js:3-12`, `src/canvas/viewportPreload.js:3-5`
- **원인**:
  - 품질 단계 제거(커밋 `5657865`) 과정에서 `representationScale`이 `Infinity`로 하드코딩되면서 `isOverviewProxy(item, world, Infinity)`의 `width = item.width * world.width * Infinity`가 항상 `Infinity`가 되어 **모든 리치 객체의 프록시 전환이 완전히 꺼져 있습니다.**
  - 줌아웃(예: 10~25%) 시 화면에 수백 개의 `note`, `table`, `chart`, `image`, `pdf`, `question`, `value`, `project`, `link`, `user-group`, `math` 객체가 들어와도 전부 라이브 React/DOM 트리 + CSS 그림자 + SVG로 유지됩니다.
  - 또한 `viewportPreloadPadding`이 뷰포트 너비·높이의 50%를 상하좌우로 추가(총 4배 면적)하므로, 화면 밖 리치 DOM까지 대량 마운트된 채 `.canvas-world-layer`의 `scale()` 변환에 포함됩니다.
- **해결 방안**:
  1. `representationScale`을 `overviewScale(camera.scale)`(반옥타브 버킷) 또는 `camera.detailScale`로 복원하되, 가독성이 필요한 구간은 유지하고 **화소 크기 임계치(예: `min(w, h) < 28px` 또는 화면 내 DOM 객체 수 > 임계치)**에서 점진적으로 GPU 래스터 프록시(`overviewProxy`)로 전환합니다.
  2. DOM 객체용 렌더 윈도우와 GPU 벡터용 프리로드 윈도우를 분리합니다. GPU 벡터는 50% 프리로드 링을 유지하되, **라이브 DOM 마운트 윈도우는 더 좁은 여백(예: 10~15% 또는 128px)**으로 제한하고 카메라 고속 이동 중에는 화면 밖 DOM 마운트를 지연합니다.

---

#### 2) HTML·노트북 출력 라이브 `<iframe>` 상시 마운트
- **위치**:
  - `src/canvas/content/HtmlObject.jsx:24` (`<iframe sandbox="allow-scripts" src="/html-preview.html" />`)
  - `src/canvas/notebook/NotebookOutput.jsx:8` (`<iframe sandbox="" srcDoc={document} />`)
  - `src/canvas/sceneRepresentation.js:15` (`if (isHtmlContent(item) || hasNotebookOutputs(item)) return false;`)
- **원인**:
  - HTML 객체와 출력이 있는 노트북 셀은 `isOverviewProxy`에서도 예외 처리되어 항상 실제 `<iframe>`으로 유지됩니다.
  - `.canvas-world-layer`에 `transform: translate3d(...) scale(...)`이 매 프레임 적용될 때, 하위에 라이브 `<iframe>`이 존재하면 브라우저가 매 프레임 서브프레임의 스케일 동기화, 타일 재래스터화, (특히 `allow-scripts` HTML의 경우) 별도 렌더러/문서 수명주기 동기화를 수행해 프레임 드랍이 크게 발생합니다.
- **해결 방안**:
  1. **카메라 이동/줌 중(`camera-moving` / `camera-zooming`) 및 비선택/원거리 상태**에서는 `<iframe>`을 직접 스케일하지 않고, 최근 렌더링 결과를 **정적 스냅샷(SVG/Canvas 비트맵 또는 `StaticMarkupPreview`)**으로 표시하거나 `content-visibility: hidden` + 경량 썸네일로 치환합니다.
  2. 동시 활성 `<iframe>` 상한(LRU 풀, 예: 뷰포트 중앙/최근 상호작용 기준 최대 4~6개)을 두고, `HtmlObject`의 스크립트 애니메이션/타이머는 화면 밖이거나 줌 중일 때 `postMessage`로 일시 정지(`pause`/`resume`) 신호를 전달합니다.

---

#### 3) 모든 `ScalableObjectContent`의 `filter: drop-shadow(...)` 및 개별 `ResizeObserver`
- **위치**:
  - `src/canvas/object-shadow.css:2` (`.canvas-stage .scalable-object-content { filter: var(--object-shadow-filter) }`)
  - `src/canvas/objectContentScale.js:3` (`const SCALABLE_KINDS = new Set(['text', 'code', 'math', 'note', 'table', 'link']);`)
  - `src/vector-editor.css:34` (`.sticky-note-object`의 `clip-path: polygon(...)` + `filter: drop-shadow(...)`)
  - `src/canvas/ScalableObjectContent.jsx:14-21` (객체마다 `new ResizeObserver(measure)` + `content.offsetHeight`)
  - `src/pages/CanvasPage.jsx:1553` (`denseDom <= 24`일 때 `backdrop-filter` 최대 8개 허용)
- **원인**:
  - `object-shadow.css:2` 규칙 때문에 사각형 카드인 `code`, `table`, `link`, `math`, `text`까지도 값싼 `box-shadow` 대신 **매 프레임 GPU 오프스크린 렌더 패스 + 알파 채널 가우시안 블러**를 요구하는 `filter: drop-shadow(...)`를 기본 실행합니다.
  - 줌(scale) 도중에는 블러 반경이 화면 픽셀 단위로 변하므로 브라우저 컴포지터가 매 줌 프레임마다 해당 DOM 객체의 필터 패스를 재래스터화합니다.
  - `ScalableObjectContent.jsx:18`은 객체당 개별 `ResizeObserver` 인스턴스를 생성하고 `useLayoutEffect`에서 `content.offsetHeight`를 동기 읽기하여, 다수 DOM 객체가 동시에 진입할 때 **강제 동기 레이아웃(Forced Reflow)**을 일으킵니다.
- **해결 방안**:
  1. 비정형 마스킹(`clip-path`가 있는 `note`, 투명 배경 `text`)을 제외한 **사각형 카드(`code`, `table`, `link`, `math` 등)는 `filter: drop-shadow` 대신 외곽 래퍼의 `box-shadow`**로 전환합니다.
  2. 포스트잇(`sticky-note-object`)의 20-점 `clip-path` + `drop-shadow`는 줌/패닝 중 GPU 비용이 크므로, `box-shadow` 기반 유사 종이 그림자(또는 `::after` 의사 요소의 정적 그라데이션/SVG 테두리)로 대체하거나, `camera-zooming` 시 `will-change`와 GPU 레이어 승격 정책을 정교화합니다.
  3. `ScalableObjectContent.jsx`의 `ResizeObserver`를 `connectors/objectMetrics.js`처럼 **단일 공유 `ResizeObserver`**로 통합하고, `content.offsetHeight` 대신 `entry.borderBoxSize[0].blockSize`를 사용해 동기 레이아웃 읽기를 제거합니다.
  4. `camera-moving` / `camera-zooming` 중에는 `backdrop-filter` 패스 예산을 0 또는 1~2개로 축소(또는 반투명 단색 폴백)하는 옵션을 검토합니다.

---

#### 4) 고배율(`coarse`) 확대 시 4배 면적 `.canvas-grid-surface`의 매 프레임 CSS 리페인트
- **위치**:
  - `src/canvas/canvas-grid.css:14-17` (`width: calc(200% + 128px); height: calc(200% + 128px);`)
  - `src/canvas/gridProjection.js:5-16` (`coarse = Math.max(spacingX, spacingY) > 96`)
  - `src/canvas/useCanvasCamera.js:62-79`
- **원인**:
  - 일반 배율(`!proj.coarse`)에서는 `grid.style.transform`만 바꿔 컴포지터 스레드에서 빠르게 이동하지만, **확대하여 격자 간격이 96px를 넘으면(`coarse === true`)** `useCanvasCamera.js:66`의 빠른 분기를 타지 못하고 매 프레임 `applyGridProjection`이 실행됩니다.
  - 이때 `backgroundSize`, `backgroundPosition`과 CSS 변수 4개(`--surface-dot-x/y/radius/end`)가 매 카메라 프레임마다 변경되어 **뷰포트의 4배 이상 면적을 가진 레이어 전체의 스타일 재계산 + `radial-gradient` 풀 리페인트**가 매 프레임 발생합니다.
- **해결 방안**:
  1. `coarse` 구간에서도 `backgroundPosition`을 갱신하지 말고, **고정 타일 크기 + `transform: translate3d(x, y, 0)`**만 변경하도록 통일합니다 (예: 타일 크기가 바뀔 때만 `backgroundSize` 1회 갱신, 패닝은 항상 `translate3d` 모듈로 오프셋 이동).
  2. 더 근본적으로는 배경 격자를 **wgpu 렌더러의 배경 패스(1개의 풀스크린 삼각형 셰이더)**로 그리면, 4배 크기의 대형 CSS 컴포지터 레이어(VRAM 수십 MB)와 `radial-gradient` 리페인트를 완전히 제거할 수 있습니다.

---

### 영역 2: GPU Worker · wgpu · 아틀라스 파이프라인 병목

#### 5) 공유 GPU Worker의 단일 `OffscreenCanvas` 직렬화 + WebGL2 기본값 + `transferToImageBitmap` 교체 비용
- **위치**:
  - `src/canvas/wgpu/WorkerGpuRenderer.js:1,6,128-173` (`MARGIN=96`, `preferWebgl=true`, 단일 `GpuWorkerHost`)
  - `src/canvas/wgpu/gpuRenderer.worker.js:12,21,31` (`select_scene`, `canvas.transferToImageBitmap()`)
  - `src/canvas/graphicsQuality.js:5,23` (`maxDpr: 4`)
  - `rust/agora-wgpu-renderer/src/lib.rs:150-154`
- **원인**:
  - **다중 depth layer 직렬화**: 모든 depth layer가 1개의 Worker와 1개의 `OffscreenCanvas`를 공유하므로, depth layer가 여러 개인 캔버스에서 패닝/줌 시 한 번에 1개 레이어씩 직렬로 `select_scene -> render_frame -> transferToImageBitmap`을 처리합니다.
  - **매 프레임 백버퍼 분리/재할당**: `canvas.transferToImageBitmap()` -> `postMessage` -> `context.transferFromImageBitmap()`은 매 GPU 프레임마다 `(vw + 192) × (vh + 192) × dpr²` 크기의 풀 서페이스를 분리·전송·재할당합니다. 특히 `UNIFIED_GRAPHICS_PROFILE.maxDpr = 4`이므로 고해상도/고배율 모니터에서 프레임당 픽셀 전송량이 과도해집니다.
  - **WebGL2 백엔드 우선(`preferWebgl = true`)**: WebGPU를 지원하는 Chrome/Edge에서도 wgpu의 **WebGL2 백엔드**를 우선 선택합니다(`wgpuEngine.js:3`). wgpu의 WebGL2 백엔드는 `RenderBundle`을 GPU 네이티브로 실행하지 않고 CPU에서 GL 상태 변경 호출로 재실행하며, `OffscreenCanvas` WebGL2의 `transferToImageBitmap()`은 ANGLE 백엔드에서 암묵적 동기화/복사 비용이 큽니다.
  - **작은 마진(`MARGIN = 96`)**: `WorkerGpuRenderer.js:1`의 마진이 96px에 불과해 조금만 빠르게 패닝하거나 축소해도 `reprojectionCovers()`가 `false`가 되어 120ms 주기로 풀 서페이스 재렌더링이 반복됩니다.
- **해결 방안**:
  1. **WebGPU 우선(기능 검증 후) 또는 단일 `transferControlToOffscreen()` 직접 프레젠테이션 검토**:
     - depth layer가 1개(대부분의 캔버스는 `depth === 0` 단일 레이어)일 때는 `transferToImageBitmap` 복사 없이 메인 DOM `<canvas>`의 소유권을 `transferControlToOffscreen()`으로 Worker에 직접 넘겨 **Zero-Copy SwapChain Present**로 전환하면 `transferToImageBitmap` / `transferFromImageBitmap` 병목이 완전히 사라집니다.
     - 다중 depth layer이더라도 레이어 사이에 DOM 객체가 끼어있지 않은 연속 벡터 레이어는 단일 GPU 레이어로 병합하여 렌더 패스 수를 줄입니다.
  2. **카메라 제스처 중 동적 해상도 스케일링(Interactive DPR Cap)**: 제스처 중(`interactive === true`)에는 GPU 렌더 타깃 DPR을 최대 `1.5` 또는 `2`로 제한하고 정지 시 원복하며, 정지 시에도 `maxDpr`을 `2`(또는 `2.5`)로 합리화합니다.
  3. **`MARGIN` 확대 또는 속도 기반 비대칭 마진**: 팬 방향/속도에 따라 오버스캔 마진을 동적으로 늘리거나(예: 192~256px) 줌아웃 중에는 축소 비율을 선반영해 렌더함으로써 `reprojectionCovers()` 히트율을 높입니다.

---

#### 6) `gpuCullKey` / 드래그 프리뷰 시 `WgpuSceneBatcher.sync()` 전체 씬 O(N) 재빌드
- **위치**:
  - `src/canvas/DepthVectorLayer.jsx:366-380` (`cullChanged` -> `gpuSceneDirty = true` -> `gpuBatcher.sync(...)`)
  - `src/canvas/DepthVectorLayer.jsx:413-425` (드래그 중 매 프레임 `gpuBatcher.sync(...)`)
  - `src/canvas/wgpu/WgpuSceneBatcher.js:42-130` (`ordered` 전체 선형 순회)
  - `src/canvas/wgpu/WorkerGpuRenderer.js:34-36` (`words.slice()` 복사)
  - `rust/agora-wgpu-renderer/src/lib.rs:646-688` (`queue.write_buffer` 전체 업로드 + `cached_bundle = None`)
  - `rust/agora-wgpu-renderer/src/shader.wgsl:55-61` (이미 GPU 버텍스 셰이더에서 frustum culling 수행 중)
- **원인**:
  - **중복 CPU 컬링으로 인한 불필요한 씬 재업로드**: `shader.wgsl:55-61`이 이미 GPU 버텍스 셰이더에서 화면 밖 인스턴스를 컬링하는데도, `DepthVectorLayer.jsx:366`이 `preparation.count > 256`일 때 `gpuCullKey`가 바뀔 때마다 `gpuSceneDirty = true`를 걸어 **`ordered` 전체를 JS에서 다시 순회 -> `TypedArray` 복사(`slice()`) -> Worker 전송 -> GPU 버퍼 전체 재업로드 -> `RenderBundle` 재녹화**를 유발합니다.
  - **드래그 중 O(N) 씬 재전송**: 객체 1개만 드래그해도 `dragVectorChanged` 경로(`DepthVectorLayer.jsx:419`)가 **레이어 내 모든 객체(N개)를 매 프레임 `gpuBatcher.sync()`로 다시 패킹·복사·업로드**합니다.
- **해결 방안**:
  1. **드래그 전용 오프셋 유니폼 또는 분리된 드래그 버퍼 도입**:
     - 드래그 시작 시 정적 객체와 드래그 대상 객체를 2개의 인스턴스 버퍼(또는 드래그 전용 슬롯 범위)로 분리하고, 드래그 중에는 **`drag_offset: vec2<f32>` 유니폼 8바이트만 갱신**합니다. 이렇게 하면 수만 개 객체 위에서 도형을 드래그해도 CPU 패킹·버퍼 업로드·RenderBundle 재녹화가 **0회**가 됩니다.
  2. **중간 규모 씬(예: <= 4,096~8,192개)에서는 `gpuCullKey` 기반 CPU 재컬링 비활성화**:
     - 이미 `shader.wgsl`에서 per-instance 컬링을 수행하므로, 수천 개 수준에서는 1회 업로드한 전체 인스턴스 버퍼 + `RenderBundle`을 패닝/줌 내내 무효화 없이 그대로 재사용하는 것이 훨씬 빠릅니다.
     - 초대규모 씬(수만 개 이상)에서 CPU 컬링이 필요할 때도 `ordered` 전체 선형 스캔 대신 **`paintIndex`(RBush 공간 인덱스) 범위 쿼리**로 후보만 추출하고, 컬링 히스테리시스(패딩 확대)를 적용합니다.

---

#### 7) `1024×1024` 아틀라스 한계로 인한 `standalone` 텍스처 난립 및 `invalidate_bundles()` 전역 무효화
- **위치**:
  - `src/canvas/textureAtlas.js:29,43,64-78` (`size = 1024, maxPages = 8`)
  - `src/canvas/wgpu/WgpuSceneBatcher.js:104-119` (인접 동일 `texId`만 배칭)
  - `rust/agora-wgpu-renderer/src/lib.rs:543-549` (`create_texture_entry` -> `invalidate_bundles()`가 모든 `saved_scenes` 무효화)
- **원인**:
  - `maxRasterRatio = 4` 환경에서 화면상 260px 이상인 객체는 래스터 크기가 `1040px`를 초과해 **`1024×1024` 아틀라스 페이지에 들어가지 못하고 전부 `standalone` 개별 텍스처**로 할당됩니다.
  - z-order 순서대로 그리는 `WgpuSceneBatcher`는 `texId`가 바뀔 때마다 새 배치를 쪼개므로, `standalone` 텍스처나 여러 아틀라스 페이지가 번갈아 나오면 **드로우 콜 수와 BindGroup 전환이 객체 수에 비례해 폭증**합니다.
  - 또한 새 텍스처가 하나만 생성/삭제돼도 `lib.rs:543`의 `invalidate_bundles()`가 **모든 depth layer의 `cached_bundle`을 일괄 파기**합니다.
- **해결 방안**:
  1. 아틀라스 페이지 크기를 `2048×2048`(GPU `max_texture_dimension_2d >= 2048` 보장 시, Direct 모드에서는 메인 스레드 캔버스 복사본이 없으므로 메모리 부담이 작음)로 상향하여 대부분의 중대형 도형·텍스트·이미지가 아틀라스에 수용되도록 합니다.
  2. **Texture Array (`texture_2d_array`) 또는 멀티 바인드 슬롯(예: 셰이더당 4~8개 텍스처 슬롯)**을 도입하고 인스턴스에 `tex_layer: u32`를 추가하면, 서로 다른 아틀라스 페이지가 z-order 상 번갈아 나타나도 **단일 드로우 콜(1 Draw Call)**로 전체 레이어를 그릴 수 있습니다.
  3. `lib.rs`에서 `create_texture_entry`는 새 `tex_id`를 추가할 뿐 기존 `tex_id`의 `BindGroup`을 교체하지 않는 경우(신규 ID 생성 시)에는 기존 번들을 무효화하지 않도록 분기하고, 교체/삭제 시에도 **해당 `tex_id`를 참조하는 scene만 선택적으로 무효화**합니다.

---

#### 8) 정지(Settle) 직후 `drop-shadow` 2-pass 래스터화 + 일괄 `createImageBitmap` 스파이크
- **위치**:
  - `src/canvas/rasterObjectCache.js:130-136` (그림자용 두 번째 `<canvas>` 생성 + `shaded.filter = 'drop-shadow(...)'`)
  - `src/canvas/DepthVectorLayer.jsx:505-509, 532-555` (`qualityNeeded` 재래스터화)
  - `src/canvas/wgpu/WorkerGpuRenderer.js:72-77` (`Promise.allSettled(uploads.map(capture))`)
- **원인**:
  - 확대 후 카메라가 멈추면(`cameraActive = false`) `settledDesiredRatio`가 상승하며 다수의 객체에 `qualityNeeded = true`가 발동합니다.
  - 이때 매 객체마다:
    1. 임시 `<canvas>` 2개 생성 + 2D 컨텍스트 초기화 + **`ctx.filter = 'drop-shadow(...)'` 풀 가우시안 블러** (`rasterObjectCache.js:130-135`),
    2. `WorkerGpuRenderer.pump()`에서 대기 중인 모든 업로드 슬롯에 대해 **`createImageBitmap`을 한꺼번에 호출**하여 메인 스레드 2D 캔버스 파이프라인을 강제 플러시합니다.
  - `ScenePreparationQueue.run`은 `visited === 0`이면 예산과 무관하게 최소 1개를 반드시 실행하므로, 큰 객체 1개의 래스터화 + 섀도우 블러 + `createImageBitmap`이 합쳐져 단일 프레임이 16~40ms로 튀는 현상이 발생합니다.
- **해결 방안**:
  1. **직사각형/원형 등 단순 도형의 그림자를 GPU 셰이더(SDF 기반 soft drop-shadow)로 처리**하거나, 일반 도형도 2D `ctx.filter` 대신 다운샘플링된 블러 또는 `ctx.shadowBlur` 단일 패스로 2차 캔버스 생성을 제거합니다.
  2. `WorkerGpuRenderer.pump()`에서 1프레임당 `createImageBitmap` 업로드 캡처 개수를 제한(예: 프레임당 최대 2~4개 또는 총 픽셀 수 1M px 예산)하여, settle 시점의 텍스처 업로드가 여러 프레임에 고르게 분산되도록 합니다.
  3. 래스터화 자체를 **OffscreenCanvas 전용 Raster Worker**로 이관 가능한 유형(순수 도형, 커넥터, 스트로크, 단색/그라데이션)부터 메인 스레드에서 분리합니다.

---

### 영역 3: 잉크(드로잉) Canvas 2D 파이프라인 병목

#### 9) 메인 스레드 Canvas 2D 잉크 렌더링의 누적 비용
- **위치**:
  - `src/canvas/inkStrokeRenderer.js:148-189` (`buildStrokeGeometry`, `strokePath`)
  - `src/canvas/inkStrokeRenderer.js:223-269` (`drawStroke` 내 매 스트로크 `context.shadowBlur`)
  - `src/canvas/inkStrokeRenderer.js:372-375` (`flushCanvas`의 1x1 `drawImage` 강제 플러시)
  - `src/canvas/inkStrokeRenderer.js:511-517` (`renderDraft`에서 매 포인터 입력마다 전체 포인트 재구축·재채우기)
  - `src/canvas/inkStrokeRenderer.js:338, 396, 722, 774` (공간 인덱스 없는 `entries` 전체 선형 순회)
- **원인**:
  1. **라이브 드로잉 O(K²) 병목**: `renderDraft` (`inkStrokeRenderer.js:516`)는 `pointerrawupdate` / `pointermove`가 들어올 때마다 현재 획의 **0번부터 마지막 포인트까지 전체 배열로 `inkStrokeOutline` 재계산 -> 새 `Path2D` 생성 -> `fill('nonzero')` -> `shadowBlur`**를 반복합니다. 획이 길어질수록(수백~수천 점) 120~240Hz 스타일러스/마우스 입력에서 메인 스레드가 포화됩니다.
  2. **매 스트로크 `shadowBlur`**: `objectShadow`의 기본값이 `enabled: true` (`objectShadow.js:5`)이므로, 수천 개의 필기 획을 그릴 때 매 `drawStroke`마다 Canvas 2D `shadowBlur`가 켜져 GPU(Skia)가 획마다 별도 블러 패스를 생성합니다.
  3. **공간 인덱스 부재**: `paintOverview`, `progressiveSettle`, `damageRect` 부분 리페인트, 제스처 중 노출 영역 페인트 모두 `entries` 전체를 선형 순회하며 `quickStrokeWorldBounds`를 검사합니다.
  4. **제스처 중 동기 풀 리페인트 폴백**: `overview`가 미완성이거나 줌 배율 `k < 0.5 || k > 2` 시 `inkStrokeRenderer.js:742-780`에서 제스처 도중 메인 스레드에서 `gestureScratch` 복사 + `evenodd` 클리핑 + 노출 스트로크 전량 동기 `drawStroke`가 발생합니다.
- **해결 방안**:
  1. **스트로크의 GPU(wgpu) 파이프라인 통합(중장기 최선책)**: 완료된 스트로크의 외곽선/삼각형 메쉬(또는 타일 캐시)를 wgpu 버텍스 버퍼 또는 타일 아틀라스에 올려, 잉크 전용 2D 캔버스 4~6개(`saved`, `overview`, `drag`, `settleCanvas`, `gestureScratch`)와 `flushCanvas` 스톨을 근본적으로 제거합니다.
  2. **라이브 드래프트 증분(Incremental) 렌더링**: 확정된 꼬리 구간은 `live` 캔버스에 1회만 구워두고(baked), 매 포인터 입력에서는 **최근 N개(예: 12~16개) 포인트 + 예측 팁(tail segment)**만 재계산·클리핑 갱신하여 O(K²)를 O(1)로 낮춥니다.
  3. **잉크 레이어 전용 공간 인덱스(`RBush`/`CanvasGridIndex`) 도입**: `damageRect` 및 뷰포트 쿼리를 O(M) 전체 순회에서 O(log M + k)로 축소합니다.
  4. **스트로크 기본 그림자 최적화**: 필기 스트로크는 `shadowEnabled` 기본값을 `false`로 두거나, 그림자가 켜진 경우에도 줌아웃/저배율(`scaledBlur < 1.0`)이나 다수 스트로크 렌더링 시 섀도우 패스를 일괄/생략합니다.

---

### 영역 4: 입력 · 카메라 스케줄링 · React 상태 전파 병목

#### 10) `useCanvasCamera`의 `queueMicrotask` 다중 발화 및 동기 연쇄 렌더
- **위치**:
  - `src/canvas/useCanvasCamera.js:170-179` (`queueMicrotask(() => { ... apply(); })`)
  - `src/canvas/DepthVectorLayer.jsx:875-876` (`stage.addEventListener('agora-camera', cameraChanged)` -> 동기 `render()`)
  - `src/canvas/CanvasAxisTicks.jsx:204-218` (`agora-camera`마다 `drawFastStrip` 전체 재드로우)
  - `src/components/canvas/FloatingContextToolbar.jsx:173-181`
- **원인**:
  - `setCamera`가 VSync(`requestAnimationFrame`)가 아닌 **`queueMicrotask`**로 `apply()`를 실행합니다.
  - 고폴링 입력 장치(트랙패드, 125~1000Hz 게이밍 마우스, 터치)는 단일 디스플레이 프레임(8.3ms / 16.6ms) 동안 여러 번의 `pointermove` / `wheel` 태스크를 발생시키며, 각 태스크 끝의 microtask마다 **`apply()` -> `agora-camera` 이벤트 -> 모든 `DepthVectorLayer.render()` + `CanvasAxisTicks` X/Y 2D 캔버스 재드로우 + `FloatingContextToolbar` 좌표 계산**이 **한 프레임에 2~6회 중복 실행**됩니다.
  - 게다가 `CanvasAxisTicks.jsx:121-182`는 매 이벤트마다 X/Y 스트립 캔버스 전체를 `clearRect`하고 모든 눈금선과 스프라이트를 다시 그립니다.
- **해결 방안**:
  1. `useCanvasCamera.js`에서 `apply()` 스케줄링을 **`requestAnimationFrame`으로 VSync 1회 코얼레싱(Coalescing)**합니다 (입력 이벤트는 `current.current` ref만 갱신하고, 실제 DOM transform·grid·axis·`agora-camera` 디스패치는 프레임당 정확히 1회만 실행).
  2. `CanvasAxisTicks`의 패닝 중 이동은 매 프레임 캔버스를 `clearRect` + 재드로우하지 않고, 오버스캔(예: +256px)이 있는 스트립 캔버스를 **`translate3d`로만 이동**하다가 마진을 넘거나 줌 배율이 바뀔 때만 재드로우합니다.

---

#### 11) `{ ...itemsRef.current, [id]: next }` 스프레드로 인한 `itemSnapshot` 구조 공유 파괴 ⚠️
- **위치**:
  - `src/canvas/useCanvasObjectInteractions.js:54-60, 302, 324, 330, 350`
  - `src/pages/CanvasPage.jsx:794, 854, 880, 897, 1019, 1040, 1084, 1102, 1138, 1162, 1172`
  - `src/canvas/itemSnapshots.js:8-14, 59-68`
- **원인**:
  - `items`는 1024-버킷 구조 공유 Proxy(`itemSnapshot`)로 설계되어 `changeItems(items, { [id]: next })`를 쓰면 O(1) 복사 + `changedItemIds()` O(1) 증분 diff가 가능합니다.
  - 그러나 `useCanvasObjectInteractions.js`의 **리사이즈(`resize`), 회전(`rotate`), 그룹 회전(`multi-rotate`), 화살표 벤딩(`bend`)**은 모두 `{ ...itemsRef.current, [id]: next }` 객체 스프레드를 사용하며 rAF 스로틀링도 없습니다!
  - Proxy 객체에 `{ ... }` 스프레드를 수행하면:
    1. `ownKeys()` 트랩이 전체 청크를 평탄화·정렬하고, **모든 N개 키에 대해 `getOwnPropertyDescriptor` + `get` 트랩이 실행되어 N개 키를 가진 일반 객체가 매 `pointermove`마다 새로 할당**됩니다 (10만 객체 시 수십~수백 ms 스톨).
    2. `commitGeometry`가 `setItems(next)`에 `ids`(`knownIds`)를 전달하지 않아 `changedItemIds(previous, next)`가 `null`을 반환하고, `itemOperations()`가 전체 N개 객체를 다시 비교합니다.
    3. `CanvasPage.jsx`의 다수 편집 핸들러(`setItems(current => ({ ...current, [key]: nextItem }))`)도 동일한 O(N) 스프레드 패턴을 사용하고 있습니다.
- **해결 방안**:
  1. `useCanvasObjectInteractions.js`와 `CanvasPage.jsx`의 모든 `{ ...itemsRef.current, [id]: next }` / `{ ...current, [key]: nextItem }` 패턴을 **`changeItems(previous, changes)` + `patchItems(changes)`**(또는 `setItems(next, ids)`)로 일괄 교체합니다.
  2. `resize`, `rotate`, `multi-rotate`, `bend`도 `move`/`multi-move`와 동일하게 **`requestAnimationFrame` 기반 배칭 + CSS `transform`/오버레이 고속 프리뷰**로 전환하고, `pointerup` 시점에만 최종 모델을 커밋합니다.

---

#### 12) 인터랙션 중 `CanvasWorkspace`(2,631줄) 전체 리렌더링 및 부수 오버헤드
- **위치**:
  - `src/canvas/useCanvasStageInteractions.js:85-93` (`updateEraserCursor`: 매 `pointermove` `getBoundingClientRect()` + `style.left/top`)
  - `src/canvas/useCanvasStageInteractions.js:325-327` (`recordLaserPoint`: 매 `pointermove` `setLaserStrokes` React state 갱신)
  - `src/canvas/useCanvasStageInteractions.js:372-385, 522-543` (`moveMarqueeSelection`, `creationDragRef`: 매 `pointermove` `getBoundingClientRect()` + `setSelectionBox`/`setCreationBox` React state 갱신)
  - `src/canvas/useCanvasObjectInteractions.js:126-130, 250` (커넥터 부착 객체 드래그 시 `fastPreview = false` -> 매 프레임 전체 React/공간인덱스/A* 라우팅/래스터화 파이프라인 실행)
  - `src/canvas/DepthVectorLayer.jsx:895` (`useLayoutEffect(() => { renderer.current?.(); });` — 의존성 배열 없음)
  - `src/canvas/CanvasLayerObjects.jsx:24-26` (비노트북 객체에도 매 렌더 새 `[]` 배열 생성 -> `canvasObjectPropsEqual`의 재귀 비교 유발)
  - `src/components/canvas/FloatingContextToolbar.jsx:92` (`React.memo` 미적용 + 인라인 콜백 props)
  - `src/canvas/diagnostics/PerformanceMonitorSection.jsx:118` (`Object.keys(items).length` 매 렌더 O(N) 키 배열 생성)
- **원인**:
  - 레이저 포인터, 마퀴 선택 박스, 드래그 생성 박스가 모두 최상위 `CanvasWorkspace`의 React `useState`에 묶여 있어, 드래그 중 **매 포인터 이벤트마다 2,631줄짜리 컴포넌트 전체가 리렌더링**됩니다.
  - `CanvasWorkspace`가 리렌더링될 때마다 `DepthVectorLayer.jsx:895`의 의존성 없는 `useLayoutEffect`가 모든 depth layer의 `schedule()`을 트리거합니다.
  - 커넥터가 1개라도 붙은 객체를 드래그하면 `fastPreview`가 꺼지면서, 매 rAF마다 `ServerCanvasSession.publish -> HostCanvasView.rebase -> React setItems -> CanvasSpatialBTree.update -> connectorGeometry(A*) -> SceneViewModel.update -> DepthVectorLayer` 전체가 동기 실행됩니다.
  - `updateEraserCursor`, `moveMarqueeSelection`, `creationDragRef`는 이미 캐시된 `getStageBounds()`가 있음에도 매 `pointermove`마다 `getBoundingClientRect()`를 다시 호출합니다.
- **해결 방안**:
  1. **임시 인터랙션 오버레이의 React State 탈피(Ref + 직접 DOM/Canvas 갱신)**:
     - 마퀴 선택 박스(`.canvas-selection-marquee`), 드래그 생성 박스(`.canvas-creation-preview`), 지우개 커서(`.eraser-cursor`)는 `transform: translate3d(...) scale(...)`로 직접 DOM을 갱신하고 `getStageBounds()` 캐시를 재사용합니다.
     - 레이저 포인터(`LaserLayer`)는 `RemoteCursorLayer`처럼 독립 컴포넌트 내부 ref/2D Canvas(또는 imperatively updated SVG path)로 분리하여 `CanvasWorkspace` 리렌더링을 0회로 만듭니다.
  2. **커넥터 부착 객체 드래그 고속화**:
     - 드래그 중에는 `fastPreview = true`를 유지하여 객체 자체는 CSS `translate` / GPU 드래그 오프셋으로 120 FPS 이동시키고, 연결된 커넥터만 **임시 직선/경량 베지어 오버레이 레이어**로 그린 뒤 `pointerup` 시점에 정밀 A* 라우팅을 1회 실행합니다.
  3. **React 재조정 및 이펙트 정리**:
     - `DepthVectorLayer.jsx:895`의 `useLayoutEffect`에 실제 렌더에 영향을 주는 props 의존성 배열을 명시합니다.
     - `CanvasLayerObjects.jsx`의 `EMPTY_CELLS = []` 상수를 재사용하고 `FloatingContextToolbar`에 `React.memo` + 안정 콜백을 적용합니다.
     - `PerformanceMonitorSection.jsx:118`의 `Object.keys(items).length`를 `itemCount(items)`(O(1))로 교체합니다.

---

## 4. 권장 적용 로드맵 (투자 대비 효과 순)

### Phase 1 — 즉각적 체감 효과 (낮은 구현 난이도, 큰 프레임 회복)
1. **`{ ...itemsRef.current }` -> `changeItems` / `patchItems` 일괄 전환** (`useCanvasObjectInteractions.js`, `CanvasPage.jsx`) + `resize`/`rotate`/`bend` rAF 배칭
2. **`useCanvasCamera`의 `queueMicrotask` -> `requestAnimationFrame` VSync 코얼레싱** + `DepthVectorLayer.jsx:895` 의존성 명시
3. **`ScalableObjectContent`의 `filter: drop-shadow` -> 사각형 카드 `box-shadow` 전환** + `ResizeObserver` 단일 공유화
4. **마퀴·생성박스·레이저·지우개 커서 React State 분리** + `getStageBounds()` 재사용 + `PerformanceMonitorSection` `itemCount(items)` 교체
5. **고배율 `coarse` 격자(`gridProjection.js`)의 매 프레임 `backgroundPosition` 리페인트 제거**

### Phase 2 — 복합·대규모 캔버스 60~120 FPS 안정화 (중간 난이도)
6. **리치 객체 LOD(`representationScale`) 합리적 복원** + DOM 마운트 윈도우 축소
7. **HTML·노트북 `<iframe>` 제스처 중 정적 스냅샷/LRU 활성 풀 제한**
8. **커넥터 부착 객체 드래그 시 `fastPreview` + 경량 임시 와이어 오버레이**
9. **GPU 드래그 오프셋 유니폼 분리 & 불필요한 `gpuCullKey` 씬 재업로드 제거**
10. **아틀라스 `2048×2048` 상향 + 선택적 `cached_bundle` 무효화 + Settle 시 `createImageBitmap` 프레임 분산**

### Phase 3 — 아키텍처 레벨 근본 최적화 (높은 난이도)
11. **단일 레이어 Zero-Copy `transferControlToOffscreen()` + WebGPU 우선 경로** 및 제스처 중 동적 DPR 캡
12. **잉크(Stroke) 라이브 드래프트 증분 렌더링 + 공간 인덱스 도입 + 완료 스트로크의 wgpu 통합**
13. **Texture Array / 멀티 텍스처 바인딩으로 아틀라스 페이지 간 단일 드로우 콜 달성**

---

## 5. 검증 권장 지표

각 Phase 적용 전후로 아래 시나리오에서 Chrome DevTools Performance Trace 및 기존 벤치마크(`tests/performance/`, `tests/integration/camera-motion-performance.mjs`)를 비교 측정하는 것을 권장합니다.

| 시나리오 | 핵심 측정 지표 |
|---|---|
| 리치 DOM 객체 200+개 + HTML/노트북 포함 줌아웃·패닝 | 화면 rAF FPS, p95/p99 프레임 간격(ms), Composite/Paint 레이어 시간 |
| 10만 객체 캔버스에서 단일 객체 리사이즈·회전·드래그(커넥터 포함) | 이벤트 핸들러(PointerMove) 실행 시간, GC 할당량(MB/s) |
| 125~240Hz 입력으로 긴 브러시 획 드로잉 & 1,000+ 스트로크 줌/정지 | 입력→표시 지연(ms), Settle 후 500ms 내 최대 프레임 스파이크(Long Task ms) |
| 다중 depth layer(4+개) + HiDPI(DPR 2) 고속 패닝/축소 | GPU Worker `workerMs`/`exportMs`, 메인 `captureMs`, VRAM 사용량 |
