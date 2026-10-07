export const KNOWLEDGE_SCENES = {
  intro: [
    { kind: 'blueprint', title: '블루프린트', formula: 'L = 120\\,\\mathrm{mm}' },
    { kind: 'wave', title: '함수와 미분', formula: '\\frac{d}{dx}\\sin x = \\cos x' },
    { kind: 'network', title: '네트워크 토폴로지', formula: 'G = (V, E)' },
  ],
  architecture: [
    { kind: 'pipeline', title: '공학 아키텍처', formula: '\\text{Input} \\to \\text{Process} \\to \\text{Output}' },
    { kind: 'circuit', title: '회로와 전압', formula: 'V = IR' },
    { kind: 'mechanics', title: '힘과 운동', formula: 'F = ma' },
  ],
  map: [
    { kind: 'tree', title: '계층 자료 구조', formula: 'T = (V, E),\\quad |E| = |V|-1' },
    { kind: 'curve', title: '최적화 곡선', formula: 'f(x) = x^2' },
    { kind: 'matrix', title: '선형 변환', formula: '\\mathbf{y} = A\\mathbf{x}' },
  ],
  collaboration: [
    { kind: 'wave', title: '파동의 표현', formula: 'y = A\\sin(kx - \\omega t)' },
    { kind: 'orbit', title: '에너지와 운동', formula: 'E_k = \\frac{1}{2}mv^2' },
    { kind: 'network', title: '서로 이어진 노드', formula: 'G = (V, E)' },
  ],
  start: [
    { kind: 'blueprint', title: '설계에서 시작하기', formula: 'A = \\pi r^2' },
    { kind: 'matrix', title: '수학으로 정리하기', formula: '\\det(A) \\ne 0' },
    { kind: 'circuit', title: '연결로 확장하기', formula: 'P = VI' },
  ],
};
