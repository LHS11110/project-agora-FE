# Agora Frontend

React + Vite로 만든 Project Agora 프론트엔드입니다. 홈, 로그인·회원가입, 프로필 관리, 캔버스 검색, 실시간 캔버스 화면을 제공합니다.

## 실행

```bash
npm install
cp .env.example .env
npm run dev
```

Vite 개발 서버는 기본적으로 Spring Boot의 `http://127.0.0.1:8080`으로 `/api` 요청을 프록시합니다. 다른 주소를 사용하는 경우 `.env`의 `VITE_API_PROXY_TARGET`을 수정하세요.

캔버스 WebSocket은 개발 모드에서 `VITE_CPP_WS_HOST`와 API 응답의 `ws_port`로 C++ 서버에 직접 연결합니다. 프로덕션에서는 기본적으로 현재 도메인의 `/wss/port/{wsPort}/canvas/{canvasId}` Nginx 경로를 사용합니다. 별도 도메인을 사용하는 경우 `VITE_WS_BASE_URL`을 지정합니다.

`VITE_API_BASE_URL`은 Spring API의 origin을 지정할 때 사용하며, 같은 도메인에서 제공한다면 비워 둡니다.

## 구현 페이지

- `/` 프로젝트 소개와 기능 안내
- `/login` 로그인 및 회원가입
- `/profile` 사용자 프로필 및 비밀번호 변경
- `/search` 캔버스 검색, 생성, 진입
- `/canvases/:canvasId` 실시간 드로잉, 이미지·코드 공유, 채팅, 멤버 및 설정

로그인 토큰과 사용자 정보는 브라우저 `localStorage`에 저장됩니다. 이미지 공유는 최대 2MB 이미지의 data URL을 캔버스 아이템으로 WebSocket 전송합니다.

## 프로덕션 빌드

```bash
npm run build
npm run preview
```

빌드 결과는 `dist/`에 생성됩니다. SPA 경로(`/profile`, `/search`, `/canvases/...`)가 `index.html`로 fallback되도록 웹 서버를 설정해야 합니다.

Nginx 배포 예시는 `../project-agora-BE/nginx/agora.conf.example`에 있습니다. 이 설정은 `/var/www/agora-frontend`에서 Vite 빌드 파일을 정적으로 제공하고, `/api`와 캔버스·RTC WebSocket 경로는 각 백엔드로 전달합니다. 배포할 때는 `npm run build` 후 `dist/` 안의 파일을 해당 Nginx root로 복사하세요.
