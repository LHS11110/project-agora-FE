import { useRef } from 'react';
import './editing-surface.css';

/** Keep the last rendered layout while a source editor occupies the same box.
 * Reusing the preview element also avoids Markdown/MathJax work per keystroke.
 */
export default function EditingSurface({ editing, renderPreview, children, className = '' }) {
  const preview = useRef(null);
  if (!editing || preview.current === null) preview.current = renderPreview();
  return <div className={`editing-surface${editing ? ' is-editing' : ''} ${className}`.trim()}>
    <div className="editing-surface-preview" aria-hidden={editing || undefined} inert={editing ? '' : undefined}>{preview.current}</div>
    {editing && <div className="editing-surface-editor">{children}</div>}
  </div>;
}
