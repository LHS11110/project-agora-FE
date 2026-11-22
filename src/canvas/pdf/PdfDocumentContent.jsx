import {canvasFetch} from '../../api/client.js';
import {useCanvasGraphics} from '../CanvasGraphicsContext.jsx';
import {graphicsDocumentRatio} from '../graphicsQuality.js';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../../api/client.js';
import './pdf-object.css';
import { bearer } from '../../state/authSession.js';

// Rendered pages survive unmounts (scrolling out of the render window and back),
// bounded by a pixel budget; the least recently used page is closed first.
const PAGE_CACHE_PIXELS = 24_000_000;
const pageCache = new Map();
let pageCachePixels = 0;
function takeCachedPage(key) {
  const bitmap = pageCache.get(key);
  if (!bitmap) return null;
  pageCache.delete(key); pageCachePixels -= bitmap.width * bitmap.height;
  return bitmap;
}
function storeCachedPage(key, bitmap) {
  const pixels = bitmap.width * bitmap.height;
  if (pixels > PAGE_CACHE_PIXELS) { bitmap.close?.(); return; }
  const previous = takeCachedPage(key);
  if (previous && previous !== bitmap) previous.close?.();
  pageCache.set(key, bitmap); pageCachePixels += pixels;
  for (const [oldKey, old] of pageCache) {
    if (pageCachePixels <= PAGE_CACHE_PIXELS) break;
    pageCache.delete(oldKey); pageCachePixels -= old.width * old.height; old.close?.();
  }
}

export default function PdfDocumentContent({ item, token, interactive, canChangePage=true, onPageChange }) {
  useUiLocale();
  const graphicsQuality=useCanvasGraphics();
  const [pdf, setPdf] = useState(null);
  const pageNumber=Math.max(1,Math.min(Number(item.pdfPage)||1,pdf?.numPages||1000000));
  const [renderedPage, setRenderedPage] = useState(null);
  const [error, setError] = useState(''), [rendering, setRendering] = useState(false), [reload, setReload] = useState(0);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const loading = !error && (!pdf || rendering || renderedPage?.pdf !== pdf || renderedPage?.number !== pageNumber);
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
    let active = true, handle;
    setPdf(null); setError('');
    import('./pdfRuntime.js').then(runtime => {
      if (!active) return;
      if (reload) runtime.forgetCanvasPdf(item.src, token);
      handle = runtime.acquireCanvasPdf(item.src, token);
      return handle.promise.then(document => { if (active) setPdf(document); });
    }).catch(failure => { if (active) setError(failure.name === 'PasswordException' ? '암호로 잠긴 PDF입니다.' : 'PDF를 불러오지 못했습니다. 파일 접근 권한이나 연결 상태를 확인해주세요.'); });
    return () => { active = false; handle?.release(); };
  }, [item.src, token, reload]);
  useEffect(() => {
    if (!pdf || size.width <= 1 || size.height <= 1) return undefined;
    let active = true, renderTask;
    setRendering(true); setError('');
    pdf.getPage(pageNumber).then(page => {
      if (!active) return;
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(size.width / base.width, size.height / base.height);
      const viewport = page.getViewport({ scale });
      const ratio = graphicsDocumentRatio(graphicsQuality,viewport.width,viewport.height,window.devicePixelRatio || 1);
      const cacheKey = `${item.src}|${pageNumber}|${Math.round(viewport.width)}x${Math.round(viewport.height)}@${ratio}`;
      const cached = takeCachedPage(cacheKey);
      if (cached) {
        const target = canvas.current;
        target.width = cached.width; target.height = cached.height;
        target.style.width = `${viewport.width}px`; target.style.height = `${viewport.height}px`;
        target.getContext('2d').drawImage(cached, 0, 0);
        storeCachedPage(cacheKey, cached);
        setRenderedPage({ pdf, number: pageNumber });
        setRendering(false);
        return;
      }
      // A separate canvas makes rapid page changes safe while old tasks cancel.
      const buffer = document.createElement('canvas');
      buffer.width = Math.max(1, Math.ceil(viewport.width * ratio)); buffer.height = Math.max(1, Math.ceil(viewport.height * ratio));
      renderTask = page.render({ canvas: buffer, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      // The staging canvas is a full-resolution duplicate; free its backing store
      // as soon as it is copied or abandoned instead of waiting for GC.
      const releaseBuffer = () => { buffer.width = buffer.height = 1; };
      return renderTask.promise.then(() => {
        if (!active) return;
        const target = canvas.current;
        target.width = buffer.width; target.height = buffer.height;
        target.style.width = `${viewport.width}px`; target.style.height = `${viewport.height}px`;
        target.getContext('2d').drawImage(buffer, 0, 0);
        if (typeof createImageBitmap === 'function') createImageBitmap(buffer).then(bitmap => storeCachedPage(cacheKey, bitmap), () => {});
        setRenderedPage({ pdf, number: pageNumber });
        setRendering(false);
      }).finally(releaseBuffer);
    }).catch(failure => { if (active && failure.name !== 'RenderingCancelledException') { setError('이 페이지를 표시하지 못했습니다.'); setRendering(false); } });
    return () => { active = false; renderTask?.cancel(); };
  }, [pdf, pageNumber, size, graphicsQuality]);
  const download = async () => {
    if (downloadPending.current) return;
    downloadPending.current = true;
    try {
      const response = await canvasFetch(apiUrl(item.src), { headers: token ? { Authorization: bearer(token) } : {} });
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = item.filename || 'document.pdf'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('원본 파일을 내려받지 못했습니다.'); }
    finally { downloadPending.current = false; }
  };
  return <div className="pdf-document">
    <div className="pdf-document-heading"><strong title={item.filename}>PDF · {item.filename || ui("문서")}</strong></div>
    <div className="pdf-page-view" ref={host} aria-busy={loading}>
      <canvas ref={canvas} aria-label={ui("PDF {v0}페이지", {
  v0: pageNumber
})} />
      {error ? <div className="pdf-status" role="alert">{ui(error)}<button data-object-action disabled={!interactive} onClick={() => setReload(value => value + 1)}>{ui("다시 불러오기")}</button></div> : loading && <div className="pdf-status" role="status"><span className="runtime-spinner" aria-hidden="true" />{ui("PDF를 불러오는 중…")}</div>}
    </div>
    <div className="pdf-document-actions" data-object-action onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
      <button disabled={!interactive || !canChangePage || !pdf || pageNumber <= 1} onClick={() => onPageChange?.(pageNumber-1)} aria-label={ui("PDF 이전 페이지")}>‹</button>
      <span>{pageNumber} / {pdf?.numPages || '—'}</span>
      <button disabled={!interactive || !canChangePage || !pdf || pageNumber >= pdf.numPages} onClick={() => onPageChange?.(pageNumber+1)} aria-label={ui("PDF 다음 페이지")}>›</button>
      <button className="pdf-download" disabled={!interactive} onClick={download}>{ui("원본 저장")}</button>
    </div>
  </div>;
}
