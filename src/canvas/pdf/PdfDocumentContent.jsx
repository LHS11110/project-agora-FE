import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../../api/client.js';
import './pdf-object.css';

export default function PdfDocumentContent({ item, token, interactive }) {
  const [pdf, setPdf] = useState(null), [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState(''), [rendering, setRendering] = useState(false), [reload, setReload] = useState(0);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const host = useRef(null), canvas = useRef(null), downloadPending = useRef(false);
  useEffect(() => {
    const node = host.current;
    const measure = () => setSize(previous => {
      const width = Math.max(1, node.clientWidth - 16), height = Math.max(1, node.clientHeight - 16);
      return previous.width === width && previous.height === height ? previous : { width, height };
    });
    const observer = new ResizeObserver(measure); observer.observe(node); measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true, task;
    setPdf(null); setError(''); setPageNumber(1);
    import('./pdfRuntime.js').then(runtime => {
      if (!active) return;
      task = runtime.loadCanvasPdf(item.src, token);
      return task.promise.then(document => { if (active) setPdf(document); });
    }).catch(failure => { if (active) setError(failure.name === 'PasswordException' ? '암호로 잠긴 PDF입니다.' : 'PDF를 불러오지 못했습니다. 파일 접근 권한이나 연결 상태를 확인해주세요.'); });
    return () => { active = false; if (task) void task.destroy(); };
  }, [item.src, token, reload]);
  useEffect(() => {
    if (!pdf || size.width <= 1 || size.height <= 1) return undefined;
    let active = true, renderTask;
    setRendering(true); setError('');
    pdf.getPage(pageNumber).then(page => {
      if (!active) return;
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(size.width / base.width, size.height / base.height);
      const ratio = Math.min(2, window.devicePixelRatio || 1, 2048 / Math.max(size.width, size.height));
      const viewport = page.getViewport({ scale });
      // A separate canvas makes rapid page changes safe while old tasks cancel.
      const buffer = document.createElement('canvas');
      buffer.width = Math.max(1, Math.ceil(viewport.width * ratio)); buffer.height = Math.max(1, Math.ceil(viewport.height * ratio));
      renderTask = page.render({ canvas: buffer, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      return renderTask.promise.then(() => {
        if (!active) return;
        const target = canvas.current;
        target.width = buffer.width; target.height = buffer.height;
        target.style.width = `${viewport.width}px`; target.style.height = `${viewport.height}px`;
        target.getContext('2d').drawImage(buffer, 0, 0); setRendering(false);
      });
    }).catch(failure => { if (active && failure.name !== 'RenderingCancelledException') { setError('이 페이지를 표시하지 못했습니다.'); setRendering(false); } });
    return () => { active = false; renderTask?.cancel(); };
  }, [pdf, pageNumber, size]);
  const download = async () => {
    if (downloadPending.current) return;
    downloadPending.current = true;
    try {
      const response = await fetch(apiUrl(item.src), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = item.filename || 'document.pdf'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('원본 파일을 내려받지 못했습니다.'); }
    finally { downloadPending.current = false; }
  };
  return <div className="pdf-document">
    <div className="pdf-document-heading"><strong title={item.filename}>PDF · {item.filename || '문서'}</strong></div>
    <div className="pdf-page-view" ref={host} aria-busy={!pdf || rendering}>
      <canvas ref={canvas} aria-label={`PDF ${pageNumber}페이지`} />
      {error ? <div className="pdf-status" role="alert">{error}<button data-object-action disabled={!interactive} onClick={() => setReload(value => value + 1)}>다시 불러오기</button></div> : (!pdf || rendering) && <div className="pdf-status" role="status">PDF를 불러오는 중…</div>}
    </div>
    <div className="pdf-document-actions" data-object-action onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
      <button disabled={!interactive || !pdf || pageNumber <= 1} onClick={() => setPageNumber(value => value - 1)} aria-label="PDF 이전 페이지">‹</button>
      <span>{pageNumber} / {pdf?.numPages || '—'}</span>
      <button disabled={!interactive || !pdf || pageNumber >= pdf.numPages} onClick={() => setPageNumber(value => value + 1)} aria-label="PDF 다음 페이지">›</button>
      <button className="pdf-download" disabled={!interactive || !pdf} onClick={download}>원본 저장</button>
    </div>
  </div>;
}
