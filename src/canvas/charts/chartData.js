export const CHART_TYPES = ['bar', 'line', 'area', 'pie', 'donut', 'scatter'];
export const CHART_COLORS = ['#7558d9', '#e88b63', '#439aa0', '#d6a63a', '#bf6a8f', '#6788c5', '#80a653', '#b178c3', '#ce7559', '#557b93', '#c29b70'];
export const MAX_CHART_ROWS = 100;
export const MAX_CHART_COLUMNS = 12;
export const MAX_CHART_TEXT = 32768;
export const newChartData = () => ({ chartType: 'bar', title: '', columns: ['', ''], rows: [['', '']] });

// Accept pasted CSV or spreadsheet TSV, including quoted separators/newlines.
export function parseChartData(input) {
  const text = String(input ?? '').replace(/^\uFEFF/, '');
  if (text.length > MAX_CHART_TEXT) throw new Error('데이터가 너무 깁니다.');
  if (!text.trim()) return { columns: ['', ''], rows: [['', '']] };
  let inQuotes = false, separator = ',';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') {
      if (inQuotes && text[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && text[i] === '\t') { separator = '\t'; break; }
    else if (!inQuotes && (text[i] === '\n' || text[i] === '\r')) break;
  }
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else cell += ch;
    } else if (ch === '"' && !cell && !closed) quoted = true;
    else if (ch === separator || ch === '\n' || ch === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (ch === '\n' || ch === '\r') { rows.push(row); row = []; if (ch === '\r' && text[i + 1] === '\n') i++; }
    } else if (closed) throw new Error('따옴표 뒤에 구분자가 필요합니다.');
    else cell += ch;
  }
  if (quoted) throw new Error('닫히지 않은 따옴표가 있습니다.');
  if (cell || row.length || !rows.length) { row.push(cell); rows.push(row); }
  if (rows.length > MAX_CHART_ROWS + 1) throw new Error('데이터 행은 최대 100개입니다.');
  const width = Math.max(2, ...rows.map(entry => entry.length));
  if (width > MAX_CHART_COLUMNS) throw new Error('데이터 열은 최대 12개입니다.');
  if (rows.some(entry => entry.some(value => value.length > 1000))) throw new Error('각 셀은 최대 1000자입니다.');
  const normalized = rows.map(entry => Array.from({ length: width }, (_, index) => entry[index] ?? ''));
  return { columns: normalized[0], rows: normalized.slice(1).length ? normalized.slice(1) : [Array(width).fill('')] };
}

export function formatChartData(columns, rows) {
  const escape = value => { const text = String(value ?? ''); return /[",\r\n\t]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };
  return [columns || [], ...(rows || [])].map(row => row.map(escape).join(',')).join('\n');
}

export function chartNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && Math.abs(number) <= 1e12 ? number : null;
}

export function chartDataset(item) {
  const columns = Array.isArray(item?.columns) ? item.columns.slice(0, MAX_CHART_COLUMNS) : [];
  const rows = Array.isArray(item?.rows) ? item.rows.slice(0, MAX_CHART_ROWS) : [];
  return { columns, rows: rows.map(row => columns.map((_, i) => String(row?.[i] ?? ''))) };
}
