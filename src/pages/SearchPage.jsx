import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from '../routing.jsx';
import Icon from '../components/Icon.jsx';
import AuthenticatedImage from '../components/AuthenticatedImage.jsx';
import { api } from '../api/client.js';
import { useAuth } from '../state/AuthContext.jsx';

const palette = ['lavender', 'mint', 'peach', 'blue'];

function CanvasPreview({ index, canvas, token }) {
  const artwork = <><span className="preview-note note-one">{index % 2 ? 'start here' : '아이디어를 모아봐요'}</span><span className="preview-note note-two">{index % 2 ? '→ make it real' : 'what if?'}</span><div className="preview-loop" /><div className="preview-sun" /></>;
  return <div className={`canvas-preview preview-${palette[index % palette.length]}`}><div className="preview-toolbar"><span className="preview-dot" /><span className="preview-dot" /><span className="preview-dot" /><i>{canvas.canvas_name || '새로운 생각'}</i></div><div className={`preview-art${canvas.image ? ' has-cover' : ''}`}>{canvas.image ? <AuthenticatedImage src={canvas.image} token={token} alt={`${canvas.canvas_name || '캔버스'} 대표 이미지`} fallback={artwork} loadingFallback={artwork} /> : artwork}</div><div className="preview-bottom"><span>FRELOG CANVAS</span><span>↗</span></div></div>;
}

function CreateCanvasDialog({ onClose, onCreated }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ canvasName: '', description: '', canvasPassword: '' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!imageFile) { setImagePreview(''); return undefined; }
    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);
  const selectImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) { setImageFile(null); return; }
    setError('');
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setImageFile(null);
      setError('대표 이미지는 PNG 또는 JPEG 파일만 사용할 수 있어요.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageFile(null);
      setError('대표 이미지는 5MB 이하로 선택해주세요.');
      event.target.value = '';
      return;
    }
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file);
        const tooLarge = bitmap.width > 2048 || bitmap.height > 2048;
        bitmap.close();
        if (tooLarge) {
          setImageFile(null);
          setError('대표 이미지의 가로와 세로는 각각 2048px 이하여야 해요.');
          event.target.value = '';
          return;
        }
      } catch {
        setImageFile(null);
        setError('이미지 파일을 읽을 수 없어요. PNG 또는 JPEG를 다시 선택해주세요.');
        event.target.value = '';
        return;
      }
    }
    setImageFile(file);
  };
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      let body = form;
      if (imageFile) {
        body = new FormData();
        body.append('canvasName', form.canvasName);
        if (form.description) body.append('description', form.description);
        if (form.canvasPassword) body.append('canvasPassword', form.canvasPassword);
        body.append('image', imageFile);
      }
      const created = await api('/api/canvases', { method: 'POST', token, body });
      onCreated(created);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-card create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title"><button className="icon-button modal-close" onClick={onClose} aria-label="닫기"><Icon name="close" /></button><span className="section-kicker">A FRESH SPACE</span><h2 id="create-title">새 캔버스를 열어요.</h2><p>함께 나눌 생각의 이름을 붙여주세요.</p><form className="modal-form" onSubmit={submit}><label className="form-field"><span>캔버스 이름</span><input className="plain-input" maxLength={255} placeholder="예: 봄 캠페인 아이디어" value={form.canvasName} onChange={(e) => setForm({ ...form, canvasName: e.target.value })} required /></label><label className="form-field"><span>한 줄 설명 <small>선택</small></span><textarea className="plain-input" rows="3" maxLength={4000} placeholder="어떤 이야기를 나눌까요?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label className="form-field"><span>대표 이미지 <small>선택 · PNG/JPEG, 5MB 이하, 최대 2048px</small></span><input className="plain-input canvas-image-file" type="file" accept="image/png,image/jpeg" onChange={selectImage} />{imagePreview && <div className="canvas-image-upload-preview"><img src={imagePreview} alt="선택한 대표 이미지 미리보기" /><button className="button button-outline" type="button" onClick={() => { setImageFile(null); setError(''); }}>이미지 제거</button></div>}</label><label className="form-field"><span>캔버스 비밀번호 <small>선택</small></span><input className="plain-input" type="password" placeholder="선택 사항 · 캔버스를 한 번 더 보호해요" value={form.canvasPassword} onChange={(e) => setForm({ ...form, canvasPassword: e.target.value })} /></label>{error && <div className="form-error">{error}</div>}<button className="button button-dark button-submit" disabled={busy}>{busy ? '캔버스를 만드는 중…' : '캔버스 만들기'} <Icon name="arrow" size={17} /></button></form></section></div>;
}

export default function SearchPage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [canvases, setCanvases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const load = useCallback(async (name = '') => {
    setLoading(true); setError('');
    try {
      const path = name.trim() ? `/api/canvases/search?name=${encodeURIComponent(name.trim())}` : '/api/canvases';
      const result = await api(path, { token });
      setCanvases(Array.isArray(result) ? result : []);
    } catch (err) {
      if (err.status === 401) {
        logout();
        navigate('/login', { replace: true, state: { from: '/search', sessionExpired: true } });
        return;
      }
      setError(err.message);
    }
    finally { setLoading(false); }
  }, [logout, navigate, token]);
  useEffect(() => { load(); }, [load]);
  const search = (event) => { event.preventDefault(); load(query); };
  const created = (canvas) => { setShowCreate(false); navigate(`/canvases/${canvas.canvas_id}`); };

  return <main className="content-page search-page">
    <div className="page-topline"><span className="section-kicker">YOUR IDEAS, TOGETHER</span><span className="breadcrumbs">워크스페이스 <b>/</b> 캔버스 탐색</span></div>
    <section className="search-hero"><div className="search-hero-copy"><span className="search-welcome"><i /> 좋은 생각은 어디서 시작될까요?</span><h1>다음 이야기를<br /><em>함께 그려봐요.</em></h1><p>팀의 생각이 모이는 캔버스를 찾아보세요.<br />새로운 공간을 만들어도 좋아요.</p></div><div className="search-orbit-art"><div className="search-art-sheet"><span className="sheet-tiny-label">IDEA BOARD / 01</span><span className="sheet-note">start with<br /><strong>one idea.</strong></span><span className="sheet-stroke">〰</span><span className="sheet-spark">✳</span><span className="sheet-tag">you + me</span></div><span className="search-art-shadow" /></div><button className="button button-cream search-hero-create" onClick={() => setShowCreate(true)}><Icon name="plus" size={18} /> 새 캔버스 만들기</button></section>
    <section className="canvas-library"><div className="library-heading"><div><span className="section-kicker">CANVAS LIBRARY</span><h2>함께하는 캔버스 <span>{canvases.length}</span></h2></div><div className="library-actions"><form className="search-field" onSubmit={search}><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="캔버스 이름 검색" aria-label="캔버스 이름 검색" /><button type="submit">검색</button></form><button className="button button-outline create-inline" onClick={() => setShowCreate(true)}><Icon name="plus" size={17} /> 새 캔버스</button></div></div>
      {loading ? <div className="loading-state"><span className="loader" /> 캔버스를 불러오고 있어요.</div> : error ? <div className="empty-state error-state"><span className="empty-icon"><Icon name="grid" size={23} /></span><h3>캔버스를 불러오지 못했어요.</h3><p>{error}</p><button className="button button-outline" onClick={() => load(query)}>다시 시도</button></div> : canvases.length ? <div className="canvas-grid">{canvases.map((canvas, index) => <Link to={`/canvases/${canvas.canvas_id}`} className="canvas-card" key={canvas.canvas_id}><CanvasPreview index={index} canvas={canvas} token={token} /><div className="canvas-card-copy"><div><h3>{canvas.canvas_name || '이름 없는 캔버스'}</h3><p>{canvas.description || '함께 아이디어를 만들어가는 공간'}</p></div><span className="round-arrow" aria-hidden="true"><Icon name="arrow" size={17} /></span></div><div className="canvas-card-meta"><span className="member-pile"><i>나</i><i>✦</i></span><span>참여자 {canvas.user_count ?? 0}명</span><span className="meta-spacer" /><span className="canvas-open-label">열기 <Icon name="chevron" size={14} /></span></div></Link>)}</div> : <div className="empty-state"><span className="empty-icon"><Icon name="grid" size={23} /></span><h3>{query ? '검색 결과가 없어요.' : '아직 캔버스가 없어요.'}</h3><p>{query ? '다른 이름으로 검색하거나 새 캔버스를 만들어보세요.' : '첫 번째 캔버스를 열고 생각을 모아보세요.'}</p><button className="button button-dark" onClick={() => setShowCreate(true)}><Icon name="plus" size={17} /> 새 캔버스 만들기</button></div>}
    </section>
    <section className="search-bottom-note"><span className="note-icon"><Icon name="sparkle" size={17} /></span><span><strong>생각을 함께 펼쳐보세요.</strong><small>초대된 멤버들과 같은 캔버스에서 실시간으로 만들 수 있어요.</small></span><Icon name="arrow" size={17} /></section>
    {showCreate && <CreateCanvasDialog onClose={() => setShowCreate(false)} onCreated={created} />}
  </main>;
}
