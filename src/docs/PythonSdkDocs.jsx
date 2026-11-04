import {ui} from '../i18n/locale.js';
import './python-sdk-docs.css';

export const sdkSections = [
  ['python-sdk','Python SDK'],
  ['sdk-install','설치와 연결'],
  ['sdk-auth','사용자 인증과 MFA'],
  ['sdk-bots','봇 참여자'],
  ['sdk-objects','객체 생성·편집·삭제'],
  ['sdk-sync','실시간 동기화와 오류 처리'],
];
export const botEndpoints = [
  ['POST','/api/canvases/{canvasId}/bots','캔버스 관리자','JSON { name }. 봇 계정과 한 번만 공개되는 token을 반환합니다. 생성 후 participant_add로 초대해야 하며, SDK의 create_bot()은 두 단계를 처리합니다.'],
  ['GET','/api/canvases/{canvasId}/bots','캔버스 관리자','봇 목록 { user_id, nickname, tag_number, canvas_id, active }. 비밀 토큰과 해시는 반환하지 않습니다.'],
  ['POST','/api/canvases/{canvasId}/bots/{botId}/rotate','캔버스 관리자','봇 자격 증명을 교체하고 새 token을 한 번 반환합니다. 기존 토큰으로 새 요청을 보낼 수 없습니다.'],
  ['DELETE','/api/canvases/{canvasId}/bots/{botId}','캔버스 관리자','봇 토큰을 폐기합니다. 이미 열린 WSS는 최대 60초 임대 종료 시 차단됩니다. SDK의 revoke_bot()은 먼저 참여자를 제거해 연결도 종료합니다.'],
];
const authCode = `import os
from agora_canvas import AgoraClient, MFARequired

with AgoraClient("https://frelog.p-e.kr") as client:
    try:
        client.login(os.environ["AGORA_EMAIL"],
                     os.environ["AGORA_PASSWORD"])
    except MFARequired as challenge:
        client.complete_mfa(challenge.challenge, input("MFA: "))

    with client.canvas(int(os.environ["AGORA_CANVAS_ID"])) as canvas:
        items = canvas.refresh()
        print(len(items))`;
const botCode = `import os
from agora_canvas import AgoraClient

with AgoraClient(token=os.environ["AGORA_USER_TOKEN"]) as owner:
    with owner.canvas(42) as canvas:
        created = canvas.create_bot("automation")
        bot_id = created["bot"]["user_id"]
        bot_token = created["token"]  # Save in a secret store.

with AgoraClient.from_bot(bot_token) as bot:
    with bot.canvas(42) as canvas:
        print(len(canvas.items))

# As the owner:
# owner.rotate_bot(42, bot_id)
# with owner.canvas(42) as canvas:
#     canvas.revoke_bot(bot_id)`;
const objectCode = `import os
from agora_canvas import AgoraClient

with AgoraClient(token=os.environ["AGORA_USER_TOKEN"]) as client:
    with client.canvas(42, password=None) as canvas:
        item_id = canvas.create({
            "kind": "shape", "shapeType": "rectangle",
            "x": 0.2, "y": 0.2, "width": 0.15, "height": 0.12,
            "fill": "#ddd5ff",
        })
        canvas.patch(item_id, {"fill": "#b5e5d0"})
        canvas.move([item_id], 0.01, 0)
        canvas.lock(item_id)
        canvas.lock(item_id, False)
        canvas.delete(item_id)`;
const syncCode = `import os
from agora_canvas import AgoraClient, AgoraError, OutcomeUnknown

with AgoraClient(token=os.environ["AGORA_USER_TOKEN"]) as client:
    with client.canvas(42) as canvas:
        try:
            canvas.patch(os.environ["AGORA_OBJECT_ID"],
                         {"fill": "#ddd5ff"})
        except OutcomeUnknown:
            canvas.wait_for_idle(timeout=60)  # Don't resubmit.
        except AgoraError as error:
            print(error.code, error.status)

        event = canvas.next_event(timeout=5)
        latest = canvas.refresh()`;
const methods = [
  ['canvas.peers · peer_id · presence_connected · send_cursor(x,y) · send_laser(...) · set_editing(id)', '접속자 목록과 연결 상태를 조회하고 커서·레이저·객체 편집 상태를 주고받습니다.'],
  ['client.me() · client.canvases(name) · client.create_canvas(name)','계정 조회와 캔버스 검색·생성. 봇은 캔버스 검색·생성이 제한됩니다.'],
  ['canvas.create(item) · patch(id, fields) · delete(*ids)','서버가 지원하는 도형·메모·텍스트·코드·이미지·표·드로잉·연결선 등의 객체를 생성·변경·삭제합니다.'],
  ['canvas.apply(operations) · move(ids, dx, dy) · lock(id, locked)','일괄 작업, 상대 이동과 잠금. 한 배치는 최대 512개 작업·8MiB이며 연결선은 객체 삭제 시 함께 제거합니다.'],
  ['canvas.set_text(id, text, code=False)','본문 전체를 교체하며 이전 Automerge 문서를 제거합니다. 문자 단위 협업 병합이 아니므로 동시 편집 중에는 주의하세요.'],
  ['canvas.settings() · update_settings(field, value=...)','설정 조회·변경. 변경은 관리자 전용이며 expected_revision 충돌 검사를 적용합니다.'],
  ['canvas.invite(nickname, tag_number) · remove_participant(...)','관리자가 기존 참여자 API로 사용자를 초대하거나 제외합니다.'],
  ['canvas.refresh() · canvas.items · next_event(timeout=5)','최신 스냅샷과 이벤트를 수신합니다. 객체 이벤트는 최근 256개, 커서는 참여자별 최신 위치를 유지하며 누락은 event_overflow로 알립니다.'],
  ['canvas.execute(language, code, stdin=None)','기존 런타임 API로 코드를 실행하고 결과를 반환합니다. 블루프린트 자동 순회와 결과 객체 갱신은 별도 구현이 필요합니다.'],
  ['canvas.send_event(event) · publish(event)','기존 브로커의 채팅·댓글·멘션 등 요청과 커서 같은 일방향 이벤트를 전달합니다. 서버 권한 검증은 동일합니다.'],
  ['client.request(method, path, raw=True)','기존 HTTP API를 호출합니다. raw=True 응답의 content로 파일을 읽고 files= 인자로 multipart 업로드를 요청할 수 있습니다.'],
];
function Heading({id,children}){return <h3 className="sdk-heading" id={id}>{children}</h3>;}
function Code({children}){return <pre className="sdk-code"><code>{children}</code></pre>;}
export default function PythonSdkDocs(){return <section className="docs-section python-sdk-docs" id="python-sdk">
  <div className="docs-section-title"><span className="section-kicker">PYTHON / AUTOMATION</span><h2>Python SDK</h2><p>{ui('기존 HTTPS API와 WSS 브로커를 이용해 캔버스를 자동화합니다. 익명 접속이나 DB·내부 포트 접근 없이 사용자 또는 봇의 권한으로 작업합니다.')}</p></div>
  <Heading id="sdk-install">{ui('설치와 연결')}</Heading>
  <p>{ui('Python 3.10 이상이 필요합니다. 패키지는 아직 PyPI에 게시하지 않았으므로 wheel을 내려받거나 백엔드 저장소의 sdk/python 경로에서 설치하세요.')}</p>
  <a className="button button-outline sdk-download" href="/downloads/agora_canvas-0.1.4-py3-none-any.whl" download>{ui('Python 모듈 다운로드')} <span>0.1.4 · MIT</span></a>
  <Code>{'python -m pip install ./agora_canvas-0.1.4-py3-none-any.whl\n\n# Or install from the cloned backend repository:\npython -m pip install ./project-agora-BE/sdk/python'}</Code>
  <p>{ui('외부 주소는 https://frelog.p-e.kr입니다. TLS 인증서 검증은 항상 활성화되며 내부 CA가 필요한 환경에서는 ca_file을 지정합니다. with 블록이 끝나면 연결을 정리합니다.')}</p>
  <Heading id="sdk-auth">{ui('사용자 인증과 MFA')}</Heading>
  <p>{ui('이메일·비밀번호 로그인은 MFA를 그대로 적용합니다. OAuth·패스키 로그인으로 받은 기존 사용자 토큰은 AgoraClient(token=...)에 전달합니다. 사용자 토큰은 발급받은 네트워크의 IP에 묶입니다.')}</p>
  <Code>{authCode}</Code>
  <div className="docs-note"><strong>{ui('권한은 서버가 검증합니다.')}</strong><p>{ui('사용자와 봇 모두 읽기 권한이 있어야 접속할 수 있습니다. 생성·수정·삭제는 쓰기 권한, 코드 실행은 실행 권한이 필요합니다. 객체별 그룹과 잠금도 적용하며 캔버스 비밀번호가 있으면 password 인자로 전달합니다.')}</p></div>
  <Heading id="sdk-bots">{ui('봇 참여자')}</Heading>
  <p>{ui('캔버스 소유자·관리자 그룹 사용자만 봇을 생성·관리할 수 있습니다. create_bot()은 전용 계정을 생성한 뒤 현재 캔버스에 초대합니다. 봇은 초대된 초기 그룹의 권한을 따르며 다른 캔버스나 계정 관리 API에 접근할 수 없습니다.')}</p>
  <Code>{botCode}</Code>
  <div className="docs-note"><strong>{ui('토큰 보관과 회수')}</strong><p>{ui('봇 토큰은 생성·교체 응답에서 한 번만 공개됩니다. 서버에는 해시만 저장하므로 토큰을 비밀 저장소에 보관하고 객체·채팅·Git에 넣지 마세요. CanvasSession.revoke_bot()은 참여자 제거와 토큰 폐기를 처리합니다. HTTP 폐기만 호출하면 기존 WSS는 최대 60초 후 종료되며 SDK는 정상 임대를 자동 갱신합니다.')}</p></div>
  <Heading id="sdk-objects">{ui('객체 생성·편집·삭제')}</Heading>
  <p>{ui('객체 필드는 기존 캔버스 문서 스키마를 사용하고 좌표는 정규화 좌표입니다. 예제의 캔버스 42와 환경 변수는 실제 접근 권한이 있는 값으로 바꿔 사용하세요.')}</p>
  <p>{ui('permission을 생략하면 모든 소속 그룹에 공유됩니다. 읽기 전용 그룹도 포함되며, 편집 권한은 별도로 검사합니다.')}</p>
  <p>{ui('그룹은 최대 64개입니다. capabilities.group_bits는 고정 비트 번호, group_masks는 권한별 16진 마스크입니다. Python에서는 int(mask, 16)으로 변환하세요.')}</p>
  <Code>{objectCode}</Code>
  <div className="docs-table-scroll"><table className="docs-api-table sdk-method-table"><thead><tr><th>{ui('메서드')}</th><th>{ui('동작 / 데이터')}</th></tr></thead><tbody>{methods.map(([method,description])=><tr key={method}><td><code>{method}</code></td><td>{ui(description)}</td></tr>)}</tbody></table></div>
  <Heading id="sdk-presence">{ui('일반 사용자처럼 실시간 참여')}</Heading>
  <p>{ui('사용자와 봇 모두 객체 채널과 참여 채널에 함께 접속하며 접속자 목록에 표시됩니다. 객체 변경·채팅·댓글은 next_event(), 커서·레이저·편집 상태는 canvas_relay 이벤트로 받습니다. 통화나 P2P 연결은 자동으로 시작하지 않습니다.')}</p>
  <Code>{"with client.canvas(canvas_id) as canvas:\n    canvas.send_cursor(.25, .3)\n    while True:\n        event = canvas.next_event(timeout=5)\n        if event and event[\"type\"] == \"canvas_relay\":\n            print(event[\"peer\"][\"nickname\"], event[\"payload\"])\n        elif event and event[\"type\"] == \"canvas_commit\":\n            print(event[\"changed_ids\"], event.get(\"author_id\"))"}</Code>
  <p>{ui('연결이 끊기거나 토큰이 만료되면 두 채널을 새 인증으로 복구합니다. 객체별 그룹 권한은 그대로 적용되며 커서 같은 일시적 이벤트는 재전송하지 않습니다.')}</p>
  <Heading id="sdk-sync">{ui('실시간 동기화와 오류 처리')}</Heading>
  <p>{ui('객체 변경은 저장 커밋 또는 저장 영수증을 확인한 스냅샷을 받은 뒤 반환합니다. 단순 ACK는 성공으로 처리하지 않습니다. 재연결 시 동일한 client_id·request_id·request_count·내용을 재전송하고 revision 누락은 스냅샷으로 복구합니다.')}</p>
  <Code>{syncCode}</Code>
  <p>{ui('OutcomeUnknown은 실패 확정이 아닙니다. 같은 변경을 새 요청으로 보내지 말고 wait_for_idle()로 기존 요청을 확인하세요. 인증·권한이 회수되면 재접속을 중단하며, 잠금 거부는 ITEM_LOCKED, 쓰기 거부는 ITEM_WRITE_DENIED 등의 AgoraError.code로 구분합니다.')}</p>
</section>;}
