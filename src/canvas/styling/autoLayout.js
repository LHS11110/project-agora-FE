// Spatial Auto Layout engine for container frames and shapes enclosing child objects.
// Computes normalized world patches for children (`x`, `y`, `width`, `height`) and
// parent Hug bounds when `autoLayout.enabled` is turned on or re-laid out.

import { readObjectStyle } from './objectStyleModel.js';
import { OBJECT_SIZES } from '../../components/connectorGeometry.js';

const DEFAULT_SIZE = OBJECT_SIZES;

export function itemWorldRect(item, boardSize = { width: 16000, height: 10000 }) {
  const wNorm = Number(item?.width) || DEFAULT_SIZE[item?.kind]?.[0] || 0.2;
  const hNorm = Number(item?.height) || DEFAULT_SIZE[item?.kind]?.[1] || 0.14;
  return {
    x: (Number(item?.x) || 0) * boardSize.width,
    y: (Number(item?.y) || 0) * boardSize.height,
    width: wNorm * boardSize.width,
    height: hNorm * boardSize.height,
  };
}

export function findAutoLayoutChildren(parentId, parentItem, allItems = {}, boardSize = { width: 16000, height: 10000 }) {
  if (!parentItem) return [];
  const parentRect = itemWorldRect(parentItem, boardSize);
  const children = [];

  for (const [id, candidate] of Object.entries(allItems)) {
    if (id === String(parentId) || !candidate || ['connector', 'stroke', 'portfolio', 'host-tombstone', 'frame'].includes(candidate.kind)) {
      continue;
    }
    const belongsByFrame = parentItem.kind === 'frame' && candidate.frameId === String(parentId);
    const rect = itemWorldRect(candidate, boardSize);
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const insideRect = cx >= parentRect.x && cx <= parentRect.x + parentRect.width && cy >= parentRect.y && cy <= parentRect.y + parentRect.height;
    if (belongsByFrame || insideRect) {
      children.push({ id, item: candidate, rect, style: readObjectStyle(candidate) });
    }
  }

  return children;
}

export function computeAutoLayoutPatches(parentId, parentItem, allItems = {}, boardSize = { width: 16000, height: 10000 }) {
  const parentStyle = readObjectStyle(parentItem);
  const al = parentStyle.autoLayout;
  if (!al?.enabled) return {};

  const children = findAutoLayoutChildren(parentId, parentItem, allItems, boardSize);
  if (!children.length) return {};

  const parentRect = itemWorldRect(parentItem, boardSize);
  const direction = al.direction === 'column' ? 'column' : (al.direction === 'wrap' ? 'wrap' : 'row');
  children.sort((a, b) => (direction === 'column' ? a.rect.y - b.rect.y || a.rect.x - b.rect.x : a.rect.x - b.rect.x || a.rect.y - b.rect.y));

  const padL = al.paddingLeft;
  const padR = al.paddingRight;
  const padT = al.paddingTop;
  const padB = al.paddingBottom;
  const gap = al.gap;

  const innerMaxW = Math.max(40, parentRect.width - padL - padR);
  const innerMaxH = Math.max(40, parentRect.height - padT - padB);
  const patches = {};

  if (direction === 'row') {
    const fillChildren = children.filter((c) => c.style.autoLayout.widthMode === 'fill');
    const fixedWidthSum = children
      .filter((c) => c.style.autoLayout.widthMode !== 'fill')
      .reduce((sum, c) => sum + c.rect.width, 0);
    const fillW = fillChildren.length
      ? Math.max(40, (innerMaxW - fixedWidthSum - gap * (children.length - 1)) / fillChildren.length)
      : 0;

    const totalContentW = children.reduce((sum, c, idx) => (
      sum + (c.style.autoLayout.widthMode === 'fill' ? fillW : c.rect.width) + (idx > 0 ? gap : 0)
    ), 0);

    let cursorX = parentRect.x + padL;
    let effectiveGap = gap;
    if (al.justifyContent === 'center') cursorX += Math.max(0, (innerMaxW - totalContentW) / 2);
    else if (al.justifyContent === 'flex-end') cursorX += Math.max(0, innerMaxW - totalContentW);
    else if (al.justifyContent === 'space-between' && children.length > 1) {
      effectiveGap = Math.max(gap, (innerMaxW - (totalContentW - gap * (children.length - 1))) / (children.length - 1));
    }

    let maxRowH = 0;
    for (const child of children) {
      const w = child.style.autoLayout.widthMode === 'fill' ? fillW : child.rect.width;
      const h = (al.alignItems === 'stretch' || child.style.autoLayout.heightMode === 'fill')
        ? (al.heightMode === 'hug' ? child.rect.height : innerMaxH)
        : child.rect.height;
      maxRowH = Math.max(maxRowH, h);
      let y = parentRect.y + padT;
      if (al.alignItems === 'center') y += Math.max(0, (innerMaxH - h) / 2);
      else if (al.alignItems === 'flex-end') y += Math.max(0, innerMaxH - h);

      patches[child.id] = {
        x: cursorX / boardSize.width,
        y: y / boardSize.height,
        width: w / boardSize.width,
        height: h / boardSize.height,
      };
      cursorX += w + effectiveGap;
    }

    if (al.widthMode === 'hug' || al.heightMode === 'hug') {
      patches[String(parentId)] = {
        ...(al.widthMode === 'hug' ? { width: Math.max(80, totalContentW + padL + padR) / boardSize.width } : {}),
        ...(al.heightMode === 'hug' ? { height: Math.max(60, maxRowH + padT + padB) / boardSize.height } : {}),
      };
    }
  } else if (direction === 'column') {
    const fillChildren = children.filter((c) => c.style.autoLayout.heightMode === 'fill');
    const fixedHeightSum = children
      .filter((c) => c.style.autoLayout.heightMode !== 'fill')
      .reduce((sum, c) => sum + c.rect.height, 0);
    const fillH = fillChildren.length
      ? Math.max(36, (innerMaxH - fixedHeightSum - gap * (children.length - 1)) / fillChildren.length)
      : 0;

    const totalContentH = children.reduce((sum, c, idx) => (
      sum + (c.style.autoLayout.heightMode === 'fill' ? fillH : c.rect.height) + (idx > 0 ? gap : 0)
    ), 0);

    let cursorY = parentRect.y + padT;
    let effectiveGap = gap;
    if (al.justifyContent === 'center') cursorY += Math.max(0, (innerMaxH - totalContentH) / 2);
    else if (al.justifyContent === 'flex-end') cursorY += Math.max(0, innerMaxH - totalContentH);
    else if (al.justifyContent === 'space-between' && children.length > 1) {
      effectiveGap = Math.max(gap, (innerMaxH - (totalContentH - gap * (children.length - 1))) / (children.length - 1));
    }

    let maxColW = 0;
    for (const child of children) {
      const w = (al.alignItems === 'stretch' || child.style.autoLayout.widthMode === 'fill')
        ? (al.widthMode === 'hug' ? child.rect.width : innerMaxW)
        : child.rect.width;
      const h = child.style.autoLayout.heightMode === 'fill' ? fillH : child.rect.height;
      maxColW = Math.max(maxColW, w);
      let x = parentRect.x + padL;
      if (al.alignItems === 'center') x += Math.max(0, (innerMaxW - w) / 2);
      else if (al.alignItems === 'flex-end') x += Math.max(0, innerMaxW - w);

      patches[child.id] = {
        x: x / boardSize.width,
        y: cursorY / boardSize.height,
        width: w / boardSize.width,
        height: h / boardSize.height,
      };
      cursorY += h + effectiveGap;
    }

    if (al.widthMode === 'hug' || al.heightMode === 'hug') {
      patches[String(parentId)] = {
        ...(al.widthMode === 'hug' ? { width: Math.max(80, maxColW + padL + padR) / boardSize.width } : {}),
        ...(al.heightMode === 'hug' ? { height: Math.max(60, totalContentH + padT + padB) / boardSize.height } : {}),
      };
    }
  } else {
    // Wrap layout
    let cursorX = parentRect.x + padL;
    let cursorY = parentRect.y + padT;
    let rowHeight = 0;
    let maxUsedRight = parentRect.x + padL;

    for (const child of children) {
      if (cursorX > parentRect.x + padL && cursorX + child.rect.width > parentRect.x + padL + innerMaxW) {
        cursorX = parentRect.x + padL;
        cursorY += rowHeight + gap;
        rowHeight = 0;
      }
      patches[child.id] = {
        x: cursorX / boardSize.width,
        y: cursorY / boardSize.height,
        width: child.rect.width / boardSize.width,
        height: child.rect.height / boardSize.height,
      };
      cursorX += child.rect.width + gap;
      maxUsedRight = Math.max(maxUsedRight, cursorX - gap);
      rowHeight = Math.max(rowHeight, child.rect.height);
    }

    if (al.widthMode === 'hug' || al.heightMode === 'hug') {
      const contentH = cursorY + rowHeight - parentRect.y + padB;
      const contentW = maxUsedRight - parentRect.x + padR;
      patches[String(parentId)] = {
        ...(al.widthMode === 'hug' ? { width: Math.max(80, contentW) / boardSize.width } : {}),
        ...(al.heightMode === 'hug' ? { height: Math.max(60, contentH) / boardSize.height } : {}),
      };
    }
  }

  return patches;
}
