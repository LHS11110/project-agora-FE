import { api, apiUrl, canvasFetch } from '../../api/client.js';
import { bearer } from '../../state/authSession.js';
import { importNotebook } from './notebookData.js';

export async function uploadNotebookFile(file, { canvasId, token, canContinue, document }) {
  let notebookCells = null;
  // Keep very large originals out of the browser's JSON parser. They are
  // uploaded as opaque files and can be opened in Jupyter after downloading.
  if (document || file.size <= 64 * 1024 * 1024) {
    const parsed = document ?? JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
    if (parsed?.nbformat !== 4 || !Array.isArray(parsed.cells)) {
      throw Error('올바른 ipynb 파일을 선택하세요.');
    }
    try {
      notebookCells = importNotebook(parsed).notebookCells;
    } catch {
      // Files outside the editable cell budget can still be stored and downloaded.
    }
  }

  const body = new FormData();
  body.append('file', file);
  const { src } = await api(`/api/canvases/${encodeURIComponent(canvasId)}/notebooks`, {
    method: 'POST', body, token, canContinue, requireCanvasTransport: true,
  });
  if (!isNotebookSource(src)) throw Error('노트북 원본을 저장하지 못했습니다.');
  return { src, filename: file.name, notebookCells };
}

export function isNotebookSource(src) {
  return /^\/api\/canvases\/\d+\/notebooks\/[0-9a-f-]{36}\.ipynb$/.test(src || '');
}

export async function fetchNotebookFile(src, token) {
  if (!isNotebookSource(src)) throw Error('노트북 파일 주소가 올바르지 않습니다.');
  const response = await canvasFetch(apiUrl(src), { headers: token ? { Authorization: bearer(token) } : {} });
  if (!response.ok) throw Error('노트북 원본을 불러오지 못했습니다.');
  return response.blob();
}
