# 캔버스 iframe 생성 제거와 합성 비용 조사

## 범위와 측정 조건

비활성 HTML·YouTube·노트북 HTML/SVG 출력의 iframe 생성을 제거했다. 기존 객체 저장 포맷, API, 공동 편집 프로토콜, 깊이, Rust/wgpu 및 GPU 슬롯 제한은 유지했다. 사용자 원본 트레이스의 80.62ms Main Task와 50.06ms Layout은 제공된 관측값이며, 아래 재현 측정과 혼합하지 않는다. 원본 캔버스/트레이스 파일 자체가 제공되지 않아 동일한 통제 픽스처로 수정 전후를 비교했다.

- 수정 전: Git `1de2669`의 분리 worktree. 수정 후: 이번 변경 코드.
- 동일한 72개 객체, 1280×900, Chrome 157.0.8103.78, 하드웨어 GPU. 동일 Vite 개발/React Profiler 빌드와 CDP trace 설정.
- HTML/YouTube/노트북을 각각 측정. 실행당 4.8초 이동·빠른 확대/축소, 전후 교대로 각 3회.
- YouTube 페이지/썸네일은 동일한 결정적 로컬 응답으로 대체했다. 실제 YouTube 서비스의 네트워크·광고·디코더 성능 측정이 아니다.
- FPS는 3회 평균, p95는 각 회차 p95의 중앙값, 최대 간격은 3회 전체 최댓값이다. 초과 프레임 수는 3회 합계다. 앱에 FPS 상한을 추가하지 않았다.

## 이동·확대/축소 결과

|객체|평균 FPS 전→후|프레임 p95 ms 전→후|전체 최대 간격 ms 전→후|25ms 초과 전→후|33.3ms 초과 전→후|
|---|---:|---:|---:|---:|---:|
|html|42.20 → 59.16|66.70 → 16.80|66.80 → 33.40|116 → 17|105 → 16|
|youtube|52.70 → 59.73|33.40 → 16.80|66.70 → 83.30|72 → 6|65 → 3|
|notebook|43.98 → 60.06|66.70 → 16.80|66.80 → 33.40|102 → 3|96 → 3|

|객체|iframe 생성 전→후¹|이동 중 생성 전→후¹|동시 최대 iframe 전→후¹|종료 시 iframe 전→후¹|최대 합성 레이어 전→후¹|
|---|---:|---:|---:|---:|---:|
|html|166 → 0|130 → 0|48 → 0|42 → 0|60 → 12|
|youtube|171 → 0|135 → 0|48 → 0|42 → 0|54 → 53|
|notebook|166 → 0|130 → 0|48 → 0|42 → 0|54 → 12|

¹ 각 회차 값의 중앙값. iframe 생성은 MutationObserver, 합성 레이어는 CDP LayerTree로 측정한다. 합성 레이어 수는 DOM 객체 수나 GPU 슬롯 수와 다르다.

## 메인 문서의 Layout·Paint·Layerize

각 회차 누적 시간 및 p95의 중앙값이다. 아래 최대값은 3회 전체 최댓값이다. iframe 자식 문서의 다른 renderer thread는 이 표에 포함하지 않는다. 따라서 iframe의 작업이 사라져도 루트 문서에 추가된 정적 DOM 때문에 루트 Layout/React render 수치는 증가할 수 있다.

|객체/단계|누적 ms 전→후|p95 ms 전→후|최대 ms 전→후|
|---|---:|---:|---:|
|html / Layout|19.06 → 81.78|0.81 → 2.91|3.27 → 6.27|
|html / UpdateLayoutTree|30.75 → 56.76|0.21 → 0.85|1.34 → 2.01|
|html / Paint|1179.24 → 846.51|5.96 → 8.49|8.01 → 13.84|
|html / Layerize|166.54 → 555.90|1.59 → 2.82|2.30 → 5.24|
|youtube / Layout|12.89 → 15.30|0.26 → 1.30|0.82 → 1.76|
|youtube / UpdateLayoutTree|39.29 → 33.57|0.20 → 0.39|0.97 → 1.15|
|youtube / Paint|814.56 → 244.22|3.28 → 6.31|4.27 → 8.49|
|youtube / Layerize|220.59 → 753.03|1.59 → 4.19|2.40 → 8.81|
|notebook / Layout|11.86 → 57.48|0.22 → 2.31|0.65 → 7.23|
|notebook / UpdateLayoutTree|27.95 → 54.51|0.18 → 0.75|0.54 → 2.51|
|notebook / Paint|509.77 → 428.43|2.97 → 5.02|3.90 → 16.25|
|notebook / Layerize|163.57 → 662.51|1.71 → 3.23|2.22 → 5.59|

## React 비용

|객체|render actualDuration p95 ms 전→후|commitTime→Profiler 콜백 p95 ms 전→후|
|---|---:|---:|
|html|18.60 → 30.50|27.50 → 1.40|
|youtube|16.50 → 14.40|29.00 → 1.80|
|notebook|6.90 → 27.80|22.00 → 1.20|

React 개발 Profiler의 실제 render duration이다. 동시 렌더링의 여러 작업 조각을 포함할 수 있어 한 프레임의 blocking 시간으로 해석하면 안 된다. `commitTime→Profiler 콜백`은 DOM commit 경과 시간의 관측값이며 React의 모든 passive effect까지 포함한 전체 commit duration은 아니다. 정적 콘텐츠의 render 자체가 모든 종류에서 빨라졌다고 주장하지 않는다. iframe DOM 삽입·문서 로딩을 없애 commit 구간과 전체 탐색 프레임이 개선됐다.

## 변경 파일과 주요 함수

|파일|주요 함수/변경|
|---|---|
|`src/canvas/content/HtmlObject.jsx`|`HtmlObject`: 실제 문서 생성/iframe 마운트 조건, 값 브리지 유지|
|`src/components/SharedMediaContent.jsx`|`YoutubeObject`: 명시적 재생과 안정적인 iframe identity|
|`src/canvas/notebook/NotebookOutput.jsx`|`NotebookOutput`, `RichOutput`: HTML/SVG 정적 출력 및 실제 보기|
|`src/canvas/notebook/NotebookObject.jsx`, `NotebookCellObject.jsx`|공통 출력 컴포넌트 재사용, 소유 객체 ID 전달|
|`src/canvas/content/staticPreviewQueue.js`|`StaticPreviewQueue.request/start`, `staticMarkupPreview`: 취소/예산/캐시|
|`src/canvas/content/StaticMarkupPreview.jsx`|안전한 텍스트·표 요약과 캐시 무효화|
|`src/canvas/content/LiveContentContext.js`|`createLiveContentRegistry`, `useLiveContent`: 객체별 활성화 및 세대/타입 식별|
|`src/pages/CanvasPage.jsx`|활성 객체를 공간 쿼리와 DOM 유지 집합에 포함|
|`src/canvas/inkStrokeRenderer.js`|`createInkStrokeRenderer/render/renderDraft`: 빈 잉크 표면 제외|
|`src/canvas/DepthVectorLayer.jsx`|`presentGpu`: 내용이 없는 GPU 표시 표면 제외|

## 구현과 유지 정책

- `HtmlObject`: 기본은 `StaticMarkupPreview`. 명시적인 미리보기 또는 코드 편집 때만 iframe을 마운트한다. HTML/CSS/JS/값 데이터가 바뀌면 요약 캐시 키가 달라진다. 값 갱신은 `postMessage`로 전달하며 HTML 실행 환경을 다시 로드하지 않는다. HTML/CSS/JS 코드가 바뀌면 실제 문서를 갱신한다. `sandbox="allow-scripts"`, CSP, `canvasValues` 브리지는 유지했다.
- 정적 HTML은 제한된 텍스트/제목/표 요약이며 실제 브라우저 스크린샷이 아니다. React 텍스트 노드만 사용하고 코드를 실행하지 않는다.
- `SharedMediaContent / YoutubeObject`: 썸네일·제목·재생 버튼을 기본 표시한다. 재생 버튼에서만 iframe을 생성하고 autoplay를 요청한다. 선택 해제/일반 React 갱신은 iframe을 교체하지 않는다. URL 변경 시 새 URL은 다시 명시적으로 활성화해야 한다. 기존 YouTube 개인 재생 정책 및 동영상 공유 재생 로직은 변경하지 않았다.
- `NotebookOutput`: 중복 출력 구현을 통합했다. HTML은 정적 요약, SVG는 스크립트가 실행되지 않는 이미지 문맥으로 표시한다. 실제 출력 버튼에서만 기존 `sandbox=""` iframe을 연다. PNG/JPEG, 스트림, 오류, 셀 상태와 저장 결과는 그대로 유지한다.
- `StaticPreviewQueue`: iframe을 전혀 만들지 않는다. idle 작업당 최대 2개/약 2ms의 준비 예산으로 점진 처리한다. 하나의 요약 파싱은 원자적이며 최대 64KiB만 읽는다. 동일 입력은 공유하고, 사라진 객체의 대기 작업은 취소한다. 캐시는 최대 64개/약 8MiB로 제한한다.
- `LiveContentContext`: 사용자 명시 활성화는 idle 큐를 거치지 않는다. 캔버스별 최대 6개 객체를 유지한다. 7번째 객체를 열면 가장 먼저 연 객체를 해제한다. 화면 밖에서도 활성 객체는 장면에 고정하여 재생/문서 상태를 보존한다. 명시적 닫기·예산 초과·객체 삭제·캔버스 이탈 시 해제한다. 단순 선택 해제는 해제 사유가 아니다. 이 상태는 서버 저장 데이터에 추가하지 않는다.
- `CanvasPage`: 활성 객체만 공간 쿼리와 DOM 강제 유지 집합에 추가한다. 전체 객체를 추가 순회하지 않는다. 깊이 및 겹침 순서는 기존 장면 모델을 사용한다.

## 합성·GPU 혼합 경로 조사

13개 깊이 레이어 × 12개 도형으로 별도 측정했다. GPU 슬롯은 기존 4개이며 실제 4개 Rust/wgpu Worker + 9개 Canvas 2D였다. GPU 사용 불가 조건에서는 13개 모두 Canvas 2D로 동작했다.

- 화면 공유나 장면 모델을 재작성하지 않았다. `WorkerGpuRenderer`도 변경하지 않았다.
- `transferFromImageBitmap()` p95 약 0.1ms, Worker frame 수신 처리 p95 약 0.1ms였다. 이 픽스처에서는 주요 병목으로 입증되지 않았다.
- 드로잉 내용이 없어도 saved/live 캔버스 26개가 표시되고 있었다. `inkStrokeRenderer`에서 내용이 있는 표면만 표시하도록 했다. GPU에 그릴 항목이 없는 경우에도 `DepthVectorLayer`가 GPU 표면을 숨긴다. 객체가 돌아오면 다시 표시하며 GPU 컨텍스트는 유지한다.
- 도형이 있는 상태에서 표시 표면 39→13개, 모두 비운 뒤 표시 표면은 GPU/Canvas 2D 모두 0개였다. 실제 `Canvas` 합성 원인 레이어 수는 활성 도형이 있는 상태에서 13개로 동일했다. 따라서 DOM상 빈 표면을 줄인 수치를 GPU 합성 레이어 26개 감소로 표현하지 않는다.
- 해당 보조 픽스처는 전후 모두 약 60 FPS였다. 빈 표면 수정만으로 유의미한 FPS 추가 향상이 있었다고 주장하지 않는다. 깊이 순서는 GPU 및 Canvas 2D의 픽셀 `[44,168,168,255]`로 검증했다.

## 남은 병목과 다음 우선순위

YouTube 정적 미리보기의 1차 회차에서 최대 83.3ms 간격이 남았다. 해당 trace의 `tick` 함수 사이 83.063ms 구간에는 약 75.69ms의 `GPUTask`가 있었다. 같은 구간의 주요 메인 작업은 약 14.15ms였으며 iframe 생성은 0회였다. 이 한 건을 iframe/Layout 재발로 분류하지 않는다. GPU 작업의 세부 원인은 아직 확정하지 않았다.

1. 썸네일·브라우저 합성 경로의 GPU task/텍스처 업로드·래스터 비용을 별도 GPU trace로 분해한다. YouTube의 Layerize p95와 합성 레이어 수는 여전히 높다.
2. 실제 문제 캔버스와 원본 trace에서 같은 이동 경로로 다시 검증한다. 실제 YouTube 서버·영상·다른 탭의 GPU 부하는 이번 결정적 fixture에 포함하지 않았다.
3. 활성 HTML의 임의 JavaScript, 노트북의 무거운 실제 HTML을 동시에 실행하면 긴 작업이 생길 수 있다. 실행 기능을 보존한 상태에서 무조건 무지연을 보장하지 않는다.
4. SceneViewModel은 이번 관측에서 최장 지연의 원인으로 입증되지 않아 변경하지 않았다. GPU 슬롯을 늘리지 않았다.

## 재현·검증

```bash
AGORA_E2E_ORIGIN=https://127.0.0.1:5191 \
AGORA_E2E_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
BENCH_OUTPUT=/tmp/agora-iframe-after.json \
node tests/performance/iframe-navigation.mjs

node --test tests/*.test.js
```

- 원시 수치: `before-{1,2,3}.json`, `after-{1,2,3}.json`, `summary.json`.
- 합성 조사: `compositor-before.json`, `compositor-after.json`, `tests/performance/compositor-layers.mjs`.
- 로컬 전체 trace: `~/.local/share/project-agora/performance/iframe-navigation-2026-11-18/*.trace.json.gz` (Git 제외). 브라우저 Performance에서 압축 해제한 JSON을 열 수 있다.
- 회귀 테스트: `iframe-lifecycle`, `html-object`, `web-objects`, `personal-youtube`, `tablet-html-pan`, `notebook-grid`, `gpu-worker-rendering`. HTML 실행/편집/CSS/JS 연결, 값 전달, 실제 카메라 이동 중 iframe identity, 노트북 공유 편집/실행/저장·새로고침, 태블릿 조작, GPU/CPU 픽셀 정합성을 확인한다.
- 기존 노트북 테스트는 textarea focus 뒤 Monaco로 전환되는 현재 UI, WebSocket 실행 및 셀 변경분 전송을 모의하도록 갱신했다. 운영 API/포맷을 테스트에 맞춰 변경하지 않았다.

검증 결과: 전체 Node 단위 테스트 575개 통과. 위 회귀 테스트와 `youtube-sync-and-sound-cues`가 통과했다. GPU/CPU 합성 조사에서는 비우기→다시 표시 후에도 깊이 픽셀을 확인했다.
