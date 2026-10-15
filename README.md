# Agora Frontend

Project Agora 프런트엔드는 React 18과 Vite 6 기반의 SPA입니다. 홈, 문서, 튜토리얼, 사용자 프로필, 캔버스 검색과 실시간 협업 캔버스를 제공합니다.

## 시작하기

처음 clone한 뒤 전체 앱을 실행하는 절차는 [TLS 초기 설정 안내](docs/TLS_SETUP.md)를 따르세요. 인증서·개인 키·공개 CA는 직접 준비하고, 아래 명령으로 세 프로젝트의 나머지 설정을 준비합니다.

```bash
python3 scripts/setup-projects.py --tls-dir /path/to/certificates
```

이 명령은 `.env` 생성, 비밀번호·토큰 준비, DB 연결 동기화와 인증서 검증을 처리합니다. 인증서를 생성하지 않습니다. 전체 Docker 앱은 **https://localhost:8443**에서 접속합니다.

호스트에서 Vite만 실행하려면 위 설정 이후 `npm ci`, `npm run dev`를 실행합니다. Vite는 `https://localhost:5173`으로만 실행하며 API는 HTTPS, 캔버스·RTC 신호는 HTTPS 게이트웨이를 통한 WSS를 사용합니다.

## 환경 변수

| 변수 | 기본값 | 용도 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 빈 값 | REST API origin. 빈 값이면 현재 origin의 `/api`를 사용합니다. |
| `VITE_API_PROXY_TARGET` | `https://localhost:8443` | Vite 개발 서버가 `/api` 요청을 전달할 주소입니다. |
| `VITE_WS_BASE_URL` | 빈 값 | WebSocket origin을 명시적으로 지정합니다. 지정하면 `/wss/port/{wsPort}/canvas/{canvasId}` 및 `/wss/port/{wsPort}/rtc/canvas/{canvasId}` 경로를 사용합니다. |

`VITE_*` 값은 빌드된 브라우저 코드에서 확인할 수 있습니다. TURN 사용자명·비밀번호 같은 장기 비밀값을 넣지 말고, 필요한 경우 만료 시간이 짧은 자격 증명을 사용하세요. 예시와 개발 설정은 [.env.example](.env.example)을 참고하세요.

## 페이지

| 경로 | 접근 | 기능 |
| --- | --- | --- |
| `/` | 공개 | 프로젝트 소개 |
| `/docs` | 공개 | 기능 및 사용 문서 |
| `/tutorial` | 공개 | 브라우저 안에서 동작하는 캔버스 체험 |
| `/login` | 공개 | 로그인 및 회원가입 |
| `/profile` | 로그인 필요 | 프로필 및 비밀번호 관리 |
| `/search` | 로그인 필요 | 캔버스 검색·생성·진입 |
| `/canvases/:canvasId` | 로그인 필요 | 실시간 협업 캔버스 |

세부 디렉터리 구조, API/WebSocket 연결 흐름, MathJax와 배포 파일 동작은 [프런트엔드 구조 문서](docs/FRONTEND_ARCHITECTURE.md)에 정리되어 있습니다.

## 캔버스와 수식

실시간 캔버스는 PixiJS로 스트로크·도형·연결선을 그리고, 텍스트·이미지·코드·테이블·수식은 React DOM 오브젝트로 표시합니다. 저장 요청은 Phoenix 브로커가 지속 WSS 소켓으로 C++에 전달하고 응답과 브로드캐스트를 라우팅합니다. 공유 텍스트 편집은 Automerge를 사용합니다. 객체 변경·스냅샷·편집 상태·마우스 위치·레이저 포인터는 인증된 브로커 WebSocket으로 전달하며, 캔버스 데이터에 P2P 데이터 채널을 사용하지 않습니다. `rtc_signal`은 통화용 WebRTC 미디어 협상에만 예약됩니다. 저장 요청은 백엔드로 라우팅하고 실시간 이벤트는 같은 캔버스의 인증된 사용자에게 전달합니다.

드로잉은 진행 중인 점들과 완료 상태를, 지우개는 변경된 선 조각과 삭제 상태를 최대 30FPS로 모아 호스트 승인 경로에 제출합니다. 브로커 전송이 아닌 별도 P2P 미리보기에 의존하지 않습니다. 동기화가 일시 중단되면 제출하지 못한 최신 프레임을 유지하고, 포인터 종료 시 마지막 프레임을 즉시 제출합니다. 호스트의 저장소 쓰기는 최대 10FPS이며, 새 참여자는 저장 전의 승인된 상태도 버전과 삭제 tombstone을 포함한 스냅샷으로 받습니다. 스냅샷 확인 전에는 편집을 허용하지 않고 변경 sequence가 누락되면 재동기화합니다. 아직 호스트 승인을 받지 않은 로컬 변경과 모든 참여자가 저장 확인 전에 종료하는 경우의 내구성까지 보장하는 구조는 아닙니다.


수식은 MathJax 4의 로컬 TeX-to-SVG 렌더러를 사용합니다. 실시간 캔버스와 튜토리얼에서 수식을 두 번 클릭해 편집할 수 있으며, Enter 또는 입력란 포커스 해제로 편집을 마칩니다. 튜토리얼 아이템은 현재 브라우저 메모리에서만 유지되고 서버에 저장되지 않습니다. 크기 조절 영역은 보이지 않지만 드래그 동작은 유지됩니다.

## 빌드와 배포

```bash
npm run build
npm run preview
```

빌드 파일은 `dist/`에 생성됩니다. 서버는 SPA 경로를 `index.html`로 fallback하고, `/mathjax/` 요청은 `dist/mathjax/` 파일로 제공해야 합니다. Vite 빌드 설정이 MathJax 런타임 파일을 `dist/mathjax/`에 복사합니다. Nginx 예시는 [Wall 저장소 설정](https://github.com/LHS11110/project-agora-Wall/blob/main/nginx/agora.conf.example)에 있습니다.

## Docker

Nginx와 Phoenix 브로커는 Wall 저장소에서 관리합니다. FE 저장소는 React·Vite 개발 서버 또는 배포용 빌드 결과를 제공합니다. Docker 엔진과 DB 스택을 먼저 시작하고 BE 백엔드, Wall 브로커, Nginx 순서로 실행합니다. 기존 `.env`를 사용하며 파일이 없을 때만 `cp .env.example .env`로 준비합니다.

### 개발 서버 실행

인증서 묶음을 직접 준비한 뒤 `python3 scripts/setup-projects.py --tls-dir /path/to/certificates`를 실행합니다. 파일 배치와 SAN은 [TLS 초기 설정 안내](docs/TLS_SETUP.md)를 참고하세요. 사설 CA는 접속할 브라우저 또는 시스템의 신뢰 저장소에 직접 등록합니다.

설정 명령은 BE `.env`에 `NGINX_TLS_CERT_DIR=/path/to/certificates`와
`NGINX_HTTPS_PORT=8443`을 설정하고, `CORS_ALLOWED_ORIGINS`에
`https://localhost:8443,https://127.0.0.1:8443`을 추가합니다.
직접 인증서를 갱신한 뒤 설정 명령으로 검증하고 BE의 `service-tls-init`을 `--force-recreate`로 실행한 뒤 관련 서비스를 재시작하세요.
로컬 인증서는 localhost·127.0.0.1·::1용이며, 공개 서비스에는 해당 도메인의 공인 인증서가 필요합니다.

Wall Nginx를 개발 모드로 시작하면 공유 네트워크 `agora-web`이 준비됩니다. 이후 FE Vite를 실행합니다.

```bash
cd ../project-agora-BE
docker compose -f docker-compose.backend.yml up -d --build --wait
cd ../project-agora-Wall
./scripts/broker-docker.sh up
./scripts/nginx-docker.sh development
cd ../project-agora-FE
docker compose -f compose.dev.yaml up -d --build --remove-orphans
```

브라우저에서 **https://localhost:8443** 또는 **https://127.0.0.1:8443**에 접속하세요. HTTP 4173 포트는 닫혀 있으며 리다이렉트도 제공하지 않습니다. Nginx가 React 페이지와 Vite HMR, Spring `/api/`, Phoenix `/wss/`를 제공합니다. Vite 5173과 Spring·C++·브로커 포트는 Docker 내부에만 열려 있고 모두 TLS를 사용합니다. Nginx와 브로커는 내부 서버의 CA와 호스트명을 검증합니다. 소스 변경은 볼륨 마운트로 즉시 반영됩니다.

Docker 개발 WebSocket은 현재 브라우저 origin을 사용하므로 Nginx 포트·호스트·HTTPS 변경을 자동으로 따릅니다. 별도 WebSocket 도메인만 `VITE_WS_BASE_URL`로 지정하세요. Vite를 사용자 도메인으로 접근하면 `VITE_ALLOWED_HOSTS`에 해당 호스트명을 명시합니다. HTTP API origin 및 WS origin은 빌드·실행 시 거절됩니다. 직접 평문 C++ 연결 경로는 제거했습니다.

```bash
docker compose -f compose.dev.yaml logs -f frontend
docker compose -f compose.dev.yaml down
```

### 빌드 배포

FE의 일회성 빌드 컨테이너가 정적 파일을 `agora-frontend-dist` 공유 볼륨에 기록합니다. Wall Nginx가 해당 볼륨을 읽어 SPA·MathJax·PDF 자산을 제공합니다. Vite preview 서버는 배포에 사용하지 않습니다.

```bash
cd ../project-agora-FE
docker compose -f compose.dev.yaml down --remove-orphans
docker compose build frontend-build
docker compose run --rm frontend-build
cd ../project-agora-Wall
./scripts/nginx-docker.sh production
curl -fsS https://localhost:8443/
```

기존 FE 운영 컨테이너(`agora-frontend`)가 남아 있으면 새 게이트웨이를 실행하기 전에 해당 컨테이너를 정리하세요. 새 빌드 배포 시 위 빌드·내보내기 명령을 반복합니다. 내보내기는 새 release를 준비한 뒤 `current` 심볼릭 링크를 원자적으로 전환합니다. 실패하면 이전 배포를 유지하고 동시 배포는 잠금으로 차단합니다. 이전 해시 자산은 열린 페이지의 lazy loading을 위해 보존하며, release 디렉터리는 최신 두 개를 유지합니다.

FE에는 Nginx 이미지나 설정이 없습니다. API·WebSocket·SPA fallback·자산 캐시·MIME 설정은 [Wall의 단일 Nginx 설정](../project-agora-Wall/nginx/agora.conf.example), Docker 실행 및 TLS 설정은 [Wall README](../project-agora-Wall/README.md)를 참고하세요. `VITE_*`는 브라우저에 포함되는 공개 설정이며 비밀값을 넣지 않습니다.

HTTPS 설정은 [Nginx 공식 문서](https://nginx.org/en/docs/http/configuring_https_servers.html)를 참고하세요.

## 라이선스

MathJax, PixiJS, Automerge의 라이선스 고지는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 참고하세요.

## 실행 의존성 및 검증

FE와 Wall은 같은 Docker 엔진의 `agora-web` 네트워크와 `agora-frontend-dist` 볼륨을 공유해야 합니다. BE와 Wall은 DB가 준비한 `agora-net`에 연결됩니다. 저장소가 나란히 있을 필요는 없으며 README의 `cd ../…`는 예시입니다. 각 저장소를 독립 경로에서 실행해도 컨테이너 DNS·볼륨 이름으로 연결됩니다. Node 22와 원자적 파일 전환은 컨테이너 안에서 실행하므로 호스트 Node/Nginx 설치에 의존하지 않습니다.

배포 도중 exporter가 강제 종료되어 `.deploy-lock`이 남으면 실행 중인 exporter가 없는지 확인한 뒤 공유 볼륨에서 잠금 디렉터리만 제거하세요. 데이터 볼륨 전체를 삭제하지 않습니다. 보존한 해시 자산은 배포 횟수에 따라 증가하므로 운영 환경의 자산 보존 정책에 따라 정리합니다.

```bash
node --test tests/exportDist.test.js tests/socketUrls.test.js
```

## 객체 그림자와 렌더링

선택 객체의 그림자는 설정 패널에서 켜기·끄기, 농도, 흐림, X/Y 위치를 조절합니다. `shadowEnabled`, `shadowOpacity`(0~1), `shadowBlur`(0~24), `shadowOffsetX`/`shadowOffsetY`(-24~24)는 객체 데이터로 저장·동기화되며 캔버스 코드에도 포함됩니다. 여러 객체를 선택하면 한 번의 변경으로 함께 적용됩니다.

화면 안의 벡터 객체는 외형과 그림자를 비트맵으로 캐시합니다. 이동과 회전은 캐시를 재사용하고 외형·크기 변경 시 해당 객체만 다시 그립니다. 하드웨어 GPU가 있으면 Pixi의 WebGL/WebGPU 스프라이트 렌더링을 사용하며, 소프트웨어 GPU나 초기화 실패 시 캐시를 재사용하는 Canvas 2D 경로로 전환합니다. GPU 컨텍스트는 페이지당 최대 4개, 낮음 설정의 래스터 준비 예산은 깊이별 약 800만 픽셀로 제한하며 화면 밖 객체의 리소스는 해제합니다. 드로잉 중에는 진행 중인 선만 별도 표면에 갱신하고, 객체 렌더링과 측정 이벤트는 애니메이션 프레임마다 합칩니다.


대량 객체 캔버스는 `rbush` 4의 R-tree로 화면과 겹치는 객체를 검색합니다. 이동·크기 변경 때 변경 객체와 라우팅 영향을 받는 연결선만 경계를 갱신하며, 카메라 이동은 인덱스를 다시 만들지 않습니다. 그림자와 테두리의 실제 여백까지 검색 영역에 포함하고 편집 중인 객체는 유지합니다. 지우개와 드래그 선택도 같은 인덱스로 후보를 좁힙니다.

GPU 렌더링은 PixiJS 8의 스프라이트를 1,024px 텍스처 아틀라스(깊이당 최대 8장)에 모아 배칭합니다. 이동·회전은 텍스처 업로드를 발생시키지 않고, 바뀐 텍스처 페이지만 업로드합니다. 큰 객체 또는 아틀라스 용량 초과 객체는 개별 텍스처를 사용하며, 화면 밖 객체의 슬롯은 재사용합니다. 확대 시 선명도 갱신은 프레임당 약 8ms의 준비 예산으로 나누고 축소 시 기존 캐시를 유지합니다. Canvas 2D 대체 경로는 이전·현재 객체 경계에 해당하는 부분만 지우고 겹치는 객체를 순서대로 다시 그립니다. 큰 변경 영역은 전체를 갱신하고 카메라 이동은 준비 영역의 캐시를 재사용합니다.

검증: `node --test tests/*.test.js`. `tests/canvasSpatialIndex.test.js`는 1,000개 객체의 뷰포트 검색, 단일 객체 부분 갱신, 연결선·그림자 경계, 아틀라스 슬롯 재사용과 회전 객체의 변경 영역을 검증합니다.

객체 이벤트는 캔버스 단위의 안정적인 디스패처를 공유하고 최신 콜백을 참조합니다. 다른 객체나 카메라가 바뀔 때 변경되지 않은 객체 컴포넌트의 실행을 생략합니다.

대량 객체에서는 도형·드로잉·화살표의 조작용 HTML을 선택한 객체에만 만들고 R-tree로 포인터가 가리키는 객체를 찾습니다. 64개를 넘는 선택은 선택 테두리도 래스터로 표시하여 수천 개의 HTML 요소를 다시 만들지 않습니다. 크기가 명시된 일반 텍스트도 아틀라스에 그리며 선택·편집 시 기존 HTML 편집기로 전환합니다. 풍부한 콘텐츠는 화면에서 읽을 수 없을 정도로 작은 경우에만 간단한 개요 상자로 표시하고, 확대하거나 선택하면 실제 콘텐츠를 복원합니다. 객체 데이터와 저장·동기화 방식은 그대로 사용합니다.

동일한 기본 도형은 비트맵과 텍스처를 공유하고 그림체 객체는 고유한 시드를 유지합니다. GPU와 Canvas 2D 모두 아틀라스 페이지에 비트맵을 보관하여 작은 객체마다 별도 캔버스 버퍼를 유지하지 않습니다. 화면 가장자리에는 256px의 준비 영역을 두고, 작은 이동에서는 장면의 객체 목록과 이미 그린 화면을 재사용합니다. 미니맵도 단일 비트맵과 화면 영역 오버레이로 그립니다. 알려진 이동·회전·크기 변경은 해당 ID만 인덱스에 갱신하며, 위치 변경은 실제 DOM 크기가 바뀌지 않는 한 전체 크기 측정 이벤트를 만들지 않습니다.

12,000개 객체의 브라우저 측정 결과와 검증 범위는 [대량 객체 렌더링 검증](docs/large-canvas-performance.md)을 참고하세요. 인덱스 성능은 `node scripts/benchmark-render-index.mjs`로 재현할 수 있습니다.

카메라 입력은 애니메이션 프레임마다 합치고, React의 객체 목록·패널 갱신은 약 100ms 간격 또는 준비 영역을 벗어날 때 수행합니다. 벡터 표면은 화면 좌표에 두고 HTML 편집기와 조작 요소만 세계 좌표로 변환합니다. 확대·축소 중에는 기존 텍스처를 유지하며, 멈춘 뒤 선명도를 갱신할 때도 Pixi 스프라이트를 재사용합니다. 미니맵 역시 이동·확대 중 기존 비트맵을 투영하고 멈추면 필요한 품질을 복원합니다.

테두리·그림자·선택 윤곽이 없는 불투명 사각형은 흰색 텍스처를 공유하고 GPU의 tint로 원래 색을 표시합니다. 그림체·투명 채우기·테두리·그림자는 기존 래스터 경로를 사용합니다. GPU 렌더 그룹과 기존 래스터의 안티앨리어싱을 이용해 중복 MSAA 비용을 줄입니다. 소프트웨어 경로는 그림이 차지하는 영역만 출력하고, 지원되는 환경에서는 OffscreenCanvas Worker가 내용 변경 때 캐시를 준비하며 카메라 이동은 CSS 합성으로 처리합니다. Worker 실패나 미지원 환경은 메인 스레드의 Canvas 2D로 복원합니다.

실제 RTX 3060 Ti와 Chrome에서 12,000개 객체의 평균 60 FPS를 확인한 조건·수치는 [60 FPS 검증](docs/canvas-60fps-performance.md)에 기록합니다.

10만·20만·50만 개 객체의 분산·밀집 배치와 30 FPS 기준에 대한 측정 범위 및 결과는 [수십만 객체 검증](docs/hundred-thousand-canvas-performance.md)에 기록합니다.

객체 준비는 장면마다 생성한 목록과 진행 커서를 재사용하여 청크 단위로 이어서 처리합니다. 수정 후 10만·20만·50만 객체 밀집 장면의 전체 준비 시간과 기능 검증은 [객체 준비 병목 최적화](docs/canvas-preparation-performance.md)에 기록합니다.

드로잉과 텍스트 편집은 변경된 객체만 반영하고 정적인 GPU 장면을 재사용합니다. 입력 중 프레임 측정과 저장·렌더링 회귀 검증은 [입력 프레임 개선](docs/canvas-input-performance.md)에 기록합니다.

캔버스 설정 패널에서 그래픽 품질을 낮음·보통·높음으로 선택할 수 있습니다. 기본값은 속도를 우선하는 낮음이며 기기에 저장됩니다. 해상도와 검증 범위는 [그래픽 품질 설정](docs/canvas-graphics-quality.md)을 참고하세요.

다중 객체 이동은 선택한 ID 목록과 이동 벡터를 100ms 간격으로 묶어 브로커를 통해 승인·전달합니다. 드래그 종료 시 마지막 이동량을 즉시 반영합니다. 프로토콜과 검증은 [다중 객체 이동 전송](docs/canvas-group-movement.md)을 참고하세요.

대용량 캔버스는 분할 전송·수신 ACK·전송량 제한으로 동기화합니다. 초기 접속 재시도, 인증 메타데이터 조회와 실제 20MB 연결 검증은 [연결 안정성 개선](docs/canvas-connection-stability.md)을 참고하세요.

참여자 접속·퇴장 중 이전 호스트/대상을 가리키는 전송은 기존 소켓에서 목록을 재조회해 복구합니다. 처리 범위와 재현은 [브로커 참여자 전환 복구](docs/canvas-broker-membership-recovery.md)를 참고하세요.

깊이 변경 시 GPU 레이어 종료와 2D 복구는 [깊이 렌더링 회귀 검증](docs/canvas-depth-rendering.md)에 기록합니다. 실제 데이터를 사용하지 않는 브라우저 픽셀 검사는 `scripts/check-depth-rendering-browser.mjs`로 재현할 수 있습니다.

축소 화면에서는 텍스트 획과 실제 이미지 썸네일을 캐시해 단색 박스 표시를 완화합니다. 메모리·디코딩 제한과 GPU/2D 비교 결과는 [축소 미리보기 렌더링](docs/canvas-overview-rendering.md)에 기록합니다.

다각형 꼭짓점 수·둥근 모서리·테두리 굵기·채우기 투명도·손그림 빗금 밀도와 방향키 픽셀 이동은 [도형 설정](docs/canvas-shape-appearance.md)에 설명합니다.
