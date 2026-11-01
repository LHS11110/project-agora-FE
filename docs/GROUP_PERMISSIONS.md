# 캔버스 접근 그룹 권한

캔버스 설정의 **그룹 접근 권한**에서 관리자가 읽기·쓰기·실행을 독립적으로 설정합니다. 프로필을 모아 표시하는 ‘사용자 그룹’ 객체와는 별개인 실제 접근 그룹입니다.

- 읽기: 캔버스, 객체, 코드, 결과, 채팅/댓글 내역을 조회합니다. 커서·선택 표시·레이저도 사용할 수 있습니다.
- 쓰기: 그룹의 객체를 생성·이동·편집·삭제하고, 채팅/댓글을 작성합니다. 객체 잠금은 그대로 적용됩니다.
- 실행: 코드를 실행하고 실행 결과 객체의 결과 데이터만 갱신합니다. 위치·스타일 등은 쓰기가 필요합니다. 실행 환경의 설정·리소스·초기화는 쓰기와 실행이 모두 필요합니다.

쓰기 또는 실행을 켜면 읽기도 켜집니다. 읽기를 끄면 나머지도 꺼집니다. 여러 그룹의 허용 권한은 합산하되 객체 자체의 ACL과 함께 검사합니다. 관리자 그룹은 항상 모든 권한을 유지합니다.

저장 형식은 캔버스 문서의 `group-permissions`입니다.

```json
{"default":{"read":true,"write":false,"execute":true}}
```

설정이 없거나 해당 그룹이 생략된 기존 문서는 기존 동작을 유지합니다. 설정이 있는 경우 각 필드를 명시적인 boolean으로 검증합니다. 관리자는 그룹 권한을 갱신하는 `canvas_settings_update` 이벤트에 `field: "group_permissions"`, 위 객체를 `value`, 현재 `expected_revision`을 보냅니다. 설정 응답에는 `group_permissions`, `can_manage`가 포함됩니다. 초기 연결에는 읽기 그룹 `groups`, `write_groups`, `execute_groups`, `is_admin`이 포함됩니다.

C++는 저장·이동·삭제·결과 갱신·채팅을 검사합니다. Spring은 최신 Redis/ES 메타데이터로 읽기와 코드 실행·실행 환경 관리를 검사합니다. 설정 변경은 기존 revision 검증과 재연결 통지로 이미 연결된 클라이언트에도 적용됩니다. 브로커의 필터는 읽기 그룹만 사용하며 쓰기/실행 그룹이 읽기 범위를 넓히지 않습니다.

Elasticsearch의 `group-permissions`는 `_source`에는 보관하지만 `enabled:false`로 동적 필드 확장을 막습니다. 초기화 스크립트에 동일한 매핑을 반영했습니다. SQL 스키마 변경은 없습니다.

기존 `peoples` 같은 별칭이 최신 `people`보다 우선하던 문제도 수정했습니다. Redis와 ES를 읽을 때 정식 필드를 우선하고, 새 문서에는 중복 호환 필드를 직렬화하지 않습니다.

검증: `groupPermissions.test.js`, `integration/group-permissions.mjs`, Spring `CanvasGroupPermissionsTest`·`CanvasRuntimeControllerTest`, C++ `query_tests`·`broker_operations_tests`, 브로커 `group_permissions_test.exs`. 브라우저 UI 테스트의 HTTP와 WSS는 격리된 fixture이며, 배포 환경에서는 별도 임시 사용자와 캔버스로 저장, 실제 거부 응답, 권한 갱신을 확인합니다. VM 생성 없이 실행 권한 검사를 검증할 수 있도록 허용 상태에서 잘못된 언어의 입력 검증까지 도달하는지 구분합니다.
