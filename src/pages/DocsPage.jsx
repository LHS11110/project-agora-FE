import { useEffect, useState } from 'react';
import { Link } from '../routing.jsx';
import Icon from '../components/Icon.jsx';
import FreLogBrand from '../components/frelog/FreLogBrand.jsx';
import '../docs-directory.css';

const publicEndpoints = [
  ['POST', '/api/auth/signup', '없음', '회원가입. JSON { email, password, nickname }. 이메일 형식, 비밀번호 6자 이상, 닉네임 최대 100자. 성공 시 201 + UserResponse.'],
  ['POST', '/api/auth/login', '없음', '로그인. JSON { email, password }. 200 응답에 tokenType, accessToken, user를 반환합니다.'],
  ['POST', '/api/auth/me', '본문 token', '현재 사용자 조회. JSON { token }에 로그인 JWT를 넣습니다. 누락·무효 토큰은 401입니다.'],
  ['GET', '/api/auth/health', '없음', '인증 서비스 상태 확인. { status: "UP", service: "Agora Auth Service" }.'],
  ['POST', '/api/users', '없음', '회원가입 호환 별칭. /api/auth/signup과 같은 요청·201 응답을 사용합니다.'],
  ['GET', '/api/users/{nickname}/{tagNumber}', 'Bearer JWT', '닉네임과 태그 번호로 사용자 한 명을 조회합니다.'],
  ['PUT · PATCH', '/api/users/{nickname}/{tagNumber}', 'Bearer JWT', '프로필 변경. JSON에서 nickname 및/또는 password를 선택합니다. 이메일과 tag_number는 변경할 수 없고 200 + UserResponse를 반환합니다.'],
  ['DELETE', '/api/users/{nickname}/{tagNumber}', 'Bearer JWT', '본인 또는 관리자만 삭제할 수 있습니다. 사용자가 접속 중이면 409 USER_003; 세션 종료 후 다시 요청합니다. 성공은 204입니다.'],
  ['GET', '/api/users · /api/auth/users', '없음', '사용자 응답 배열(email, nickname, tag_number, role, status, last_login_at, password_changed_at, created_at, updated_at). user_id·password_hash는 공개하지 않습니다.'],
  ['POST', '/api/canvases', 'Bearer JWT', '캔버스 생성. JSON { canvasName, description?, canvasPassword? } 또는 multipart canvasName·description·canvasPassword·image(선택). 201 + 요약 응답.'],
  ['GET', '/api/canvases · /api/canvases/search?name={name}', 'Bearer JWT', '캔버스 목록·검색. 두 경로 모두 선택 쿼리 name을 받습니다. 이름 생략 시 전체 검색 결과는 최대 1000건입니다.'],
  ['GET', '/api/canvases/{canvasId}', 'Bearer JWT', '캔버스 요약 { canvas_id, image, description, canvas_name, user_count }.'],
  ['GET', '/api/canvases/{canvasId}/image', 'Bearer JWT', '대표 이미지 바이너리(image/*). 요약 image URL을 요청할 때도 Authorization 헤더가 필요합니다.'],
  ['GET', '/api/canvases/{canvasId}/settings', 'Bearer JWT', '설정과 참여자 목록. password_protected, settings_revision 및 nickname + tag_number 목록을 반환합니다.'],
  ['PATCH', '/api/canvases/{canvasId}/name', 'Bearer JWT', '비활성 캔버스 이름 변경. JSON { canvas_name }; 성공 시 204. 활성 캔버스는 WebSocket 설정 이벤트를 사용합니다.'],
  ['PATCH', '/api/canvases/{canvasId}/description', 'Bearer JWT', '비활성 캔버스 설명 변경. JSON { description }; 성공 시 204.'],
  ['PATCH', '/api/canvases/{canvasId}/password', 'Bearer JWT', '비활성 캔버스 비밀번호 설정·해제. JSON { canvas_password }; 빈 값은 해제, 저장 전 해시화, 성공 시 204.'],
  ['POST · DELETE', '/api/canvases/{canvasId}/people', 'Bearer JWT', '참여자 추가(POST)·제외(DELETE). JSON { nickname, tag_number }; 성공 시 204. 활성 캔버스에는 WebSocket 설정을 사용합니다.'],
  ['POST', '/api/canvases/{canvasId}/access', 'Bearer JWT', '접속 권한 확인. 보호된 캔버스는 JSON { password } 또는 30분간 유효한 { canvas_password_token }을 받습니다. { server_id, ws_port, canvas_access_token, canvas_password_token } 반환. 비밀번호 토큰은 사용자·캔버스·설정 revision에 묶입니다. 다른 캔버스에 활성 접속 중이면 409 CANVAS_003.'],
  ['DELETE', '/api/canvases/{canvasId}', 'Bearer JWT', '소유자 또는 관리자만 삭제할 수 있습니다. 활성 세션이 있으면 409, 성공은 204입니다.'],
];

const internalEndpoints = [
  ['GET · POST', '/api/load-balancer/allocate/server', 'ROLE_ADMIN', '호출할 때마다 C++ 서버를 선택합니다. 활성 등록·최근 heartbeat와 C++ 활성 캔버스 수를 확인합니다. { ip, port, wsPort, serverIp, serverPort }.'],
  ['GET · POST', '/api/load-balancer/allocate/redis', 'ROLE_ADMIN', 'Redis 서비스 할당 정보를 반환합니다. { ip, port, redisIp, redisPort }.'],
  ['GET', '/api/load-balancer/database · /api/database/address', 'ROLE_ADMIN', 'DB 접속 주소 { ip, port, dbHost, dbPort, dbName, address }를 반환합니다.'],
  ['POST', '/api/load-balancer/allocate/database', 'ROLE_ADMIN', 'DB 접속 주소를 반환합니다.'],
  ['GET', '/api/test/cpp-canvas-count', 'ROLE_ADMIN', 'SQL user_sessions의 활성 세션으로 캔버스 수를 계산합니다. C++ HTTP API를 호출하지 않습니다.'],
  ['GET', '/api/test/cpp-active-canvases', '로그인 사용자', 'SQL 세션 기준 { status, count, canvases: [{ canvas_id, active_user_count }] }. C++ 프록시가 아닙니다.'],
  ['GET', 'C++ :8000/health · /', '내부 네트워크', 'C++ REST 프로세스 상태 확인.'],
  ['GET', 'C++ :8000/api/canvas/count · /api/canvas/active', '내부 네트워크', '실행 중인 캔버스 운영 현황. /active 상세 정보는 내부 운영 API로만 취급합니다.'],
  ['POST', 'C++ :8000/api/users/{userId}/disconnect · /api/canvas/{canvasId}/users/{userId}/disconnect', '내부 네트워크', '서비스 내부 세션 종료 제어. userId를 외부 클라이언트에 전달하지 않습니다.'],
  ['DELETE', 'C++ :8000/api/canvas/{canvasId}', '내부 네트워크', '캔버스 언로드 제어. 활성 사용자가 있으면 removed:false를 반환할 수 있습니다.'],
];

const publicApiGroups = [
  { id: 'api-auth', title: '인증', rows: publicEndpoints.slice(0, 4) },
  { id: 'api-users', title: '사용자·프로필', rows: publicEndpoints.slice(4, 9) },
  { id: 'api-canvases', title: '캔버스', rows: publicEndpoints.slice(9) },
];

const internalApiGroups = [
  { id: 'api-infra', title: '서버·저장소 할당', rows: internalEndpoints.slice(0, 4) },
  { id: 'api-debug', title: '진단 API', rows: internalEndpoints.slice(4, 8) },
  { id: 'api-cpp', title: 'C++ 내부 API', rows: internalEndpoints.slice(8) },
];

const sqlTables = [
  ['users', 'user_id · INT IDENTITY PK', 'email NVARCHAR(255) NOT NULL; password_hash NVARCHAR(255) NULL; nickname NVARCHAR(100) NOT NULL; tag_number INT NOT NULL DEFAULT 0; role NVARCHAR(20) NOT NULL DEFAULT ROLE_USER; status NVARCHAR(20) NOT NULL DEFAULT ACTIVE; oauth_provider NVARCHAR(50) NULL; oauth_id NVARCHAR(255) NULL; password_changed_at DATETIME2 NULL; created_at/updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()', '사용자 계정·프로필. email과 (nickname, tag_number)는 고유합니다. ROLE/상태·비어 있지 않은 닉네임·로컬 또는 OAuth 인증 정보를 CHECK로 제한합니다.'],
  ['user_sessions', 'user_id · INT PK/FK', 'user_id → users.user_id; cpp_server_id INT NULL → cpp_server.server_id; canvas_id INT NULL → canvas_info.canvas_id; is_accessed BIT NOT NULL DEFAULT 0; last_login_at DATETIME2 NULL; updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()', '사용자별 현재 접속 한 건. 모든 FK는 ON DELETE/UPDATE NO ACTION이며 (canvas_id, is_accessed), cpp_server_id 보조 인덱스가 있습니다.'],
  ['canvas_info', 'canvas_id · INT IDENTITY PK', 'redis_id INT NULL → redis_server.redis_id; cpp_server_id INT NULL → cpp_server.server_id; is_cached BIT NOT NULL DEFAULT 0; created_at/updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()', '캔버스의 저장소·실시간 서버 배정 및 캐시 상태. canvas_name, owner user_id, 아이템 본문은 이 테이블에 저장하지 않습니다. is_cached와 cpp_server_id 보조 인덱스가 있습니다.'],
  ['cpp_server', 'server_id · INT IDENTITY PK', 'server_ip VARCHAR(45) NOT NULL; server_port/ws_port VARCHAR(10) NOT NULL; is_activated BIT NOT NULL DEFAULT 0; created_at/last_heartbeat_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()', '(server_ip, server_port) 고유. IP와 포트 공백 방지 CHECK가 있으며 C++ 서버 heartbeat·활성 상태를 기록합니다.'],
  ['redis_server', 'redis_id · INT IDENTITY PK', 'redis_ip VARCHAR(45) NOT NULL; redis_port VARCHAR(10) NOT NULL; is_activated BIT NOT NULL DEFAULT 0; created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()', '(redis_ip, redis_port) 고유. 주소·포트 공백 방지 CHECK가 있습니다.'],
];

const canvasDocumentFields = [
  ['canvas-id · canvas-name', '캔버스 문서 ID와 검색·표시용 이름'],
  ['admin-user-id · people', '소유 관리자 및 참여자 내부 user_id 목록'],
  ['description · init-group', '캔버스 설명 및 새 참여자의 초기 그룹'],
  ['canvas-password-hash', '접속 비밀번호 해시. API 응답에 포함하지 않음'],
  ['inner-group', '그룹 이름을 내부 user_id 배열에 매핑'],
  ['settings-revision', '설정 변경 낙관적 동시성 revision. 설정 토큰·CAS에서 사용'],
  ['items-b64', 'ES의 동적 items 필드 매핑 충돌을 막기 위해 직렬화한 items JSON 청크. 읽을 때 items 객체로 복원'],
];

const redisDocumentFields = [
  ['canvas:{canvasId}', 'RedisJSON root', 'Canvas의 활성 작업 문서. C++가 Redis를 우선 로드하고, cache unload/save 때 ES 문서와 동기화'],
  ['$.canvas-id · $.canvas-name', 'integer · string', 'Canvas 식별자와 표시 이름'],
  ['$.description · $.init-group', 'string · string', 'Canvas 설명과 초기 접근 그룹'],
  ['$.canvas-password-hash', 'string · null', '접속 비밀번호 해시. 평문 저장·응답 금지'],
  ['$.admin-user-id · $.people', 'integer · integer[]', '관리자·참여자 참조. 내부 식별자이므로 브라우저 응답에 그대로 노출하지 않음'],
  ['$.inner-group', 'object<string, integer[]>', '그룹별 내부 사용자 ID 목록'],
  ['$.settings-revision', 'integer', '설정 변경용 revision. 설정 쓰기는 Redis CAS로 경합을 감지'],
  ['$.items[<itemId>]', 'object', '개별 아이템과 permission ACL. 텍스트/코드는 Ctrl+S 저장본을 보관'],
  ['$.items[<roomId>].data', 'chat message[]', 'chat_room 아이템의 순번 포함 메시지 내역'],
  ['$.items[<roomId>].next_sequence', 'integer', '다음 채팅 순번. RedisJSON array append와 Lua에서 원자 갱신'],
];

const socketEvents = [
  ['Canvas 연결 직후', '서버 → 클라이언트', 'init_items', '권한 필터링된 아이템·공개 그룹, 캔버스 이름, rtc_canvas_connection_id와 64자리 rtc_canvas_connection_hash를 반환합니다. chat_room의 메시지 data는 제외합니다.'],
  ['RTC 신호 연결·참여', '서버 ↔ 클라이언트', 'rtc_ready · { type: "rtc_join", canvas_connection_id, canvas_connection_hash }', 'RTC 소켓에서 rtc_ready를 받은 뒤 init_items에서 받은 ID와 해시를 함께 보냅니다. 해시는 Canvas WebSocket 연결마다 새로 생성되는 HMAC-SHA256 증명값입니다.'],
  ['RTC 피어 상태', '서버 → 클라이언트', 'rtc_peers · rtc_peer_joined · rtc_peer_left', 'RTC 신호 소켓별 임시 peer_id와 공개 닉네임·태그·그룹을 전달합니다. 내부 user_id는 포함하지 않습니다.'],
  ['핑', '양방향 · Canvas 소켓', '{ type: "ping" }', '요청자에게 pong { canvas_id, timestamp }. 사용자 ID는 포함하지 않습니다.'],
  ['채팅 보내기', '클라이언트 → 서버 · Canvas 소켓', '{ type: "chat", room_id, text, request_id }', '서버가 검증된 sender·tag_number·canvas_id, 방별 sequence, created_at을 붙입니다. ACL 허용 대상에 전달한 뒤 Redis 저장 큐에 넣습니다.'],
  ['채팅 내역 조회', '양방향 · Canvas 소켓', '{ type: "chat_history", room_id, limit | from_sequence + to_sequence, request_id }', '기본 최근 50개(최대 200개) 또는 양 끝 포함 sequence 범위를 조회합니다. 오래된 순서로 messages, from/to_sequence, total, has_more를 반환합니다.'],
  ['항목 생성·수정', '클라이언트 → 서버 · Canvas 소켓', '{ type: "item_update", item_id, item }', 'ACL 검사를 거쳐 일반 그래픽·이미지 항목을 전달하고 Redis 저장 큐에 넣습니다. 텍스트·노트·코드·Automerge 데이터를 포함하면 ITEM_SAVE_REQUIRED로 거절됩니다.'],
  ['텍스트·노트·코드 저장', '클라이언트 → 서버 · Canvas 소켓', '{ type: "item_save", item_id, item: { automerge_snapshot, automerge_changes } }', '텍스트·코드는 Ctrl + S로 저장하고 포스트잇은 변경 후 자동 저장합니다. 공통 base 스냅샷과 변경 이력을 보내며, 같은 아이템 변경은 중복 제거해 합칩니다. JSON payload 상한은 12 MiB입니다.'],
  ['WebRTC 신호 교환', '클라이언트 ↔ 서버 ↔ 지정 피어 · RTC 소켓', '{ type: "rtc_signal", peer_id, action, description|candidate }', '인증된 같은 캔버스의 대상 소켓 하나에만 SDP/ICE를 전달합니다. 신호는 저장하지 않으며 커서·CRDT 본문은 이 경로를 통과하지 않습니다.'],
  ['커서·Automerge 변경', '피어 ↔ 피어', 'RTCDataChannel: cursor · doc_change · doc_snapshot', '커서는 비신뢰 전달 채널, 문서 변경은 신뢰성 있는 채널로 직접 전송합니다. 서버는 이 데이터 트래픽을 중계하지 않습니다.'],
  ['실시간 드로잉', '피어 ↔ 피어', 'RTCDataChannel: stroke_preview (start · points · end · cancel)', '신뢰성 있는 agora-sync 채널로 포인트 묶음을 그리는 동안 전송합니다. end 시 피어 화면에 획을 확정하고, 원본 항목은 Canvas WebSocket으로 저장합니다.'],
  ['항목 삭제', '클라이언트 → 서버', '{ type: "item_delete", item_id }', '항목 권한 확인 후 삭제 이벤트를 브로드캐스트합니다.'],
  ['설정 조회', '클라이언트 → 서버', '{ type: "canvas_settings_get" }', '요청자에게 canvas_settings_snapshot을 반환합니다.'],
  ['설정 변경', '클라이언트 → 서버', 'canvas_settings_update', 'request_id, expected_revision, field, value. name·description·password 또는 participant_add/remove를 지정하며 변경은 admin-group 전용입니다.'],
  ['설정 결과', '서버 → 클라이언트', 'canvas_settings_result / canvas_settings_changed', 'revision 충돌은 최신 settings가 포함된 SETTINGS_CONFLICT. 비밀번호 평문·해시는 이벤트에 포함하지 않습니다.'],
];

const projectTree = [
  'project-agora-FE/',
  '├─ src/',
  '│  ├─ App.jsx                 # 경로와 인증 보호',
  '│  ├─ routing.jsx             # 브라우저 라우터',
  '│  ├─ api/client.js           # REST 요청 · WebSocket 주소 생성',
  '│  ├─ state/AuthContext.jsx   # 로그인 상태와 토큰',
  '│  ├─ components/             # 공통 셸 · 아이콘',
  '│  ├─ components/VectorLayer  # PixiJS GPU 가속 벡터 그래픽',
  '│  ├─ components/CanvasSpatialBTree.js # 객체 경계 상자 · 화면 영역 질의',
  '│  ├─ components/CanvasPeerMesh.js     # WebRTC 신호 · P2P 데이터 채널',
  '│  ├─ components/MathFormula  # 안전 설정된 MathJax SVG 출력',
  '│  ├─ pages/                  # 슬라이드 홈 · 튜토리얼 · 앱 페이지',
  '│  └─ *.css                   # 각 페이지의 반응형 디자인',
  '├─ vite.config.js             # 개발 프록시 · 로컬 MathJax 에셋',
  '├─ .env.example               # 공개 가능한 로컬 설정 예시',
  '├─ THIRD_PARTY_NOTICES.md     # 프런트엔드 의존성 라이선스',
  '└─ package.json               # PixiJS · Automerge · MathJax',
  '',
  'project-agora-BE/',
  '├─ spring/                    # REST · JWT · 계정 · 캔버스 권한',
  '├─ cpp/                       # 내부 REST · 실시간 WebSocket 서버',
  '├─ nginx/                     # HTTPS 정적 파일 · /api · /wss 프록시',
  '├─ API_SPEC.md                # 백엔드 REST · WebSocket 상세 명세',
  '├─ THIRD_PARTY_LICENSES.md    # C++ 포함 의존성 라이선스',
  '└─ LICENSE                    # 프로젝트 라이선스',
  '',
  'project-agora-DB/',
  '├─ mssql/init-mssql.sql       # SQL Server 스키마 생성·반복 이관',
  '├─ redis/                     # Redis Stack · RedisJSON 초기화',
  '└─ elasticsearch/             # Canvas 인덱스 · 로그 저장소 초기화',
];

function EndpointTable({ rows, internal = false }) {
  return <div className="docs-table-scroll"><table className="docs-api-table"><thead><tr><th>메서드</th><th>경로</th><th>{internal ? '접근' : '인증'}</th><th>동작 / 데이터</th></tr></thead><tbody>{rows.map(([method, path, auth, description]) => <tr id={endpointAnchorId(method, path)} key={`${method}-${path}`}><td><span className={`http-method method-${method.split(' ')[0].toLowerCase()}`}>{method}</span></td><td><code>{path}</code></td><td><span className="api-auth-badge">{auth}</span></td><td>{description}</td></tr>)}</tbody></table></div>;
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
  return <div className="docs-section-title" id={id}><span className="section-kicker">{eyebrow}</span><h2>{title}</h2>{children && <p>{children}</p>}</div>;
}

function DocsNavLink({ id, children, kind, activeSection, onSelect }) {
  return <a className={`docs-nav-link${activeSection === id ? ' active' : ''}`} href={`#${id}`} aria-current={activeSection === id ? 'location' : undefined} onClick={() => onSelect(id)}>
    <span>{children}</span>{kind && <small>{kind}</small>}
  </a>;
}

function DocsNavFolder({ title, children, nested = false }) {
  return <details className={`docs-nav-folder${nested ? ' nested' : ''}`} open>
    <summary>{title}</summary>
    <div className="docs-nav-folder-content">{children}</div>
  </details>;
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    const endpointIds = [...publicApiGroups, ...internalApiGroups].flatMap((group) => group.rows.map(([method, path]) => endpointAnchorId(method, path)));
    const socketIds = socketEvents.map((_, index) => socketEventId(index));
    const schemaIds = [
      ...sqlTables.map(([table]) => schemaRowId('sql', table)),
      ...canvasDocumentFields.map(([field]) => schemaRowId('es', field)),
      ...redisDocumentFields.map(([path]) => schemaRowId('redis', path)),
    ];
    const ids = ['overview', 'structure', 'public-api', 'api-auth', 'api-users', 'api-canvases', 'internal-api', 'api-infra', 'api-debug', 'api-cpp', 'websocket', 'webrtc-signaling', 'database', 'db-sql', 'db-es', 'db-redis', 'rules', ...endpointIds, ...socketIds, ...schemaIds];
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
    <header className="docs-header page-container"><FreLogBrand /><nav><a href="#structure">프로젝트 구조</a><a href="#public-api">외부 API</a><a href="#internal-api">내부 API</a><a href="#database">DB 명세</a></nav><Link className="button button-outline docs-workspace-link" to="/search">워크스페이스 <Icon name="arrow" size={15} /></Link></header>
    <div className="docs-layout page-container">
      <aside className="docs-toc" aria-label="문서 목차">
        <div className="docs-toc-heading"><span>FRELOG DOCS</span><small>REFERENCE / DIRECTORY</small></div>
        <DocsNavLink id="overview" activeSection={activeSection} onSelect={setActiveSection}>개요</DocsNavLink>
        <DocsNavFolder title="프로젝트">
          <DocsNavLink id="structure" activeSection={activeSection} onSelect={setActiveSection}>구조와 역할</DocsNavLink>
        </DocsNavFolder>
        <DocsNavFolder title="API 레퍼런스">
          <DocsNavFolder title="외부 공개 REST" nested>
            <DocsNavLink id="public-api" kind="REST" activeSection={activeSection} onSelect={setActiveSection}>API 개요·인증</DocsNavLink>
            {publicApiGroups.map((group) => <DocsNavFolder key={group.id} title={group.title} nested>
              {group.rows.map(([method, path]) => <DocsNavLink key={`${method}-${path}`} id={endpointAnchorId(method, path)} kind={method.split(' ')[0]} activeSection={activeSection} onSelect={setActiveSection}>{endpointNavLabel(path)}</DocsNavLink>)}
            </DocsNavFolder>)}
          </DocsNavFolder>
          <DocsNavFolder title="내부·운영 API" nested>
            <DocsNavLink id="internal-api" kind="PRIVATE" activeSection={activeSection} onSelect={setActiveSection}>내부 API 경계</DocsNavLink>
            {internalApiGroups.map((group) => <DocsNavFolder key={group.id} title={group.title} nested>
              {group.rows.map(([method, path]) => <DocsNavLink key={`${method}-${path}`} id={endpointAnchorId(method, path)} kind={method.split(' ')[0]} activeSection={activeSection} onSelect={setActiveSection}>{endpointNavLabel(path)}</DocsNavLink>)}
            </DocsNavFolder>)}
          </DocsNavFolder>
          <DocsNavFolder title="실시간 통신" nested>
            <DocsNavFolder title="Canvas WebSocket" nested>
              <DocsNavLink id="websocket" kind="WS" activeSection={activeSection} onSelect={setActiveSection}>연결·프로토콜 개요</DocsNavLink>
              {socketEvents.map(([name], index) => <DocsNavLink key={name} id={socketEventId(index)} kind="EVENT" activeSection={activeSection} onSelect={setActiveSection}>{name}</DocsNavLink>)}
            </DocsNavFolder>
            <DocsNavLink id="webrtc-signaling" kind="P2P" activeSection={activeSection} onSelect={setActiveSection}>WebRTC · P2P</DocsNavLink>
          </DocsNavFolder>
        </DocsNavFolder>
        <DocsNavFolder title="데이터 레퍼런스">
          <DocsNavLink id="database" activeSection={activeSection} onSelect={setActiveSection}>저장소 구성</DocsNavLink>
          <DocsNavFolder title="SQL Server" nested>
            <DocsNavLink id="db-sql" kind="SQL" activeSection={activeSection} onSelect={setActiveSection}>테이블 개요</DocsNavLink>
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
        <DocsNavLink id="rules" activeSection={activeSection} onSelect={setActiveSection}>보안·공통 규칙</DocsNavLink>
      </aside>
      <article className="docs-content">
        <section className="docs-hero" id="overview"><span className="docs-hero-icon"><Icon name="book" size={22} /></span><span className="section-kicker">FRELOG / TECHNICAL DOCS</span><h1>구조와 API를<br /><em>한눈에 살펴보세요.</em></h1><p>FreLog는 캔버스 위에서 그림, 이미지, 코드와 대화를 실시간으로 나누는 협업 서비스입니다. 이 문서는 현재 저장소 구현을 기준으로 정리했습니다.</p><div className="docs-hero-meta"><span><i /> React · Vite</span><span><i /> Spring Boot</span><span><i /> C++ · uWebSockets</span></div></section>
        <section className="docs-section"><SectionTitle id="structure" eyebrow="01 / PROJECT MAP" title="프로젝트 구조와 역할" />
          <div className="docs-architecture"><div><span>Browser</span><strong>React · Vite</strong><small>화면 · 인증 UI · 캔버스 이벤트</small></div><b>HTTPS / WSS</b><div><span>Nginx</span><strong>Reverse proxy</strong><small>정적 파일 · API · WebSocket 라우팅</small></div><b>internal</b><div><span>Backend</span><strong>Spring + C++</strong><small>권한·데이터 관리 · 실시간 세션</small></div></div>
          <pre className="docs-tree"><code>{projectTree.join('\n')}</code></pre>
          <div className="docs-role-grid"><div><span>FRONTEND</span><h3>한 화면에서 함께 만들기</h3><p>PixiJS가 보이는 벡터만 그리고, 공간 B-tree로 화면 밖 객체를 제외합니다. 커서와 Automerge 편집은 WebRTC P2P로 동기화하며 텍스트·코드는 Ctrl + S, 포스트잇은 변경 후 자동 저장합니다.</p></div><div><span>SPRING BOOT</span><h3>인증과 권한의 기준점</h3><p>사용자 JWT, 캔버스 메타데이터, 접속 토큰 발급, C++ 서버 할당을 관리합니다.</p></div><div><span>C++ REALTIME</span><h3>신호와 영속 저장</h3><p>같은 캔버스의 WebRTC 신호만 지정 피어로 전달하고, 명시적 item_save 및 일반 그래픽 이벤트를 저장합니다. 커서와 CRDT 본문은 중계하지 않습니다.</p></div></div>
        </section>
        <section className="docs-section" id="public-api"><SectionTitle eyebrow="02 / CLIENT API" title="외부에 공개된 API">브라우저에서 사용하는 HTTPS API입니다. 보호된 API에는 access token을 Bearer 헤더로 전달합니다.</SectionTitle><div className="docs-callout"><Icon name="lock" size={18} /><p><strong>인증 헤더</strong><code>Authorization: Bearer &lt;accessToken&gt;</code> · <code>POST /api/auth/me</code>는 본문에 <code>{'{ token }'}</code>을 받습니다. 사용자 목록 조회는 비인증 경로입니다. 캔버스 접속 토큰은 로그인 JWT와 별개이며 WebSocket에만 사용합니다.</p></div><div className="docs-api-groups">{publicApiGroups.map((group, index) => <section className="docs-api-group" id={group.id} key={group.id}><div className="docs-subsection-heading"><span>REST / {String(index + 1).padStart(2, '0')}</span><h3>{group.title}</h3></div><EndpointTable rows={group.rows} /></section>)}</div><div className="docs-note"><strong>UserResponse 참고</strong><p><code>last_login_at</code>은 로그인 시각이 <code>user_sessions</code>로 이동해 현재 응답에서 <code>null</code>입니다. 비밀번호 변경 시각은 호환성을 위해 <code>password_chaged_at</code> 표기와 <code>password_changed_at</code> 필드를 함께 반환합니다.</p></div><div className="docs-note"><strong>이미지 응답 참고</strong><p>요약 DTO의 <code>image</code>는 <code>/api/canvases/:canvasId/image</code> URL을 반환합니다. 이 경로는 이미지 바이너리를 제공하며 다른 캔버스 API와 같이 Bearer 인증이 필요합니다. 브라우저의 일반 <code>&lt;img&gt;</code> 요청에는 인증 헤더를 넣을 수 없으므로 앱에서 토큰을 포함해 가져와 표시합니다.</p></div><div className="docs-payload-card"><div><span className="section-kicker">CANVAS ACCESS FLOW</span><h3>캔버스 접속 순서</h3><p>REST에서 로그인·비밀번호를 확인한 다음, 전용 접속 토큰으로 두 WebSocket을 엽니다. 참여 여부는 WebSocket에서 다시 확인합니다.</p></div><pre><code>{'POST /api/canvases/42/access\nAuthorization: Bearer <accessToken>\n\n{ "password": "optional" }\n→ { "server_id": 5, "ws_port": "8002",\n    "canvas_access_token": "<canvas-jwt>" }\n\nWSS /wss/port/8002/canvas/42?token=<canvas_access_token>\nWSS /wss/port/8002/rtc/canvas/42?token=<canvas_access_token>'}</code></pre></div><div className="docs-note"><strong>캔버스 설정 변경</strong><p>비활성 캔버스는 REST PATCH로 변경합니다. 활성 캔버스의 REST 변경은 409 CANVAS_006으로 거절되므로 WebSocket 설정 이벤트를 사용합니다. 다른 캔버스에 활성 접속 중이면 /access가 409 CANVAS_003을 반환합니다.</p></div></section>
        <section className="docs-section" id="internal-api"><SectionTitle eyebrow="03 / PRIVATE OPERATIONS" title="내부·운영 전용 API">운영 상태와 서버 제어용 경로입니다. 관리자 전용 Spring API와 내부 C++ REST 경로를 지정된 인증 범위에 맞춰 사용하세요.</SectionTitle><div className="docs-callout warning"><Icon name="lock" size={18} /><p><strong>접근 범위</strong> 서버·저장소 할당과 DB 주소, <code>/api/test/cpp-canvas-count</code>는 ROLE_ADMIN이 필요합니다. <code>/api/test/cpp-active-canvases</code>만 로그인 사용자에게 허용됩니다. 이전 <code>/api/test/cpp-access</code>·<code>cpp-disconnect</code> 프록시와 C++ <code>/api/access</code> 경로는 제거됐습니다. C++ REST는 내부 포트(기본 8000)에 두고 Nginx에서 외부 공개하지 않습니다.</p></div><div className="docs-api-groups">{internalApiGroups.map((group, index) => <section className="docs-api-group" id={group.id} key={group.id}><div className="docs-subsection-heading"><span>PRIVATE / {String(index + 1).padStart(2, '0')}</span><h3>{group.title}</h3></div><EndpointTable rows={group.rows} internal /></section>)}</div><div className="docs-note"><strong>네트워크 경계</strong><p>브라우저용 WebSocket은 Nginx의 <code>/wss/port/:wsPort/canvas/:canvasId</code> 및 <code>/wss/port/:wsPort/rtc/canvas/:canvasId</code> 경로를 사용합니다. 내부 REST 제어 API, DB·Redis 포트는 외부에 직접 열지 않습니다. 테스트베드의 활성 캔버스 목록은 C++ 프록시가 아니라 DB <code>user_sessions</code>에서 계산합니다.</p></div></section>
        <section className="docs-section" id="websocket">
          <SectionTitle eyebrow="04 / REALTIME PROTOCOL" title="캔버스·RTC WebSocket 명세">Spring 접속 API가 발급한 캔버스 전용 토큰으로 캔버스 이벤트와 RTC 신호용 소켓을 각각 엽니다.</SectionTitle>
          <div className="docs-endpoint-line"><span>WSS</span><code>/wss/port/:wsPort/canvas/:canvasId?token=:canvasAccessToken</code><small>캔버스 이벤트 · Nginx 경유</small></div>
          <div className="docs-endpoint-line"><span>WSS</span><code>/wss/port/:wsPort/rtc/canvas/:canvasId?token=:canvasAccessToken</code><small>별도 RTC 신호 연결 · Nginx 경유</small></div>
          <div className="docs-table-scroll"><table className="docs-api-table socket-table"><thead><tr><th>이벤트</th><th>방향</th><th>페이로드 / 동작</th></tr></thead><tbody>{socketEvents.map(([name, direction, payload, description], index) => <tr id={socketEventId(index)} key={name}><td><strong>{name}</strong></td><td>{direction}</td><td><code>{payload}</code><br />{description}</td></tr>)}</tbody></table></div>
          <div className="docs-note"><strong>아이템 권한과 채팅 ACL</strong><p>초기 아이템과 실시간 이벤트는 아이템의 <code>permission</code> 그룹으로 필터링합니다. ACL이 없거나 비어 있으면 관리자만 접근할 수 있고, 일반 사용자는 기존 ACL이 허용할 때만 수정·삭제할 수 있습니다. 채팅방도 <code>chat_room</code> 아이템이며 메시지 내역은 별도 <code>chat_history</code> 요청으로 읽습니다. 전체 <code>items</code> 교체는 관리자 전용입니다.</p></div>
          <div className="docs-note" id="webrtc-signaling"><strong>P2P 연결과 연결 증명</strong><p>RTC 소켓의 <code>rtc_join</code>에는 Canvas 소켓의 <code>init_items</code>에서 받은 <code>rtc_canvas_connection_id</code>와 <code>rtc_canvas_connection_hash</code>를 함께 전달해야 합니다. ID 누락·형식 오류는 <code>RTC_CANVAS_CONNECTION_REQUIRED</code>·<code>RTC_CANVAS_CONNECTION_INVALID</code>, 해시 누락·불일치는 <code>RTC_CANVAS_CONNECTION_HASH_REQUIRED</code>·<code>RTC_CANVAS_CONNECTION_HASH_INVALID</code>, 묶을 Canvas 소켓이 없거나 이미 다른 소켓에 연결된 경우는 <code>RTC_CANVAS_SOCKET_REQUIRED</code>·<code>RTC_CANVAS_CONNECTION_MISMATCH</code>로 거절됩니다. 기본 STUN은 경로 탐색만 돕고 일부 NAT·방화벽에서는 직접 연결이 불가능할 수 있습니다. 그런 배포에서는 TURN 서버와 <code>VITE_WEBRTC_ICE_SERVERS</code> ICE 서버 JSON 배열이 필요합니다. RTC 신호 소켓은 JSON 메시지 최대 256 KiB, 연결당 초당 최대 100개이며 실제 미디어·데이터 패킷은 C++ 서버를 통과하지 않습니다.</p></div>
          <div className="docs-role-grid docs-safety-grid"><div><span>IDENTITY</span><h3>공개 식별자는 닉네임 + 태그</h3><p>채팅 이벤트에는 <code>sender</code>와 <code>tag_number</code>만 포함하며 user_id와 sender_id는 전달하지 않습니다. WebRTC 식별자는 연결 중에만 쓰는 임의 peer 토큰입니다.</p></div><div><span>CONCURRENCY</span><h3>저장 시점 명시</h3><p>Automerge 변경은 연결된 피어끼리 실시간 동기화하며, 포스트잇은 변경 후 자동 저장합니다. 텍스트·코드는 <code>Ctrl + S</code>에서 공통 스냅샷과 변경 이력으로 저장하고, 서버는 오프라인 동시 편집 이력도 합칩니다.</p></div></div>
        </section>
        <section className="docs-section" id="database">
          <SectionTitle eyebrow="05 / DATA REFERENCE" title="데이터베이스 명세">계정·접속 배정은 SQL Server, 영구 캔버스 문서는 Elasticsearch, 활성 캔버스 작업본은 RedisJSON에 나눠 저장합니다. SQL 항목은 DB 저장소의 실제 DDL과 이관 스크립트를 기준으로 정리했습니다.</SectionTitle>
          <div className="docs-callout"><Icon name="database" size={18} /><p><strong>스키마 출처와 적용</strong> 실제 DDL은 <code>project-agora-DB/mssql/init-mssql.sql</code>입니다. 테이블 이름은 sqlcmd의 <code>TABLE_USERS</code> 등 설정으로 지정하며, 반복 실행 시 누락 컬럼·제약·인덱스를 보완하고 이전 세션·서버 참조 스키마를 이관합니다. 백엔드 런타임 계정은 dbo/DDL 권한 없이 <code>agora_runtime</code> 역할로 데이터 읽기·쓰기만 수행합니다. Spring Hibernate는 <code>ddl-auto=validate</code>로 기존 스키마를 검증합니다.</p></div>
          <div className="docs-storage-roles">
            <a href="#db-sql"><span>01 · RELATIONAL</span><strong>SQL Server 2022</strong><small>계정 · 세션 · 서버 할당</small></a>
            <a href="#db-es"><span>02 · DOCUMENT</span><strong>Elasticsearch 8.19</strong><small>캔버스 검색 · 영속 문서</small></a>
            <a href="#db-redis"><span>03 · ACTIVE CACHE</span><strong>Redis Stack 8</strong><small>활성 캔버스 · 실시간 데이터</small></a>
          </div>
          <section className="docs-db-subsection" id="db-sql">
            <div className="docs-subsection-heading"><span>SQL SERVER / DDL</span><h3>관계형 테이블과 제약</h3></div>
            <div className="docs-table-scroll"><table className="docs-api-table docs-schema-table"><thead><tr><th>테이블</th><th>키</th><th>주요 컬럼·관계</th><th>역할</th></tr></thead><tbody>{sqlTables.map(([table, key, columns, purpose]) => <tr id={schemaRowId('sql', table)} key={table}><td><code>{table}</code></td><td><code>{key}</code></td><td>{columns}</td><td>{purpose}</td></tr>)}</tbody></table></div>
            <p className="docs-db-caption">관계 요약: <code>users 1—1 user_sessions</code> · <code>canvas_info N—1 redis_server/cpp_server</code> · <code>user_sessions N—1 canvas_info/cpp_server</code>. FK는 삭제·갱신 시 NO ACTION입니다. users의 OAuth 부분 인덱스·nickname 인덱스와 세션 정리·서버 할당 인덱스도 생성합니다. user_id는 외부 공개 식별자가 아닙니다.</p><div className="docs-note"><strong>마이그레이션 동작</strong><p>초기화 SQL은 과거 users 접속 컬럼을 <code>user_sessions</code>로 옮긴 뒤 제거하고, <code>canvas_cache</code>와 서버 IP·포트 자연키 참조를 현재 ID FK로 정규화합니다. 중복 C++ 서버 행은 연결된 캔버스·세션 참조를 유지할 서버 ID로 합칩니다. 이 SQL은 관리자 초기화 경로에서 적용합니다.</p></div>
          </section>
          <section className="docs-db-subsection" id="db-es">
            <div className="docs-subsection-heading"><span>ELASTICSEARCH / DOCUMENT</span><h3>캔버스 문서 인덱스</h3></div>
            <p className="docs-db-intro">인덱스 이름은 <code>ES_INDEX</code> 설정을 사용하며 기본값은 <code>canvas</code>입니다. 문서 <code>_id</code>는 canvas ID입니다. 캔버스 목록·이름 검색에 사용하고, C++ unload 시 최종 문서가 저장됩니다. 임의 형식 아이템의 동적 매핑 충돌을 막기 위해 저장 시 <code>items</code> JSON을 <code>items-b64</code>로 분할 인코딩하고 읽을 때 복원합니다. 기존 <code>items</code> 문서도 계속 읽습니다.</p>
            <div className="docs-table-scroll"><table className="docs-api-table docs-schema-table"><thead><tr><th>필드</th><th>의미</th></tr></thead><tbody>{canvasDocumentFields.map(([field, meaning]) => <tr id={schemaRowId('es', field)} key={field}><td><code>{field}</code></td><td>{meaning}</td></tr>)}</tbody></table></div>
            <div className="docs-note"><strong>중요</strong><p><code>people</code>, <code>admin-user-id</code>, <code>inner-group</code>에는 내부 사용자 ID가 저장됩니다. 검색/공개 API 응답은 표시 가능한 닉네임·태그만 내려주고, 저장 문서 전체를 클라이언트에 반환하면 안 됩니다.</p></div>
          </section>
          <section className="docs-db-subsection" id="db-redis">
            <div className="docs-subsection-heading"><span>REDIS STACK / REDISJSON</span><h3>활성 캔버스 문서</h3></div>
            <p className="docs-db-intro">Redis Stack은 기본 <code>idx:canvas</code> 검색 인덱스와 캔버스별 <code>canvas:{'{canvasId}'}</code> RedisJSON key를 사용합니다. 활성 C++ 서버가 작업 문서를 읽고 아이템·채팅 변경은 Canvas별 FIFO 저장 큐, 설정은 Redis revision CAS를 사용합니다. 마지막 Canvas WebSocket 연결이 닫히면 최종 문서를 Elasticsearch에 반영하고 캐시 할당을 해제합니다. RTC 신호 연결만으로 Canvas를 활성 상태로 유지하지 않습니다.</p>
            <div className="docs-table-scroll"><table className="docs-api-table docs-schema-table"><thead><tr><th>RedisJSON path</th><th>논리 타입</th><th>설명</th></tr></thead><tbody>{redisDocumentFields.map(([path, type, meaning]) => <tr id={schemaRowId('redis', path)} key={path}><td><code>{path}</code></td><td>{type}</td><td>{meaning}</td></tr>)}</tbody></table></div>
            <div className="docs-note"><strong>데이터 수명 주기와 오류 처리</strong><p>Redis는 활성 Canvas의 작업 사본입니다. C++ unload/save와 Spring 설정 변경이 Elasticsearch 문서를 동기화합니다. 활성 Redis 문서를 읽을 수 없거나 저장 큐에서 오류가 나면 오래된 ES 문서로 조용히 대체하지 않고 fail-closed 처리합니다. 저장 실패가 난 Canvas는 후속 저장·unload를 멈춰 캐시를 보존하므로 운영 확인이 필요합니다.</p></div>
          </section>
        </section>
        <section className="docs-section docs-rules" id="rules"><SectionTitle eyebrow="06 / IMPLEMENTATION NOTES" title="보안·공통 규칙" /><ul><li>일반 API는 로그인 JWT, 실시간 접속은 캔버스 전용 토큰을 사용합니다.</li><li>캔버스 비밀번호는 서버에서 해시 저장되며 평문이나 해시를 응답에 포함하지 않습니다.</li><li>브라우저 공개 응답과 WebSocket 이벤트에 내부 사용자 ID를 넣지 않습니다. 참여자 관리 키는 nickname + tag_number입니다.</li><li>포스트잇은 변경 후 item_save로 자동 저장하며, 텍스트·코드는 Ctrl + S로 저장합니다. 입력 중 Automerge 변경과 객체 좌표는 WebRTC 데이터 채널로 피어에게 전달합니다.</li><li>기본 주소: Spring <code>127.0.0.1:8080</code>, 내부 C++ REST <code>127.0.0.1:8000</code>, 첫 WebSocket 포트 <code>8002</code>.</li><li>별도 프런트엔드 도메인에서 API를 호출할 때만 Spring <code>CORS_ALLOWED_ORIGINS</code>를 지정합니다. 같은 도메인 배포는 Nginx 경유를 권장합니다.</li></ul></section>
        <footer className="docs-footer"><Link to="/">← FreLog 홈으로</Link><span>API는 project-agora-BE/API_SPEC.md, DB는 project-agora-DB의 현재 초기화 스키마를 기준으로 갱신했습니다.</span></footer>
      </article>
    </div>
  </main>;
}
