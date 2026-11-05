// Tool order and category labels are managed here, independently of the page.
export const canvasToolCategories = [
  { id: 'navigate', label: '탐색·협업', tools: [
    { id: 'select', label: '선택', description: '선택 및 이동', icon: 'select' },
    { id: 'hand', label: '손', description: '캔버스 화면 이동 · 마우스로 집어서 드래그', icon: 'hand' },
    { id: 'user-group', label: '사용자 그룹', description: '사용자 프로필을 모아 캔버스에 배치', icon: 'user' },
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
    { id: 'text', label: '내용', description: '텍스트 · Markdown · LaTeX · 코드', icon: 'text' },
    { id: 'note', label: '포스트잇', icon: 'sticky' },
  ] },
  { id: 'structure', label: '자료·계산', tools: [
    { id: 'continuous-value', label: '연속 값', description: '실수 슬라이더와 수치 입력', icon: 'settings' },
    { id: 'discrete-value', label: '이산 값', description: '정수·버튼·선택·문자 입력', icon: 'table' },
    { id: 'notebook', label: '주피터 노트북', description: '셀 편집과 표·그래프·이미지 출력', icon: 'document' },
    { id: 'terminal', label: '터미널', description: '캔버스 VM 셸', icon: 'code' },
    { id: 'executor', label: '실행 객체', description: '연결된 코드 실행', icon: 'code' },
    { id: 'code', label: '코드 객체', description: '블루프린트 코드 편집', icon: 'code' },
    { id: 'execution-output', label: '실행 결과 객체', description: '연결된 코드의 출력 표시', icon: 'document' },
    { id: 'question', label: '문제 객체', description: '객관식·주관식 문제와 수동 채점', icon: 'document' },
    { id: 'table', label: '테이블', icon: 'table' },
    { id: 'chart', label: '그래프', description: '그래프 추가', icon: 'chart' },
  ] },
  { id: 'media', label: '미디어', tools: [
    { id: 'sheet', label: '데이터 시트', description: 'CSV · XLSX 데이터 시트 가져오기', icon: 'table', upload: true, accept: '.csv,.tsv,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    { id: 'pdf', label: 'PDF', description: 'PDF 문서 올리기', icon: 'document', upload: true, accept: 'application/pdf,.pdf' },
    { id: 'image', label: '사진', description: '사진 올리기', icon: 'image', upload: true },
    { id: 'link', label: '링크', description: '동영상·링크 공유', icon: 'link' },
  ] },
];
