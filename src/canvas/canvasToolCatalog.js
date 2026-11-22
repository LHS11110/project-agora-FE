// Tool order and category labels are managed here, independently of the page.
export const canvasToolCategories = [
  { id: 'navigate', label: '탐색·협업', tools: [
    { id: 'select', label: '선택', description: '선택 및 이동', icon: 'select' },
    { id: 'hand', label: '손', description: '캔버스 화면 이동 · 마우스로 집어서 드래그', icon: 'hand' },
    { id: 'user-group', label: '사용자 그룹', description: '사용자 프로필을 모아 캔버스에 배치', icon: 'user' },
    { id: 'anchor', label: '앵커', description: '클릭한 위치를 개인 앵커로 저장', icon: 'anchor' },
    { id: 'laser', label: '포인터', description: '레이저 포인터', icon: 'laser' },
  ] },
  { id: 'draw', label: '그리기', tools: [
    { id: 'pen', label: '펜', description: '드로잉', icon: 'pen' },
    { id: 'eraser', label: '지우개', description: '드로잉 지우개', icon: 'eraser' },
  ] },
  { id: 'diagram', label: '도형·연결', tools: [
    { id: 'shape', label: '도형', icon: 'shape' },
    { id: 'connect', label: '연결', description: '오브젝트 연결', icon: 'connect' },
  ] },
  { id: 'write', label: '글쓰기', tools: [
    {id:'css',label:'CSS',description:'HTML에 연결할 스타일',icon:'code'},
    {id:'js',label:'JavaScript',description:'HTML에 연결할 스크립트',icon:'code'},
    {id:'html',label:'HTML',description:'HTML 코드 편집 및 미리보기',icon:'code'},
    { id: 'text', label: '내용', description: '텍스트 · Markdown · LaTeX · 코드', icon: 'text' },
    { id: 'note', label: '포스트잇', icon: 'sticky' },
  ] },
  { id: 'planning', label: '진행·발표', tools: [
    {id:'frame',label:'프레임',description:'발표 화면 프레임',icon:'grid'},
    {id:'project',label:'프로젝트 관리',description:'이슈·칸반·스크럼·스프린트·로드맵',icon:'table'},
    { id: 'timer', label: '타이머', icon: 'timer' },
    { id: 'question', label: '문제 객체', description: '객관식·주관식 문제와 수동 채점', icon: 'document' },
  ] },
  { id: 'structure', label: '데이터·시각화', tools: [
    { id: 'continuous-value', label: '연속 값', description: '실수 슬라이더와 수치 입력', icon: 'settings' },
    { id: 'discrete-value', label: '이산 값', description: '정수·버튼·선택·문자 입력', icon: 'table' },
    { id: 'table', label: '테이블', icon: 'table' },
    { id: 'chart', label: '그래프', description: '그래프 추가', icon: 'chart' },
  ] },
  { id: 'execution', label: '코드·실행', tools: [
    { id: 'notebook', label: '주피터 노트북', description: '셀 편집과 표·그래프·이미지 출력', icon: 'document' },
    { id: 'terminal', label: '터미널', description: '캔버스 VM 셸', icon: 'code' },
    { id: 'code', label: '코드 객체', description: '블루프린트 코드 편집', icon: 'code' },
    { id: 'executor', label: '실행 객체', description: '연결된 코드 실행', icon: 'code' },
    { id: 'execution-output', label: '실행 결과 객체', description: '연결된 코드의 출력 표시', icon: 'document' },
  ] },
  { id: 'agents', label: 'AI 에이전트 도구', tools: [
    { id: 'agent-input', label: '에이전트 입력 객체', description: '텍스트·이미지·오디오·동영상·PDF 입력을 받아 전달', icon: 'inbox' },
    { id: 'agent-router', label: '에이전트 라우터 객체', description: '입력 포맷 또는 지능형 판단으로 에이전트 분기', icon: 'router' },
    { id: 'agent-node', label: 'AI 에이전트 객체', description: '프롬프트와 데이터 그래프를 연결하는 에이전트', icon: 'sparkle' },
    { id: 'agent-mock', label: '모형 에이전트', description: '설정한 응답으로 멀티 에이전트 흐름 테스트', icon: 'sparkle' },
    { id: 'agent-orchestrator', label: '에이전트 오케스트레이터', description: '여러 AI 에이전트의 협업 그래프를 조율', icon: 'network' },
    { id: 'agent-output', label: '에이전트 출력 객체', description: '에이전트와 라우터의 최종 응답을 표시', icon: 'outputCard' },
  ] },
  { id: 'media', label: '미디어', tools: [
    {id:'media-file',label:'동영상·GIF',description:'동영상·GIF 업로드',icon:'image',upload:true,accept:'.gif,.mp4,.m4v,.mov,.webm,.ogv,image/gif,video/*'},
    { id: 'sheet', label: '데이터 시트', description: 'CSV · XLSX 데이터 시트 가져오기', icon: 'table', upload: true, accept: '.csv,.tsv,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    { id: 'pdf', label: 'PDF', description: 'PDF 문서 올리기', icon: 'document', upload: true, accept: 'application/pdf,.pdf' },
    { id: 'image', label: '사진', description: '사진 올리기', icon: 'image', upload: true },
    { id: 'link', label: '링크', description: '동영상·링크 공유', icon: 'link' },
  ] },
];
