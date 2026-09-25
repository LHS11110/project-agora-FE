# 프런트엔드 구조와 설정

이 문서는 `project-agora-FE`의 현재 구현을 기준으로 작성합니다. 백엔드 서비스 내부 설정은 다루지 않습니다.

## 디렉터리 구성

| 경로 | 역할 |
| --- | --- |
| `src/App.jsx` | 페이지 라우트와 로그인 보호 구성을 정의합니다. |
| `src/pages/` | 홈, 로그인, 문서, 검색, 프로필, 튜토리얼, 실시간 캔버스 화면을 둡니다. |
| `src/api/client.js` | REST API 주소와 캔버스·RTC WebSocket URL을 만듭니다. |
| `src/state/AuthContext.jsx` | 인증 상태와 브라우저 저장소의 토큰·사용자 정보를 관리합니다. |
| `src/components/` | MathJax, Pixi 벡터 레이어, 편집 오브젝트, 공유 미디어, 테이블 등을 둡니다. |
| `src/tutorial.css`, `src/vector-editor.css` | 튜토리얼과 실시간 캔버스 편집기 스타일입니다. |
| `vite.config.js` | `/api` 개발 프록시, 로컬 MathJax 제공, 빌드 자산 복사를 설정합니다. |

## 라우트

| 경로 | 페이지 | 인증 |
| --- | --- | --- |
| `/` | `HomePage` | 불필요 |
| `/docs` | `DocsPage` | 불필요 |
| `/tutorial` | `TutorialPage` | 불필요 |
| `/login` | `LoginPage` | 불필요 |
| `/profile` | `ProfilePage` | 필요 |
| `/search` | `SearchPage` | 필요 |
| `/canvases/:canvasId` | `CanvasPage` | 필요 |

`/profile`, `/search`, `/canvases/:canvasId`는 공통 `Protected` 라우트로 감쌉니다. 알 수 없는 경로는 `/`로 이동합니다.

## 환경 설정

Vite는 `.env`의 `VITE_*` 값을 브라우저 번들에 포함합니다. 사용자가 확인할 수 있으므로 비밀키나 장기 자격 증명을 여기에 두지 않습니다.

| 변수 | 기본값 | 동작 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 빈 값 | REST API origin입니다. 비어 있으면 현재 origin의 `/api/...`를 사용합니다. 지정하면 해당 origin으로 직접 요청합니다. |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8080` | 개발 서버가 `/api` 요청을 전달할 Vite 프록시 대상입니다. API base URL이 지정되면 프록시는 사용되지 않습니다. |
| `VITE_CPP_WS_HOST` | 예시 파일은 `127.0.0.1`; 미설정 시 현재 페이지 hostname | 개발 모드에서 WebSocket을 직접 연결할 hostname입니다. 포트는 API 응답의 `ws_port`입니다. |
| `VITE_WS_BASE_URL` | 빈 값 | 지정 시 설정한 origin의 `/wss/port/{wsPort}/canvas/{canvasId}` 및 `/wss/port/{wsPort}/rtc/canvas/{canvasId}` 경로를 사용합니다. |
| `VITE_WEBRTC_ICE_SERVERS` | `stun:stun.l.google.com:19302` | `RTCPeerConnection`용 JSON 배열입니다. 비어 있거나 잘못되면 기본 STUN 설정을 사용합니다. TURN 자격 증명은 브라우저에 전달되므로 단기 값이어야 합니다. |

예시 설정은 [.env.example](../.env.example)입니다. 변경한 값은 Vite 개발 서버를 다시 시작하거나 프런트엔드를 다시 빌드해야 반영됩니다.

### 연결 흐름

`api()`는 상대 API 경로에 `VITE_API_BASE_URL`을 붙이고, 토큰이 있으면 `Authorization: Bearer ...` 헤더를 보냅니다. 개발 모드에서 base URL이 비어 있으면 `/api`는 기본 Spring 주소 `http://127.0.0.1:8080`으로 프록시됩니다.

캔버스 진입 시 접근 정보를 받은 다음 응답의 `ws_port`로 캔버스 데이터 WebSocket과 RTC 시그널링 WebSocket을 엽니다.

| 설정 | 캔버스 WebSocket | RTC 시그널링 WebSocket |
| --- | --- | --- |
| 개발, 별도 origin 미지정 | `ws(s)://{VITE_CPP_WS_HOST}:{wsPort}/ws/canvas/{canvasId}` | `ws(s)://{VITE_CPP_WS_HOST}:{wsPort}/ws/rtc/canvas/{canvasId}` |
| 프로덕션 기본값 | 현재 origin의 `/wss/port/{wsPort}/canvas/{canvasId}` | 현재 origin의 `/wss/port/{wsPort}/rtc/canvas/{canvasId}` |
| `VITE_WS_BASE_URL` 지정 | 설정한 origin의 `/wss/port/{wsPort}/canvas/{canvasId}` | 설정한 origin의 `/wss/port/{wsPort}/rtc/canvas/{canvasId}` |

WebSocket URL에는 접근 토큰이 `token` 쿼리 파라미터로 포함됩니다. 프록시와 웹 서버 로그에는 해당 값을 남기지 않도록 설정해야 합니다.

## 캔버스와 튜토리얼

`CanvasPage`는 캔버스 초기화와 연결 상태를 조정합니다. PixiJS `VectorLayer`가 스트로크·도형·커넥터를 그리고, 텍스트·코드·이미지·링크·메모·테이블·수식은 React DOM 오브젝트로 표시됩니다. 오브젝트 위치와 크기는 정규화된 캔버스 좌표를 사용합니다.

캔버스 데이터 소켓은 아이템 변경과 스냅샷 동기화에 쓰입니다. Automerge는 텍스트 기반 공동 편집에 쓰이고, RTC WebSocket은 WebRTC 연결의 offer·answer·ICE candidate 시그널링을 전달합니다. WebRTC 데이터 채널은 피어 간 동기화 데이터와 커서를 전달합니다.

`TutorialPage`는 `demoItems`를 초기값으로 사용하며 편집 내용은 React 상태에만 유지합니다. 현재 API나 WebSocket에 저장되지 않고 페이지를 다시 열면 기본 예제로 초기화됩니다.

## 수식과 크기 조절

`MathFormula`는 로컬 MathJax 4 런타임 `/mathjax/tex-svg.js`를 불러와 `tex2svgPromise`로 수식을 SVG로 변환합니다. 변환 결과를 해당 수식 요소에 직접 넣으며 입력은 1,200자로 제한합니다. 오류가 나면 원문을 표시합니다.

실시간 캔버스와 튜토리얼에서 수식 미리보기를 두 번 클릭하면 편집할 수 있습니다. Enter 또는 입력란의 포커스 해제로 편집을 마칩니다. 실시간 캔버스는 변경 이벤트를 소켓으로 전송하고, 튜토리얼은 현재 화면 상태만 갱신합니다.

Vite 개발 서버는 `node_modules/mathjax`를 `/mathjax/` 경로에 제공합니다. 빌드는 MathJax 런타임을 `dist/mathjax/`로 복사하고 sourcemap은 제외합니다.

`ResizeHandles`는 가장자리와 모서리에 투명한 포인터 버튼을 둡니다. 넓은 금색 선 표시는 제거해 크기 조절 UI를 숨겼고 드래그 동작은 유지합니다. 선택 오브젝트 외곽선은 별도 표시입니다.

## 인증과 보안

인증 토큰과 사용자 정보는 각각 `agora_token`, `agora_user` 키로 브라우저 `localStorage`에 저장됩니다. API에는 Bearer 헤더로, WebSocket에는 쿼리 파라미터로 토큰을 보냅니다. 같은 출처의 스크립트는 `localStorage`를 읽을 수 있으므로 XSS 방어와 HTTPS가 중요합니다.

TURN 자격 증명은 연결을 위해 브라우저에 전달되므로 비밀로 유지할 수 없습니다. 운영 배포에는 단기 또는 임시 자격 증명을 사용하고 실제 비밀값을 저장소에 커밋하지 않습니다.

## 빌드와 웹 서버

`npm run build`는 `dist/`를 생성합니다. 빌드 설정은 MathJax 파일을 `dist/mathjax/`로 복사하고 PixiJS·Automerge 라이선스 파일을 `dist/licenses/`에 둡니다.

- `/assets/`와 `/mathjax/` 요청은 정적 파일을 반환하고 파일이 없으면 404를 반환해야 합니다.
- `/profile`, `/search`, `/tutorial`, `/canvases/...` 같은 SPA 경로는 `index.html`로 fallback해야 합니다.
- 배포할 때 `dist/`의 전체 내용을 웹 서버의 정적 루트에 복사합니다.

Nginx 예시는 [백엔드 저장소의 설정 파일](https://github.com/LHS11110/project-agora-BE/blob/main/nginx/agora.conf.example)입니다. 경로 또는 프록시 설정을 바꾸면 Nginx location과 `VITE_*` 값을 함께 확인합니다.
