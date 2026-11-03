# Canvas group and bot management

Canvas settings expose group lifecycle and bot controls to `can_manage` users. New groups start read-only; the existing permissions table grants read/write/execute independently. Managers can select the initial participant group, rename a group, save its registered members, and delete unused groups. The owner cannot leave `admin-group`; that group cannot be renamed/deleted or have its capabilities reduced. The initial group and groups referenced by objects cannot be deleted. Renaming migrates object ACL strings, arrays and object keys while retaining locks and other metadata.

Existing settings protocol: `canvas_settings_update` with request_id, expected_revision, field and value. New fields:

- `group_create`: `{name, permissions?: {read,write,execute}}`
- `group_members`: `{name, members:[{nickname,tag_number}]}`
- `group_initial`: `{name}` (readable, non-admin group)
- `group_rename`: `{name,new_name}`
- `group_delete`: `{name}`

Names are at most 80 UTF-8 bytes, with no dots/control characters or prototype-reserved names. Limits: 64 groups and 1000 explicitly selected members in one update. Membership uses registered handles, never caller-supplied internal user IDs. The settings response adds `groups`, `initial_group` and `owner` (nickname/tag handle). Existing DTO constructors remain compatible.

Each mutation uses the existing admin/revision checks, Redis compare-and-set, Elasticsearch persistence/compensation, settings revision increment and broker reconnect broadcast. Root Elasticsearch map fields are explicitly replaced rather than recursively merged, preventing renamed/deleted groups from reappearing. Renamed item ACLs are persisted through items-b64 chunks.

Bot UI uses existing canvas-scoped bot HTTP APIs, followed by an awaited settings `participant_add` to the selected readable group. `participant_add` accepts an optional `group` field; otherwise it uses the initial group. Failed enrollment triggers credential revocation. Creation and rotation reveal the token once, masked by default, with explicit copy/download actions. Credentials are not placed in canvas objects or localStorage. The JSON download includes version, public origin, bot metadata and token. Revocation disables the credential first, then removes membership to close active sockets. Failed membership removal can be retried even after revocation; the existing lease remains bounded to 60 seconds.

UI verification: `tests/integration/canvas-group-bots.mjs` covers create/rename/members/initial/delete, owner protection, bot enrollment, credential download, rotation, revocation and mobile dialog bounds. Server coverage includes cpp/tests/group_management_tests.cpp and real isolated canvas checks for ACL enforcement, durable rename persistence, read-only bots and access revocation. All verification canvases/accounts are removed after testing.

## Participant role picker and default object sharing

The participant management dialog provides searchable role badges and a searchable checkbox picker per participant. Adding/removing one role sends the complete intended role set for that registered participant in a single revision-checked `participant_groups` mutation: `{nickname, tag_number, groups:[name,...]}`. Only canvas administrators may perform it. The owner must retain `admin-group`. Public canvas initial roles are shown as inherited where appropriate. Existing group-wide membership editing remains available in settings.

The authoritative C++ identity and initial response now expose `member_groups` separately from readable `groups`, `write_groups`, and `execute_groups`. New browser objects, drawing streams, clipboard paste, canvas-as-code and Python SDK 0.1.1 default to **all memberships**. A read-only role is included in the object's ACL without receiving write rights. C++ also fills the membership ACL when a create request omits `permission`, and rejects non-admin creation targeting foreign groups. An explicitly supplied narrower ACL remains supported. Existing objects retain their stored ACL.

Object visibility is OR across readable shared groups; users with disjoint groups receive neither the object in a snapshot nor its broadcast payload. Administrators retain full visibility. Membership revocation invalidates the existing broker identity, and the automatic reconnect loads a fresh filtered snapshot, evicting objects that are no longer visible. On public canvases, the initial group is shared implicitly: members of that common group are not disjoint. To isolate teams, use separate groups and avoid giving both teams the same readable role.

Validated using temporary registered accounts and an isolated private canvas against the deployed C++/Phoenix/SQL/Redis/Elasticsearch stack: multi-role default ACL including read-only roles, live/snapshot/new-user filtering, write denial, role/policy forgery denial, foreign ACL denial, owner protection, server-side defaulting and automatic revocation/grant convergence. Temporary accounts and canvas are removed after the test. UI coverage extends `tests/integration/canvas-group-bots.mjs` with role search/add/remove/owner protection and mobile bounds; unit coverage includes `tests/creationGroups.test.js`, C++ group/query/broker operation suites and Python SDK tests.


## 64비트 그룹 접근 검사

관리자·기본 그룹을 포함해 캔버스당 최대 64개 그룹을 허용합니다. `group-bits`는 그룹 이름에 0~63의 고정 슬롯을 부여하는 저장용 메타데이터입니다. 기존 문서는 처음 변경할 때 이 필드를 저장하며, 읽을 때는 동일한 파생 레이아웃으로 호환됩니다. 이름 변경은 슬롯을 유지하고, 참조 중인 그룹은 삭제하지 못합니다. 슬롯을 반환한 뒤 새 그룹이 사용해도 알 수 없는 이름을 다른 그룹의 비트로 해석하지 않습니다. 설정 리비전이 바뀌면 브로커 인증을 다시 수행합니다.

`group-permissions`의 저장 값은 읽기=1 (`001`), 쓰기=2 (`010`), 실행=4 (`100`)을 조합한 0~7 정수입니다. 읽기 없이 쓰기·실행을 허용하지 않는 기존 규칙을 유지합니다. 관리자 그룹은 7입니다. 이전 불리언 맵도 읽고, 설정 API는 불리언 맵 또는 정수 입력을 지원합니다. UI용 `group_permissions` 응답은 이전 불리언 형태를 유지합니다.

핵심 검사는 `(객체 그룹 마스크 & 사용자 권한별 그룹 마스크) != 0`입니다. C++은 `uint64_t`, Spring은 `long`, 브로커는 Elixir Bitwise, 클라이언트는 `BigInt`를 사용합니다. 사용자 마스크는 인증/요청 문맥에서 한 번 계산하고 객체의 이름 기반 ACL을 마스크로 변환한 결과를 캐시합니다. 기존 객체 `permission` 필드와 기존 클라이언트 프로토콜을 유지하며, 사용자가 보내는 임의의 마스크를 권한 근거로 신뢰하지 않습니다. 알 수 없는 그룹은 0비트로 처리합니다.

브로커 초기 응답의 `group_bits`는 그룹별 슬롯, `group_masks`는 member/read/write/execute의 **16자리 16진 문자열**입니다. JavaScript Number의 정밀도 손실과 32비트 비트 연산 잘림을 방지합니다. 예를 들어 최상위 그룹만 포함하면 `8000000000000000`입니다. 그룹 이름 메타데이터는 Elasticsearch에서 enabled:false로 보관해 이름마다 매핑 필드가 늘지 않게 합니다.

검증: C++/Java/Elixir/JavaScript의 bit 63, 불법 슬롯·중복 슬롯, 64개 제한, 이름 변경·슬롯 반환과 재사용, 3비트 조합, 권한 변경 후 캐시 교체를 검사합니다. 실제 임시 캔버스에 64개 그룹을 생성하여 65번째 거부, 최상위 비트 객체의 동일/서로소 그룹 브로드캐스트와 스냅샷 필터, 101 권한의 쓰기 거부, Redis/Elasticsearch의 정수 정책·슬롯 보존을 확인했습니다. 테스트 계정과 캔버스는 제거했습니다.

권한 검사 단독 Node 벤치마크: 64개 사용자 그룹, 객체 50,000개, 예열 후 5회 중앙값에서 기존 Set 방식 47.65ms, 캐시된 BigInt 방식 3.90ms였습니다. 전체 렌더링·네트워크·저장 성능을 나타내는 수치는 아닙니다.
