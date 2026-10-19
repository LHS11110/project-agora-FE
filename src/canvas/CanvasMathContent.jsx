import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { useEditingBoundary } from './useEditingBoundary.js';
import { useEffect, useRef, useState } from 'react';
import MathFormula from '../components/MathFormula.jsx';
import './math-editor.css';

/** Edit the formula in its canvas object; display typeset math when editing finishes. */
export default function CanvasMathContent({ id, item, editing, onFormulaChange, onStopEditing }) {
  useUiLocale();
  const formula = String(item.formula ?? item.text ?? '');
  const [draft, setDraft] = useState(formula);
  const cancelRef = useRef(false);
  useEffect(() => {
    setDraft(formula);
    cancelRef.current = false;
  }, [formula, editing]);
  const boundary = useEditingBoundary(editing, () => {
    if (!cancelRef.current) onFormulaChange(id, draft);
    onStopEditing(id);
  });
  if (!editing) return <span className="math-formula-preview" title={ui("두 번 클릭해 수식 편집")}>
    {formula.trim() ? <MathFormula formula={formula} /> : <span className="math-formula-placeholder">{ui("두 번 클릭해 수식 작성")}</span>}
  </span>;
  return <input ref={boundary.ref} className="math-formula-input" autoFocus aria-label={ui("수식 편집")} placeholder={ui("예: f(x) = x^2 + 2x + 1")}
    value={draft} onPointerDown={event => event.stopPropagation()} onChange={event => setDraft(event.target.value)}
    onBlur={boundary.onBlur} onKeyDown={event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        cancelRef.current = true;
        onStopEditing(id);
      } else if (event.key === 'Enter' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's')) {
        event.preventDefault(); event.stopPropagation();
        cancelRef.current = true;
        onFormulaChange(id, event.currentTarget.value);
        onStopEditing(id);
      }
    }} />;
}
