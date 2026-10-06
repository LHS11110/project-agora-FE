// Tool order and category labels are managed here, independently of the page.
export const canvasToolCategories = [
  { id: 'navigate', label: '탐색·협업', tools: [
    { id: 'select', label: '선택', description: '선택 및 이동', icon: 'select' },
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
    { id: 'text', label: '텍스트', icon: 'text' },
    { id: 'markdown', label: '마크다운', description: '배경 없는 마크다운 텍스트', mark: 'M↓' },
    { id: 'note', label: '포스트잇', icon: 'sticky' },
  ] },
  { id: 'structure', label: '자료·계산', tools: [
    { id: 'table', label: '테이블', icon: 'table' },
    { id: 'math', label: '수식', description: '수식 작성', icon: 'math' },
    { id: 'code', label: '코드', description: '코드 블록', icon: 'code' },
  ] },
  { id: 'media', label: '미디어', tools: [
    { id: 'image', label: '사진', description: '사진 올리기', icon: 'image', upload: true },
    { id: 'link', label: '링크', description: '동영상·링크 공유', icon: 'link' },
  ] },
];
