import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { apiUrl } from '../../api/client.js';

GlobalWorkerOptions.workerSrc = workerUrl;
const options = { cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/', iccUrl: '/pdfjs/iccs/', isEvalSupported: false };
export function loadPdfBytes(bytes) { return getDocument({ ...options, data: bytes }); }
export function loadCanvasPdf(src, token) {
  if (!/^\/api\/canvases\/\d+\/pdfs\/[0-9a-f-]{36}$/.test(src || '')) throw new Error('PDF 파일 주소가 올바르지 않습니다.');
  return getDocument({ ...options, url: apiUrl(src), httpHeaders: token ? { Authorization: `Bearer ${token}` } : {}, disableRange: true, disableStream: true });
}
export function pdfErrorMessage(error) {
  if (error?.name === 'PasswordException') return '암호로 잠긴 PDF입니다. 암호를 해제한 파일을 업로드해주세요.';
  return error?.message || 'PDF를 읽지 못했습니다.';
}
export async function pdfThumbnail(file) {
  const task = loadPdfBytes(new Uint8Array(await file.arrayBuffer()));
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(1, 640 / Math.max(base.width, base.height)) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width)); canvas.height = Math.max(1, Math.ceil(viewport.height));
    await page.render({ canvas, viewport }).promise;
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PDF 미리보기를 만들지 못했습니다.')), 'image/png'));
  } finally { await task.destroy(); }
}
