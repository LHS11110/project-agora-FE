import { useState } from 'react';
import Icon from './Icon.jsx';
import { inspectShareUrl } from './shareMedia.js';

export default function ShareComposer({ onCancel, onSubmit }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const preview = inspectShareUrl(url);

  const submit = (event) => {
    event.preventDefault();
    if (!preview) return;
    onSubmit({ ...preview, title: title.trim() || preview.defaultTitle });
  };

  const description = preview?.mediaType === 'youtube'
    ? 'YouTube 플레이어로 캔버스에서 재생합니다.'
    : preview?.mediaType === 'video'
      ? '동영상 플레이어로 캔버스에서 재생합니다.'
      : preview?.mediaType === 'link'
        ? '링크 카드를 눌러 새 탭에서 엽니다.'
        : 'YouTube 주소, 동영상 파일 주소 또는 웹 링크를 입력하세요.';

  return <div className="share-composer-backdrop" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <form className="share-composer" role="dialog" aria-modal="true" aria-labelledby="share-composer-title" onSubmit={submit}>
      <div className="share-composer-heading"><span className="share-composer-icon"><Icon name="link" size={17} /></span><div><strong id="share-composer-title">동영상 또는 링크 공유</strong><small>캔버스 위치에 자료를 추가합니다.</small></div><button type="button" className="share-composer-close" onClick={onCancel} aria-label="닫기"><Icon name="close" size={15} /></button></div>
      <label className="share-composer-field"><span>주소</span><input autoFocus type="text" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck="false" maxLength="2048" placeholder="https://youtu.be/... 또는 example.com" value={url} onChange={(event) => setUrl(event.target.value)} aria-label="동영상 또는 링크 주소" /></label>
      <label className="share-composer-field"><span>표시 이름 <small>선택</small></span><input type="text" maxLength="100" placeholder={preview?.defaultTitle || '주소를 입력하면 자동으로 정해집니다'} value={title} onChange={(event) => setTitle(event.target.value)} aria-label="표시 이름" /></label>
      <p className={`share-composer-hint${url && !preview ? ' invalid' : ''}`} role="status">{description}</p>
      <div className="share-composer-actions"><button type="button" onClick={onCancel}>취소</button><button type="submit" disabled={!preview}>캔버스에 추가 <Icon name="arrow" size={13} /></button></div>
    </form>
  </div>;
}
