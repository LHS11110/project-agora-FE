# 처음 clone한 뒤 실행하기

Docker Engine, Docker Compose v2, Python 3.10 이상, OpenSSL이 필요합니다. Docker로 실행하면 호스트에 Java·Node·Nginx를 설치할 필요는 없습니다. SQL Server 이미지는 `linux/amd64`를 사용하므로 다른 아키텍처에서는 Docker의 해당 플랫폼 실행 지원이 필요합니다.

세 저장소를 clone하고 BE 서브모듈을 준비합니다. 다른 경로에 두었다면 설정 명령의 `--backend-dir`, `--db-dir`로 지정할 수 있습니다.

```bash
git clone https://github.com/LHS11110/project-agora-FE.git
git clone --recurse-submodules https://github.com/LHS11110/project-agora-BE.git
git clone https://github.com/LHS11110/project-agora-DB.git
```

## 1. 인증서 직접 준비

인증서와 개인 키는 직접 발급·생성하여 아래 구조로 넣습니다. 설정 명령은 인증서를 생성하거나 교체하지 않습니다. 프로젝트 밖의 디렉터리에 보관하고, CA 개인 키는 이 디렉터리에 넣거나 컨테이너에 전달하지 않습니다.

```text
certificates/
  fullchain.pem                 # Nginx 서버 인증서와 중간 인증서 체인
  privkey.pem                   # Nginx 서버 개인 키
  root-ca.pem                   # Nginx 및 내부 서비스의 신뢰 CA 묶음
  internal/
    spring/{fullchain.pem,privkey.pem,ca.pem}
    cpp/{fullchain.pem,privkey.pem,ca.pem}
    frontend/{fullchain.pem,privkey.pem,ca.pem}
    redis-insight/{fullchain.pem,privkey.pem,ca.pem}
  mssql/{server.crt,server.key,ca.crt}
  redis/{server.crt,server.key,ca.crt}
  elasticsearch/{http.crt,http.key,ca.crt}
```

각 `ca.pem`·`ca.crt`에는 공개 CA 인증서만 넣습니다. 서버 인증서는 leaf 인증서부터 중간 인증서 순서로 이어 붙입니다. 개인 키는 암호 입력 없이 서비스가 읽을 수 있어야 하며 소유자에게만 읽기 권한을 줍니다. SQL Server용 `server.key`는 암호화되지 않은 RSA PKCS#1 형식입니다. Redis 노드 및 Sentinel은 동일한 인증서 묶음을 사용하므로 아래 주소를 모두 SAN에 포함합니다.

| 인증서 | 기본 구성에 필요한 SAN |
| --- | --- |
| Nginx | `localhost`, IP `127.0.0.1`, `agora-nginx`; 별도 공개 도메인을 쓰면 그 도메인도 포함 |
| Spring | `agora-spring`, `localhost` |
| C++ | `agora-cpp`, `localhost` |
| Vite | `agora-frontend-dev`, `localhost` |
| Redis Insight | `redis-insight`, `localhost`, IP `127.0.0.1` |
| SQL Server | `agora-mssql`, `mssql`, `localhost`, IP `127.0.0.1` |
| Redis·Sentinel | IP `172.20.0.2`, `172.20.0.7`, `172.20.0.5`, `172.20.0.6`, `172.20.0.3`, `172.20.0.4` |
| Elasticsearch | `agora-elasticsearch`, `localhost`, IP `127.0.0.1` |

Nginx·Spring·C++·Vite·Redis Insight 인증서는 `root-ca.pem`의 CA 묶음으로 검증할 수 있어야 합니다. DB 인증서는 별도 CA를 사용할 수 있으며 설정 명령이 그 공개 CA를 BE에 연결합니다. 사설 CA를 사용한다면 접속할 브라우저 또는 시스템의 신뢰 저장소에 Nginx CA를 직접 등록합니다. 기본 Docker 주소를 변경하면 인증서 SAN과 `.env`의 주소도 함께 맞춥니다. 설정 검사는 체인, 키 일치, SAN, 남은 유효 기간 30일 이상을 확인합니다.

## 2. 나머지 설정 준비

FE 저장소에서 실행합니다. 인증서 경로가 상대 경로여도 설정에는 절대 경로로 기록됩니다.

```bash
python3 scripts/setup-projects.py --tls-dir /path/to/certificates
```

다른 저장소 경로나 공개 주소를 사용한다면 다음과 같이 지정합니다.

```bash
python3 scripts/setup-projects.py \
  --backend-dir /path/to/project-agora-BE \
  --db-dir /path/to/project-agora-DB \
  --tls-dir /path/to/certificates \
  --public-origin https://app.example.com
```

이 명령은 세 프로젝트의 `.env`를 만들고, placeholder 비밀번호·JWT 키·내부 토큰을 독립 난수로 바꾸며, DB 계정과 CA 경로를 BE에 동기화합니다. 기존 비밀번호는 보존하고 파일 권한은 `0600`으로 설정합니다. 인증서가 없거나 검증에 실패하면 중단하고 파일 또는 검증 문제를 안내합니다. 서비스는 아직 시작하지 않습니다. 초기 관리자 비밀번호는 BE `.env`의 `ADMIN_PASSWORD`를 직접 확인하며 로그에 출력되지 않습니다.

## 3. 실행

```bash
cd ../project-agora-DB
python3 ops/configure-db.py prepare-storage
python3 ops/configure-db.py validate --profile development
docker compose up -d --wait --wait-timeout 240
./mssql/init-mssql.sh
./redis/init-redis-sentinel.sh
./elasticsearch/ensure-elasticsearch-initialized.sh
./elasticsearch/sync-elasticsearch-users.sh

cd ../project-agora-BE
git submodule update --init --recursive
./scripts/backend-docker.sh up
./scripts/nginx-docker.sh development

cd ../project-agora-FE
docker compose -f compose.dev.yaml up -d --build --wait
```

기본 접속 주소는 **https://localhost:8443**입니다. HTTP·WS 접속은 제공하지 않으며 인증서 오류를 무시하는 옵션은 사용하지 않습니다. DB가 SQL Server·Redis Insight의 TLS 볼륨을 직접 초기화하므로 BE보다 먼저 시작할 수 있습니다. 컨테이너는 필요한 서버 키와 공개 CA만 복사하여 서비스 UID에 맞는 권한을 적용합니다.

인증서를 갱신한 경우 같은 설정 명령으로 검증한 뒤 DB의 TLS 초기화 서비스와 BE의 `service-tls-init`을 다시 실행하고 해당 서비스들을 재시작합니다. 데이터 볼륨은 삭제하지 않습니다. 운영 HA의 listener·사설 주소·외부 snapshot/백업 저장소는 [DB 운영 안내](../../project-agora-DB/ops/README.md)의 별도 구성 대상입니다.
