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

Nginx 설정과 컨테이너는 BE 저장소에서 관리합니다. FE 저장소는 React·Vite 개발 서버 또는 배포용 빌드 결과만 제공합니다. Docker 엔진과 DB 스택을 먼저 시작하고, BE의 `./scripts/backend-docker.sh up`으로 백엔드를 실행하세요. 기존 `.env`를 사용하며 파일이 없을 때만 `cp .env.example .env`로 준비합니다.

### 개발 서버 실행

인증서 묶음을 직접 준비한 뒤 `python3 scripts/setup-projects.py --tls-dir /path/to/certificates`를 실행합니다. 파일 배치와 SAN은 [TLS 초기 설정 안내](docs/TLS_SETUP.md)를 참고하세요. 사설 CA는 접속할 브라우저 또는 시스템의 신뢰 저장소에 직접 등록합니다.

설정 명령은 BE `.env`에 `NGINX_TLS_CERT_DIR=/path/to/certificates`와
`NGINX_HTTPS_PORT=8443`을 설정하고, `CORS_ALLOWED_ORIGINS`에
`https://localhost:8443,https://127.0.0.1:8443`을 추가합니다.
직접 인증서를 갱신한 뒤 설정 명령으로 검증하고 BE의 `service-tls-init`을 `--force-recreate`로 실행한 뒤 관련 서비스를 재시작하세요.
로컬 인증서는 localhost·127.0.0.1·::1용이며, 공개 서비스에는 해당 도메인의 공인 인증서가 필요합니다.

BE Nginx를 개발 모드로 시작하면 공유 네트워크 `agora-web`이 준비됩니다. 이후 FE Vite를 실행합니다.

```bash
cd ../project-agora-BE
docker compose -f docker-compose.backend.yml up -d --build --wait
./scripts/nginx-docker.sh development
cd ../project-agora-FE
docker compose -f compose.dev.yaml up -d --build --remove-orphans
```

브라우저에서 **https://localhost:8443** 또는 **https://127.0.0.1:8443**에 접속하세요. HTTP 4173 포트는 닫혀 있으며 리다이렉트도 제공하지 않습니다. Nginx가 React 페이지와 Vite HMR, Spring `/api/`, C++ `/wss/`를 제공합니다. Vite 5173과 Spring·C++ 포트는 Docker 내부에만 열려 있고 모두 TLS를 사용합니다. Nginx는 내부 서버의 CA와 호스트명을 검증합니다. 소스 변경은 볼륨 마운트로 즉시 반영됩니다. 기존 개발 Nginx 컨테이너도 `--remove-orphans`로 정리됩니다.

Docker 개발 WebSocket은 현재 브라우저 origin을 사용하므로 Nginx 포트·호스트·HTTPS 변경을 자동으로 따릅니다. 별도 WebSocket 도메인만 `VITE_WS_BASE_URL`로 지정하세요. Vite를 사용자 도메인으로 접근하면 `VITE_ALLOWED_HOSTS`에 해당 호스트명을 명시합니다. HTTP API origin 및 WS origin은 빌드·실행 시 거절됩니다. 직접 평문 C++ 연결 경로는 제거했습니다.

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
curl -fsS https://localhost:8443/
```

기존 FE 운영 컨테이너(`agora-frontend`)가 남아 있으면 새 게이트웨이를 실행하기 전에 해당 컨테이너를 정리하세요. 새 빌드 배포 시 위 빌드·내보내기 명령을 반복합니다. 내보내기는 새 release를 준비한 뒤 `current` 심볼릭 링크를 원자적으로 전환합니다. 실패하면 이전 배포를 유지하고 동시 배포는 잠금으로 차단합니다. 이전 해시 자산은 열린 페이지의 lazy loading을 위해 보존하며, release 디렉터리는 최신 두 개를 유지합니다.

FE에는 Nginx 이미지나 설정이 없습니다. API·WebSocket·SPA fallback·자산 캐시·MIME 설정은 [BE의 단일 Nginx 설정](../project-agora-BE/nginx/agora.conf.example), Docker 실행 및 TLS 설정은 [BE README](../project-agora-BE/README.md#nginx와-wss)를 참고하세요. `VITE_*`는 브라우저에 포함되는 공개 설정이며 비밀값을 넣지 않습니다.

HTTPS 설정은 [Nginx 공식 문서](https://nginx.org/en/docs/http/configuring_https_servers.html)를 참고하세요.

## 라이선스

MathJax, PixiJS, Automerge의 라이선스 고지는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 참고하세요.

## 실행 의존성 및 검증

FE와 BE는 같은 Docker 엔진의 `agora-web` 네트워크와 `agora-frontend-dist` 볼륨을 공유해야 합니다. 저장소가 나란히 있을 필요는 없으며 README의 `cd ../…`는 예시입니다. 각 저장소를 독립 경로에서 실행해도 컨테이너 DNS·볼륨 이름으로 연결됩니다. Node 22와 원자적 파일 전환은 컨테이너 안에서 실행하므로 호스트 Node/Nginx 설치에 의존하지 않습니다.

배포 도중 exporter가 강제 종료되어 `.deploy-lock`이 남으면 실행 중인 exporter가 없는지 확인한 뒤 공유 볼륨에서 잠금 디렉터리만 제거하세요. 데이터 볼륨 전체를 삭제하지 않습니다. 보존한 해시 자산은 배포 횟수에 따라 증가하므로 운영 환경의 자산 보존 정책에 따라 정리합니다.

```bash
node --test tests/exportDist.test.js tests/socketUrls.test.js
```
