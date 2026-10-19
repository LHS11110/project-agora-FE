# 데이터베이스 ERD — 2026-10-19

[편집 가능한 ERD 캔버스 #2048](https://112.168.71.147/canvases/2048)

현재 실행 중인 SQL Server `agora_db`의 시스템 카탈로그를 조회했습니다.
테이블 5개·컬럼 36개·외래 키 5개를 원래 이름과 타입으로 표시합니다.
PK, FK, IDENTITY, NULL 허용, 단일·복합 UNIQUE 및 관계의 선택성을 포함합니다.

| 부모 | 자식 | 실제 FK | 관계 |
|---|---|---|---|
| users | user_sessions | user_sessions.user_id → users.user_id | 사용자당 세션 0..1행, 세션의 사용자 1행 |
| cpp_server | user_sessions | user_sessions.cpp_server_id → cpp_server.server_id | 서버당 세션 0..N행, 세션의 서버 0..1행 |
| canvas_info | user_sessions | user_sessions.canvas_id → canvas_info.canvas_id | 캔버스당 세션 0..N행, 세션의 캔버스 0..1행 |
| cpp_server | canvas_info | canvas_info.cpp_server_id → cpp_server.server_id | 서버당 캔버스 0..N행, 캔버스의 서버 0..1행 |
| redis_server | canvas_info | canvas_info.redis_id → redis_server.redis_id | Redis 등록당 캔버스 0..N행, 캔버스의 Redis 등록 0..1행 |

모든 FK가 활성화·신뢰 상태이고 DELETE / UPDATE는 NO ACTION입니다.
`user_sessions.user_id`는 PK이자 FK입니다. 계정마다 세션 행이 반드시 존재한다는 제약은 아니므로 1:0..1로 표시했습니다.
Redis·Elasticsearch 문서는 SQL 테이블이나 SQL FK로 표현하지 않고 하단에서 저장 경계를 설명합니다.
ES `canvas` 인덱스 매핑도 읽기 전용으로 확인했습니다. 실제 계정 값이나 문서 본문은 산출물에 포함하지 않았습니다.

- [PDF](database-erd.pdf) / [SVG](database-erd.svg) / [PNG](database-erd.png)
- [편집 가능한 캔버스 원본](database-erd.canvas.json)
- [SQL 메타데이터](schema.json) / [ES 매핑](elasticsearch-mapping.json)
- [브라우저 저장·재조회 검증](validation.json)

176개 네이티브 객체로 구성했습니다. 테이블별 그룹이 있고 표·텍스트·관계선을 편집할 수 있습니다.
RedisJSON 저장 내용과 새로고침 후 객체 ID·본문·스타일을 비교했으며 서버 거절이나 브라우저 오류는 없었습니다.
빈 제약 셀은 객체를 만들지 않고 컬럼 이름은 일반 텍스트로 표시해 밑줄을 그대로 보존합니다.

재생성:

```sh
python3 scripts/read-database-erd.py
node scripts/generate-database-erd.mjs
```

브라우저 작성 도구 `scripts/create-database-erd-browser.mjs`는 소유자 전용 세션 파일과 Playwright 경로를 환경변수로 받습니다.
기존 다른 객체를 가진 캔버스에는 적용하지 않도록 접두어를 확인합니다. 인증 토큰은 저장소에 남기지 않습니다.
