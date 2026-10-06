import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import AuthenticatedImage from '../AuthenticatedImage.jsx';
import './canvas-cover-editor.css';

export default function CanvasCoverEditor({ canvasId, image, token, onSaved }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const choose = event => {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    if (!['image/png', 'image/jpeg'].includes(selected.type)) { setMessage('PNG 또는 JPEG 이미지를 선택하세요.'); return; }
    if (selected.size > 5 * 1024 * 1024) { setMessage('이미지는 5MB 이하로 선택하세요.'); return; }
    setFile(selected); setMessage('');
  };
  const save = async () => {
    if (!file || pending) return;
    setPending(true); setMessage('');
    try {
      const body = new FormData(); body.append('image', file);
      const result = await api(`/api/canvases/${canvasId}/image`, { method: 'POST', body, token });
      onSaved(`${result.image}?v=${Date.now()}`);
      setFile(null); setMessage('대표 이미지를 변경했어요.');
    } catch (error) { setMessage(error.message || '이미지를 변경하지 못했어요.'); }
    finally { setPending(false); }
  };
  return <section className="form-field canvas-cover-editor" aria-label="대표 이미지 변경">
    <span>대표 이미지</span>
    <div className="canvas-cover-editor-row">
      <AuthenticatedImage className="canvas-cover-editor-preview" src={preview || image} token={token} alt="대표 이미지 미리보기" fallback={<div className="canvas-cover-editor-placeholder">이미지 없음</div>} />
      <div><label className="button button-outline canvas-cover-file">이미지 선택<input type="file" accept="image/png,image/jpeg" aria-label="대표 이미지 선택" disabled={pending} onChange={choose} /></label>
        <p>PNG·JPEG · 최대 5MB · 최대 2048×2048<br />캔버스 관리자만 변경할 수 있어요.</p>
        {file && <small className="canvas-cover-filename">{file.name}</small>}
      </div>
      <button type="button" className="button button-dark" disabled={!file || pending} onClick={save}>{pending ? '저장 중…' : '이미지 저장'}</button>
    </div>
    {message && <p className="field-hint" role="status">{message}</p>}
  </section>;
}
