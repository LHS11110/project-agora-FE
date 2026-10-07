export const SLIDE_CONTEXTS = {
  intro: [
    { icon: 'text', title: '생각을 담는 여러 방식', detail: '마크다운 · 코드 · 수식 · 드로잉', tag: 'CAPTURE', to: '/tutorial' },
    { icon: 'connect', title: '아이디어 사이의 연결', detail: '메모에서 프로젝트의 다음 단계까지', tag: 'CONNECT', to: '/tutorial' },
    { icon: 'user', title: '혼자 시작하고 함께 다듬기', detail: '같은 공간에서 이어가는 공동 편집', tag: 'COLLABORATE', to: '/docs' },
  ],
  architecture: [
    { icon: 'grid', title: '손끝에서 시작하는 입력', detail: '고정된 좌표 위에서 이동·확대·편집', tag: 'BROWSER', to: '/tutorial' },
    { icon: 'connect', title: '실시간으로 이어지는 변경', detail: 'WebRTC와 웹소켓이 연결하는 작업', tag: 'REALTIME', to: '/docs' },
    { icon: 'database', title: '생각을 남기는 저장소', detail: '객체 저장과 캔버스 검색의 흐름', tag: 'PERSISTENCE', to: '/docs' },
  ],
  map: [
    { icon: 'search', title: '먼저 질문을 모으고', detail: '조사할 문제와 발견한 근거를 정리해요', tag: '01 / DISCOVER', to: '/tutorial' },
    { icon: 'code', title: '작은 실행으로 나누고', detail: '각 단계에 코드와 메모를 연결해요', tag: '02 / BUILD', to: '/tutorial' },
    { icon: 'check', title: '다음 목표로 이어가요', detail: '완료한 일과 다음 할 일을 한눈에', tag: '03 / LAUNCH', to: '/tutorial' },
  ],
  collaboration: [
    { icon: 'pen', title: '한 문장에 더하는 관점', detail: '같은 메모를 함께 다듬는 실시간 편집', tag: 'WRITE TOGETHER', to: '/tutorial' },
    { icon: 'code', title: '읽기 쉬운 코드와 수식', detail: '문법 색상과 수식으로 명확하게 전달', tag: 'SHARE CONTEXT', to: '/tutorial' },
    { icon: 'laser', title: '여기를 봐주세요', detail: '포인터로 지금 이야기하는 곳을 가리켜요', tag: 'POINT IT OUT', to: '/tutorial' },
  ],
  start: [
    { icon: 'grid', title: '직접 만져보기', detail: '샘플 캔버스에서 도구를 경험해보세요', tag: 'TRY THE CANVAS', to: '/tutorial' },
    { icon: 'book', title: '구조를 살펴보기', detail: '화면과 연결, 저장의 역할을 확인해요', tag: 'READ THE DOCS', to: '/docs' },
    { icon: 'user', title: '나의 공간 시작하기', detail: '생각과 프로젝트를 기록할 첫 캔버스', tag: 'MAKE IT YOURS', to: '/login' },
  ],
};
