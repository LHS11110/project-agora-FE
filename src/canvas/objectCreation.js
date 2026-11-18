import { ui } from '../i18n/locale.js';
import { CANVAS_SPACE } from './canvasSpace.js';
import { newFrame } from './portfolio/frameModel.js';
import { newProject } from './projects/projectModel.js';
import { notebookCell } from './notebook/notebookData.js';
import { createValue } from './values/valueData.js';
import { hasPolygonVertices } from './shapeAppearance.js';
import { groupMember } from './userGroups/userGroupModel.js';
import { shapeCreationSize } from './shapeCatalog.js';
import { newQuestion } from './questions/questionData.js';
import { newChartData } from './charts/chartData.js';
import { createTableData } from '../components/tableModel.js';
import { DEFAULT_SHAPE_ARROW_BEND } from '../components/shapeArrowGeometry.js';

export const DRAG_CREATE_THRESHOLD_PX = 6;

export const BOX_CREATION_TOOLS = new Set([
  'link', 'user-group', 'table', 'frame', 'project', 'question', 'chart',
  'timer', 'continuous-value', 'discrete-value', 'notebook', 'terminal', 'executor',
  'execution-output', 'html', 'css', 'js', 'shape', 'text', 'markdown',
  'math', 'code', 'note',
]);

export const isBoxCreationTool = tool => BOX_CREATION_TOOLS.has(tool);

const EDIT_ON_CREATE_TOOLS = new Set(['html', 'css', 'js', 'text', 'markdown', 'code', 'note', 'math']);

function minimumCreationPixels(tool) {
  if (tool === 'shape') return { width: 8, height: 8 };
  if (['text', 'markdown', 'note', 'code', 'html', 'css', 'js', 'math', 'link'].includes(tool)) {
    return { width: 64, height: 36 };
  }
  return { width: 80, height: 48 };
}

/**
 * Normalize a pointer drag between start and current into clamped canvas-space bounds.
 * Supports Shift-constrained 1:1 proportions and tool-appropriate minimum pixel sizes.
 */
export function computeDraggedCreationRect(start, current, boardSize = CANVAS_SPACE, options = {}) {
  const spaceWidth = Math.max(1, Number(boardSize?.width) || CANVAS_SPACE.width);
  const spaceHeight = Math.max(1, Number(boardSize?.height) || CANVAS_SPACE.height);
  const minPx = minimumCreationPixels(options.tool || 'shape');
  let dxPx = (current.x - start.x) * spaceWidth;
  let dyPx = (current.y - start.y) * spaceHeight;
  if (options.keepSquare) {
    const sidePx = Math.max(Math.abs(dxPx), Math.abs(dyPx), minPx.width, minPx.height);
    dxPx = dxPx < 0 ? -sidePx : sidePx;
    dyPx = dyPx < 0 ? -sidePx : sidePx;
  }
  const endX = start.x + dxPx / spaceWidth;
  const endY = start.y + dyPx / spaceHeight;
  const width = Math.max(minPx.width / spaceWidth, Math.abs(endX - start.x));
  const height = Math.max(minPx.height / spaceHeight, Math.abs(endY - start.y));
  const x = endX < start.x ? start.x - width : start.x;
  const y = endY < start.y ? start.y - height : start.y;
  return { x, y, width, height };
}

/**
 * Build a canvas item for either click-placement or dragged-size placement across all boxed tools.
 */
export function buildCreatedObject(tool, placement, context = {}) {
  const {
    boardSize = CANVAS_SPACE,
    permission = 'default',
    user,
    userGroupTemplate,
    tableConfig = { rows: 3, columns: 3, width: 42, height: 32 },
    shapeType = 'rectangle',
    shapeArrowStartHead = 'none',
    shapeArrowHeadSize = 14,
    shapeArrowEndHead = 'triangle',
    shapeFillColor = '',
    shapeFillOpacity = 1,
    shapeSketchFillOpacity = 0.8,
    shapeVertexCount = 6,
    shapeCornerStyle = 'sharp',
    shapeVisualStyle = 'standard',
    shapeStrokeEnabled = true,
    shapeBorderWidth = 2.5,
    color = '#2b2b2b',
    noteColor = '#f6edcf',
  } = context;

  const dragged = Boolean(placement?.dragged);
  const point = placement?.point || { x: placement?.x || 0, y: placement?.y || 0 };
  const box = (defaultWidth, defaultHeight) => {
    if (dragged) return { x: placement.x, y: placement.y, width: placement.width, height: placement.height };
    return {
      x: point.x - defaultWidth / 2,
      y: point.y - defaultHeight / 2,
      width: defaultWidth,
      height: defaultHeight,
    };
  };

  let item = null;
  let errorToast = '실시간 서버에 연결된 뒤 캔버스를 수정할 수 있어요.';

  if (tool === 'user-group') {
    const members = Array.isArray(userGroupTemplate?.members) && userGroupTemplate.members.length > 0
      ? userGroupTemplate.members
      : (user?.user_id != null ? [groupMember(user)] : []);
    item = {
      kind: 'user-group',
      groupTitle: userGroupTemplate?.groupTitle || '사용자 그룹',
      members,
      shadowEnabled: false,
      ...(userGroupTemplate?.groupColor ? { groupColor: userGroupTemplate.groupColor } : {}),
      ...box(0.3, 0.2),
      permission,
    };
    errorToast = '연결이 복구되면 사용자 그룹을 다시 추가해주세요.';
  } else if (tool === 'table') {
    item = {
      kind: 'table',
      ...createTableData(tableConfig.rows, tableConfig.columns),
      ...box(tableConfig.width / 100, tableConfig.height / 100),
      permission,
    };
    errorToast = '실시간 서버에 연결된 뒤 테이블을 놓을 수 있어요.';
  } else if (tool === 'frame') {
    const base = newFrame();
    item = {
      ...base,
      title: ui('프레임'),
      frameOrder: Date.now() % 1000000,
      depth: -1000,
      ...box(base.width, base.height),
      permission,
    };
  } else if (tool === 'project') {
    const base = newProject();
    item = {
      ...base,
      title: ui('프로젝트'),
      ...box(base.width, base.height),
      permission,
    };
  } else if (tool === 'question') {
    item = { kind: 'question', ...newQuestion(), ...box(0.28, 0.4), permission };
    errorToast = '연결이 복구되면 문제를 다시 추가해주세요.';
  } else if (tool === 'chart') {
    item = { kind: 'chart', ...newChartData(), ...box(0.3, 0.25), permission };
    errorToast = '실시간 서버에 연결된 뒤 그래프를 놓을 수 있어요.';
  } else if (tool === 'timer') {
    item = {kind:'shape', shapeType:'rectangle', runtimeRole:'timer', timerDuration:300, timerRemaining:300000, timerDeadline:0, ...box(.24,.27), permission};
  } else if (tool === 'continuous-value' || tool === 'discrete-value') {
    const base = createValue(tool === 'continuous-value' ? 'real' : 'integer');
    item = { ...base, ...box(base.width, base.height), permission };
  } else if (tool === 'notebook' || tool === 'terminal' || tool === 'executor' || tool === 'execution-output') {
    const defaults = tool === 'notebook'
      ? { role: 'notebook', width: 0.48, height: 0.65, extra: { notebookCells: [notebookCell()], notebookResults: {} } }
      : tool === 'terminal'
      ? { role: 'terminal', width: 0.42, height: 0.4, extra: {} }
      : tool === 'executor'
      ? { role: 'executor', width: 0.24, height: 0.22, extra: {} }
      : { role: 'output', width: 0.24, height: 0.24, extra: {} };
    item = {
      kind: 'shape',
      shapeType: 'rectangle',
      runtimeRole: defaults.role,
      ...defaults.extra,
      ...box(defaults.width, defaults.height),
      permission,
    };
  } else if (tool === 'shape') {
    const size = shapeCreationSize(shapeType, boardSize);
    item = {
      kind: 'shape',
      strokeWidth: shapeBorderWidth,
      shapeType,
      fillOpacity: shapeFillOpacity,
      sketchFillOpacity: shapeSketchFillOpacity,
      cornerStyle: shapeCornerStyle,
      ...(hasPolygonVertices(shapeType) ? { vertexCount: shapeVertexCount } : {}),
      visualStyle: shapeVisualStyle,
      strokeEnabled: shapeStrokeEnabled,
      fill: shapeType === 'arrow' ? '' : shapeFillColor,
      ...(shapeType === 'arrow' ? {
        bend: DEFAULT_SHAPE_ARROW_BEND,
        headSize: shapeArrowHeadSize,
        startHead: shapeArrowStartHead,
        shapeArrowHeadSize,
        endHead: shapeArrowEndHead,
      } : {}),
      ...box(size.width, size.height),
      color,
      permission,
    };
  } else if (tool === 'text' || tool === 'markdown') {
    const coords = dragged
      ? box(0.22, 0.12)
      : { x: point.x - 0.11, y: point.y - 0.06, width: 0.22 };
    item = {
      kind: 'text',
      text: '',
      renderMode: 'markdown',
      ...(tool === 'markdown' ? { format: 'markdown' } : {}),
      ...coords,
      permission,
    };
  } else if (tool === 'note') {
    const coords = dragged
      ? box(0.24, 0.16)
      : { x: point.x - 0.12, y: point.y - 0.08, width: 0.24 };
    item = {
      kind: 'note',
      text: '',
      ...coords,
      color: noteColor,
      rotation: Math.random() * 3 - 1.5,
      permission,
    };
  } else if (tool === 'css' || tool === 'js') {
    item = {
      kind: 'text',
      renderMode: 'code',
      language: tool === 'css' ? 'css' : 'javascript',
      filename: tool === 'css' ? 'style.css' : 'script.js',
      text: tool === 'css'
        ? 'h1 { color: #7055d6; }'
        : 'document.querySelector("h1")?.addEventListener("click", () => { document.querySelector("h1").textContent = "Hello, JavaScript!"; });',
      ...box(0.36, 0.28),
      permission,
    };
  } else if (tool === 'html') {
    item = {
      kind: 'text',
      renderMode: 'code',
      language: 'html',
      filename: 'index.html',
      text: '<style>body{background:#f4f1ff;color:#30244e}h1{color:#7055d6}</style>\n<h1>Hello, HTML!</h1>\n<p>HTML과 CSS로 화면을 만들어 보세요.</p>',
      ...box(0.4, 0.5),
      permission,
    };
  } else if (tool === 'code') {
    const coords = dragged
      ? box(0.32, 0.2)
      : { x: point.x - 0.16, y: point.y - 0.1, width: 0.32 };
    item = {
      kind: 'text',
      text: '',
      renderMode: 'code',
      filename: 'idea.js',
      language: 'javascript',
      ...coords,
      permission,
    };
  } else if (tool === 'math') {
    const coords = dragged
      ? box(0.2, 0.12)
      : { x: point.x - 0.1, y: point.y - 0.06, width: 0.2 };
    item = {
      kind: 'text',
      text: '',
      renderMode: 'latex',
      ...coords,
      permission,
    };
  }

  return {
    item,
    errorToast,
    startEditing: EDIT_ON_CREATE_TOOLS.has(tool),
    selectAfterCreate: !EDIT_ON_CREATE_TOOLS.has(tool),
  };
}
