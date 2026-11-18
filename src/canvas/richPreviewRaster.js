import { CHART_COLORS, chartDataset, chartNumber } from './charts/chartData.js';
import { contentSource } from './content/contentPresentation.js';
import { objectCornerRadius } from './objectCorners.js';
import { hasAdvancedStyle, readObjectStyle } from './styling/objectStyleModel.js';

function previewPalette(kind, src) {
  const darkTheme = typeof document !== 'undefined' && Boolean(document.querySelector('.canvas-app-page[data-theme="dark"]'));
  if (kind === 'note') {
    return {
      bg: src?.color || '#f6edcf',
      border: '#d6ca9b',
      ink: '#4d4635',
      muted: '#776e56',
      accent: '#a38945',
    };
  }
  if (kind === 'runtime:terminal') {
    return {
      bg: '#161f2e',
      border: '#334155',
      ink: '#e2e8f0',
      muted: '#94a3b8',
      accent: '#38bdf8',
    };
  }
  if (darkTheme) {
    return {
      bg: '#232734',
      border: '#3c4257',
      ink: '#ebedf7',
      muted: '#9ea3bd',
      accent: '#9b7cf7',
    };
  }
  return {
    bg: '#ffffff',
    border: '#dfe4eb',
    ink: '#292b3c',
    muted: '#6d7288',
    accent: '#7558d9',
  };
}

function drawRoundedFillAndStroke(ctx, w, h, radius, src, palette) {
  const styled = hasAdvancedStyle(src);
  const style = styled ? readObjectStyle(src) : null;
  const r = styled ? objectCornerRadius(src, w, h) : Math.min(radius, w / 2, h / 2);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.clip();

  const visibleFills = styled ? style.fills.filter((f) => f.visible !== false) : [];
  if (visibleFills.length) {
    for (const layer of visibleFills) {
      ctx.save();
      ctx.globalAlpha *= layer.opacity ?? 1;
      if (layer.type === 'linear' && Array.isArray(layer.stops) && layer.stops.length) {
        const rad = ((layer.angle ?? 135) * Math.PI) / 180;
        const dx = Math.cos(rad) * w * 0.5;
        const dy = Math.sin(rad) * h * 0.5;
        const grad = ctx.createLinearGradient(w * 0.5 - dx, h * 0.5 - dy, w * 0.5 + dx, h * 0.5 + dy);
        for (const stop of layer.stops) grad.addColorStop(Math.max(0, Math.min(1, (stop.pos ?? 0) / 100)), stop.color || '#ffffff');
        ctx.fillStyle = grad;
      } else if (layer.type === 'radial' && Array.isArray(layer.stops) && layer.stops.length) {
        const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.65);
        for (const stop of layer.stops) grad.addColorStop(Math.max(0, Math.min(1, (stop.pos ?? 0) / 100)), stop.color || '#ffffff');
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = layer.color || palette.bg;
      }
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  } else {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();

  const strokeEnabled = styled ? style.stroke?.enabled !== false : Boolean(palette.border);
  if (strokeEnabled) {
    const strokeW = styled && style.stroke?.explicit ? Math.max(1, style.stroke.width) : 1;
    ctx.save();
    ctx.strokeStyle = styled && style.stroke?.explicit ? style.stroke.color : palette.border;
    ctx.lineWidth = strokeW;
    ctx.beginPath();
    ctx.roundRect(strokeW / 2, strokeW / 2, Math.max(1, w - strokeW), Math.max(1, h - strokeW), Math.max(0, r - strokeW / 2));
    ctx.stroke();
    ctx.restore();
  }
  return { r, styled, ink: (styled && style?.typography?.textColor) || palette.ink };
}

function drawTextLines(ctx, text, x, y, maxWidth, maxHeight, fontSize, lineHeight, fontFamily, color) {
  const source = String(text ?? '').trim();
  if (!source || maxWidth <= 4 || maxHeight <= 4) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, maxWidth, maxHeight);
  ctx.clip();
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  let lineIndex = 0;
  for (const rawLine of source.split(/\r\n?|\n/)) {
    let cur = '';
    for (const ch of rawLine) {
      if (cur && ctx.measureText(cur + ch).width > maxWidth) {
        ctx.fillText(cur, x, y + lineIndex * lineHeight);
        lineIndex++;
        cur = ch;
        if (lineIndex >= maxLines) break;
      } else {
        cur += ch;
      }
    }
    if (lineIndex >= maxLines) break;
    if (cur || lineIndex < maxLines) {
      ctx.fillText(cur, x, y + lineIndex * lineHeight);
      lineIndex++;
      if (lineIndex >= maxLines) break;
    }
  }
  ctx.restore();
}

function drawChartOverview(ctx, src, w, h, pad, headerH, fontFamily, ink, muted) {
  const { columns, rows } = chartDataset(src);
  const type = src.chartType || 'bar';
  const gx = pad;
  const gy = headerH + 4;
  const gw = Math.max(8, w - pad * 2);
  const gh = Math.max(8, h - gy - pad);

  const series = columns.slice(1).map((name, idx) => ({
    name,
    color: CHART_COLORS[idx % CHART_COLORS.length],
    values: rows.map((row) => chartNumber(row[idx + 1])),
  }));
  const nums = series.flatMap((s) => s.values.filter((v) => v !== null));
  if (!nums.length) {
    drawTextLines(ctx, src.chartTitle || src.title || 'Chart', gx, gy, gw, gh, 10, 14, fontFamily, muted);
    return;
  }

  ctx.save();
  if (type === 'pie' || type === 'donut') {
    const vals = (series[0]?.values || []).map((v) => (v && v > 0 ? v : 0));
    const total = vals.reduce((a, b) => a + b, 0);
    if (total > 0) {
      const cx = gx + gw / 2;
      const cy = gy + gh / 2;
      const outer = Math.max(4, Math.min(gw, gh) * 0.44);
      let start = -Math.PI / 2;
      vals.forEach((v, i) => {
        if (!v) return;
        const sweep = (v / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outer, start, start + sweep);
        ctx.closePath();
        ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
        ctx.fill();
        start += sweep;
      });
      if (type === 'donut') {
        ctx.beginPath();
        ctx.arc(cx, cy, outer * 0.48, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }
  } else if (type === 'line' || type === 'area') {
    const low = Math.min(0, ...nums);
    const high = Math.max(0, ...nums) || 1;
    const span = high - low || 1;
    for (const s of series) {
      const pts = [];
      const count = Math.max(1, s.values.length - 1);
      s.values.forEach((v, i) => {
        if (v === null) return;
        pts.push({
          x: gx + (s.values.length === 1 ? gw / 2 : (i / count) * gw),
          y: gy + gh * (high - v) / span,
        });
      });
      if (!pts.length) continue;
      if (type === 'area' && pts.length > 1) {
        ctx.save();
        ctx.globalAlpha *= 0.2;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, gy + gh);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.lineTo(pts[pts.length - 1].x, gy + gh);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      pts.forEach((p, idx) => (idx ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    }
  } else {
    const low = Math.min(0, ...nums);
    const high = Math.max(0, ...nums) || 1;
    const span = high - low || 1;
    const baseY = gy + gh * (high - 0) / span;
    const rowCount = Math.max(1, rows.length);
    const sCount = Math.max(1, series.length);
    const groupW = gw / rowCount;
    const barW = Math.max(2, (groupW * 0.72) / sCount);
    rows.forEach((_, rIdx) => {
      series.forEach((s, sIdx) => {
        const val = s.values[rIdx];
        if (val === null) return;
        const barY = gy + gh * (high - val) / span;
        const bx = gx + rIdx * groupW + groupW * 0.14 + sIdx * barW;
        const by = Math.min(baseY, barY);
        const bh = Math.max(1, Math.abs(baseY - barY));
        ctx.fillStyle = s.color;
        ctx.fillRect(bx, by, Math.max(1.5, barW - 1), bh);
      });
    });
  }
  ctx.restore();
}

function drawTableOverview(ctx, src, w, h, pad, palette, fontFamily, ink) {
  const columns = Array.isArray(src.columns) ? src.columns : [];
  const rows = Array.isArray(src.rows) ? src.rows : [];
  const colCount = Math.max(1, Math.min(5, columns.length || (rows[0]?.length || 2)));
  const rowCount = Math.min(5, rows.length);
  const headH = Math.min(24, Math.max(14, h * 0.22));
  const colW = (w - pad * 2) / colCount;
  const rowH = rowCount ? Math.max(10, (h - pad * 2 - headH) / rowCount) : 16;

  ctx.save();
  ctx.fillStyle = palette.accent + '18';
  ctx.fillRect(pad, pad, w - pad * 2, headH);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(pad, pad, Math.max(1, w - pad * 2), Math.max(1, Math.min(h - pad * 2, headH + rowCount * rowH)));

  ctx.font = `600 9px ${fontFamily}`;
  ctx.fillStyle = ink;
  ctx.textBaseline = 'middle';
  for (let c = 0; c < colCount; c++) {
    const cx = pad + c * colW;
    if (c > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, pad);
      ctx.lineTo(cx, Math.min(h - pad, pad + headH + rowCount * rowH));
      ctx.stroke();
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx + 3, pad, Math.max(1, colW - 6), headH);
    ctx.clip();
    ctx.fillText(String(columns[c] ?? ''), cx + 4, pad + headH / 2);
    ctx.restore();
  }

  ctx.font = `400 8px ${fontFamily}`;
  for (let r = 0; r < rowCount; r++) {
    const ry = pad + headH + r * rowH;
    if (ry >= h - pad) break;
    ctx.beginPath();
    ctx.moveTo(pad, ry);
    ctx.lineTo(w - pad, ry);
    ctx.stroke();
    const row = Array.isArray(rows[r]) ? rows[r] : [];
    for (let c = 0; c < colCount; c++) {
      const cx = pad + c * colW;
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx + 3, ry, Math.max(1, colW - 6), rowH);
      ctx.clip();
      ctx.fillText(String(row[c] ?? ''), cx + 4, ry + rowH / 2);
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawHeadingBar(ctx, badge, title, w, pad, accent, ink, muted, fontFamily) {
  const badgeW = badge ? Math.min(w * 0.45, Math.max(24, badge.length * 6.5 + 10)) : 0;
  let tx = pad;
  if (badgeW > 0) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(pad, pad, badgeW, 14, 4);
    ctx.fill();
    ctx.font = `700 8px ${fontFamily}`;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, pad + 5, pad + 7);
    tx += badgeW + 6;
  }
  if (title && tx < w - pad - 4) {
    drawTextLines(ctx, title, tx, pad + 1, Math.max(4, w - pad - tx), 15, 10, 12, fontFamily, ink || muted);
  }
  return pad + 18;
}

export function richPreviewSignature(item = {}) {
  const kind = item.runtimeRole ? `runtime:${item.runtimeRole}` : item.kind;
  const parts = [kind, item.brush || '', item.format || '', item.color || '', item.fill || '', item.cornerStyle || ''];
  if (kind === 'note') parts.push(item.text || '');
  else if (kind === 'table') parts.push(item.filename || '', (item.columns || []).join(','), (item.rows || []).slice(0, 5).map((r) => (r || []).slice(0, 5).join(',')).join(';'));
  else if (kind === 'chart') parts.push(item.chartType || '', item.chartTitle || item.title || '', (item.columns || []).join(','), (item.rows || []).slice(0, 8).map((r) => (r || []).join(',')).join(';'));
  else if (kind === 'link') parts.push(item.mediaType || '', item.title || '', item.url || '');
  else if (kind === 'pdf') parts.push(item.filename || item.title || '', item.pdfPage || 1);
  else if (kind === 'question') parts.push(item.questionType || '', item.questionPrompt || '', (item.questionOptions || []).slice(0, 4).join(','));
  else if (kind === 'value') parts.push(item.title || '', item.valueType || '', item.valueNumber ?? '', item.valueText || '');
  else if (kind === 'project') parts.push(item.title || '', Array.isArray(item.issues) ? item.issues.length : 0);
  else if (kind === 'user-group') parts.push(item.groupTitle || item.title || '', Array.isArray(item.members) ? item.members.length : 0);
  else if (kind === 'math') parts.push(contentSource(item));
  else if (kind.startsWith('runtime:')) parts.push(item.title || '', item.filename || '', item.text || '', item.code || '', item.runtimeState?.status || '');
  return parts.join('|');
}

export function drawRichOverview(ctx, item, world, textAppearance = {}, imagePreview = null) {
  const src = item.__overviewItem || item;
  const kind = item.__overviewKind || (src.runtimeRole ? `runtime:${src.runtimeRole}` : src.kind);
  const w = Math.max(1, (Number(item.width) || 0.2) * world.width);
  const h = Math.max(1, (Number(item.height) || 0.14) * world.height);
  const fontFamily = textAppearance.font || 'sans-serif';
  const codeFont = textAppearance.codeFont || 'monospace';
  const palette = previewPalette(kind, src);
  const defaultRadius = kind === 'note' ? 2 : 10;
  const { styled, ink } = drawRoundedFillAndStroke(ctx, w, h, defaultRadius, src, palette);
  const pad = Math.max(4, Math.min(10, Math.min(w, h) * 0.07));

  if (kind === 'note') {
    if (!styled) {
      const fold = Math.min(18, Math.min(w, h) * 0.16);
      ctx.save();
      ctx.fillStyle = '#00000014';
      ctx.beginPath();
      ctx.moveTo(w - fold, 0);
      ctx.lineTo(w, fold);
      ctx.lineTo(w - fold, fold);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    const text = String(src.text || '').replace(/^#+\s*/gm, '');
    drawTextLines(ctx, text || '메모', pad, pad + 4, w - pad * 2 - 8, h - pad * 2 - 4, 11, 15, fontFamily, ink);
    return;
  }

  if (kind === 'table') {
    drawTableOverview(ctx, src, w, h, pad, palette, fontFamily, ink);
    return;
  }

  if (kind === 'chart') {
    const headerY = drawHeadingBar(ctx, 'CHART', src.chartTitle || src.title || '', w, pad, CHART_COLORS[0], ink, palette.muted, fontFamily);
    drawChartOverview(ctx, src, w, h, pad, headerY, fontFamily, ink, palette.muted);
    return;
  }

  if (kind === 'link') {
    const mediaType = src.mediaType || 'link';
    const badgeMap = { youtube: ['YT', '#dc2626'], video: ['VID', '#2563eb'], gif: ['GIF', '#7c3aed'], link: ['LINK', '#0d9488'] };
    const [badge, badgeColor] = badgeMap[mediaType] || badgeMap.link;
    if (imagePreview) {
      const top = drawHeadingBar(ctx, badge, src.title || '', w, pad, badgeColor, ink, palette.muted, fontFamily);
      const boxH = Math.max(4, h - top - pad);
      const boxW = Math.max(4, w - pad * 2);
      const ratio = Math.min(boxW / imagePreview.width, boxH / imagePreview.height);
      const dw = imagePreview.width * ratio;
      const dh = imagePreview.height * ratio;
      ctx.drawImage(imagePreview, pad + (boxW - dw) / 2, top + (boxH - dh) / 2, dw, dh);
      return;
    }
    const top = drawHeadingBar(ctx, badge, src.title || src.url || 'Link', w, pad, badgeColor, ink, palette.muted, fontFamily);
    drawTextLines(ctx, src.url || src.title || '', pad, top, w - pad * 2, h - top - pad, 9, 13, fontFamily, palette.muted);
    return;
  }

  if (kind === 'pdf') {
    const label = `${src.filename || src.title || '문서'} · p.${Math.max(1, Number(src.pdfPage) || 1)}`;
    const top = drawHeadingBar(ctx, 'PDF', label, w, pad, '#c25148', ink, palette.muted, fontFamily);
    ctx.save();
    ctx.fillStyle = palette.border;
    for (let y = top + 2; y < h - pad - 4; y += 9) {
      ctx.fillRect(pad, y, Math.max(8, (w - pad * 2) * (0.55 + ((y * 7) % 4) * 0.1)), 3);
    }
    ctx.restore();
    return;
  }

  if (kind === 'question') {
    const kicker = src.questionType === 'choice' ? '객관식' : '주관식';
    const top = drawHeadingBar(ctx, kicker, '', w, pad, palette.accent, ink, palette.muted, fontFamily);
    const promptH = Math.max(14, (h - top - pad) * 0.45);
    drawTextLines(ctx, src.questionPrompt || '문제', pad, top, w - pad * 2, promptH, 10, 13, fontFamily, ink);
    const opts = Array.isArray(src.questionOptions) ? src.questionOptions : [];
    const optText = opts.slice(0, 3).map((opt) => `○ ${opt}`).join('\n');
    if (optText) drawTextLines(ctx, optText, pad, top + promptH + 2, w - pad * 2, h - top - promptH - pad - 2, 9, 12, fontFamily, palette.muted);
    return;
  }

  if (kind === 'value') {
    const valStr = src.valueType === 'discrete' ? String(src.valueText || src.valueOptions?.[0] || '') : String(src.valueNumber ?? 0);
    const top = drawHeadingBar(ctx, valStr, src.title || '값', w, pad, palette.accent, ink, palette.muted, fontFamily);
    const barY = Math.min(h - pad - 4, top + (h - top - pad) * 0.45);
    const min = Number(src.valueMin) || 0;
    const max = Number(src.valueMax) || 100;
    const ratio = max > min ? Math.max(0, Math.min(1, ((Number(src.valueNumber) || 0) - min) / (max - min))) : 0.5;
    ctx.fillStyle = palette.border;
    ctx.fillRect(pad, barY, Math.max(4, w - pad * 2), 4);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(pad, barY, Math.max(4, (w - pad * 2) * ratio), 4);
    return;
  }

  if (kind === 'project') {
    const top = drawHeadingBar(ctx, 'BOARD', src.title || '프로젝트', w, pad, palette.accent, ink, palette.muted, fontFamily);
    const colW = Math.max(6, (w - pad * 2 - 8) / 3);
    const colH = Math.max(6, h - top - pad);
    for (let i = 0; i < 3; i++) {
      const cx = pad + i * (colW + 4);
      ctx.fillStyle = palette.border + '55';
      ctx.fillRect(cx, top, colW, colH);
      ctx.fillStyle = palette.bg;
      for (let card = 0; card < 2 && top + 6 + card * 14 + 8 < h - pad; card++) {
        ctx.fillRect(cx + 3, top + 5 + card * 14, Math.max(2, colW - 6), 9);
      }
    }
    return;
  }

  if (kind === 'user-group') {
    const top = drawHeadingBar(ctx, 'GROUP', src.groupTitle || src.title || '그룹', w, pad, palette.accent, ink, palette.muted, fontFamily);
    drawTextLines(ctx, `${Array.isArray(src.members) ? `${src.members.length}명` : ''}`, pad, top, w - pad * 2, h - top - pad, 9, 12, fontFamily, palette.muted);
    return;
  }

  if (kind === 'runtime:terminal') {
    const top = drawHeadingBar(ctx, 'TERM', src.title || 'Terminal', w, pad, '#38bdf8', palette.ink, palette.muted, codeFont);
    drawTextLines(ctx, src.text || '$ ready', pad, top, w - pad * 2, h - top - pad, 9, 12, codeFont, palette.muted);
    return;
  }

  if (kind.startsWith('runtime:')) {
    const roleLabel = kind.slice('runtime:'.length).toUpperCase().slice(0, 6);
    const top = drawHeadingBar(ctx, roleLabel, src.title || src.filename || '', w, pad, palette.accent, ink, palette.muted, fontFamily);
    drawTextLines(ctx, src.code || src.text || src.runtimeState?.status || '', pad, top, w - pad * 2, h - top - pad, 9, 12, codeFont, palette.muted);
    return;
  }

  drawTextLines(ctx, contentSource(src) || src.title || '', pad, pad, w - pad * 2, h - pad * 2, 10, 14, fontFamily, ink);
}
