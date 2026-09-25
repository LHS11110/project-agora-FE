import { useState } from 'react';
import MarkdownText from './MarkdownText.jsx';
import './editable-table.css';

export default function EditableTable({ item, onChange }) {
  const [editingCell, setEditingCell] = useState(null);
  const columns = Array.isArray(item.columns) ? item.columns : [];
  const rows = Array.isArray(item.rows) ? item.rows : [];

  const changeColumn = (columnIndex, value) => onChange({ kind: 'column', columnIndex }, value);
  const changeCell = (rowIndex, columnIndex, value) => onChange({ kind: 'cell', rowIndex, columnIndex }, value);

  return <div className="table-scroll-area">
    <table className="canvas-data-table">
      <thead><tr>
        <th className="table-row-index-heading" scope="col">#</th>
        {columns.map((column, columnIndex) => {
          const isEditing = editingCell?.kind === 'column' && editingCell.columnIndex === columnIndex;
          return <th key={`column-${columnIndex}`} scope="col" onDoubleClick={() => setEditingCell({ kind: 'column', columnIndex })} title="두 번 클릭해 컬럼 이름 편집">
            {isEditing
              ? <input autoFocus aria-label={`컬럼 ${columnIndex + 1} 이름`} value={column} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => changeColumn(columnIndex, event.target.value)} onBlur={() => setEditingCell(null)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); setEditingCell(null); } }} />
              : <div className="table-markdown-content">{column ? <MarkdownText source={column} /> : <span className="table-cell-placeholder">컬럼 이름</span>}</div>}
          </th>;
        })}
      </tr></thead>
      <tbody>
        {rows.map((row, rowIndex) => <tr key={`row-${rowIndex}`}>
          <th className="table-row-index" scope="row">{rowIndex + 1}</th>
          {columns.map((_, columnIndex) => {
            const value = String(row?.[columnIndex] ?? '');
            const isEditing = editingCell?.kind === 'cell' && editingCell.rowIndex === rowIndex && editingCell.columnIndex === columnIndex;
            return <td key={`cell-${rowIndex}-${columnIndex}`} onDoubleClick={() => setEditingCell({ kind: 'cell', rowIndex, columnIndex })} title="두 번 클릭해 Markdown 셀 편집">
              {isEditing
                ? <textarea autoFocus aria-label={`${rowIndex + 1}행 ${columnIndex + 1}열`} value={value} placeholder="Markdown 텍스트" onPointerDown={(event) => event.stopPropagation()} onChange={(event) => changeCell(rowIndex, columnIndex, event.target.value)} onBlur={() => setEditingCell(null)} onKeyDown={(event) => { if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) { event.preventDefault(); setEditingCell(null); } }} />
                : <div className="table-markdown-content">{value ? <MarkdownText source={value} /> : <span className="table-cell-placeholder">두 번 클릭해 작성</span>}</div>}
            </td>;
          })}
        </tr>)}
      </tbody>
    </table>
  </div>;
}
