export const PROJECT_MAP_NODES = [
  { x: 42, y: 176, width: 145, height: 88, level: 0, fill: '#f3ead0', stroke: '#e5d8b9', kind: 'root', lines: ['PROJECT / ROOT', '가입 흐름 개선', '전환율 목표 +15%'] },
  { x: 258, y: 53, width: 157, height: 72, level: 1, fill: '#dce9e4', stroke: '#a9c0b2', kind: 'group', lines: ['01 / DISCOVER', '사용자 조사', '문제와 기회 찾기'] },
  { x: 258, y: 184, width: 157, height: 72, level: 1, fill: '#f3ead0', stroke: '#ddcfad', kind: 'group', lines: ['02 / BUILD', '핵심 기능', '가설을 빠르게 검증'] },
  { x: 258, y: 315, width: 157, height: 72, level: 1, fill: '#e8e1ef', stroke: '#b6a9c1', kind: 'group', lines: ['03 / LAUNCH', '출시와 측정', '결과를 함께 살펴보기'] },
  ...[
    [49, 'RESEARCH / 01', '사용자 인터뷰 5명'], [115, 'RESEARCH / 02', '가입 이탈 지점 찾기'],
    [180, 'MVP / 01', '가입 3단계로 단축'], [246, 'MVP / 02', '온보딩 A/B 실험'],
    [311, 'LAUNCH / 01', '베타 버전 출시'], [377, 'LAUNCH / 02', '전환율 주간 측정'],
  ].map(([y, label, title]) => ({ x: 500, y, width: 165, height: 56, level: 2, fill: '#fff', stroke: '#e3e9e1', kind: 'task', lines: [label, title] })),
];
export const PROJECT_MAP_EDGES = [
  ['M187 220 C213 220 219 89 244 89', 0], ['M187 220 C210 220 222 220 244 220', 0], ['M187 220 C213 220 219 351 244 351', 0],
  ['M415 89 C442 89 457 77 486 77', 1], ['M415 89 C446 100 450 134 486 143', 1],
  ['M415 220 C444 220 456 208 486 208', 1], ['M415 220 C444 220 456 274 486 274', 1],
  ['M415 351 C444 351 456 339 486 339', 1], ['M415 351 C444 351 456 405 486 405', 1],
];
