# 캔버스 실행 환경

캔버스 상단 **실행 환경**을 열어 언어, 컴파일러·인터프리터, 옵션을 고른 뒤
**이 언어에 적용**을 누릅니다. 설정은 서버에 저장되며 같은 캔버스 참가자가 공유합니다.
다음 코드 객체 실행과 블루프린트 실행부터 적용됩니다.

| 언어 | 설치된 선택지 | 설정 |
| --- | --- | --- |
| C++ | Clang 19/21, GCC 14 | C++11/14/17/20/23, O0–O3, 경고, Werror, 예외, RTTI |
| C | Clang 19/21, GCC 14 | C11/17/23, O0–O3, 경고, Werror |
| Python | 3.11/3.12/3.13/3.14/3.15 | 최적화, 바이트코드 파일, 경고 처리 |
| Java | Temurin JDK 17/21/25 | 대상 Java 버전, 힙 한도, assert, preview |
| JavaScript | Node.js 20/22/24 | strict 모드, 경고 |
| Shell | Bash 5.2 | errexit, nounset, pipefail |

설정 변경 시 해당 언어의 변수·함수가 초기화됩니다. 다른 언어의 메모리, 저장 파일,
기존 출력은 유지됩니다. 같은 설정을 다시 적용하면 초기화하지 않습니다.

Clang은 JIT로 변수·함수를 이어서 사용합니다. GCC는 main이 필요한 독립 프로그램이며
코드 객체 간 메모리를 공유하지 않습니다. 변경되지 않은 소스의 실행 파일은 재사용합니다.
Java는 JShell API로 변수·함수를 유지하며 main을 가진 클래스를 실행할 수 있습니다.
Java 대상 버전은 선택한 JDK 이하만 가능하고 preview는 두 버전이 같아야 합니다.
Python 버전마다 패키지를 별도로 설치해야 합니다. Shell의 pip는 선택한 버전으로 설치합니다.

실행 중에는 설정을 바꿀 수 없습니다. 다른 참가자가 먼저 수정했으면 **다시 불러오기**로
최신 설정을 받아 수정합니다. 설치되지 않은 버전이나 임의 명령 인자는 사용할 수 없습니다.

설정은 `GET/PUT /api/canvases/{id}/runtime/settings`를 사용합니다. 기존 실행 API는
그대로 유지하고 실행 관리자가 서버에 저장된 설정을 선택합니다. 백엔드는 캔버스 접근
권한과 비밀번호 인증을 확인하며 실행 관리자는 옵션을 허용 목록으로 검증합니다.

UI 회귀 검증은 Vite 서버와 실제 관리자의 settings_get 응답 JSON을 준비한 뒤 실행합니다.

```bash
AGORA_E2E_RUNTIME_CATALOG=/path/to/settings.json \
AGORA_E2E_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
AGORA_E2E_ORIGIN=https://localhost:5191 \
node tests/integration/runtime-settings.mjs
```

로컬 개발용 자체 인증서 서버에만 `AGORA_E2E_INSECURE_LOCAL_TLS=1`을 지정할 수 있습니다.
실제 VM의 모든 런타임 버전 검증은 hypervisor-for-agora의
`sudo python3 runtime/tests/profiles_integration.py`를 사용합니다.


## VM 사양 선택

같은 창의 **VM 리소스**에서 소형(1 vCPU/1 GiB), 표준(2 vCPU/2 GiB),
고성능(4 vCPU/4 GiB)을 선택하고 **VM 템플릿 적용**을 누릅니다. 모든 템플릿의
디스크는 기본 6 GiB이며 아래에서 별도로 확장할 수 있습니다. 변경 시 VM을 종료하고 다음 실행에서 새 사양으로 시작합니다.
작업 파일은 유지되고 모든 언어의 변수·함수는 초기화됩니다. 언어 옵션을 바꿀 때는
해당 언어만 초기화되는 것과 차이가 있습니다.

템플릿 역시 참가자들이 공유하고 서버에 저장됩니다. 실행 중에는 변경할 수 없습니다.
전체 서버의 VM RAM 합계 8 GiB, vCPU 합계 8개, 동시 VM 4개 한도를 넘거나 호스트의
여유 메모리가 부족하면 실행할 수 없습니다. 비활성 캔버스의 설정 저장은 자원을
예약하지 않습니다. 실제 VM 메모리 일부는 OS에 필요하므로 코드 워커의 합계 메모리
한도는 각각 768/1536/3072 MiB입니다.

API: `PUT /api/canvases/{id}/runtime/resources`, 본문은
`{template: "small" | "medium" | "large", revision, passwordGrant?}`입니다.
설정 읽기 API에서 템플릿 목록과 선택값도 받습니다.


## 디스크 용량 선택

**실행 환경 → VM 디스크**에서 6/12/24 GiB를 선택하고 **디스크 용량 적용**을 누릅니다.
OS와 설치 패키지를 포함한 전체 용량입니다. 확장 시 VM을 종료하며 모든 언어의
변수·함수는 초기화되고 저장 파일은 보존됩니다. 축소는 지원하지 않습니다.
선택한 용량은 서버에 저장되어 다음 실행과 VM 이미지 업그레이드 후에도 유지됩니다.

기존 디스크를 안전하게 복사해 확장하므로 서버에는 목표 용량 전체와 8 GiB 여유가
추가로 필요합니다. 공간이 부족하면 원본과 현재 VM을 유지하고 요청을 거부합니다.
확장 도중 오류가 나면 원본을 보존하며 VM은 중지된 상태일 수 있어 다음 실행으로
다시 시작할 수 있습니다. 실행 중인 코드가 있으면 변경할 수 없습니다.

`PUT /api/canvases/{id}/runtime/disk`의 본문은 `{sizeGiB, revision, passwordGrant?}`입니다.
실제 VM 검증은 hypervisor-for-agora의 `sudo python3 runtime/tests/disk_integration.py`를 사용합니다.

## Java 외부 라이브러리

**실행 환경 → 프로그래밍 언어: Java → Maven 라이브러리**에
`group:artifact:version`을 한 줄씩 입력하고 **이 언어에 적용**을 누릅니다.
설정 저장 후 Maven 다운로드와 JShell 클래스패스 연결 준비가 자동으로 진행됩니다.
완료 메시지가 뜨면 Java 코드 객체에서 import하여 사용합니다. 실패하면 저장된
설정으로 **라이브러리 설치 / 다시 시도**를 누릅니다.

검증에 사용한 좌표:

```text
org.apache.commons:commons-lang3:3.17.0
com.fasterxml.jackson.core:jackson-databind:2.18.2
```

```java
import org.apache.commons.lang3.StringUtils;
System.out.println(StringUtils.reverse("agora"));
```

Maven Central의 고정된 릴리스 버전을 최대 20개까지 지정합니다. 같은 라이브러리의
서로 다른 버전을 중복 지정할 수 없으며 하위 의존성도 함께 설치합니다.
설치와 재시도는 Java 변수·함수를 초기화하고 다른 언어의 메모리는 유지합니다.
다운로드 캐시는 VM의 `/workspace/.m2/repository`, 클래스패스는
`/workspace/.java-dependencies`에 저장되어 VM 재시작 후에도 사용할 수 있습니다.
JDK를 변경하면 해당 JDK용 클래스패스를 다시 준비하며 이미 받은 JAR은 재사용합니다.

설치는 일반 코드 실행의 15초 제한과 분리된 작업이며 최대 약 3분이 걸릴 수 있습니다.
설치 중에는 해당 VM의 실행·설정 변경이 제한됩니다. 설치 전 실행하면 먼저 설치하라는
메시지를 출력합니다. 준비 API는 `POST /api/canvases/{id}/runtime/java/dependencies`이며
본문은 `{passwordGrant?}`입니다. Java 설정의 `dependencies`는 좌표 문자열 배열입니다.

실제 VM 검증: hypervisor-for-agora의
`sudo python3 runtime/tests/java_dependencies_integration.py`.
운영 UI/블루프린트 검증: 빈 임시 캔버스와 인증 상태 파일을 준비하여
`AGORA_E2E_STATE=... node tests/integration/java-dependencies.mjs`를 실행합니다.
기존 테스트와 같이 origin, Playwright 모듈, Chrome 실행 파일을 환경 변수로 지정할 수 있습니다.
이 테스트는 지정한 빈 캔버스에 Java·Python 코드/실행/결과 객체를 만들고
실제 Java 의존성 다운로드와 pip NumPy 설치, 블루프린트 실행 결과를 검증합니다.

Python NumPy 단독 실제 VM 테스트는
`sudo python3 runtime/tests/numpy_integration.py`입니다. 검증 당시
Python 3.12.16에서 pip로 NumPy 2.5.4를 설치하고 배열 변환, 선형방정식,
내적 계산과 VM 재시작 후 재사용을 확인했습니다.


Python 3.14와 3.15도 **실행 환경 → Python → 컴파일러 / 인터프리터**에서 선택합니다.
기존 기본값은 3.12이며, 버전을 변경하면 Python 메모리가 초기화됩니다.
패키지는 버전별 경로를 사용합니다. Shell의 pip는 선택한 Python 버전을 따릅니다. 먼저 3.15를 선택하고 `pip install numpy`를
실행하면 됩니다. 아래처럼 버전별 경로를 명시하는 명령도 사용할 수 있습니다.

```bash
LD_LIBRARY_PATH=/opt/python/3.15/lib \
PYTHONPATH=/workspace/.python/3.15 \
PIP_TARGET=/workspace/.python/3.15 \
/opt/python/3.15/bin/python3.15 -m pip install --only-binary=:all: numpy
```

3.14는 경로의 3.15를 3.14로 바꿉니다. Python 코드에서 설치할 때는 현재 인터프리터인
`sys.executable`과 `-m pip`를 사용하면 버전이 일치합니다.


Shell에서 `pip install numpy` 또는 `pip3 install numpy`를 실행한 후 Python 코드 객체에서
`import numpy as np`를 사용하면 됩니다. 실행 환경의 버전을 변경하면 다음 Shell 실행부터
python/pip도 같은 버전으로 바뀝니다. 기존 Shell 변수는 유지되지만 Python 버전 변경에
따른 Python 변수 초기화와 버전별 패키지 분리는 기존과 같습니다.
