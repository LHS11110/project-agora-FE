export const DEFAULT_TABLE_ROWS = 3;
export const DEFAULT_TABLE_COLUMNS = 3;
export const MAX_TABLE_ROWS = 100;
export const MAX_TABLE_COLUMNS = 30;

export function normalizeTableCount(value, limit) {
  const count = Math.round(Number(value));
  return Number.isFinite(count) ? Math.max(1, Math.min(limit, count)) : 1;
}

export function createTableData(rowCount = DEFAULT_TABLE_ROWS, columnCount = DEFAULT_TABLE_COLUMNS) {
  const rows = normalizeTableCount(rowCount, MAX_TABLE_ROWS);
  const columns = normalizeTableCount(columnCount, MAX_TABLE_COLUMNS);
  return {
    columns: Array.from({ length: columns }, (_, index) => `컬럼 ${index + 1}`),
    rows: Array.from({ length: rows }, () => Array.from({ length: columns }, () => '')),
  };
}

export function resizeTableData(item, rowCount, columnCount) {
  const oldColumns = Array.isArray(item?.columns) ? item.columns : [];
  const oldRows = Array.isArray(item?.rows) ? item.rows : [];
  const rows = normalizeTableCount(rowCount, MAX_TABLE_ROWS);
  const columns = normalizeTableCount(columnCount, MAX_TABLE_COLUMNS);
  return {
    ...item,
    columns: Array.from({ length: columns }, (_, index) => oldColumns[index] ?? `컬럼 ${index + 1}`),
    rows: Array.from({ length: rows }, (_, rowIndex) => Array.from({ length: columns }, (_, columnIndex) => oldRows[rowIndex]?.[columnIndex] ?? '')),
  };
}

export function updateTableValue(item, location, value) {
  if (location.kind === 'column') {
    const columns = Array.isArray(item.columns) ? [...item.columns] : [];
    columns[location.columnIndex] = value;
    return { ...item, columns };
  }
  const rows = Array.isArray(item.rows) ? item.rows.map((row) => [...row]) : [];
  if (!Array.isArray(rows[location.rowIndex])) rows[location.rowIndex] = [];
  rows[location.rowIndex][location.columnIndex] = value;
  return { ...item, rows };
}
