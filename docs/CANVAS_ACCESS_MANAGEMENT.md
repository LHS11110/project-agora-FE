# Canvas group and bot management

Canvas settings expose group lifecycle and bot controls to `can_manage` users. New groups start read-only; the existing permissions table grants read/write/execute independently. Managers can select the initial participant group, rename a group, save its registered members, and delete unused groups. The owner cannot leave `admin-group`; that group cannot be renamed/deleted or have its capabilities reduced. The initial group and groups referenced by objects cannot be deleted. Renaming migrates object ACL strings, arrays and object keys while retaining locks and other metadata.

Existing settings protocol: `canvas_settings_update` with request_id, expected_revision, field and value. New fields:

- `group_create`: `{name, permissions?: {read,write,execute}}`
- `group_members`: `{name, members:[{nickname,tag_number}]}`
- `group_initial`: `{name}` (readable, non-admin group)
- `group_rename`: `{name,new_name}`
- `group_delete`: `{name}`

Names are at most 80 UTF-8 bytes, with no dots/control characters or prototype-reserved names. Limits: 128 groups and 1000 explicitly selected members in one update. Membership uses registered handles, never caller-supplied internal user IDs. The settings response adds `groups`, `initial_group` and `owner` (nickname/tag handle). Existing DTO constructors remain compatible.

Each mutation uses the existing admin/revision checks, Redis compare-and-set, Elasticsearch persistence/compensation, settings revision increment and broker reconnect broadcast. Root Elasticsearch map fields are explicitly replaced rather than recursively merged, preventing renamed/deleted groups from reappearing. Renamed item ACLs are persisted through items-b64 chunks.

Bot UI uses existing canvas-scoped bot HTTP APIs, followed by an awaited settings `participant_add` to the selected readable group. `participant_add` accepts an optional `group` field; otherwise it uses the initial group. Failed enrollment triggers credential revocation. Creation and rotation reveal the token once, masked by default, with explicit copy/download actions. Credentials are not placed in canvas objects or localStorage. The JSON download includes version, public origin, bot metadata and token. Revocation disables the credential first, then removes membership to close active sockets. Failed membership removal can be retried even after revocation; the existing lease remains bounded to 60 seconds.

UI verification: `tests/integration/canvas-group-bots.mjs` covers create/rename/members/initial/delete, owner protection, bot enrollment, credential download, rotation, revocation and mobile dialog bounds. Server coverage includes cpp/tests/group_management_tests.cpp and real isolated canvas checks for ACL enforcement, durable rename persistence, read-only bots and access revocation. All verification canvases/accounts are removed after testing.
