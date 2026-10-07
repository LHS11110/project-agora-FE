import { useEffect, useRef, useState } from 'react';
import { copyCode } from './copyCode.js';

export default function CodeCopyButton({ value }) {
  const [status, setStatus] = useState('');
  const timer = useRef(0), busy = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); }; }, []);
  const copy = async event => {
    event.stopPropagation();
    if (busy.current) return;
    busy.current = true;
    let next;
    try { await copyCode(value); next = '복사됨'; } catch { next = '복사 실패'; }
    busy.current = false;
    if (!mounted.current) return;
    setStatus(next); clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(''), 2000);
  };
  return <button type="button" className="code-copy-button" data-object-action="copy" aria-label="코드 복사" onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onClick={copy}>
    <span aria-live="polite">{status || '복사'}</span>
  </button>;
}
