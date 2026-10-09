import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './canvas-management-dialog.css';

export default function CanvasManagementDialog({ titleId, onClose, children, theme = 'light' }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const node = dialog.current;
    node.showModal();
    return () => {
      node.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(<dialog ref={dialog} className="modal-card settings-dialog canvas-management-dialog" data-theme={theme} role="dialog" aria-modal="true" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => event.stopPropagation()}
    onMouseDown={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>{children}</dialog>, document.body);
}
