// Built-in one-click style presets and curated cohesive color palettes.
import { writeObjectStylePatch } from './objectStyleModel.js';

export const STYLE_PRESETS = [
  {
    id: 'glassmorphism',
    name: '글래스모피즘',
    description: '반투명 배경 블러 + 맑은 유리 테두리',
    preview: {
      background: 'linear-gradient(135deg, rgba(255,255,255,0.58), rgba(226,238,255,0.28))',
      border: '1px solid rgba(255,255,255,0.75)',
      boxShadow: '0 8px 20px rgba(31, 41, 55, 0.16)',
      backdropFilter: 'blur(12px)',
    },
    buildStyle: () => ({
      cornerRadius: { linked: true, tl: 18, tr: 18, br: 18, bl: 18, explicit: true },
      opacity: 0.96,
      blendMode: 'normal',
      explicitFills: true,
      fills: [
        {
          id: 'glass-grad',
          visible: true,
          type: 'linear',
          angle: 135,
          stops: [{ color: '#ffffff', pos: 0 }, { color: '#dbeafe', pos: 100 }],
          opacity: 0.36,
          blendMode: 'normal',
        },
      ],
      stroke: {
        explicit: true,
        enabled: true,
        color: '#ffffff',
        width: 1.5,
        align: 'inside',
        dashPattern: 'solid',
        dash: 8,
        gap: 6,
        cap: 'round',
        join: 'round',
        sides: { linked: true, top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 },
      },
      explicitEffects: true,
      effects: [
        { id: 'glass-blur', enabled: true, type: 'background-blur', color: '#ffffff', opacity: 1, x: 0, y: 0, blur: 16, spread: 0 },
        { id: 'glass-inner', enabled: true, type: 'inner-shadow', color: '#ffffff', opacity: 0.55, x: 0, y: 1, blur: 8, spread: 0 },
        { id: 'glass-drop', enabled: true, type: 'drop-shadow', color: '#1e293b', opacity: 0.18, x: 0, y: 8, blur: 20, spread: 0 },
      ],
    }),
  },
  {
    id: 'neon-glow',
    name: '네온 글로우',
    description: '사이버 네온 그라디언트 & 다층 발광',
    preview: {
      background: 'linear-gradient(135deg, #0f172a, #1e1b4b)',
      border: '2px solid #22d3ee',
      boxShadow: '0 0 14px rgba(34,211,238,0.65)',
      color: '#ecfeff',
    },
    buildStyle: () => ({
      cornerRadius: { linked: true, tl: 14, tr: 14, br: 14, bl: 14, explicit: true },
      opacity: 1,
      blendMode: 'normal',
      explicitFills: true,
      fills: [
        {
          id: 'neon-bg',
          visible: true,
          type: 'linear',
          angle: 135,
          stops: [{ color: '#0f172a', pos: 0 }, { color: '#1e1b4b', pos: 100 }],
          opacity: 0.96,
          blendMode: 'normal',
        },
      ],
      stroke: {
        explicit: true,
        enabled: true,
        color: '#22d3ee',
        width: 2,
        align: 'center',
        dashPattern: 'solid',
        dash: 8,
        gap: 6,
        cap: 'round',
        join: 'round',
        sides: { linked: true, top: 2, right: 2, bottom: 2, left: 2 },
      },
      explicitEffects: true,
      effects: [
        { id: 'neon-cyan', enabled: true, type: 'drop-shadow', color: '#22d3ee', opacity: 0.72, x: 0, y: 0, blur: 14, spread: 0 },
        { id: 'neon-magenta', enabled: true, type: 'drop-shadow', color: '#a855f7', opacity: 0.45, x: 0, y: 4, blur: 22, spread: 0 },
      ],
      typographyPatch: { textColor: '#e0f2fe', fontWeight: 600 },
    }),
  },
  {
    id: 'postit-shadow',
    name: '포스트잇 그림자',
    description: '따뜻한 종이 질감과 부드러운 입체 그림자',
    preview: {
      background: 'linear-gradient(145deg, #fef9c3, #fde68a)',
      border: '1px solid #f59e0b44',
      boxShadow: '0 10px 18px rgba(120, 92, 24, 0.22)',
      color: '#451a03',
    },
    buildStyle: () => ({
      cornerRadius: { linked: true, tl: 6, tr: 6, br: 6, bl: 6, explicit: true },
      opacity: 1,
      blendMode: 'normal',
      explicitFills: true,
      fills: [
        {
          id: 'note-grad',
          visible: true,
          type: 'linear',
          angle: 145,
          stops: [{ color: '#fef9c3', pos: 0 }, { color: '#fde68a', pos: 100 }],
          opacity: 1,
          blendMode: 'normal',
        },
      ],
      stroke: {
        explicit: true,
        enabled: true,
        color: '#e5c158',
        width: 1,
        align: 'inside',
        dashPattern: 'solid',
        dash: 8,
        gap: 6,
        cap: 'round',
        join: 'round',
        sides: { linked: true, top: 1, right: 1, bottom: 1, left: 1 },
      },
      explicitEffects: true,
      effects: [
        { id: 'paper-shadow', enabled: true, type: 'drop-shadow', color: '#6b5320', opacity: 0.26, x: 2, y: 10, blur: 16, spread: 0 },
      ],
      typographyPatch: { textColor: '#451a03' },
    }),
  },
  {
    id: 'button-3d',
    name: '3D 버튼',
    description: '하단 베벨과 입체 하이라이트 CTA 스타일',
    preview: {
      background: 'linear-gradient(180deg, #6366f1, #4f46e5)',
      border: '1px solid #4338ca',
      borderBottomWidth: '4px',
      boxShadow: '0 6px 12px rgba(79,70,229,0.34)',
      color: '#ffffff',
    },
    buildStyle: () => ({
      cornerRadius: { linked: true, tl: 12, tr: 12, br: 12, bl: 12, explicit: true },
      opacity: 1,
      blendMode: 'normal',
      explicitFills: true,
      fills: [
        {
          id: 'btn3d-grad',
          visible: true,
          type: 'linear',
          angle: 180,
          stops: [{ color: '#818cf8', pos: 0 }, { color: '#4f46e5', pos: 100 }],
          opacity: 1,
          blendMode: 'normal',
        },
      ],
      stroke: {
        explicit: true,
        enabled: true,
        color: '#3730a3',
        width: 2,
        align: 'inside',
        dashPattern: 'solid',
        dash: 8,
        gap: 6,
        cap: 'round',
        join: 'round',
        sides: { linked: false, top: 1, right: 1, bottom: 5, left: 1 },
      },
      explicitEffects: true,
      effects: [
        { id: 'btn3d-top-glow', enabled: true, type: 'inner-shadow', color: '#ffffff', opacity: 0.45, x: 0, y: 2, blur: 2, spread: 0 },
        { id: 'btn3d-drop', enabled: true, type: 'drop-shadow', color: '#312e81', opacity: 0.35, x: 0, y: 6, blur: 14, spread: 0 },
      ],
      typographyPatch: { textColor: '#ffffff', fontWeight: 700, textAlign: 'center' },
    }),
  },
  {
    id: 'aurora-gradient',
    name: '오로라 메쉬',
    description: '선형 + 각도 그라디언트 블렌딩 카드',
    preview: {
      background: 'conic-gradient(from 120deg, #a78bfa, #38bdf8, #34d399, #a78bfa)',
      border: '1px solid rgba(255,255,255,0.6)',
      boxShadow: '0 8px 18px rgba(56,189,248,0.28)',
      color: '#0f172a',
    },
    buildStyle: () => ({
      cornerRadius: { linked: true, tl: 20, tr: 20, br: 20, bl: 20, explicit: true },
      opacity: 1,
      blendMode: 'normal',
      explicitFills: true,
      fills: [
        {
          id: 'aurora-base',
          visible: true,
          type: 'linear',
          angle: 135,
          stops: [{ color: '#c4b5fd', pos: 0 }, { color: '#67e8f9', pos: 100 }],
          opacity: 0.92,
          blendMode: 'normal',
        },
        {
          id: 'aurora-conic',
          visible: true,
          type: 'conic',
          angle: 90,
          stops: [{ color: '#f472b6', pos: 0 }, { color: '#34d399', pos: 50 }, { color: '#f472b6', pos: 100 }],
          opacity: 0.42,
          blendMode: 'overlay',
        },
      ],
      stroke: {
        explicit: true,
        enabled: true,
        color: '#ffffff',
        width: 1.5,
        align: 'inside',
        dashPattern: 'solid',
        dash: 8,
        gap: 6,
        cap: 'round',
        join: 'round',
        sides: { linked: true, top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 },
      },
      explicitEffects: true,
      effects: [
        { id: 'aurora-drop', enabled: true, type: 'drop-shadow', color: '#38bdf8', opacity: 0.3, x: 0, y: 10, blur: 20, spread: 0 },
      ],
    }),
  },
  {
    id: 'claymorphism',
    name: '클레이 카드',
    description: '폭신한 내외부 이중 음영 파스텔 스타일',
    preview: {
      background: '#fce7f3',
      border: '0px',
      boxShadow: 'inset 0 -4px 8px rgba(219,39,119,0.2), 0 10px 18px rgba(15,23,42,0.12)',
      color: '#831843',
    },
    buildStyle: () => ({
      cornerRadius: { linked: true, tl: 26, tr: 26, br: 26, bl: 26, explicit: true },
      opacity: 1,
      blendMode: 'normal',
      explicitFills: true,
      fills: [
        { id: 'clay-bg', visible: true, type: 'solid', color: '#fce7f3', opacity: 1, blendMode: 'normal' },
      ],
      stroke: {
        explicit: true,
        enabled: false,
        color: '#f9a8d4',
        width: 1,
        align: 'inside',
        dashPattern: 'solid',
        dash: 8,
        gap: 6,
        cap: 'round',
        join: 'round',
        sides: { linked: true, top: 1, right: 1, bottom: 1, left: 1 },
      },
      explicitEffects: true,
      effects: [
        { id: 'clay-in-dark', enabled: true, type: 'inner-shadow', color: '#db2777', opacity: 0.22, x: -3, y: -5, blur: 10, spread: 0 },
        { id: 'clay-in-light', enabled: true, type: 'inner-shadow', color: '#ffffff', opacity: 0.85, x: 3, y: 4, blur: 8, spread: 0 },
        { id: 'clay-drop', enabled: true, type: 'drop-shadow', color: '#831843', opacity: 0.16, x: 0, y: 10, blur: 18, spread: 0 },
      ],
      typographyPatch: { textColor: '#831843' },
    }),
  },
];

export const THEME_PALETTES = [
  {
    id: 'nordic-sage',
    name: '노르딕 세이지',
    colors: ['#f4f7f5', '#d8e8dc', '#88a892', '#476853', '#1f2f25'],
  },
  {
    id: 'sunset-coral',
    name: '선셋 코랄',
    colors: ['#fff7ed', '#fed7aa', '#fb7185', '#e11d48', '#4c0519'],
  },
  {
    id: 'ocean-glass',
    name: '오션 블루',
    colors: ['#f0f9ff', '#bae6fd', '#38bdf8', '#0284c7', '#0c4a6e'],
  },
  {
    id: 'midnight-cyber',
    name: '사이버 네온',
    colors: ['#0f172a', '#1e1b4b', '#6366f1', '#22d3ee', '#f472b6'],
  },
  {
    id: 'warm-editorial',
    name: '웜 에디토리얼',
    colors: ['#faf8f5', '#ede6da', '#d4a373', '#8c5e3c', '#2b2118'],
  },
];

export function applyPresetToItem(item, presetId) {
  const preset = STYLE_PRESETS.find((entry) => entry.id === presetId);
  if (!preset || !item) return null;
  const spec = preset.buildStyle(item);
  return writeObjectStylePatch(item, (current) => {
    const next = {
      ...current,
      cornerRadius: spec.cornerRadius || current.cornerRadius,
      opacity: spec.opacity ?? current.opacity,
      blendMode: spec.blendMode || current.blendMode,
      explicitFills: spec.explicitFills ?? current.explicitFills,
      fills: spec.fills ? spec.fills : current.fills,
      stroke: spec.stroke ? spec.stroke : current.stroke,
      explicitEffects: spec.explicitEffects ?? current.explicitEffects,
      effects: spec.effects ? spec.effects : current.effects,
    };
    if (spec.typographyPatch) {
      next.typography = { ...current.typography, explicit: true, ...spec.typographyPatch };
    }
    return next;
  });
}

export function applyThemePaletteToItem(item, paletteId) {
  const palette = THEME_PALETTES.find((entry) => entry.id === paletteId);
  if (!palette || !item) return null;
  const [surface, tint, accent, strong, ink] = palette.colors;
  return writeObjectStylePatch(item, (current) => ({
    ...current,
    explicitFills: true,
    fills: [{
      id: 'palette-fill',
      visible: true,
      type: 'linear',
      angle: 135,
      stops: [{ color: surface, pos: 0 }, { color: tint, pos: 100 }],
      opacity: 1,
      blendMode: 'normal',
    }],
    stroke: { ...current.stroke, explicit: true, enabled: true, color: accent },
    typography: { ...current.typography, explicit: true, textColor: ink || strong },
  }));
}
