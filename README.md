# Agora Frontend

Project Agora 프런트엔드는 React 18과 Vite 6 기반의 SPA입니다. 홈, 문서, 튜토리얼, 사용자 프로필, 캔버스 검색과 실시간 협업 캔버스를 제공합니다.

## 시작하기

```bash
npm install
cp .env.example .env
npm run dev
```

Vite 개발 서버는 `http://127.0.0.1:5173`에서 실행하고, `/api` 요청을 `http://127.0.0.1:8080`으로 프록시합니다. API 주소나 WebSocket 구성이 다른 경우 `.env` 값을 조정하세요.

## 환경 변수

| 변수 | 기본값 | 용도 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 빈 값 | REST API origin. 빈 값이면 현재 origin의 `/api`를 사용합니다. |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8080` | Vite 개발 서버가 `/api` 요청을 전달할 주소입니다. |
| `VITE_CPP_WS_HOST` | 예시 파일은 `127.0.0.1`; 미설정 시 현재 페이지 hostname | 개발 모드에서 캔버스·RTC WebSocket을 직접 연결할 호스트입니다. 포트는 API 응답의 `ws_port`를 사용합니다. |
| `VITE_WS_BASE_URL` | 빈 값 | WebSocket origin을 명시적으로 지정합니다. 지정하면 `/wss/port/{wsPort}/canvas/{canvasId}` 및 `/wss/port/{wsPort}/rtc/canvas/{canvasId}` 경로를 사용합니다. |
| `VITE_WEBRTC_ICE_SERVERS` | Google STUN 기본값 | WebRTC ICE 서버 설정을 JSON 배열로 지정합니다. 제한된 NAT 환경에서는 TURN 서버 설정이 필요할 수 있습니다. |

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

실시간 캔버스는 PixiJS로 스트로크·도형·연결선을 그리고, 텍스트·이미지·코드·테이블·수식은 React DOM 오브젝트로 표시합니다. 캔버스 데이터 변경은 C++ WebSocket으로 전달하고, 공유 텍스트 편집은 Automerge를 사용합니다. P2P 데이터 채널 연결은 별도 RTC WebSocket의 시그널링과 브라우저 WebRTC를 사용합니다.

수식은 MathJax 4의 로컬 TeX-to-SVG 렌더러를 사용합니다. 실시간 캔버스와 튜토리얼에서 수식을 두 번 클릭해 편집할 수 있으며, Enter 또는 입력란 포커스 해제로 편집을 마칩니다. 튜토리얼 아이템은 현재 브라우저 메모리에서만 유지되고 서버에 저장되지 않습니다. 크기 조절 영역은 보이지 않지만 드래그 동작은 유지됩니다.

## 빌드와 배포

```bash
npm run build
npm run preview
```

빌드 파일은 `dist/`에 생성됩니다. 서버는 SPA 경로를 `index.html`로 fallback하고, `/mathjax/` 요청은 `dist/mathjax/` 파일로 제공해야 합니다. Vite 빌드 설정이 MathJax 런타임 파일을 `dist/mathjax/`에 복사합니다. Nginx 예시는 [백엔드 저장소 설정](https://github.com/LHS11110/project-agora-BE/blob/main/nginx/agora.conf.example)에 있습니다.

## Docker

Nginx 설정과 컨테이너는 BE 저장소에서 관리합니다. FE 저장소는 React·Vite 개발 서버 또는 배포용 빌드 결과만 제공합니다. Docker Desktop과 DB 스택을 먼저 시작하고, BE의 `./scripts/backend-docker.sh up`으로 백엔드를 실행하세요. 기존 `.env`를 사용하며 파일이 없을 때만 `cp .env.example .env`로 준비합니다.

### 개발 서버 실행

BE Nginx를 개발 모드로 시작하면 공유 네트워크 `agora-web`이 준비됩니다. 이후 FE Vite를 실행합니다.

```bash
cd ../project-agora-BE
./scripts/nginx-docker.sh development
cd ../project-agora-FE
docker compose -f compose.dev.yaml up -d --build --remove-orphans
```

브라우저에서 **http://127.0.0.1:4173**에 접속하세요. Nginx가 React 페이지와 Vite HMR, Spring `/api/`, C++ `/wss/`를 제공합니다. Vite 직접 접속은 `http://127.0.0.1:5173`이며 소스 변경은 볼륨 마운트로 즉시 반영됩니다. 기존 개발 Nginx 컨테이너도 `--remove-orphans`로 정리됩니다.

Docker 개발 WebSocket은 현재 브라우저 origin을 사용하므로 Nginx 포트·호스트·HTTPS 변경을 자동으로 따릅니다. 별도 WebSocket 도메인만 `VITE_WS_BASE_URL`로 지정하세요. Vite를 사용자 도메인으로 접근하면 `VITE_ALLOWED_HOSTS`에 해당 호스트명을 명시합니다. Docker 밖에서 C++에 직접 연결하는 개발 모드만 `VITE_CPP_WS_HOST`를 사용합니다.

```bash
docker compose -f compose.dev.yaml logs -f frontend
docker compose -f compose.dev.yaml down
```

### 빌드 배포

FE의 일회성 빌드 컨테이너가 정적 파일을 `agora-frontend-dist` 공유 볼륨에 기록합니다. BE Nginx가 해당 볼륨을 읽어 SPA·MathJax·PDF 자산을 제공합니다. Vite preview 서버는 배포에 사용하지 않습니다.

```bash
cd ../project-agora-FE
docker compose -f compose.dev.yaml down --remove-orphans
docker compose build frontend-build
docker compose run --rm frontend-build
cd ../project-agora-BE
./scripts/nginx-docker.sh production
curl -fsS http://127.0.0.1:4173/
```

기존 FE 운영 컨테이너(`agora-frontend`)가 남아 있으면 먼저 `docker rm -f agora-frontend`로 제거해 4173 포트를 비워 주세요. 새 빌드 배포 시 위 빌드·내보내기 명령을 반복합니다. 내보내기는 새 release를 준비한 뒤 `current` 심볼릭 링크를 원자적으로 전환합니다. 실패하면 이전 배포를 유지하고 동시 배포는 잠금으로 차단합니다. 이전 해시 자산은 열린 페이지의 lazy loading을 위해 보존하며, release 디렉터리는 최신 두 개를 유지합니다.

FE에는 Nginx 이미지나 설정이 없습니다. API·WebSocket·SPA fallback·자산 캐시·MIME 설정은 [BE의 단일 Nginx 설정](../project-agora-BE/nginx/agora.conf.example), Docker 실행 및 TLS 설정은 [BE README](../project-agora-BE/README.md#nginx와-wss)를 참고하세요. `VITE_*`는 브라우저에 포함되는 공개 설정이며 비밀값을 넣지 않습니다.

## 라이선스

MathJax, PixiJS, Automerge의 라이선스 고지는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 참고하세요.

## 실행 의존성 및 검증

FE와 BE는 같은 Docker 엔진의 `agora-web` 네트워크와 `agora-frontend-dist` 볼륨을 공유해야 합니다. 저장소가 나란히 있을 필요는 없으며 README의 `cd ../…`는 예시입니다. 각 저장소를 독립 경로에서 실행해도 컨테이너 DNS·볼륨 이름으로 연결됩니다. Node 22와 원자적 파일 전환은 Linux 컨테이너 안에서 실행하므로 호스트 Node/Nginx 설치에 의존하지 않습니다.

배포 도중 exporter가 강제 종료되어 `.deploy-lock`이 남으면 실행 중인 exporter가 없는지 확인한 뒤 공유 볼륨에서 잠금 디렉터리만 제거하세요. 데이터 볼륨 전체를 삭제하지 않습니다. 보존한 해시 자산은 배포 횟수에 따라 증가하므로 운영 환경의 자산 보존 정책에 따라 정리합니다.

```bash
node --test tests/exportDist.test.js tests/socketUrls.test.js
```
