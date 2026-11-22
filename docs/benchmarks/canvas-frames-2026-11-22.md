# 캔버스 프레임 측정과 지연 원인 — 2026-11-22

캔버스 편집 화면의 프레임 지연을 객체 종류와 조작 방식별로 측정했다. 이 문서는 측정 결과와 지연 원인만 기록한다. 해결 방안은 다루지 않는다.

> 완화 결과와 다시 측정한 값은 짝 문서 [canvas-frames-2026-11-22-after.md](canvas-frames-2026-11-22-after.md)에 있다.

- 원본 데이터
  - 일반 CPU: [canvas-frames-2026-11-22.json](canvas-frames-2026-11-22.json)
  - CPU 4배 감속: [canvas-frames-2026-11-22-cpu4x.json](canvas-frames-2026-11-22-cpu4x.json)
- 측정 스크립트: [scripts/benchmark-canvas-frames-browser.mjs](../../scripts/benchmark-canvas-frames-browser.mjs)

## 요약

- **정지 상태와 일반 CPU에서의 이동:** 모든 시나리오에서 지연 프레임이 0%였다.
- **지연 프레임이 남는 곳:** 확대·축소 중에는 0.7~3.5%, CPU 4배 감속에서 여러 객체를 섞은 캔버스를 이동할 때는 11~16%다.
- **원인별 영향** (큰 순서):
  1. **카메라 이동의 기본 비용.** 빈 캔버스에서도 이동 2.7초 동안 메인 스레드가 2.3초 바쁘다(CPU 4배 감속 기준). 원인은 카메라 적용, 축 눈금 그리기, 그리고 매 프레임 Chrome이 다시 하는 레이어 구성(Layerize)이다.
  2. **DOM 객체 안의 기본 `<select>`.** 이동하는 매 프레임마다 레이아웃과 다시 그리기를 일으킨다. 다른 객체와 섞이면 같은 레이어의 DOM 전체를 다시 그린다. 값 객체만 빼면 4배 감속 이동의 지연 프레임이 11.3%에서 4.2%로 줄었다.
  3. **확대·축소 중 DOM 객체의 제거·재생성.** 렌더 창을 벗어난 객체를 제거했다가 다시 만든다. `removeChild` 450~520ms, 이미지 크기 계산의 강제 레이아웃 150~190ms가 든다.
  4. **축 눈금 SVG.** 확대·축소 단계마다 텍스트 노드를 지우고 다시 만든다. 레이아웃 35~42회와 `:has()` 스타일 무효화가 생긴다.
  5. **작은 원인들.** 고급 스타일 객체(합성 레이어 증가), 흐름 연결선(정지 상태에서도 다시 그리기), 표(DOM 노드 수), 객체마다 다른 깊이(메모리 46MB 증가).

## 측정 조건

| 항목 | 값 |
| --- | --- |
| 브라우저 | Chrome 158.0.8127.36, 헤드리스(화면 없이 실행), 화면 크기 1800×1100, 한국어 |
| GPU | NVIDIA GeForce RTX 3060 Ti (ANGLE / OpenGL ES 3.2) |
| CPU | Intel Core i5-12400F, 12스레드, Linux 7.0.0-43 |
| 빌드 | 커밋 `1e75ffe` + 커밋하지 않은 변경, `vite build --sourcemap` 후 `vite preview` |
| 서버 | API와 실시간 브로커는 모의 응답으로 대체(실제 편집 화면 코드는 그대로 실행) |
| 반복 | 일반 CPU는 시나리오당 3회, CPU 4배 감속(CDP `Emulation.setCPUThrottlingRate`)은 2회. 표의 값은 중앙값 |

측정 단계는 네 가지다.

| 단계 | 조작 |
| --- | --- |
| 정지 | 3초 동안 조작 없음 |
| 이동 | 가운데 버튼으로 드래그, 150스텝, 약 2.7초 |
| 스크롤 | Ctrl 없이 휠 40회 |
| 확대·축소 | Ctrl+휠 40회(축소 10회, 확대 20회, 축소 10회) |

지표는 다음과 같다.

- **지연 프레임 %:** `requestAnimationFrame` 간격이 25ms를 넘은 프레임의 비율이다(60Hz 기준 1프레임 이상 놓친 경우).
- **p95:** 프레임 간격의 95백분위다.
- **작업 ms:** 단계 동안 메인 스레드가 일한 시간 합계다(CDP `TaskDuration`). 스크립트·스타일·레이아웃 열도 같은 방식으로 잰 값이다.
- **원인 분석:** 각 시나리오를 한 번 더 따로 실행해 Chrome 트레이스와 JS 프로파일러로 기록했다. 트레이스 오버헤드가 프레임 수치를 왜곡하지 않도록 프레임 측정과는 분리했다.
  - 렌더링 단계별 자기 시간(Layerize, Paint 등)
  - 스타일·레이아웃 무효화를 일으킨 요소
  - 소스맵으로 원본 위치를 찾은 JS 함수

시나리오 구성은 다음과 같다.

- 객체 시나리오는 종류별로 8개를 화면 가운데 4×2로 놓았고, 객체 하나는 약 300×230px이다.
- 혼합 시나리오는 9종류 × 8개를 8열로 놓아 일부가 화면 밖에 있다.
- 도형 시나리오는 도형·텍스트 240개를 캔버스 전체에 펼쳤다.
- 스크립트 첫 부분의 `SCENARIOS` 목록에 각 구성이 정의돼 있다.

## 재현 방법

```sh
npx vite build --sourcemap
npx vite preview --port 5199 --strictPort &
PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core/index.mjs \
  BENCHMARK_OUTPUT=docs/benchmarks/canvas-frames-YYYY-MM-DD.json \
  node scripts/benchmark-canvas-frames-browser.mjs
# CPU 감속: THROTTLE=4 REPEAT=2 ATTRIBUTION=0
# 일부 시나리오만: SCENARIOS=mixed-all,table-8
```

전체 실행 시간은 일반 CPU에서 약 30분, CPU 4배 감속에서 약 15분이다.

## 결과 — 일반 CPU

| 시나리오 | 정지 지연% | 이동 지연% | 스크롤 지연% | 확대·축소 지연% | 이동 작업 ms | 이동 레이아웃 ms | 확대·축소 작업 ms | DOM 객체 / 노드 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 빈 캔버스 | 0 | 0 | 0 | 0 | 641 | 1 | 386 | 0 / 10 |
| 도형·텍스트 240 | 0 | 0 | 0 | 2.8 | 721 | 1 | 554 | 0 / 11 |
| 도형·텍스트 240, 객체마다 다른 깊이 | 0 | 0 | 1.4 | 3.4 | 726 | 1 | 670 | 0 / 20 |
| 고급 스타일 24 (240 중) | 0 | 0 | 1.4 | 3.5 | 950 | 1 | 727 | 24 / 286 |
| 흐름 연결선 24 (240 중) | 0 | 0 | 0 | 2.8 | 822 | 1 | 654 | 24 / 227 |
| 이미지 8 | 0 | 0 | 0 | 0.3 | 705 | 1 | 405 | 8 / 42 |
| PDF 8 | 0 | 0 | 0 | 0.7 | 854 | 1 | 440 | 8 / 98 |
| 코드 8 | 0 | 0 | 0 | 0 | 753 | 1 | 424 | 0 / 11 |
| 드로잉 8 | 0 | 0 | 0 | 0 | 737 | 2 | 401 | 0 / 10 |
| 표 8 | 0 | 0 | 0.7 | 0.7 | 749 | 1 | 485 | 8 / 2002 |
| 노트북 8 | 0 | 0 | 0 | 0.3 | 788 | 1 | 421 | 8 / 386 |
| 유튜브 썸네일 8 | 0 | 0 | 0 | 0 | 710 | 1 | 436 | 8 / 90 |
| 유튜브 재생 (클릭 6회, 동시 재생 1개) | 0 | 0 | 0 | 0 | 880 | 1 | 477 | 8 / 87 |
| 마크다운 8 | 0 | 0 | 0 | 0 | 710 | 1 | 413 | 8 / 130 |
| 선택형 값 객체 8 (`<select>`) | 0 | 0 | 0 | 0.7 | 901 | **68** | 417 | 8 / 106 |
| 혼합 9종 × 8 | 0 | 0 | 0.7 | 2.0 | **2261** | **101** | **949** | 56 / 2795 |
| 혼합에서 값 객체만 제외 (추가 측정) | 0 | 0 | 0.4 | 0.7 | 1287 | 2 | 779 | 48 / 2699 |

- 모든 시나리오에서 이동 중 p95는 16.8ms 이하였다.
- 헤드리스 환경에서는 입력이 있을 때 `requestAnimationFrame`이 60Hz보다 자주 돌 수 있어서, fps 대신 지연 프레임 비율로 판단한다.

## 결과 — CPU 4배 감속

| 시나리오 | 정지 지연% | 이동 지연% | 스크롤 지연% | 확대·축소 지연% | 이동 작업 ms | 확대·축소 작업 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 빈 캔버스 | 0 | 0.1 | 0 | 0.8 | 2316 | 1230 |
| 도형·텍스트 240 | 0 | 0 | 0.6 | 2.0 | 2488 | 1416 |
| 객체마다 다른 깊이 | 0 | 0.3 | 1.9 | 1.9 | 2615 | 1552 |
| 고급 스타일 24 | 0 | 1.1 | 0.6 | 3.7 | 2757 | 1475 |
| 흐름 연결선 24 | 0 | 0 | 0.3 | 2.4 | 2453 | 1529 |
| 이미지 8 | 0 | 0.1 | 0.3 | 0.3 | 2423 | 1108 |
| PDF 8 | 0 | 1.1 | 0.3 | 0.8 | 2470 | 1266 |
| 코드 8 | 0 | 0.3 | 0.9 | 0.4 | 2529 | 1186 |
| 드로잉 8 | 0 | 0.1 | 0.3 | 0.9 | 2390 | 1105 |
| 표 8 | 0 | 0.1 | 1.5 | 2.7 | 2392 | 1301 |
| 노트북 8 | 0 | 0.3 | 0.9 | 0.4 | 2484 | 1077 |
| 유튜브 썸네일 8 | 0 | 0.6 | 0.3 | 0.3 | 2371 | 1122 |
| 유튜브 재생 | 0 | 0.3 | 0.1 | 0.3 | 2642 | 1223 |
| 마크다운 8 | 0 | 0.1 | 0 | 0.6 | 2299 | 1283 |
| 선택형 값 객체 8 | 0 | 0.3 | 0 | 1.3 | 2558 | 965 |
| 혼합 9종 × 8 | 0 | **16.1** | **4.2** | **4.0** | **4417** | 1627 |
| 혼합, 값 객체 제외 (추가 측정) | — | 4.2 | — | 5.7 | 3042 | — |

- 같은 세션에서 혼합 시나리오를 다시 재면 이동 지연이 11.3%였다(본 측정 16.1%).
- 확대·축소 지연 비율은 실행마다 2~3%p씩 흔들렸다. 1%p 안쪽의 차이는 의미를 두지 않는다.

## 지연 원인

각 항목은 다음 순서로 적었다.

1. 측정 근거
2. 원인이 되는 코드나 브라우저 동작
3. 확인 방법

소요 시간은 별도 표시가 없으면 원인 분석 실행(일반 CPU)에서 해당 단계 전체에 걸린 시간이다. 이동은 약 2.7초, 확대·축소는 약 1.4초 동안이다.

### 1. 카메라 이동의 기본 비용 (모든 시나리오)

빈 캔버스에서도 CPU 4배 감속 이동 2.7초 중 2.3초를 메인 스레드가 쓴다. 다른 모든 비용은 이 위에 더해진다.

| 항목 | 이동 중 비용(일반 CPU) | 위치 / 근거 |
| --- | --- | --- |
| 카메라 적용 | 65~77ms | `src/canvas/useCanvasCamera.js:30` `apply()` 콜백 |
| 축 눈금 빠른 그리기 | 22~37ms + 13~17ms | `src/canvas/CanvasAxisTicks.jsx:129` `drawFastStrip`, `src/canvas/axisTicks.js:10` `formatAxisValue` |
| GPU 워커 투영 계산 | 22~43ms | `src/canvas/wgpu/WorkerGpuRenderer.js:54` `project()` (벡터 객체가 있을 때) |
| 깊이 레이어 합성 | 8~15ms | `src/canvas/DepthVectorLayer.jsx:185`, `:896` |
| 스타일 재계산 | 80~140ms | 매 프레임 인라인 `transform`을 쓰는 요소: `canvas-world-layer`(2개), `canvas-grid-surface`, 축 눈금 캔버스 2개, `coordinate-x/y`, `coordinate-origin`, `vector-gpu-worker-surface`. 트레이스의 "Inline CSS style declaration was mutated"가 요소당 프레임마다 1회씩 기록됨 |
| 레이어 구성(Layerize) | 48ms(빈 캔버스) ~ 560ms(혼합) | 자바스크립트로 transform을 바꾸면 Chrome은 매 프레임 Layerize를 실행한다. 비용은 페이지 전체의 페인트 청크 수에 비례한다 |
| 이벤트 처리 | 130~260ms | `pointermove`와 `agora-camera` 이벤트 처리(EventDispatch 자기 시간) |

**Layerize 관련 실험** (같은 날 앞선 실험, 도형 240·기본 깊이):

- 빈 테스트 페이지에서도 JS로 transform을 바꾸면 120프레임 모두 Layerize가 돌았다. `translate3d`·`translate`·`scale` 포함 여부와 관계없었다.
- 화면 밖 UI 패널(도구·속성·채팅·퀵독)을 숨기면 Layerize가 약 330ms에서 91ms로 줄었다.
- 패널이나 보드에 `will-change: transform`을 주거나 패널 안의 `overflow` 잘림을 없애도 10% 안쪽으로만 바뀌었다.
- 합성 레이어는 42개였고, 그중 28개가 겹침(overlap) 때문에 만들어진 것이었다.

### 2. DOM 객체 안의 기본 `<select>`

- **측정 근거:**
  - 선택형 값 객체 8개를 이동하면 레이아웃이 170회(사실상 매 프레임), 다시 그리기가 344회 일어났다. 다른 객체 시나리오는 레이아웃 1회, 다시 그리기 5~13회였다.
  - 레이아웃 무효화 원인은 "Style changed · `canvas-world-layer`"로, 레이어의 transform 변경이 레이아웃까지 번진다.
  - 혼합 시나리오에서는 이동 중 다시 그리기(Paint) 자기 시간이 788ms였다. 이 다시 그리기가 같은 월드 레이어 안의 DOM 전체(표 노드 2000여 개 포함)를 대상으로 하기 때문이다.
- **확인:**
  - 혼합에서 값 객체만 빼면 이동 작업이 2261ms에서 1287ms로, 레이아웃이 101ms에서 2ms로, CPU 4배 감속 이동 지연이 11.3%에서 4.2%로 줄었다.
  - 미세 실험(Chrome 158, `will-change: transform` 레이어 안에 요소 10개를 넣고 60프레임 이동):

    | 요소 | 레이아웃 | 다시 그리기 |
    | --- | ---: | ---: |
    | 일반 `<div>`, `button`, `input`, `textarea` | 0 | 59~61 |
    | `<select>` | 60 | 120 |
    | `<select disabled>`, `multiple`, `contain: strict` 안의 `<select>` | 60 | 120 |
    | `content-visibility: hidden`을 준 `<select>` | 0 | 118 |

    `appearance: none`, `appearance: base-select`, `contain: strict`를 줘도 앱 측정값이 바뀌지 않았다.
- **같은 구조의 객체:**
  - `src/canvas/values/ValueObject.jsx:29`
  - 에이전트 노드: `src/canvas/agents/CanvasAgentNode.jsx:242`, `:279`, `:297`, `CanvasAgentInputNode.jsx:159`, `CanvasAgentOutputNode.jsx:208`, `CanvasAgentRouterNode.jsx:431`
  - `src/canvas/questions/QuestionCard.jsx`, `src/canvas/projects/ProjectObject.jsx`
  - 노트북은 같은 날 정적 대체 버튼(`src/canvas/content/CanvasSelect.jsx`)으로 바꿨고, 이번 측정에서 노트북의 기본 `<select>`는 0개였다.

### 3. 확대·축소 중 DOM 객체 제거·재생성

- **측정 근거:**
  - 확대·축소 단계의 JS 자기 시간은 혼합에서 `removeChild` 519ms, `appendChild` 115ms, React 커밋(`react-dom` `Zj`) 96ms였다. 값 객체를 뺀 혼합에서도 449 / 42 / 69ms였다.
  - 같은 단계에서 `src/canvas/CanvasImageContent.jsx:11`(`fit`)이 146~188ms를 썼다.
  - 레이아웃 1회에서 다시 계산한 객체가 최대 2272개였다.
  - 확대·축소 단계는 고급 스타일 24에서 `removeChild` 129ms, PDF 8에서 75ms, 흐름 연결선 24에서 89ms였다.
- **원인:**
  - Ctrl+휠 1단계마다 DOM 객체 수를 세면, 확대할 때 48 → 40 → 8 → 4개로 줄었다가 축소하면 다시 48개가 됐다(전체 순서는 JSON `supplementary.zoomDomObjects`).
  - 장면은 화면 범위와 상하좌우 50% 여유(`src/canvas/renderWindow.js`, `viewportPreload.js`)에 드는 객체만 DOM으로 만든다. 확대하면 범위가 좁아져 객체가 제거되고, 축소하면 다시 만들어진다.
  - 다시 만들 때마다 표 같은 큰 DOM 트리를 새로 만들고, 이미지는 `ResizeObserver`/`onLoad`에서 `clientWidth`를 읽어 강제 레이아웃이 일어난다.

### 4. 축 눈금 SVG의 확대·축소 단계별 재생성

- **측정 근거:**
  - 모든 시나리오의 확대·축소 단계에서 `src/canvas/CanvasAxisTicks.jsx:29`(`paint`)가 34~67ms, `syncStripVisibility`(`:121`)가 최대 25ms, `measureText`가 16ms, `setAttribute`가 15~31ms를 썼다.
  - 빈 캔버스에서도 확대·축소 중 레이아웃이 35회 일어났다. 무효화 원인은 "Added to layout · #text" 97회, "Removed from layout · #text" 88회, "SVG resource invalidated · text" 87회였다.
- **연쇄 효과:**
  - 같은 단계에서 "Affected by :has()" 스타일 재계산이 `canvas-workspace`에 91~218회, `canvas-stage`에 91~152회 있었다.
  - 1800px 화면에서 실제로 적용되는 `:has()` 규칙은 다음 세 개다.
    - `src/canvas/panels/tablet-layout.css:14`, `:18`: `.canvas-workspace:has(> .canvas-panel-slot-… .is-collapsed)`, `@media (min-width: 651px)` 안에 있음
    - `src/canvas/canvas-grid.css:12`: `.canvas-stage:has(> .canvas-grid-surface)`
  - 축 눈금 텍스트 노드의 추가·제거가 이 무효화를 일으키는 것으로 보이지만, 규칙별 분리 실험은 하지 않았다(**미확인**).

### 5. 고급 스타일 객체 (24개, 그림자·블러·필터)

- **측정 근거:**
  - 이동 중 Layerize가 356ms로, 같은 240개 도형만 있을 때(178ms)의 두 배였다.
  - 배경 블러 8개(블러 한도)와 CSS 필터 24개가 합성 레이어를 늘린다.
  - 확대·축소 지연은 일반 CPU 3.5%, CPU 4배 감속 3.7%로 시나리오 중 가장 높은 축이다. 확대·축소 단계에서 `removeChild` 129ms(원인 3)도 있었다.

### 6. 흐름 애니메이션 연결선 (24개)

- **측정 근거:**
  - 정지 3초 동안 "Animation · `connector-visible-stroke`" 스타일 재계산이 4344회, 다시 그리기가 2275회 기록됐다. 같은 기간 UpdateLayoutTree는 78ms, Paint는 75ms였다.
  - 아무 조작이 없어도 메인 스레드를 계속 쓴다.
- **원인:**
  - `stroke-dashoffset` 애니메이션(`src/canvas/styling/object-styling.css`의 `connectorFlowForward`)은 GPU 합성기에서 처리할 수 없어서 매 단계 메인 스레드가 다시 그린다.
  - 현재는 초당 약 30번 단계, 화면 밖 일시정지, 카메라 이동 중 일시정지가 적용된 상태다.

### 7. 표 (8개, 10행×5열)

- **측정 근거:**
  - 표 8개의 DOM 노드가 2002개로, 다른 객체의 5~20배다.
  - 이동 중 PrePaint가 55ms였다. 같은 날 앞선 실험에서는 Chrome 내부 페인트 무효화 검사가 이동 2.7초 동안 약 47,000회로, 마크다운(7,300회)이나 빈 캔버스(3,000회)보다 훨씬 많았다.
  - CPU 4배 감속에서 스크롤 지연 1.5%, 확대·축소 지연 2.7%였다.
  - 확대·축소 중 제거·재생성(원인 3)에서 다시 계산할 레이아웃 대상의 대부분이 표의 셀과 텍스트였다(혼합 확대·축소에서 "Removed from layout · P" 472회).
- **확인:** `.table-scroll-area`의 `overflow`를 없애거나, 표를 `display: block`으로 바꾸거나, 객체 루트에 `contain: paint`·`contain: strict`를 줘도 PrePaint와 무효화 횟수가 거의 변하지 않았다.

### 8. 객체마다 다른 깊이 (240개)

- **측정 근거:**
  - 가비지 컬렉션 후 JS 힙이 60MB로, 같은 구성을 기본 깊이로 뒀을 때(14MB)보다 46MB 많았다(JSON `supplementary.heapAfterGcMB`).
  - 확대·축소 단계에서 `src/canvas/itemSnapshots.js:16` `itemSnapshot`이 78ms, 가비지 컬렉션이 50ms였다.
- **원인 (추정):**
  - `itemSnapshot`은 해시 버킷 1024개를 미리 만든다.
  - `src/canvas/SceneViewModel.js:50`, `:77`은 깊이마다 `vectors`·`inkItems` 스냅샷을 하나씩 만든다.
  - 240개 깊이면 480개 × 1024 = 약 49만 개의 빈 객체가 생기는데, 이 계산이 늘어난 메모리 규모와 맞는다.
  - 확대·축소 중 표현이 바뀌면 깊이 렌더 그룹(`src/canvas/depthRenderGroups.js`)의 병합 스냅샷을 다시 만드는 경로가 실행된다.

### 9. 기타 관찰 (원인 분석 미완료)

- 혼합 시나리오 이동 중 `src/canvas/inkStrokeRenderer.js:484`(캔버스 스타일 설정 함수)가 64ms를 썼다. 드로잉만 있는 시나리오에서는 상위에 나타나지 않았다. DOM 객체와 함께 있을 때 잉크 캔버스 스타일이 매 프레임 바뀌는지는 확인하지 않았다.

## 영향이 작거나 없는 객체

- 이미지, 코드, 드로잉, 마크다운, 유튜브 썸네일은 이동 작업이 빈 캔버스보다 60~110ms 많은 수준이고, 지연 프레임은 노이즈 범위였다.
- 코드와 드로잉은 GPU/캔버스 미리보기로 그려져 DOM 객체가 0개다.
- 유튜브 재생은 이 빌드에서 동시 재생이 1개로 제한돼 있다. 정지 상태 메인 스레드 작업이 다른 시나리오와 같았다.
- PDF와 노트북은 같은 날 수정 이후의 값이다(아래 참고).

## 같은 날 먼저 찾아 수정한 원인 (참고)

이번 측정 전에 발견해 이미 코드에 반영한 원인이다. 위 결과는 모두 수정 후의 값이다.

| 원인 | 수정 전 측정 | 반영 위치 |
| --- | --- | --- |
| 도형의 바깥 컨테이너가 배경 블러 한도를 우회 | 블러 24개 켜짐(한도 8), 삼각형에 사각형 블러 | `objectStyleModel.js` |
| 깊이마다 벡터 렌더러 생성(GPU 8개, 나머지 Canvas2D) | 깊이 240개 이동 7.3초 작업, 지연 13% | `depthRenderGroups.js`, `CanvasPage.jsx` |
| 흐름 연결선이 60Hz로 다시 그리기 | 정지 3초에 약 620ms | `object-styling.css`, `flowVisibility.js` |
| 유튜브 2개 이상 재생 시 캔버스 전체가 초당 30프레임으로 고정 | 정지 상태 지연 100% | `LiveContentContext.js` |
| 노트북 `<select>`가 매 프레임 레이아웃을 일으킴 | 이동 레이아웃 90ms | `CanvasSelect.jsx` |
| PDF가 다시 마운트될 때마다 다운로드·파싱·렌더 | 스크롤 585ms, 지연 1% | `pdfRuntime.js`, `PdfDocumentContent.jsx` |
| 격자 레이어 스타일이 로드되지 않아 격자가 고정 | — | `useCanvasCamera.js`, `vector-editor.css` |

이전 보고에서 "확대·축소"로 적은 수치는 Ctrl 없이 휠을 굴린 것으로, 실제로는 스크롤이었다. 이 문서부터 둘을 나눠 측정한다.

## 측정 한계

- **헤드리스 실행:** 실제 디스플레이의 vsync·합성 경로와 다르다. 유튜브 동시 재생 시 30프레임 현상은 헤드리스에서 확인한 것이다.
- **노이즈:** 같은 시나리오도 실행마다 지연 비율이 2~3%p씩 흔들린다(혼합 이동 16.1% vs 11.3%).
- **트레이스 오버헤드:** 원인 분석 실행의 소요 시간에는 트레이스 오버헤드가 들어 있어 프레임 측정값과 직접 더하거나 비교하면 안 된다. 원인 간 상대 크기와 횟수를 보는 용도다.
- **모의 서버:** 실시간 동기화 부하, 다른 참여자 커서, 음성 통화는 포함하지 않았다.
- **작업 트리:** 측정 시점에 다른 작업(에이전트 노드 등)의 커밋하지 않은 변경이 함께 빌드됐다.

## 원본 JSON 구조

| 위치 | 내용 |
| --- | --- |
| `environment` | 브라우저·GPU·CPU·커밋·CPU 감속 배율 |
| `scenarios.<이름>.median.<단계>` | 반복 측정의 중앙값 |
| `scenarios.<이름>.runs` | 반복별 원본 값 |
| `scenarios.<이름>.dom` | DOM 객체·노드·iframe·canvas·`<select>`·배경 블러 수 |
| `scenarios.<이름>.attribution.<idle\|pan\|zoom>` | 원인 분석 결과 |
| `supplementary` | 가비지 컬렉션 후 힙, 확대·축소 단계별 DOM 객체 수, `<select>` 미세 실험(일반 CPU 파일에만 있음) |

`attribution` 항목의 필드는 다음과 같다.

- `stages`: 렌더링 단계별 메인 스레드 자기 시간(ms)
- `style`: 스타일 무효화 원인·요소와 횟수
- `layout`: 레이아웃 무효화 원인·요소와 횟수
- `layoutRuns`, `paintRuns`: 레이아웃·다시 그리기 실행 횟수
- `layoutDirtyObjectsMax`: 레이아웃 1회에서 다시 계산한 객체 수의 최댓값
- `functions`: 상위 JS 함수(소스맵으로 찾은 원본 위치)와 샘플 시간(ms)
