import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import './canvas-objects-docs.css';

export const canvasObjectSections = [
  ['canvas-objects', '객체 모델 개요'],
  ['objects-basics', '만들기와 기본 조작'],
  ['objects-kinds', '객체 종류별 사용법'],
  ['objects-style', '스타일 설정'],
  ['objects-code', '코드로 객체 다루기'],
  ['objects-rules', '권한·협업 규칙'],
];

const basics = [
  ['도구 선택', 'Ctrl/⌘+1 선택 · 2 손 · 3 펜 · 4 지우개 · 5 레이저 · 6 포스트잇 · 7 도형 · 8 연결 · 9 텍스트 · 0 테이블, Ctrl/⌘+Shift+1 그래프 · Shift+2 사진 업로드. 나머지 도구는 왼쪽 도구 패널에서 고릅니다.'],
  ['만들기', '도구를 고른 뒤 캔버스를 클릭하거나 드래그합니다. 업로드 도구(사진·PDF·동영상·데이터 시트)는 파일을 선택하면 객체가 생깁니다.'],
  ['이동·크기·회전', '선택 도구로 드래그하고 모서리 핸들로 크기를 바꿉니다. 방향키로 미세 이동하며, 설정 패널에서 위치·크기·회전을 숫자로 입력할 수 있습니다.'],
  ['내용 편집', '텍스트·포스트잇·코드·표는 두 번 클릭해 편집합니다. 텍스트와 코드는 Ctrl/⌘+S로 저장하고, 포스트잇은 자동 저장합니다.'],
  ['다중 선택', 'Shift+클릭 또는 빈 곳을 드래그해 여러 객체를 고르면 설정 패널에서 공통 속성만 한 번에 바꿉니다.'],
  ['그룹·순서', 'Ctrl/⌘+G로 묶고 Ctrl/⌘+Shift+G로 풉니다. 같은 groupId의 객체는 함께 이동·회전합니다. 맨 앞/맨 뒤 버튼은 depth를 바꿉니다.'],
  ['스타일 복사', 'Ctrl+Alt+C로 선택한 객체의 스타일을 복사하고 Ctrl+Alt+V로 다른 객체에 붙여 넣습니다. 내용은 바뀌지 않습니다.'],
  ['잠금·숨김', '잠금은 이동·편집·삭제를 막는 실수 방지 기능입니다. 숨긴 객체는 발표·보기 화면에서 감추고, 애니메이션 뒤에 나타나게 할 수 있습니다.'],
];

const kinds = [
  ['도형 · shape', '도형 도구에서 모양 선택', 'shapeType, fill, fillOpacity, color, strokeWidth, visualStyle', '사각형·원·삼각형·별·구름·원통 등 21종입니다. arrow는 bend·startHead·endHead로 곡선 화살표를 만듭니다.'],
  ['연결선 · connector', '연결 도구로 두 객체를 차례로 클릭', 'from, to, label, labelMode, startHead, endHead, bendPoints', '연결한 객체를 따라 움직입니다. 코드·실행 객체 사이에서는 실행 순서와 입력 전달을 정의합니다.'],
  ['내용 · text', '텍스트 도구', 'text, renderMode(plain·markdown·latex·code), language, filename', '문서·수식·코드를 하나의 객체로 다룹니다. 코드 모드는 구문 강조와 실행 프레임을 제공합니다.'],
  ['포스트잇 · note', '포스트잇 도구', 'text(Markdown), color', '빠른 메모용이며 편집 내용을 자동 저장합니다.'],
  ['HTML · CSS · JS', '글쓰기 → HTML / CSS / JavaScript', 'text, language', 'HTML 미리보기 객체에 CSS·JavaScript 객체를 연결선으로 이어 붙입니다.'],
  ['표 · table', '테이블 도구 또는 데이터 시트(CSV·XLSX) 가져오기', 'columns, rows', '최대 100행·30열입니다. 셀을 두 번 클릭해 편집합니다.'],
  ['그래프 · chart', '그래프 도구', 'chartType(bar·line·area·pie·donut·scatter), columns, rows', '표 형태 데이터로 그래프를 그립니다.'],
  ['이미지 · image', '사진 도구 또는 붙여넣기', 'src, filename', '모서리·테두리·필터·그림자를 스타일로 지정할 수 있습니다.'],
  ['동영상·GIF·링크 · link', '동영상·GIF 업로드 또는 링크 도구', 'url, mediaType(video·gif·youtube·link), title', '재생 상태를 참여자와 공유하고, 일반 링크는 미리보기 카드로 표시합니다.'],
  ['PDF · pdf', 'PDF 도구', 'pdfPage', '페이지 넘김을 참여자와 함께 봅니다.'],
  ['프레임 · frame', '프레임 도구', 'title', '발표 화면 단위입니다. 오토 레이아웃으로 안쪽 객체를 정렬할 수 있습니다.'],
  ['값 · value', '연속 값·이산 값 도구', 'valueType(real·integer·button·select·text), valueNumber, valueMin, valueMax, valueStep', '슬라이더·버튼·선택 입력을 모든 참여자와 공유하고 코드 입력으로 연결합니다.'],
  ['문제 · question', '문제 객체 도구', 'questionType, questionPrompt, questionOptions, questionMaxScore', '객관식·주관식 문제를 내고 수동으로 채점합니다.'],
  ['타이머', '타이머 도구', 'runtimeRole: "timer", timerDuration', '모든 참여자가 같은 카운트다운을 봅니다.'],
  ['실행 환경 객체', '주피터 노트북·터미널·실행 객체·코드 객체·실행 결과 객체', 'runtimeRole(notebook·terminal·executor·output)', '캔버스 VM에서 코드를 실행합니다. 실행 권한이 필요합니다.'],
  ['AI 에이전트', 'AI 에이전트 객체·에이전트 오케스트레이터', 'agent 설정, 연결선', '연결한 객체를 입력으로 받아 여러 AI 에이전트의 작업 흐름을 구성합니다.'],
  ['프로젝트 · project', '프로젝트 관리 도구', 'project 필드', '이슈·칸반·스크럼·스프린트·로드맵을 캔버스 안에서 관리합니다.'],
  ['사용자 그룹 · user-group', '사용자 그룹 도구', 'groupTitle, members(최대 50명)', '참여자 프로필 묶음입니다. 접근 권한 그룹과는 별개입니다.'],
  ['드로잉 · stroke', '펜 도구', 'points, brush(pen·ink·highlighter·spray), color, strokeWidth, opacity', '자유 그리기입니다. 색과 두께는 펜 설정에서 바꾸며 고급 테두리 설정은 적용되지 않습니다.'],
  ['채널 · channel', '채팅 패널의 채널 추가', 'channelType(text·voice·category), name, order, categoryId', '텍스트·음성 채널과 카테고리입니다. 캔버스 화면에는 그려지지 않습니다.'],
];

const styleRows = [
  ['불투명도 · 블렌드', 'opacity 0~1 · blendMode: normal, multiply, screen, overlay, darken, lighten, color-dodge, color-burn, soft-light, hard-light, difference', '모든 객체 (블렌드는 드로잉 제외)'],
  ['모서리', 'cornerRadius: 숫자 또는 { linked, tl, tr, br, bl }, 0~240px', '사각형 계열 도형, 텍스트·코드·표·차트·이미지·링크·포스트잇 등'],
  ['채우기 레이어', 'fills[]: solid(color) · linear(angle 0~360, stops 2~6개) · radial · conic · image(url: https·/api·data:image, size: cover·contain·tile). 레이어마다 opacity·blendMode·visible', '도형(화살표 제외)·텍스트·포스트잇·프레임·코드·표·차트·링크·값·문제·프로젝트'],
  ['테두리', 'stroke: enabled, color, width 0.5~64, align(inside·center·outside), dashPattern(solid·dashed·dotted·custom), dash, gap, cap, join, sides { linked, top, right, bottom, left 0~32 }', '도형·연결선·프레임·이미지·카드형 객체 (드로잉 제외)'],
  ['효과', 'effects[]: drop-shadow · inner-shadow · layer-blur · background-blur, color, opacity, x·y ±48, blur 0~64, spread −24~32, enabled', '드로잉을 제외한 모든 객체'],
  ['필터', 'filters: brightness·contrast·saturate 0~200, grayscale·sepia·invert 0~100, hueRotate ±180', '드로잉을 제외한 모든 객체'],
  ['타이포그래피', 'typography: fontFamily, fontWeight 100~900, lineHeight 0.8~3, letterSpacing −4~24, paragraphSpacing 0~64, textAlign, overflowMode(visible·truncate·auto-fit), textColor', '텍스트·포스트잇·코드·표·값·문제·차트·프로젝트·연결선 라벨·도형 글자'],
  ['연결선', 'connector: routing(curved·straight·orthogonal), dashAnimation(none·forward·reverse), animationSpeed 0.25~4, labelStyle { background, color, borderColor, pill }', '연결선'],
  ['오토 레이아웃', 'autoLayout: enabled, direction(row·column·wrap), gap·padding 0~120, alignItems, justifyContent, widthMode·heightMode(fixed·hug·fill)', '프레임·도형 컨테이너. 적용 버튼을 누르면 안쪽 객체 위치를 계산해 저장합니다.'],
  ['사용자 CSS', 'customCss 1000자 이하. background·border·box-shadow·color·filter·transform·clip-path·padding 등 허용된 속성만 적용', '드로잉·연결선 제외'],
];

const planCode = `const api = window.frelogCanvas;
const style = {
  cornerRadius: 16,
  fills: [{ type: 'linear', angle: 135, stops: [
    { color: '#6366f1', pos: 0 }, { color: '#ec4899', pos: 100 },
  ] }],
  effects: [{ type: 'drop-shadow', y: 6, blur: 14, opacity: 0.2 }],
};
const plan = api.plan({
  version: 1,
  mode: 'merge',
  items: {
    card: {
      kind: 'shape', shapeType: 'rectangle',
      x: 200, y: 160, width: 320, height: 180,
      fill: '#6366f1', color: '#312e81',
      brush: 'style1:' + JSON.stringify(style),
    },
    title: {
      kind: 'text', renderMode: 'markdown',
      x: 220, y: 380, width: 280, text: '## Quarterly goals',
    },
    flow: { kind: 'connector', from: 'title', to: 'card', endHead: 'triangle' },
  },
});
console.log(plan.creates, plan.updates, plan.deletes);
api.apply(plan);`;

const sdkCode = `import json

style = {
    "stroke": {"enabled": True, "color": "#0f766e", "width": 3,
               "dashPattern": "dashed"},
    "typography": {"fontWeight": 700, "textAlign": "center"},
}
item_id = canvas.create({
    "kind": "text", "renderMode": "plain", "text": "Needs review",
    "x": 0.1, "y": 0.1, "width": 0.2, "height": 0.08,
    "brush": "style1:" + json.dumps(style),
})
canvas.patch(item_id, {"opacity": 0.85})`;

function Heading({ id, children }) { return <h3 className="sdk-heading" id={id}>{children}</h3>; }
function Code({ children }) { return <pre className="sdk-code"><code>{children}</code></pre>; }

export default function CanvasObjectsDocs() {
  useUiLocale();
  return <section className="docs-section canvas-objects-docs" id="canvas-objects">
    <div className="docs-section-title"><span className="section-kicker">GUIDE / CANVAS OBJECTS</span><h2>{ui('캔버스 객체 활용 가이드')}</h2><p>{ui('캔버스의 모든 요소는 kind 필드를 가진 객체(JSON)입니다. 도구로 직접 만들거나 캔버스 코드·브라우저 API·Python SDK로 만들고 바꿀 수 있으며, 모든 변경은 같은 저장 큐와 권한 검사를 거칩니다.')}</p></div>

    <Heading id="objects-basics">{ui('만들기와 기본 조작')}</Heading>
    <p>{ui('하단 빠른 도구 막대나 왼쪽 도구 패널에서 도구를 고릅니다. 선택 도구로 객체를 클릭하면 오른쪽 설정 패널과 빠른 스타일 막대가 열립니다.')}</p>
    <div className="docs-table-scroll"><table className="docs-api-table"><thead><tr><th>{ui('조작')}</th><th>{ui('방법')}</th></tr></thead><tbody>{basics.map(([name, how]) => <tr key={name}><td><strong>{ui(name)}</strong></td><td>{ui(how)}</td></tr>)}</tbody></table></div>

    <Heading id="objects-kinds">{ui('객체 종류별 사용법')}</Heading>
    <p>{ui('표의 필드는 객체 JSON에 저장되는 주요 키입니다. 캔버스 코드와 SDK에서 같은 이름을 사용합니다.')}</p>
    <div className="docs-table-scroll"><table className="docs-api-table canvas-objects-kind-table"><thead><tr><th>{ui('객체')}</th><th>{ui('만드는 방법')}</th><th>{ui('주요 필드')}</th><th>{ui('활용')}</th></tr></thead><tbody>{kinds.map(([kind, create, fields, use]) => <tr key={kind}><td><strong>{ui(kind)}</strong></td><td>{ui(create)}</td><td><code>{ui(fields)}</code></td><td>{ui(use)}</td></tr>)}</tbody></table></div>

    <Heading id="objects-style">{ui('스타일 설정')}</Heading>
    <p>{ui('설정 패널의 ‘상세 디자인 · 스타일 편집’에서 바꿉니다. 기본 값(color, fill, fillOpacity, strokeWidth, opacity, shadow*)은 객체에 바로 저장하고, 고급 스타일은 brush 필드(드로잉은 format)에 style1: 접두사를 붙인 JSON으로 저장합니다. 범위를 벗어난 값은 허용 범위로 보정합니다.')}</p>
    <div className="docs-table-scroll"><table className="docs-api-table"><thead><tr><th>{ui('설정')}</th><th>{ui('키 · 값 범위')}</th><th>{ui('적용 대상')}</th></tr></thead><tbody>{styleRows.map(([name, keys, targets]) => <tr key={name}><td><strong>{ui(name)}</strong></td><td><code>{ui(keys)}</code></td><td>{ui(targets)}</td></tr>)}</tbody></table></div>
    <div className="docs-note"><strong>{ui('넘치는 글자 처리')}</strong><p>{ui('truncate는 상자 밖 글자를 잘라 숨기고, auto-fit은 글자가 넘칠 때만 크기를 줄여 상자에 맞춥니다. 지정한 글자 크기보다 커지지는 않습니다.')}</p></div>
    <div className="docs-note"><strong>{ui('렌더링 참고')}</strong><p>{ui('선택한 객체와 고급 스타일 객체(최대 24개)는 정밀하게 렌더링합니다. 그보다 많으면 성능을 위해 나머지는 첫 채우기 색, 테두리 색·두께, 그림자 같은 기본 값 중심의 미리보기로 표시합니다. 프리셋·스타일 토큰·선택 색상 일괄 교체는 ‘프리셋·토큰’ 탭에서 사용합니다.')}</p></div>

    <Heading id="objects-code">{ui('코드로 객체 다루기')}</Heading>
    <p>{ui('상단 ‘캔버스 코드’ 또는 캔버스 페이지 콘솔의 window.frelogCanvas로 선언형 JSON을 검토한 뒤 적용합니다. 이 방식의 좌표는 브라우저 크기와 상관없는 1600×1000 픽셀 공간입니다.')}</p>
    <Code>{planCode}</Code>
    <p>{ui('Python SDK는 0~1 정규화 좌표를 사용합니다. brush를 patch하면 고급 스타일 전체가 바뀌므로, 일부만 바꿀 때는 기존 값을 읽어 합친 뒤 저장하세요.')}</p>
    <Code>{sdkCode}</Code>

    <Heading id="objects-rules">{ui('권한·협업 규칙')}</Heading>
    <ul className="canvas-objects-rules">
      <li>{ui('객체를 만들고 바꾸려면 쓰기 권한, 코드·노트북·터미널을 실행하려면 실행 권한이 필요합니다.')}</li>
      <li>{ui('permission을 생략한 새 객체는 현재 사용자의 기본 그룹으로 공유됩니다. 객체별 그룹 권한은 서버가 다시 검사합니다.')}</li>
      <li>{ui('잠긴 객체는 먼저 잠금을 해제해야 바꿀 수 있습니다. 잠금 해제와 다른 변경을 한 번에 보내면 거부됩니다.')}</li>
      <li>{ui('변경은 서버 저장이 확인된 뒤 모든 참여자에게 반영됩니다. 여러 객체 변경은 객체별로 처리되며 자동 롤백되지 않습니다.')}</li>
    </ul>
  </section>;
}
