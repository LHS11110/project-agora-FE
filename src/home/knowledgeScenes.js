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
    { kind: 'distribution', title: '확률과 분포', formula: 'p(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}}e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}' },
    { kind: 'orbit', title: '원자와 에너지', formula: 'E = h\\nu' },
    { kind: 'helix', title: '생명의 이중 나선', formula: '\\mathrm{A} \\leftrightarrow \\mathrm{T},\\quad \\mathrm{G} \\leftrightarrow \\mathrm{C}' },
  ],
  start: [
    { kind: 'vector', title: '방향과 벡터', formula: '\\lVert\\mathbf{v}\\rVert = \\sqrt{x^2+y^2}' },
    { kind: 'sets', title: '집합의 교집합', formula: 'A \\cap B = \\{x \\mid x\\in A,\\ x\\in B\\}' },
    { kind: 'spiral', title: '성장하는 나선', formula: 'r = a+b\\theta' },
  ],
};
