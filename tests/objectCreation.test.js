import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOX_CREATION_TOOLS,
  buildCreatedObject,
  computeDraggedCreationRect,
  isBoxCreationTool,
} from '../src/canvas/objectCreation.js';
import { CANVAS_SPACE } from '../src/canvas/canvasSpace.js';

test('computeDraggedCreationRect normalizes drag direction, Shift-square lock, and per-tool minimums', () => {
  const forward = computeDraggedCreationRect({ x: 0.1, y: 0.2 }, { x: 0.4, y: 0.5 }, CANVAS_SPACE, { tool: 'shape' });
  assert.ok(Math.abs(forward.x - 0.1) < 1e-9);
  assert.ok(Math.abs(forward.y - 0.2) < 1e-9);
  assert.ok(Math.abs(forward.width - 0.3) < 1e-9);
  assert.ok(Math.abs(forward.height - 0.3) < 1e-9);

  // Dragging bottom-right to top-left normalizes origin and positive dimensions.
  const reverse = computeDraggedCreationRect({ x: 0.5, y: 0.6 }, { x: 0.25, y: 0.3 }, CANVAS_SPACE, { tool: 'table' });
  assert.ok(Math.abs(reverse.x - 0.25) < 1e-9);
  assert.ok(Math.abs(reverse.y - 0.3) < 1e-9);
  assert.ok(Math.abs(reverse.width - 0.25) < 1e-9);
  assert.ok(Math.abs(reverse.height - 0.3) < 1e-9);

  // Shift keeps square pixel dimensions in boardSpace.
  const squared = computeDraggedCreationRect({ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.25 }, CANVAS_SPACE, { tool: 'shape', keepSquare: true });
  assert.ok(Math.abs(squared.width * CANVAS_SPACE.width - squared.height * CANVAS_SPACE.height) < 1e-6);

  // Tiny drag is clamped to minimum pixel floor per tool category.
  const tinyShape = computeDraggedCreationRect({ x: 0.3, y: 0.3 }, { x: 0.301, y: 0.301 }, CANVAS_SPACE, { tool: 'shape' });
  assert.ok(tinyShape.width * CANVAS_SPACE.width >= 8 - 1e-6);
  assert.ok(tinyShape.height * CANVAS_SPACE.height >= 8 - 1e-6);

  const tinyTable = computeDraggedCreationRect({ x: 0.3, y: 0.3 }, { x: 0.301, y: 0.301 }, CANVAS_SPACE, { tool: 'table' });
  assert.ok(tinyTable.width * CANVAS_SPACE.width >= 80 - 1e-6);
  assert.ok(tinyTable.height * CANVAS_SPACE.height >= 48 - 1e-6);
});

test('buildCreatedObject supports both click and drag creation for all boxed canvas tools', () => {
  const ctx = {
    boardSize: CANVAS_SPACE,
    permission: 'default',
    user: { user_id: 7, nickname: 'Tester', tag_number: 1 },
    tableConfig: { rows: 3, columns: 4, width: 40, height: 30 },
    shapeType: 'rectangle',
    shapeCornerStyle: 'rounded',
    shapeFillColor: '#eef3ee',
    noteColor: '#f6edcf',
  };

  for (const tool of BOX_CREATION_TOOLS) {
    assert.equal(isBoxCreationTool(tool), true);
    if (tool === 'link') continue;

    const clicked = buildCreatedObject(tool, { dragged: false, point: { x: 0.5, y: 0.5 } }, ctx);
    assert.ok(clicked.item, `${tool}: click builds item`);
    assert.ok(Number.isFinite(clicked.item.x) && Number.isFinite(clicked.item.y));
    assert.ok(clicked.item.width > 0);

    const draggedRect = { dragged: true, x: 0.15, y: 0.2, width: 0.45, height: 0.35 };
    const dragged = buildCreatedObject(tool, draggedRect, ctx);
    assert.ok(dragged.item, `${tool}: drag builds item`);
    assert.equal(dragged.item.x, 0.15, `${tool}: drag x`);
    assert.equal(dragged.item.y, 0.2, `${tool}: drag y`);
    assert.equal(dragged.item.width, 0.45, `${tool}: drag width`);
    assert.equal(dragged.item.height, 0.35, `${tool}: drag height`);
  }

  // Click leaves auto-height unset on free-growing text/note/code/math while drag locks explicit box height.
  for (const tool of ['text', 'markdown', 'note', 'code', 'math']) {
    const clicked = buildCreatedObject(tool, { dragged: false, point: { x: 0.5, y: 0.5 } }, ctx);
    assert.equal(clicked.item.height, undefined, `${tool}: click preserves auto-height`);
    const dragged = buildCreatedObject(tool, { dragged: true, x: 0.1, y: 0.1, width: 0.3, height: 0.25 }, ctx);
    assert.equal(dragged.item.height, 0.25, `${tool}: drag stores explicit height`);
    assert.equal(dragged.startEditing, true);
  }
});
