import PythonSdkDocs, { sdkSections, botEndpoints } from '../docs/PythonSdkDocs.jsx';
import CanvasObjectsDocs, { canvasObjectSections } from '../docs/CanvasObjectsDocs.jsx';
import LanguageSwitcher from '../i18n/LanguageSwitcher.jsx';
import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { useEffect, useState } from 'react';
import { Link } from '../routing.jsx';
import Icon from '../components/Icon.jsx';
import FreLogBrand from '../components/frelog/FreLogBrand.jsx';
import '../docs-directory.css';

const authEndpoints = [
  ['POST', '/api/auth/signup', '없음', '회원가입. JSON { email, password, nickname, emailVerificationToken }. 먼저 이메일 인증을 완료해야 합니다. 인증 증명은 해당 이메일에만 한 번 사용할 수 있습니다. 성공 시 201 + UserResponse.'],
  ['POST', '/api/auth/login', '없음', '로그인. JSON { email, password }. 200 응답에 tokenType, accessToken, user 또는 2단계 인증 필요 시 mfaRequired, challengeToken을 반환합니다.'],
  ['POST', '/api/auth/session/refresh', 'refresh 쿠키 · X-Agora-Session', 'access token 갱신. 로그인 시 발급된 HttpOnly·SameSite=Strict refresh 쿠키를 회전하고 15분짜리 새 accessToken과 user를 반환합니다. 회전된 이전 쿠키를 다시 쓰면 세션이 폐기됩니다.'],
  ['POST', '/api/auth/session/logout · /logout-all', 'refresh 쿠키 · Bearer JWT', '현재 세션 또는 모든 기기의 세션을 서버에서 즉시 종료합니다. 종료된 세션의 access token은 다음 요청부터 401입니다.'],
  ['GET', '/api/auth/me', 'Bearer JWT · Bot token', '현재 인증된 사용자 또는 봇을 조회합니다. 인증이 없으면 401입니다.'],
  ['POST', '/api/auth/me', '본문 token', '현재 사용자 조회. JSON { token }에 로그인 JWT를 넣습니다. 누락·무효 토큰은 401입니다.'],
  ['GET', '/api/auth/providers', '없음', '활성화된 간편 로그인 제공자 상태 { google, naver, kakao, orcid }를 반환합니다.'],
  ['GET', '/api/auth/health', '없음', '인증 서비스 상태 확인. { status: "UP", service: "Agora Auth Service" }.'],
  ['GET', '/api/auth/oauth2/authorize/{provider}', '없음', 'Google·Naver·Kakao OAuth2 인증 시작 리디렉션. 완료 후 GET /api/auth/oauth2/session으로 로그인 또는 가입 이메일 확인 상태를 조회합니다.'],
  ['GET', '/api/auth/oauth2/session', '세션 쿠키', '소셜 로그인 리디렉션 완료 후 결과를 한 번만 꺼냅니다. 로그인 응답(accessToken, user) 또는 최초 가입 이메일 확인용 enrollmentToken을 반환하며, 세션이 없으면 401입니다.'],
  ['POST', '/api/auth/oauth2/email/request · /enrollment', '없음', '최초 소셜 가입 시 이메일 소유 확인 코드 발송 및 enrollmentToken 바인딩 가입 완료 처리.'],
  ['GET · POST', '/api/irade/auth/orcid/status · /start · /callback · /link · /api/irade/auth/session · /me', '선택 Bearer', 'ORCID 사용 가능 여부 조회, 인증 시작·콜백, 일회성 세션 교환(POST /api/irade/auth/session), 로그인 사용자 계정 연동(/link)과 현재 ORCID 사용자 조회(/me).'],
];

const securityAuthEndpoints = [
  ['GET · POST · DELETE', '/api/auth/passkeys/status · / · /registration/* · /login/* · /{id}', '없음 · Bearer JWT', 'WebAuthn 패스키 지원 여부 조회, 패스키 로그인 옵션·검증, 등록·삭제 관리.'],
  ['GET · POST · DELETE', '/api/auth/mfa · /enrollment · /enrollment/confirm · /verify · /disable · /recovery-codes', '없음 · Bearer JWT', 'TOTP 2단계 인증 상태 조회(GET), 등록 시작(POST /enrollment)·확인(/enrollment/confirm)·취소(DELETE /enrollment), 로그인 2차 검증(/verify), 복구 코드 재발급 및 해제.'],
  ['POST', '/api/auth/qr/start · /poll · /cancel · /preview · /decide', '없음 · Bearer JWT', '로그인 QR 세션 발급·폴링·취소 및 인증된 모바일/타 기기에서 미리보기·승인/거절.'],
];

const userEndpoints = [
  ['POST', '/api/users', '없음', '회원가입 호환 별칭. /api/auth/signup과 같은 요청·201 응답을 사용합니다.'],
  ['GET', '/api/users/{nickname}/{tagNumber}', 'Bearer JWT', '닉네임과 태그 번호로 사용자 한 명을 조회합니다.'],
  ['GET', '/api/users/profiles/{nickname}/{tagNumber}', 'Bearer JWT', '공개 프로필 정보 및 프로필 이미지 경로를 조회합니다.'],
  ['PUT · PATCH', '/api/users/{nickname}/{tagNumber}', 'Bearer JWT', '프로필 변경. JSON에서 nickname 및/또는 password를 선택합니다. 이메일과 tag_number는 변경할 수 없고 200 + UserResponse를 반환합니다.'],
  ['PUT · DELETE', '/api/users/me/profile-image', 'Bearer JWT', '본인 프로필 이미지 업로드(multipart) 또는 기본 아바타로 삭제합니다. GET /api/users/profile-images/{userId}로 이미지를 조회합니다.'],
  ['GET', '/api/users/me/activity', 'Bearer JWT', 'C++가 30분 주기로 SQL에 반영하는 본인 캔버스 커밋 편집(생성·수정·삭제) 일별 활동 통계를 조회합니다.'],
  ['DELETE', '/api/users/{nickname}/{tagNumber}', 'Bearer JWT', '본인 또는 관리자만 삭제할 수 있습니다. 사용자가 접속 중이면 409 USER_003; 세션 종료 후 다시 요청합니다. 성공은 204입니다.'],
  ['GET', '/api/users · /api/auth/users', '없음', '사용자 응답 배열(email, nickname, tag_number, role, status, last_login_at, password_changed_at, created_at, updated_at). user_id·password_hash는 공개하지 않습니다.'],
];

const canvasEndpoints = [
  ['POST', '/api/canvases', 'Bearer JWT', '캔버스 생성. JSON { canvasName, description?, visibility?, canvasPassword? } 또는 multipart canvasName·description·visibility·canvasPassword·image(선택, PNG/JPEG 5MiB·가로세로 2048px 이하). 201 + 요약 응답.'],
  ['GET', '/api/canvases · /api/canvases/search?name={name}', 'Bearer JWT', '캔버스 목록·검색. 두 경로 모두 선택 쿼리 name을 받습니다. 이름 생략 시 전체 검색 결과는 최대 1000건입니다.'],
  ['GET', '/api/canvases/{canvasId} · /preview', 'Bearer JWT', '캔버스 요약 및 프리뷰 정보를 조회합니다.'],
  ['POST · GET', '/api/canvases/{canvasId}/image', 'Bearer JWT', '캔버스 대표 이미지 업로드(POST multipart) 및 바이너리 조회(GET). Authorization 헤더가 필요합니다.'],
  ['POST · GET', '/api/canvases/{canvasId}/media · /media/{id}', 'Bearer JWT', '캔버스 미디어 업로드(POST multipart file, 쓰기 권한)와 바이너리 조회(읽기 권한). 이미지 PNG·JPG·WebP·GIF·BMP·AVIF와 동영상 MP4·WebM·OGV의 형식은 파일 헤더로 판별합니다. 캔버스 화면은 파일을 분할 전송합니다. 201 + { url, mediaType: image|gif|video }.'],
  ['POST · GET', '/api/canvases/{canvasId}/pdfs · /pdfs/{id} · /thumbnail', 'Bearer JWT', 'PDF 문서 업로드(POST)와 원본 파일·첫 페이지 썸네일 조회.'],
  ['POST', '/api/link-preview', 'Bearer JWT', '링크 카드 및 허용된 URL의 오픈그래프 메타데이터(제목·설명·썸네일)를 안전하게 조회합니다.'],
  ['GET', '/api/canvases/{canvasId}/settings', 'Bearer JWT', '설정과 참여자 목록·그룹 권한. password_protected, visibility, settings_revision 및 nickname + tag_number 목록을 반환합니다.'],
  ['PATCH', '/api/canvases/{canvasId}/name', 'Bearer JWT', '비활성 캔버스 이름 변경. JSON { canvas_name }; 성공 시 204. 활성 캔버스는 WebSocket 설정 이벤트를 사용합니다.'],
  ['PATCH', '/api/canvases/{canvasId}/description', 'Bearer JWT', '비활성 캔버스 설명 변경. JSON { description }; 성공 시 204.'],
  ['PATCH', '/api/canvases/{canvasId}/password', 'Bearer JWT', '비활성 캔버스 비밀번호 설정·해제. JSON { canvas_password }; 빈 값은 해제, 저장 전 해시화, 성공 시 204.'],
  ['POST · DELETE', '/api/canvases/{canvasId}/people', 'Bearer JWT', '참여자 추가(POST)·제외(DELETE). JSON { nickname, tag_number }; 성공 시 204. 활성 캔버스에는 WebSocket 설정을 사용합니다.'],
  ['POST', '/api/canvases/{canvasId}/access', 'Bearer JWT', '접속 권한 확인. 보호된 캔버스는 JSON { password } 또는 최초 비밀번호 인증 후 4시간 동안 유효한 { canvas_password_token }을 받습니다. 토큰 재사용은 유효 기간을 연장하지 않습니다. { server_id, ws_port, canvas_access_token, canvas_password_token } 반환. 다른 캔버스에 활성 접속 중이면 409 CANVAS_003.'],
  ['DELETE', '/api/canvases/{canvasId}', 'Bearer JWT', '소유자 또는 관리자만 삭제할 수 있습니다. 활성 세션이 있으면 409, 성공은 204입니다.'],
];

const runtimeEndpoints = [
  ['GET · PUT · POST', '/api/canvases/{canvasId}/runtime/settings · /resources · /disk · /reset', 'Bearer JWT', '격리 VM 실행 환경 설정 조회(GET /settings)·변경(PUT /settings), CPU/메모리(PUT /resources)·디스크(PUT /disk) 조정과 초기화(POST /reset). 활성 캔버스는 브로커 WebSocket의 action: "manage" 경로도 함께 사용합니다.'],
  ['POST', '/api/canvases/{canvasId}/runtime/java/dependencies', 'Bearer JWT', '캔버스 실행 VM의 Java/Maven 의존성 동기화 및 사전 설치를 수행합니다.'],
  ['POST', '/api/canvases/{canvasId}/runtime/execute · /execute/stream · /build', 'Bearer JWT', 'API 클라이언트용 코드 실행, NDJSON 스트리밍 실행(/execute/stream), 컴파일 사전 빌드(/build). 캔버스 UI 실행은 WebSocket runtime_execute를 사용합니다.'],
  ['POST', '/api/canvases/{canvasId}/runtime/notebook', 'Bearer JWT', '주피터 노트북 실행 환경 준비(prepare)·초기화(reset) 및 API 셀 실행. UI 셀 실행은 WebSocket action: "notebook"을 사용합니다.'],
  ['POST · WSS', '/api/canvases/{canvasId}/runtime/terminal · /terminal/ticket → /api/terminal/ws', 'Bearer JWT', '일회성 티켓(/terminal/ticket)을 발급받아 /api/terminal/ws WebSocket으로 실시간 PTY 터미널 입출력을 스트리밍합니다.'],
];

const githubEndpoints = [
  ['GET', '/api/canvases/{canvasId}/github', 'Bearer JWT', '현재 캔버스·루트 방의 GitHub 연결 대상(owner/repo/path), 브랜치 목록 및 그룹 작업 권한을 조회합니다.'],
  ['POST', '/api/canvases/{canvasId}/github/bind', '캔버스 관리자', '원본 저장소·경로·기본 브랜치를 캔버스에 연결합니다.'],
  ['POST', '/api/canvases/{canvasId}/github/branches · /initialized', 'Bearer JWT', '브랜치별 전용 캔버스를 생성·조회하거나(/branches) 초기 객체 저장 완료 상태를 기록합니다(/initialized).'],
  ['POST', '/api/canvases/{canvasId}/github/permissions · /authorize', '관리자 · 참여자', '그룹별 GitHub 작업 권한(commit·push·pr·create_branch·switch_branch) 설정 및 실행 전 서버 권한 재검사.'],
];

const iradeWorkspaceEndpoints = [
  ['GET · POST', '/api/irade/workspaces · /{id} · /{id}/preview', 'Bearer JWT', 'IRADE 워크스페이스 검색(쿼리 q, 최대 255자)·단건·프리뷰 조회와 생성(POST JSON { name, description? }, 201). 응답은 { workspaceId, name, description, visibility, imageUrl }입니다.'],
  ['POST', '/api/irade/workspaces/{id}/access', 'Bearer JWT', '워크스페이스 접속 정보 발급. 캔버스 /access와 같은 비밀번호·토큰 규칙과 응답 형식을 사용합니다.'],
  ['GET · PATCH · POST · DELETE', '/api/irade/workspaces/{id}/settings · /name · /description · /people · /image', 'Bearer JWT', '설정·참여자 조회, 이름·설명 변경, 참여자 추가·제외, 대표 이미지 업로드·조회. 캔버스 관리 API와 같은 권한 규칙을 따릅니다.'],
  ['DELETE', '/api/irade/workspaces/{id}', 'Bearer JWT', '워크스페이스를 삭제합니다. 소유자 또는 관리자만 가능합니다.'],
];

const internalEndpoints = [
  ['GET · POST · PUT · DELETE', '/api/servers · /api/servers/{serverId}', 'ROLE_ADMIN', 'C++ 실시간 서버 등록·수정·목록 조회·삭제를 관리합니다.'],
  ['GET · POST', '/api/load-balancer/allocate/server · /redis', 'ROLE_ADMIN', '활성 heartbeat·부하를 기준으로 C++ 서버 또는 Redis 인스턴스를 할당합니다.'],
  ['GET · POST', '/api/load-balancer/database · /allocate/database · /api/database/address', 'ROLE_ADMIN', 'DB 접속 주소 정보를 반환합니다.'],
  ['POST', '/internal/canvas/socket · /internal/broker/workspace-broadcast · /internal/search/embedding', '내부 토큰', 'Wall Nginx 게이트웨이·Phoenix 브로커·임베딩 서비스가 사용하는 내부 전용 HTTP 경로입니다(외부 404 차단).'],
  ['GET', '/api/test/cpp-canvas-count · /api/test/cpp-active-canvases', 'ADMIN · 로그인', 'SQL user_sessions의 활성 세션 수를 조회합니다. C++ REST 프록시가 아닙니다.'],
  ['GET', 'C++ :8000/health · /api/canvas/count · /api/canvas/active', '내부 네트워크', 'C++ REST 프로세스 상태와 활성 캔버스 운영 현황을 확인합니다.'],
  ['POST · DELETE', 'C++ :8000/api/users/{userId}/disconnect · /api/canvas/{canvasId}', '내부 네트워크', '서비스 내부 세션 종료 제어 및 캔버스 언로드 제어입니다.'],
];

const publicApiGroups = [
  { id: 'api-auth', title: '인증 · 소셜 OAuth · ORCID', rows: authEndpoints },
  { id: 'api-email', title: '이메일 인증', rows: [
    ['GET', '/api/auth/email/status', '없음', '인증 메일 발송 설정 여부. { available }.'],
    ['POST', '/api/auth/email/request', '없음', 'JSON { email }. 6자리 코드 발송 요청. 202 + challengeId, expiresInSeconds, resendAfterSeconds.'],
    ['POST', '/api/auth/email/verify', '없음', 'JSON { email, challengeId, code }. 성공 시 회원가입용 emailVerificationToken을 반환합니다. 로그인 토큰이 아닙니다.'],
  ] },
  { id: 'api-passkeys-mfa', title: '패스키 · MFA · QR 로그인', rows: securityAuthEndpoints },
  { id: 'api-users', title: '사용자 · 프로필 · 활동 통계', rows: userEndpoints },
  { id: 'api-canvases', title: '캔버스 · 미디어 · PDF · 링크 미리보기', rows: canvasEndpoints },
  { id: 'api-runtime', title: '실행 환경 · 터미널 · 노트북', rows: runtimeEndpoints },
  { id: 'api-github', title: 'GitHub 브랜치 연동', rows: githubEndpoints },
  { id: 'api-irade', title: 'IRADE 워크스페이스', rows: iradeWorkspaceEndpoints },
  { id: 'api-bots', title: '봇 참여자', rows: botEndpoints },
];

const internalApiGroups = [
  { id: 'api-infra', title: '서버 · 저장소 · 내부 라우팅', rows: internalEndpoints.slice(0, 4) },
  { id: 'api-debug', title: '진단 API', rows: internalEndpoints.slice(4, 6) },
  { id: 'api-cpp', title: 'C++ 내부 제어 API', rows: internalEndpoints.slice(6) },
];


const sqlTables = [
  ['users', 'user_id · INT IDENTITY PK', 'email NVARCHAR(255) NOT NULL; password_hash NVARCHAR(255) NULL; nickname NVARCHAR(100) NOT NULL; tag_number INT NOT NULL DEFAULT 0; role NVARCHAR(20) NOT NULL DEFAULT ROLE_USER; status NVARCHAR(20) NOT NULL DEFAULT ACTIVE; oauth_provider NVARCHAR(50) NULL; oauth_id NVARCHAR(255) NULL; orcid NVARCHAR(32) NULL; password_changed_at DATETIME2 NULL; created_at/updated_at DATETIME2 NOT NULL', '사용자 계정·프로필. email과 (nickname, tag_number)는 고유하며 OAuth2/ORCID 연동을 지원합니다.'],
  ['user_sessions', 'user_id · INT PK/FK', 'user_id → users.user_id; cpp_server_id INT NULL; canvas_id INT NULL; is_accessed BIT NOT NULL DEFAULT 0; last_login_at/updated_at DATETIME2', '사용자별 현재 접속 상태. (canvas_id, is_accessed)와 cpp_server_id 인덱스를 가집니다.'],
  ['canvas_info · workspace_info', 'canvas_id · INT IDENTITY PK', 'redis_id INT NULL → redis_server; cpp_server_id INT NULL → cpp_server; is_cached BIT NOT NULL DEFAULT 0; created_at/updated_at DATETIME2', '캔버스(및 워크스페이스)의 Redis/C++ 서버 배정과 캐시 상태를 관리합니다.'],
  ['cpp_server · redis_server', 'server_id · redis_id PK', 'ip/port/ws_port VARCHAR NOT NULL; is_activated BIT NOT NULL DEFAULT 0; last_heartbeat_at DATETIME2', '활성 C++ 실시간 서버와 Redis Stack 서버 등록·상태를 관리합니다.'],
  ['user_mfa · auth_mfa_challenges', 'user_id · challenge_id PK', 'secret_encrypted; recovery_codes_hash; challenge_token_hash; expires_at DATETIME2', 'TOTP 2단계 인증 활성 정보와 일회성 로그인 챌린지 상태를 저장합니다.'],
  ['user_passkeys · auth_passkey_challenges', 'credential_id · challenge_id PK', 'user_id → users; public_key_cose VARBINARY; sign_count BIGINT; challenge_hash', 'WebAuthn FIDO2 패스키 공개키 자격 증명과 등록·로그인 챌린지를 저장합니다.'],
  ['auth_email_verification · auth_qr_logins · auth_orcid_attempts', 'challenge_id / request_id PK', 'email/code_hash; request_id/secret_hash/status; browser_state_hash; expires_at', '이메일 인증 코드 챌린지, 크로스 디바이스 QR 승인 상태, ORCID 인증 세션을 관리합니다.'],
  ['user_canvas_activity', '(user_id, activity_date) PK', 'created_count, updated_count, deleted_count, canvas_ids JSON; updated_at', 'C++ 서버가 30분 주기 및 언로드 시 반영하는 일별 커밋 편집 통계를 저장합니다.'],
  ['auth_sessions', 'id · VARCHAR(36) PK', 'user_id → users; refresh_hash VARCHAR(64) UNIQUE; previous_hash; rotated_at; client_ip; mfa_version; created_at/expires_at/revoked_at DATETIME2', '서버 측 로그인 세션입니다. access token의 sid와 연결되며 refresh 쿠키 회전, 재사용 탐지, 로그아웃·전체 로그아웃 폐기를 관리합니다.'],
  ['canvas_runtime_cleanup', 'canvas_id PK', 'pending_delete BIT; retry_count INT; last_error NVARCHAR; updated_at', '삭제된 캔버스의 VM 디스크·실행 자원을 비동기 정리하기 위한 추적 테이블입니다.'],
];

const canvasDocumentFields = [
  ['canvas-id · canvas-name', '캔버스 문서 ID와 검색·표시용 이름'],
  ['admin-user-id · people', '소유 관리자 및 참여자 내부 user_id 목록'],
  ['description · init-group · visibility', '캔버스 설명, 새 참여자 초기 그룹 및 공개 범위(private/public)'],
  ['canvas-password-hash · password-revision', '접속 비밀번호 해시 및 비밀번호 변경 이력 버전. API 응답에 포함하지 않음'],
  ['inner-group', '그룹 이름을 내부 user_id 배열에 매핑'],
  ['settings-revision', '설정 변경 낙관적 동시성 revision. 설정 토큰·CAS에서 사용'],
  ['items-b64 · agent-sessions', 'items JSON 청크 직렬화 및 AI 에이전트 대화 세션 이력'],
];

const redisDocumentFields = [
  ['canvas:{canvasId}', 'RedisJSON root', 'Canvas의 활성 작업 문서. C++가 Redis를 우선 로드하고, cache unload/save 때 ES 문서와 동기화'],
  ['$.canvas-id · $.canvas-name', 'integer · string', 'Canvas 식별자와 표시 이름'],
  ['$.description · $.init-group · $.visibility', 'string', 'Canvas 설명, 초기 접근 그룹 및 공개 설정'],
  ['$.canvas-password-hash', 'string · null', '접속 비밀번호 해시. 평문 저장·응답 금지'],
  ['$.admin-user-id · $.people', 'integer · integer[]', '관리자·참여자 참조. 내부 식별자이므로 브라우저 응답에 그대로 노출하지 않음'],
  ['$.inner-group', 'object<string, integer[]>', '그룹별 내부 사용자 ID 목록'],
  ['$.settings-revision · $.password-revision', 'integer', '설정·비밀번호 변경용 revision. Redis CAS로 경합을 감지'],
  ['$.items[<itemId>]', 'object', '개별 아이템과 permission ACL. 텍스트/코드는 Ctrl+S 저장본, 포스트잇은 자동 저장본 보관'],
  ['$.items[<roomId>].data · $.next_sequence', 'array · integer', 'chat_room 및 object-comment 메시지 내역과 원자적 증가 순번'],
  ['$.agent-sessions', 'object', '캔버스별 AI 에이전트 세션 메타데이터 및 대화 이력 (개인 API 키 제외)'],
];

const socketEvents = [
  ['Canvas 연결 직후', '서버 → 클라이언트', 'init_items', '권한 필터링된 아이템·그룹·권한 목록, sync_protocol/revision, rtc_canvas_connection_id와 64자리 rtc_canvas_connection_hash를 반환합니다.'],
  ['RTC 신호 연결·참여', '서버 ↔ 클라이언트', 'rtc_ready · { type: "rtc_join", canvas_connection_id, canvas_connection_hash }', 'RTC 소켓에서 rtc_ready를 받은 뒤 init_items의 ID와 해시를 함께 전송해 연결을 바인딩합니다.'],
  ['RTC 피어 · 음성 채널·화면공유 알림', '서버 ↔ 클라이언트 · RTC 소켓', 'rtc_peers · voice_state { active, muted, screen_sharing?, channel? } · voice_notice · rtc_media_config', '참여자·음소거·화면공유 상태와 voice_channel(기본 "general")을 동기화합니다. voice_notice와 rtc_signal은 같은 음성 채널 참여자에게만 전달되며, rtc_media_config로 TURN 중계 자격 증명을 갱신합니다.'],
  ['캔버스 채널 객체', '클라이언트 ↔ 브로커 · Canvas 소켓', 'canvas_ops: { kind: "channel", channelType: "text"|"voice"|"category", name, order, categoryId }', '텍스트·음성 채널과 카테고리를 일반 객체처럼 생성·정렬합니다. 텍스트 채널 메시지는 해당 객체의 댓글 방에 저장되어 객체 삭제 시 함께 삭제되고, 음성 채널 입장은 읽기 권한이 있는 voice 채널 객체에서만 허용됩니다.'],
  ['캔버스 연산 커밋·복구', '클라이언트 ↔ 브로커 · Canvas 소켓', '{ type: "canvas_ops", client_id, request_count, operations } → canvas_commit · canvas_watermark', '브로커 큐가 직렬 저장·재시도·중복 요청 병합을 처리해 확정 변경(canvas_commit)과 재동기화 기준(canvas_watermark)을 전달합니다.'],
  ['채팅 · 객체 댓글 · 멘션 알림', '양방향 · Canvas 소켓', 'chat · chat_history(object_id?) · mentions_get · mention_read · mentions_changed', '일반 채팅과 객체 댓글 스레드를 동일 내구성 경로로 처리하고, 멘션 발생·읽음 시 서버 소유 미읽음 알림 목록을 동기화합니다.'],
  ['항목 생성·저장·삭제', '클라이언트 → 서버 · Canvas 소켓', 'item_update · item_save · item_delete', '일반 객체(item_update)와 텍스트·포스트잇·코드 CRDT 이력(item_save, 최대 12 MiB) 및 삭제를 ACL 검사 후 저장·브로드캐스트합니다.'],
  ['코드·노트북·VM 관리·AI 실행', '클라이언트 ↔ 브로커 ↔ C++ · Canvas 소켓', '{ type: "runtime_execute", action: "execute"|"build"|"notebook"|"manage"|"agent", ... }', '일반 실행·사전 빌드·주피터 셀·VM 설정(manage)·AI 에이전트(agent)를 권한 검증 후 비동기로 처리해 runtime_output·runtime_result·agent_sessions_changed로 응답합니다.'],
  ['AI 에이전트', '클라이언트 ↔ 브로커 ↔ C++ · Canvas 소켓', '{ type: "runtime_execute", action: "agent", operation: "run"|"status"|"sessions"|"session_get"|"session_delete", options?: { engine: "api", reasoning_effort, max_tokens, max_steps, temperature, top_p } }', '에이전트 이용약관에 동의한 캔버스 참여자의 요청을 서버의 로컬 모델에서 실행합니다.'],
  ['VM 작업 공간 파일', '클라이언트 ↔ 브로커 ↔ C++ · Canvas 소켓', '{ type: "workspace_files", request_id, operation: "stat"|"list"|"read"|"write"|"mkdir"|"rename"|"delete", path } → workspace_files_result · workspace_files_changed', 'VM /workspace 파일을 조회(읽기 권한)·변경(쓰기 권한)합니다. 파일 내용과 Automerge 문서는 각각 128 KiB 이하이며, 성공한 변경만 파일 내용 없이 workspace_files_changed로 방송합니다.'],
  ['실시간 커서·레이저·드로잉', '클라이언트 ↔ 브로커 ↔ 사용자', 'canvas_relay: cursor · laser · editor_presence · host_proposal · host_commit', '브로커가 인증된 같은 캔버스의 사용자에게 커서·레이저·편집 상태 및 호스트 드로잉 확정 프레임을 전달합니다.'],
  ['WebRTC P2P 통화 신호', '클라이언트 ↔ 브로커 ↔ 대상 피어 · RTC 소켓', '{ type: "rtc_signal", peer_id, action, description|candidate }', '인증된 같은 캔버스의 지정 피어 소켓에만 SDP/ICE(최대 256 KiB)를 전달하며 서버에 저장하지 않습니다.'],
  ['터미널 WebSocket 스트림', '브라우저 ↔ Spring ↔ VM · /api/terminal/ws', '{ type: "attach", ticket, cols, rows, offset } · input · resize · output', 'POST /runtime/terminal/ticket으로 발급한 일회성 IP 바인딩 티켓으로 연결해 격리 PTY 셸 입출력을 실시간 스트리밍합니다.'],
  ['실시간 캔버스 설정·권한 변경', '클라이언트 ↔ 서버', 'canvas_settings_get/update → canvas_settings_changed · canvas_access_changed · canvas_access_revoked', '설정 변경을 적용하며 ACL이 바뀌면 소켓별 권한 스냅샷을 갱신하고 접근이 회수된 세션은 즉시 종료합니다.'],
];

const projectTree = [
  'project-agora-FE/',
  '├─ src/',
  '│  ├─ App.jsx                 # 라우팅 · 인증 보호 · /terms · /privacy',
  '│  ├─ pages/                  # 홈(모션 쇼케이스) · 약관 · 인증 · 검색 · 프로필 · 문서 · 캔버스',
  '│  ├─ legal/                  # 이용약관 · 개인정보 저장/처리방침 데이터 및 스타일',
  '│  ├─ api/client.js           # REST 요청 · 브로커/WebSocket 주소 생성',
  '│  ├─ state/AuthContext.jsx   # JWT · OAuth · Passkey · MFA 인증 상태',
  '│  ├─ canvas/                 # 에디터 · 블루프린트 · 노트북 · 터미널 · GitHub · 음성·AI 패널',
  '│  └─ components/             # Rust·wgpu VectorLayer · MathJax · 공간 B-tree · 챗·멘션',
  '└─ vite.config.js             # 개발 프록시 · 로컬 MathJax · PDF.js 에셋',
  '',
  'project-agora-Wall/',
  '├─ nginx/                     # HTTPS · SPA 서빙 · /api · /wss · /internal 게이트웨이',
  '├─ broker/                    # Elixir/Phoenix 실시간 협업 · 멘션 · 통화 브로커',
  '├─ storage-broker/            # HAProxy 기반 Redis/Elasticsearch 라우팅',
  '└─ BROKER_PROTOCOL.md         # Phoenix ↔ C++ 지속 WSS · 멘션 · 통화 프로토콜',
  '',
  'project-agora-BE/',
  '├─ spring/                    # REST · JWT · OAuth/Passkey/MFA/QR · 캔버스/GitHub 제어',
  '├─ cpp/                       # 내부 REST · 실시간 상태·실행 조정 서버',
  '├─ agent/                     # 캔버스 AI 에이전트 서비스',
  '├─ sdk/python/                # Python SDK · examples · tests',
  '└─ API_SPEC.md                # 백엔드 REST · WebSocket 상세 명세',
  '',
  'project-agora-DB/',
  '├─ mssql/init-mssql.sql       # SQL Server 스키마 생성·반복 이관 DDL',
  '├─ redis/                     # Redis Stack · RedisJSON 초기화',
  '└─ elasticsearch/             # Canvas 인덱스 · 문서 저장소 초기화',
];

function EndpointTable({ rows, internal = false }) {
  useUiLocale();

  return <div className="docs-table-scroll"><table className="docs-api-table"><thead><tr><th>{ui('메서드')}</th><th>{ui('경로')}</th><th>{internal ? ui('접근') : ui('인증')}</th><th>{ui('동작 / 데이터')}</th></tr></thead><tbody>{rows.map(([method, path, auth, description]) => <tr id={endpointAnchorId(method, path)} key={`${method}-${path}`}><td><span className={`http-method method-${method.split(' ')[0].toLowerCase()}`}>{method}</span></td><td><code>{path}</code></td><td><span className="api-auth-badge">{ui(auth)}</span></td><td>{ui(description)}</td></tr>)}</tbody></table></div>;
}

function endpointAnchorId(method, path) {
  const slug = `${method}-${path}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `endpoint-${slug}`;
}

function endpointNavLabel(path) {
  return path.replace(/\?.*$/, '').replaceAll(' · ', ' / ');
}

function socketEventId(index) {
  return `socket-event-${index + 1}`;
}

function schemaRowId(prefix, value) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `schema-${prefix}-${slug}`;
}

function SectionTitle({ id, eyebrow, title, children }) {
  useUiLocale();

  return <div className="docs-section-title" id={id}><span className="section-kicker">{eyebrow}</span><h2>{title}</h2>{children && <p>{children}</p>}</div>;
}

function DocsNavLink({ id, children, kind, activeSection, onSelect }) {
  useUiLocale();

  return <a className={`docs-nav-link${activeSection === id ? ' active' : ''}`} href={`#${id}`} aria-current={activeSection === id ? 'location' : undefined} onClick={() => onSelect(id)}>
    <span title={typeof children === 'string' ? children : undefined}>{children}</span>{kind && <small>{kind}</small>}
  </a>;
}

function DocsNavFolder({ title, children, nested = false }) {
  useUiLocale();

  return <details className={`docs-nav-folder${nested ? ' nested' : ''}`} open>
    <summary>{title}</summary>
    <div className="docs-nav-folder-content">{children}</div>
  </details>;
}

export default function DocsPage() {
  useUiLocale();
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    const endpointIds = [...publicApiGroups, ...internalApiGroups].flatMap((group) => group.rows.map(([method, path]) => endpointAnchorId(method, path)));
    const groupIds = [...publicApiGroups, ...internalApiGroups].map((group) => group.id);
    const socketIds = socketEvents.map((_, index) => socketEventId(index));
    const schemaIds = [
      ...sqlTables.map(([table]) => schemaRowId('sql', table)),
      ...canvasDocumentFields.map(([field]) => schemaRowId('es', field)),
      ...redisDocumentFields.map(([path]) => schemaRowId('redis', path)),
    ];
    const ids = ['overview', 'structure', ...canvasObjectSections.map(([id]) => id), 'public-api', ...groupIds, 'internal-api', 'websocket', 'webrtc-signaling', 'database', 'db-sql', 'db-es', 'db-redis', 'rules', ...sdkSections.map(([id]) => id), ...endpointIds, ...socketIds, ...schemaIds];
    const targets = ids.map((id) => document.getElementById(id)).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const current = entries.filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (current) setActiveSection(current.target.id);
    }, { rootMargin: '-14% 0px -72% 0px', threshold: 0 });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return <main className="docs-page">
    <header className="docs-header page-container"><FreLogBrand /><LanguageSwitcher /><nav><a href="#structure">{ui('프로젝트 구조')}</a><a href="#canvas-objects">{ui('객체 가이드')}</a><a href="#public-api">{ui('외부 API')}</a><a href="#internal-api">{ui('내부 API')}</a><a href="#database">{ui('DB 명세')}</a></nav><Link className="button button-outline docs-workspace-link" to="/search">{ui('워크스페이스')} <Icon name="arrow" size={15} /></Link></header>
    <div className="docs-layout page-container">
      <aside className="docs-toc" aria-label={ui('문서 목차')}>
        <div className="docs-toc-heading"><span>FRELOG DOCS</span><small>REFERENCE / DIRECTORY</small></div>
        <DocsNavLink id="overview" activeSection={activeSection} onSelect={setActiveSection}>{ui('개요')}</DocsNavLink>
        <DocsNavFolder title={ui('프로젝트')}>
          <DocsNavLink id="structure" activeSection={activeSection} onSelect={setActiveSection}>{ui('구조와 역할')}</DocsNavLink>
        </DocsNavFolder>
        <DocsNavFolder title={ui('캔버스 객체 가이드')}>
          {canvasObjectSections.map(([id, title]) => <DocsNavLink key={id} id={id} kind="GUIDE" activeSection={activeSection} onSelect={setActiveSection}>{ui(title)}</DocsNavLink>)}
        </DocsNavFolder>
        <DocsNavFolder title={ui('API 레퍼런스')}>
          <DocsNavFolder title={ui('외부 공개 REST')} nested>
            <DocsNavLink id="public-api" kind="REST" activeSection={activeSection} onSelect={setActiveSection}>{ui('API 개요·인증')}</DocsNavLink>
            {publicApiGroups.map((group) => <DocsNavFolder key={group.id} title={ui(group.title)} nested>
              {group.rows.map(([method, path]) => <DocsNavLink key={`${method}-${path}`} id={endpointAnchorId(method, path)} kind={method.split(' ')[0]} activeSection={activeSection} onSelect={setActiveSection}>{endpointNavLabel(path)}</DocsNavLink>)}
            </DocsNavFolder>)}
          </DocsNavFolder>
          <DocsNavFolder title={ui('내부·운영 API')} nested>
            <DocsNavLink id="internal-api" kind="PRIVATE" activeSection={activeSection} onSelect={setActiveSection}>{ui('내부 API 경계')}</DocsNavLink>
            {internalApiGroups.map((group) => <DocsNavFolder key={group.id} title={ui(group.title)} nested>
              {group.rows.map(([method, path]) => <DocsNavLink key={`${method}-${path}`} id={endpointAnchorId(method, path)} kind={method.split(' ')[0]} activeSection={activeSection} onSelect={setActiveSection}>{endpointNavLabel(path)}</DocsNavLink>)}
            </DocsNavFolder>)}
          </DocsNavFolder>
          <DocsNavFolder title={ui('실시간 통신')} nested>
            <DocsNavFolder title="Canvas & Terminal WSS" nested>
              <DocsNavLink id="websocket" kind="WS" activeSection={activeSection} onSelect={setActiveSection}>{ui('연결·프로토콜 개요')}</DocsNavLink>
              {socketEvents.map(([name], index) => <DocsNavLink key={name} id={socketEventId(index)} kind="EVENT" activeSection={activeSection} onSelect={setActiveSection}>{ui(name)}</DocsNavLink>)}
            </DocsNavFolder>
            <DocsNavLink id="webrtc-signaling" kind="P2P" activeSection={activeSection} onSelect={setActiveSection}>WebRTC · P2P</DocsNavLink>
          </DocsNavFolder>
        </DocsNavFolder>
        <DocsNavFolder title="Python SDK">
          {sdkSections.map(([id, title]) => <DocsNavLink key={id} id={id} kind="SDK" activeSection={activeSection} onSelect={setActiveSection}>{ui(title)}</DocsNavLink>)}
        </DocsNavFolder>
        <DocsNavFolder title={ui('데이터 레퍼런스')}>
          <DocsNavLink id="database" activeSection={activeSection} onSelect={setActiveSection}>{ui('저장소 구성')}</DocsNavLink>
          <DocsNavFolder title="SQL Server" nested>
            <DocsNavLink id="db-sql" kind="SQL" activeSection={activeSection} onSelect={setActiveSection}>{ui('테이블 개요')}</DocsNavLink>
            {sqlTables.map(([table]) => <DocsNavLink key={table} id={schemaRowId('sql', table)} kind="TABLE" activeSection={activeSection} onSelect={setActiveSection}>{table}</DocsNavLink>)}
          </DocsNavFolder>
          <DocsNavFolder title="Elasticsearch" nested>
            <DocsNavLink id="db-es" kind="INDEX" activeSection={activeSection} onSelect={setActiveSection}>canvas index</DocsNavLink>
            {canvasDocumentFields.map(([field]) => <DocsNavLink key={field} id={schemaRowId('es', field)} kind="FIELD" activeSection={activeSection} onSelect={setActiveSection}>{field}</DocsNavLink>)}
          </DocsNavFolder>
          <DocsNavFolder title="Redis Stack" nested>
            <DocsNavLink id="db-redis" kind="KEY" activeSection={activeSection} onSelect={setActiveSection}>canvas:{'{canvasId}'}</DocsNavLink>
            {redisDocumentFields.map(([path]) => <DocsNavLink key={path} id={schemaRowId('redis', path)} kind="PATH" activeSection={activeSection} onSelect={setActiveSection}>{path}</DocsNavLink>)}
          </DocsNavFolder>
        </DocsNavFolder>
        <DocsNavLink id="rules" activeSection={activeSection} onSelect={setActiveSection}>{ui('보안·공통 규칙')}</DocsNavLink>
      </aside>
      <article className="docs-content">
        <section className="docs-hero" id="overview"><span className="docs-hero-icon"><Icon name="book" size={22} /></span><span className="section-kicker">FRELOG / TECHNICAL DOCS</span><h1>{ui('구조와 API를')}<br /><em>{ui('한눈에 살펴보세요.')}</em></h1><p>{ui('FreLog는 캔버스 위에서 그림, 이미지·PDF, 코드·노트북·터미널 실행, 음성 통화와 AI 에이전트 협업을 실시간으로 나누는 워크스페이스입니다. 이 문서는 현재 저장소 구성을 기준으로 정리했습니다.')}</p><div className="docs-hero-meta"><span><i /> React · Vite</span><span><i /> Wall Nginx · Phoenix</span><span><i /> Spring Boot · C++ · Agent</span></div></section>
        <section className="docs-section"><SectionTitle id="structure" eyebrow="01 / PROJECT MAP" title={ui('프로젝트 구조와 역할')} />
          <div className="docs-architecture"><div><span>Browser</span><strong>React · Vite</strong><small>{ui('캔버스 · 인증 UI · WebRTC')}</small></div><b>HTTPS / WSS</b><div><span>Wall Gateway</span><strong>Nginx · Phoenix</strong><small>{ui('정적 서빙 · 브로커 실시간 중계')}</small></div><b>internal</b><div><span>Backend</span><strong>Spring · C++ · Agent</strong><small>{ui('인증·권한 · 영속 저장 · VM/AI')}</small></div></div>
          <pre className="docs-tree"><code>{projectTree.map((line) => ui(line)).join('\n')}</code></pre>
          <div className="docs-role-grid"><div><span>FRONTEND</span><h3>{ui('한 화면에서 함께 만들기')}</h3><p>{ui('PixiJS와 공간 B-tree로 대용량 벡터와 객체를 최적화 렌더링하며, 커서·레이저·멘션·Automerge 편집은 Phoenix 브로커로 동기화하고, 텍스트·코드는 Ctrl + S, 포스트잇은 자동 저장합니다.')}</p></div><div><span>WALL · BROKER</span><h3>{ui('게이트웨이와 실시간 중계')}</h3><p>{ui('project-agora-Wall의 Nginx가 HTTPS/WSS 관문과 정적 배포를 담당하고, Elixir/Phoenix 브로커가 직렬 커밋(canvas_ops), 멘션, 통화 상태·알림 및 VM 실행 이벤트를 중계합니다.')}</p></div><div><span>BACKEND · AGENT</span><h3>{ui('인증·권한과 실행·AI 조정')}</h3><p>{ui('Spring Boot가 계정(OAuth·Passkey·MFA·QR)·권한·미디어·GitHub·터미널 티켓을 관리하고, C++ 서버와 AI 에이전트가 영속 저장·코드 실행·AI 세션을 담당합니다.')}</p></div></div>
        </section>
        <CanvasObjectsDocs />
        <section className="docs-section" id="public-api"><SectionTitle eyebrow="02 / CLIENT API" title={ui('외부에 공개된 API')}>{ui('브라우저에서 사용하는 HTTPS API입니다. 보호된 API에는 access token을 Bearer 헤더로 전달합니다.')}</SectionTitle><div className="docs-callout"><Icon name="lock" size={18} /><p><strong>{ui('인증 헤더')}</strong><code>Authorization: Bearer &lt;accessToken&gt;</code> · <code>POST /api/auth/me</code>{` ${ui('는 본문에')} `}<code>{'{ token }'}</code>{ui('을 받습니다. 사용자 목록 조회는 비인증 경로입니다. 캔버스 접속 토큰은 로그인 JWT와 별개이며 WebSocket에만 사용합니다.')}</p></div><div className="docs-api-groups">{publicApiGroups.map((group, index) => <section className="docs-api-group" id={group.id} key={group.id}><div className="docs-subsection-heading"><span>REST / {String(index + 1).padStart(2, '0')}</span><h3>{ui(group.title)}</h3></div><EndpointTable rows={group.rows} /></section>)}</div><div className="docs-note"><strong>{ui('UserResponse 참고')}</strong><p><code>last_login_at</code>{` ${ui('은 로그인 시각이')} `}<code>user_sessions</code>{` ${ui('로 이동해 현재 응답에서')} `}<code>null</code>{` ${ui('입니다. 비밀번호 변경 시각은 호환성을 위해')} `}<code>password_chaged_at</code>{` ${ui('표기와')} `}<code>password_changed_at</code>{` ${ui('필드를 함께 반환합니다.')}`}</p></div><div className="docs-note"><strong>{ui('이미지 · 미디어 · PDF 응답 참고')}</strong><p>{ui('캔버스 대표 이미지, 업로드 미디어, PDF 문서는 모두 Bearer JWT 인증이 필요합니다. 브라우저의 일반')} <code>&lt;img&gt;</code> {ui('요청에는 인증 헤더를 실을 수 없으므로 앱이 토큰을 포함해 가져와 렌더링합니다.')}</p></div><div className="docs-payload-card"><div><span className="section-kicker">CANVAS ACCESS FLOW</span><h3>{ui('캔버스 접속 순서')}</h3><p>{ui('REST에서 로그인·비밀번호를 확인한 다음, 전용 접속 토큰으로 두 WebSocket을 엽니다. 참여 여부는 WebSocket에서 다시 확인합니다.')}</p></div><pre><code>{'POST /api/canvases/42/access\nAuthorization: Bearer <accessToken>\n\n{ "password": "optional" }\n→ { "server_id": 5, "ws_port": "8002",\n    "canvas_access_token": "<canvas-jwt>" }\n\nWSS /wss/port/8002/canvas/42?token=<canvas_access_token>\nWSS /wss/port/8002/rtc/canvas/42?token=<canvas_access_token>'}</code></pre></div><div className="docs-note"><strong>{ui('캔버스 설정 변경')}</strong><p>{ui('비활성 캔버스는 REST PATCH로 변경합니다. 활성 캔버스의 REST 변경은 409 CANVAS_006으로 거절되므로 WebSocket 설정 이벤트를 사용합니다. 다른 캔버스에 활성 접속 중이면 /access가 409 CANVAS_003을 반환합니다.')}</p></div></section>
        <PythonSdkDocs />
        <section className="docs-section" id="internal-api"><SectionTitle eyebrow="03 / PRIVATE OPERATIONS" title={ui('내부·운영 전용 API')}>{ui('운영 상태와 서버 제어용 경로입니다. 관리자 전용 Spring API와 내부 C++·브로커 경로를 지정된 인증 범위에 맞춰 사용하세요.')}</SectionTitle><div className="docs-callout warning"><Icon name="lock" size={18} /><p><strong>{ui('접근 범위')}</strong> {ui('서버·저장소 할당과 DB 주소,')} <code>/api/test/cpp-canvas-count</code>{ui('는 ROLE_ADMIN이 필요합니다.')} <code>/api/test/cpp-active-canvases</code>{ui('만 로그인 사용자에게 허용됩니다.')} <code>/internal/*</code> {ui('및 C++ REST(:8000)는 Wall Nginx에서 외부 공개를 차단하며 내부 서비스 간 통신에만 사용합니다.')}</p></div><div className="docs-api-groups">{internalApiGroups.map((group, index) => <section className="docs-api-group" id={group.id} key={group.id}><div className="docs-subsection-heading"><span>PRIVATE / {String(index + 1).padStart(2, '0')}</span><h3>{ui(group.title)}</h3></div><EndpointTable rows={group.rows} internal /></section>)}</div><div className="docs-note"><strong>{ui('네트워크 경계')}</strong><p>{ui('브라우저용 WebSocket은 Wall Nginx의')} <code>/wss/port/:wsPort/canvas/:canvasId</code>, <code>/wss/port/:wsPort/rtc/canvas/:canvasId</code> {ui('및')} <code>/api/terminal/ws</code>{ui('를 사용합니다. 내부 REST 제어 API, DB·Redis 포트는 외부에 직접 열지 않습니다.')}</p></div></section>
        <section className="docs-section" id="websocket">
          <SectionTitle eyebrow="04 / REALTIME PROTOCOL" title={ui('캔버스·RTC·터미널 WebSocket 명세')}>{ui('Spring 접속 API가 발급한 캔버스 전용 토큰으로 브로커(Canvas·RTC) WebSocket을 연결하고, 터미널 객체는 일회성 티켓으로 /api/terminal/ws에 연결합니다.')}</SectionTitle>
          <div className="docs-endpoint-line"><span>WSS</span><code>/wss/port/:wsPort/canvas/:canvasId?token=:canvasAccessToken</code><small>{ui('캔버스 이벤트 · 브로커 경유')}</small></div>
          <div className="docs-endpoint-line"><span>WSS</span><code>/wss/port/:wsPort/rtc/canvas/:canvasId?token=:canvasAccessToken</code><small>{ui('통화 상태·RTC 신호 · 브로커 경유')}</small></div>
          <div className="docs-endpoint-line"><span>WSS</span><code>/api/terminal/ws</code><small>{ui('터미널 PTY 스트림 · 티켓 attach 프레임 인증')}</small></div>
          <div className="docs-table-scroll"><table className="docs-api-table socket-table"><thead><tr><th>{ui('이벤트')}</th><th>{ui('방향')}</th><th>{ui('페이로드 / 동작')}</th></tr></thead><tbody>{socketEvents.map(([name, direction, payload, description], index) => <tr id={socketEventId(index)} key={name}><td><strong>{ui(name)}</strong></td><td>{ui(direction)}</td><td><code>{payload}</code><br />{ui(description)}</td></tr>)}</tbody></table></div>
          <div className="docs-note"><strong>{ui('아이템 권한과 채팅·멘션 ACL')}</strong><p>{ui('초기 아이템과 실시간 이벤트는 아이템의')} <code>permission</code> {ui('그룹으로 필터링합니다. 객체 댓글은')} <code>chat</code>·<code>chat_history</code>{ui('에')} <code>object_id</code>{ui('를 전달해 객체 ACL을 검증하고, 멘션 알림은 서버가 소유·집계합니다.')}</p></div>
          <div className="docs-note" id="webrtc-signaling"><strong>{ui('브로커 연결과 통화 신호')}</strong><p>{ui('협업 RTC 소켓은')} <code>rtc_join</code>{ui('으로 Canvas 소켓의 연결 ID와 해시를 증명해야 합니다. 브로커는 인증된 같은 캔버스의 사용자에게만')} <code>canvas_relay</code> · <code>voice_notice</code>{ui('를 전달합니다. 협업 WebSocket은 프레임 최대 16 MiB(초당 240건),')} <code>rtc_signal</code>{ui('의 SDP/ICE는 최대 256 KiB를 허용합니다.')}</p></div>
          <div className="docs-role-grid docs-safety-grid"><div><span>IDENTITY</span><h3>{ui('공개 식별자는 닉네임 + 태그')}</h3><p>{ui('채팅·멘션·RTC 피어 이벤트에는 공개 닉네임과 태그 번호, 임시 peer 토큰을 사용하며 내부 user_id를 클라이언트에 노출하지 않습니다.')}</p></div><div><span>AI · RUNTIME</span><h3>{ui('캔버스 내 실행과 AI 세션')}</h3><p>{ui('코드·노트북·VM 제어와 AI 에이전트 작업은 모두 WebSocket runtime_execute로 권한을 검증한 뒤 실행하며, 개인 AI API 키는 영구 저장하지 않습니다.')}</p></div></div>
        </section>
        <section className="docs-section" id="database">
          <SectionTitle eyebrow="05 / DATA REFERENCE" title={ui('데이터베이스 명세')}>{ui('계정·인증·세션·활동 통계는 SQL Server, 영구 캔버스·워크스페이스 문서는 Elasticsearch, 활성 작업본·채팅·멘션 캐시는 Redis Stack에 저장합니다.')}</SectionTitle>
          <div className="docs-callout"><Icon name="database" size={18} /><p><strong>{ui('스키마 출처와 적용')}</strong> {ui('실제 DDL은')} <code>project-agora-DB/mssql/init-mssql.sql</code>{ui('입니다. 런타임 계정은 DDL 권한 없이')} <code>agora_runtime</code>{ui('으로 읽기·쓰기만 수행하며 Spring Hibernate는')} <code>ddl-auto=validate</code>{ui('로 스키마를 검증합니다.')}</p></div>
          <div className="docs-storage-roles">
            <a href="#db-sql"><span>01 · RELATIONAL</span><strong>SQL Server 2022</strong><small>{ui('계정 · 인증 · 활동 통계')}</small></a>
            <a href="#db-es"><span>02 · DOCUMENT</span><strong>Elasticsearch 8.19</strong><small>{ui('캔버스 검색 · 영속 문서')}</small></a>
            <a href="#db-redis"><span>03 · ACTIVE CACHE</span><strong>Redis Stack 8</strong><small>{ui('활성 캔버스 · 실시간 데이터')}</small></a>
          </div>
          <section className="docs-db-subsection" id="db-sql">
            <div className="docs-subsection-heading"><span>SQL SERVER / DDL</span><h3>{ui('관계형 테이블과 제약')}</h3></div>
            <div className="docs-table-scroll"><table className="docs-api-table docs-schema-table"><thead><tr><th>{ui('테이블')}</th><th>{ui('키')}</th><th>{ui('주요 컬럼·관계')}</th><th>{ui('역할')}</th></tr></thead><tbody>{sqlTables.map(([table, key, columns, purpose]) => <tr id={schemaRowId('sql', table)} key={table}><td><code>{table}</code></td><td><code>{key}</code></td><td>{columns}</td><td>{ui(purpose)}</td></tr>)}</tbody></table></div>
            <p className="docs-db-caption">{ui('관계 요약:')} <code>users 1—1 user_sessions</code> · <code>canvas_info N—1 redis_server/cpp_server</code> · <code>auth_sessions/user_mfa/user_passkeys/user_canvas_activity → users.user_id</code>{ui('. user_id는 내부 PK이며 외부 공개 식별자가 아닙니다.')}</p>
          </section>
          <section className="docs-db-subsection" id="db-es">
            <div className="docs-subsection-heading"><span>ELASTICSEARCH / DOCUMENT</span><h3>{ui('캔버스 문서 인덱스')}</h3></div>
            <p className="docs-db-intro">{ui('인덱스 이름은')} <code>ES_INDEX</code>{ui('(기본값')} <code>canvas</code>{ui(')이며')} <code>_id</code>{ui('는 canvas ID입니다. 저장 시 동적 매핑 충돌 방지를 위해')} <code>items</code> {ui('JSON을')} <code>items-b64</code>{ui('로 인코딩하고 읽을 때 복원합니다.')}</p>
            <div className="docs-table-scroll"><table className="docs-api-table docs-schema-table"><thead><tr><th>{ui('필드')}</th><th>{ui('의미')}</th></tr></thead><tbody>{canvasDocumentFields.map(([field, meaning]) => <tr id={schemaRowId('es', field)} key={field}><td><code>{field}</code></td><td>{ui(meaning)}</td></tr>)}</tbody></table></div>
          </section>
          <section className="docs-db-subsection" id="db-redis">
            <div className="docs-subsection-heading"><span>REDIS STACK / REDISJSON</span><h3>{ui('활성 캔버스 문서')}</h3></div>
            <p className="docs-db-intro">{ui('Redis Stack은')} <code>idx:canvas</code> {ui('검색 인덱스와 캔버스별')} <code>canvas:{'{canvasId}'}</code> {ui('RedisJSON key를 사용합니다. 마지막 Canvas WebSocket이 닫히면 최종 문서를 Elasticsearch에 반영하고 캐시를 해제합니다.')}</p>
            <div className="docs-table-scroll"><table className="docs-api-table docs-schema-table"><thead><tr><th>RedisJSON path</th><th>{ui('논리 타입')}</th><th>{ui('설명')}</th></tr></thead><tbody>{redisDocumentFields.map(([path, type, meaning]) => <tr id={schemaRowId('redis', path)} key={path}><td><code>{path}</code></td><td>{type}</td><td>{ui(meaning)}</td></tr>)}</tbody></table></div>
            <div className="docs-note"><strong>{ui('데이터 수명 주기와 오류 처리')}</strong><p>{ui('Redis는 활성 Canvas의 작업 사본입니다. 저장 큐 실패 시 오래된 ES 문서로 대체하지 않고 fail-closed 처리해 캐시를 보존합니다.')}</p></div>
          </section>
        </section>
        <section className="docs-section docs-rules" id="rules"><SectionTitle eyebrow="06 / IMPLEMENTATION NOTES" title={ui('보안·공통 규칙')} /><ul><li>{ui('일반 API는 로그인 JWT, 실시간 접속은 캔버스 전용 토큰, 터미널 WebSocket은 일회성 티켓을 사용합니다.')}</li><li>{ui('계정·캔버스 비밀번호는 단방향 해시 저장되며 평문이나 해시를 응답에 포함하지 않습니다.')}</li><li>{ui('브라우저 공개 응답과 WebSocket 이벤트에 내부 사용자 ID를 넣지 않습니다. 참여자 관리 키는 nickname + tag_number입니다.')}</li><li>{ui('포스트잇은 변경 후 item_save로 자동 저장하며, 텍스트·코드는 Ctrl + S로 저장합니다. 모든 변경은 Phoenix 브로커 직렬 큐와 ACL 검증을 거칩니다.')}</li><li>{ui('Wall Nginx가 외부 HTTPS/WSS를 수신하고, Spring(8080)·Phoenix 브로커·C++(8000, WSS 8002+)·AI Agent를 내부 망으로 연결합니다.')}</li><li>{ui('별도 프런트엔드 도메인에서 API를 호출할 때만 Spring CORS_ALLOWED_ORIGINS를 지정합니다. 같은 도메인 배포는 Wall Nginx 경유를 권장합니다.')}</li></ul></section>
        <footer className="docs-footer"><Link to="/">{ui('← FreLog 홈으로')}</Link><div><Link to="/terms">{ui('이용약관')}</Link> · <Link to="/privacy">{ui('개인정보 처리방침')}</Link></div><span>{ui('project-agora-FE · BE(API_SPEC.md) · Wall(BROKER_PROTOCOL.md) · DB(init-mssql.sql) 현행 구성 기준')}</span></footer>
      </article>
    </div>
  </main>;
}
